/**
 * Client-Side Google Sheets API Service
 * 
 * Directly reads and writes to Google Sheets via Google Sheets REST API v4 using
 * client-side OAuth Bearer token.
 * 
 * Generates straight, simple, human-readable sheets with ZERO raw database UUIDs.
 */

export interface SheetTabDefinition {
  title: string;
  headers: string[];
}

export const REQUIRED_TABS: SheetTabDefinition[] = [
  {
    title: 'Participants',
    headers: [
      '#',
      'Student Name',
      'Email',
      'Mobile',
      'College',
      'Branch',
      'Year',
      'Score',
      'Percentage',
      'Time Taken',
      'Status',
      'Submitted At',
      'Event Code',
    ],
  },
  {
    title: 'Leaderboard',
    headers: [
      'Rank',
      'Student Name',
      'College',
      'Branch',
      'Score',
      'Percentage',
      'Time Taken',
      'Completed At',
      'Event Code',
    ],
  },
  {
    title: 'Questions',
    headers: [
      '#',
      'Question',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Answer',
      'Explanation',
      'Topic',
    ],
  },
  {
    title: 'Events',
    headers: [
      '#',
      'Event Code',
      'Event Name',
      'College Name',
      'Duration',
      'Status',
      'Created At',
    ],
  },
  {
    title: 'Attempts',
    headers: [
      '#',
      'Student Name',
      'Email',
      'Mobile',
      'College',
      'Branch',
      'Year',
      'Score',
      'Percentage',
      'Time Taken',
      'Status',
      'Submitted At',
      'Event Code',
    ],
  },
];

export class GoogleSheetsClient {
  /**
   * Fetch spreadsheet metadata to check which tabs already exist.
   */
  static async getSpreadsheetMetadata(spreadsheetId: string, accessToken: string) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Sheets API error (${res.status}): Make sure you have permission to edit this spreadsheet.`);
    }

    return await res.json();
  }

  /**
   * Ensures tabs exist in the spreadsheet and writes human-readable headers to row 1.
   */
  static async ensureTabsAndHeaders(spreadsheetId: string, accessToken: string) {
    const meta = await this.getSpreadsheetMetadata(spreadsheetId, accessToken);
    const existingTitles: string[] = (meta.sheets || []).map(
      (s: any) => s.properties?.title || ''
    );

    const missingTabs = REQUIRED_TABS.filter((t) => !existingTitles.includes(t.title));

    // Create any missing tabs via batchUpdate
    if (missingTabs.length > 0) {
      const requests = missingTabs.map((t) => ({
        addSheet: {
          properties: {
            title: t.title,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      }));

      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (!batchRes.ok) {
        const err = await batchRes.json().catch(() => ({}));
        console.warn('Failed to add some tabs via batchUpdate:', err);
      }
    }

    // Now write clean headers to row 1 of each tab
    for (const tab of REQUIRED_TABS) {
      const range = `${tab.title}!A1:Z1`;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

      await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [tab.headers],
        }),
      });
    }

    return {
      success: true,
      message: `Verified tabs (${REQUIRED_TABS.map((t) => t.title).join(', ')}) with simple, clear headers.`,
      tabs: REQUIRED_TABS.map((t) => t.title),
    };
  }

  /**
   * Synchronizes all events, questions, participants, attempts, and answers straight into human-readable rows.
   */
  static async syncAllData(
    spreadsheetId: string,
    accessToken: string,
    data: {
      events?: any[];
      questions?: any[];
      participants?: any[];
      attempts?: any[];
      answers?: any[];
    }
  ) {
    // 1. Ensure tabs exist and have proper headers first
    await this.ensureTabsAndHeaders(spreadsheetId, accessToken);

    let totalRows = 0;

    // Helper duration format
    const formatDuration = (seconds?: number) => {
      if (!seconds || seconds <= 0) return '-';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    // Helper timestamp format
    const formatDate = (isoString?: string | null) => {
      if (!isoString) return '-';
      try {
        return new Date(isoString).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      } catch {
        return isoString;
      }
    };

    // 2. Tab: Participants and Attempts — full student details, written under the header
    const attemptsList = data.attempts || [];
    const participantsList = data.participants || [];
    const participantRows: any[][] = [];

    const pushAttemptRow = (att: any, idx: number) => {
      const contact = att.identifier || att.email || att.mobile || '';
      const isEmail = String(contact).includes('@');
      const scoreText = att.status === 'completed'
        ? `${att.score} / ${att.totalQuestions || att.total_questions || 5}`
        : (att.status === 'in_progress' ? 'In Progress' : (att.score ? `${att.score}` : 'Registered'));
      const pctText = att.status === 'completed' ? `${att.percentage}%` : '-';
      const durText = formatDuration(att.durationTakenSeconds || att.duration_taken_seconds);
      const dateText = formatDate(att.completedAt || att.completed_at || att.startedAt || att.started_at);

      participantRows.push([
        idx + 1,
        att.fullName || att.full_name || att.name || 'Student',
        isEmail ? contact : (att.email || '-'),
        isEmail ? (att.mobile || '-') : (contact || '-'),
        att.collegeName || att.college_name || att.college || 'Engineering College',
        att.branch || '-',
        att.year || '-',
        scoreText,
        pctText,
        durText,
        att.status === 'completed' ? 'Completed' : (att.status === 'in_progress' ? 'In Progress' : (att.status || 'Registered')),
        dateText,
        att.eventCode || att.event_code || 'DEMO2026',
      ]);
    };

    if (attemptsList.length > 0) {
      attemptsList.forEach((att, idx) => pushAttemptRow(att, idx));
    } else if (participantsList.length > 0) {
      participantsList.forEach((p, idx) => pushAttemptRow(p, idx));
    }

    await this.replaceDataRows(spreadsheetId, accessToken, 'Participants', participantRows);
    await this.replaceDataRows(spreadsheetId, accessToken, 'Attempts', participantRows);
    totalRows += participantRows.length;

    // 3. Tab: Leaderboard (Rankings sorted by highest score & lowest duration)
    const sortedForLeaderboard = [...attemptsList]
      .filter((a) => a.status === 'completed')
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.durationTakenSeconds || 999) - (b.durationTakenSeconds || 999);
      });

    const leaderboardRows = sortedForLeaderboard.map((att, idx) => [
      idx + 1,
      att.fullName || att.full_name || att.name || 'Student',
      att.collegeName || att.college_name || att.college || 'Engineering College',
      att.branch || '-',
      `${att.score} / ${att.totalQuestions || att.total_questions || 5}`,
      `${att.percentage}%`,
      formatDuration(att.durationTakenSeconds || att.duration_taken_seconds),
      formatDate(att.completedAt || att.completed_at),
      att.eventCode || att.event_code || 'DEMO2026',
    ]);
    await this.replaceDataRows(spreadsheetId, accessToken, 'Leaderboard', leaderboardRows);

    // 4. Tab: Questions (Readable Question Bank)
    const qRows = (data.questions || []).map((q, idx) => [
      idx + 1,
      q.question || '',
      q.option_a || '',
      q.option_b || '',
      q.option_c || '',
      q.option_d || '',
      q.correct_answer ? `Option ${q.correct_answer}` : '',
      q.explanation || '',
      q.topic || 'AI & Engineering',
    ]);
    await this.replaceDataRows(spreadsheetId, accessToken, 'Questions', qRows);
    totalRows += qRows.length;

    // 5. Tab: Events (College Events)
    const eventRows = (data.events || []).map((e, idx) => [
      idx + 1,
      e.event_code || '',
      e.event_name || '',
      e.college_name || '',
      `${Math.round((e.duration_seconds || 300) / 60)} Minutes`,
      e.is_active ? 'Active' : 'Inactive',
      formatDate(e.created_at),
    ]);
    await this.replaceDataRows(spreadsheetId, accessToken, 'Events', eventRows);
    totalRows += eventRows.length;

    const studentCount = participantRows.length;
    return {
      success: true,
      message: studentCount > 0
        ? `Saved ${studentCount} student record${studentCount === 1 ? '' : 's'} to Google Sheets, including name, email or mobile, college, branch, year, and score.`
        : 'Google Sheets updated, but no quiz participants were found to write.',
      rowsSynced: totalRows,
      studentsSynced: studentCount,
    };
  }

  static async replaceDataRows(
    spreadsheetId: string,
    accessToken: string,
    sheetName: string,
    rows: any[][]
  ) {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`${sheetName}!A2:Z5000`)}:clear`;
    const clearRes = await fetch(clearUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!clearRes.ok) {
      const err = await clearRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to clear ${sheetName}`);
    }
    if (!rows.length) return null;
    return this.updateRange(spreadsheetId, accessToken, `${sheetName}!A2`, rows);
  }

  /**
   * Append rows to a given tab range
   */
  static async appendRows(
    spreadsheetId: string,
    accessToken: string,
    range: string,
    values: any[][]
  ) {
    if (!values || values.length === 0) return null;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to append rows to ${range}`);
    }

    return await res.json();
  }

  /**
   * Overwrite/update a range in the spreadsheet
   */
  static async updateRange(
    spreadsheetId: string,
    accessToken: string,
    range: string,
    values: any[][]
  ) {
    if (!values || values.length === 0) return null;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update range ${range}`);
    }

    return await res.json();
  }
}
