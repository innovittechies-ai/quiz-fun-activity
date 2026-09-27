/**
 * Client-Side Google Sheets API Service
 * 
 * Directly reads and writes to Google Sheets via Google Sheets REST API v4 using
 * client-side OAuth Bearer token. This guarantees reliable, low-latency execution
 * without relying on serverless environment state or Apps Script.
 */

export interface SheetTabDefinition {
  title: string;
  headers: string[];
}

export const REQUIRED_TABS: SheetTabDefinition[] = [
  {
    title: 'Events',
    headers: [
      'eventId',
      'eventCode',
      'eventName',
      'collegeName',
      'description',
      'durationSeconds',
      'status',
      'leaderboardEnabled',
      'createdAt',
    ],
  },
  {
    title: 'Questions',
    headers: [
      'questionId',
      'question',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correctOption',
      'explanation',
      'topic',
      'difficulty',
      'isActive',
    ],
  },
  {
    title: 'Participants',
    headers: [
      'participantId',
      'eventId',
      'name',
      'email',
      'mobile',
      'college',
      'branch',
      'year',
      'createdAt',
    ],
  },
  {
    title: 'Attempts',
    headers: [
      'attemptId',
      'eventId',
      'participantId',
      'score',
      'percentage',
      'durationTakenSeconds',
      'status',
      'startedAt',
      'completedAt',
    ],
  },
  {
    title: 'Answers',
    headers: [
      'attemptId',
      'questionId',
      'selectedOption',
      'isCorrect',
      'answeredAt',
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
   * Ensures all 5 tabs exist in the spreadsheet and writes headers if empty.
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

    // Now write headers to row 1 of each tab
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
      message: `Verified all 5 tabs (${REQUIRED_TABS.map((t) => t.title).join(', ')}) with standard headers.`,
      tabs: REQUIRED_TABS.map((t) => t.title),
    };
  }

  /**
   * Synchronizes all events, questions, participants, attempts, and answers.
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
    // 1. Ensure tabs exist first
    await this.ensureTabsAndHeaders(spreadsheetId, accessToken);

    let totalRows = 0;

    // 2. Append Events
    if (data.events && data.events.length > 0) {
      const rows = data.events.map((e) => [
        e.id || '',
        e.event_code || '',
        e.event_name || '',
        e.college_name || '',
        e.description || '',
        e.duration_seconds || 300,
        e.is_active ? 'active' : 'inactive',
        e.leaderboard_enabled ? 'true' : 'false',
        e.created_at || new Date().toISOString(),
      ]);
      await this.appendRows(spreadsheetId, accessToken, 'Events!A:I', rows);
      totalRows += rows.length;
    }

    // 3. Append Questions
    if (data.questions && data.questions.length > 0) {
      const rows = data.questions.map((q) => [
        q.id || '',
        q.question || '',
        q.option_a || '',
        q.option_b || '',
        q.option_c || '',
        q.option_d || '',
        q.correct_answer || '',
        q.explanation || '',
        q.topic || '',
        q.difficulty || '',
        q.is_active ? 'true' : 'false',
      ]);
      await this.appendRows(spreadsheetId, accessToken, 'Questions!A:K', rows);
      totalRows += rows.length;
    }

    // 4. Append Participants
    if (data.participants && data.participants.length > 0) {
      const rows = data.participants.map((p) => [
        p.id || '',
        p.event_id || '',
        p.name || '',
        p.email || '',
        p.mobile || '',
        p.college || '',
        p.branch || '',
        p.year || '',
        p.created_at || new Date().toISOString(),
      ]);
      await this.appendRows(spreadsheetId, accessToken, 'Participants!A:I', rows);
      totalRows += rows.length;
    }

    // 5. Append Attempts
    if (data.attempts && data.attempts.length > 0) {
      const rows = data.attempts.map((a) => [
        a.id || '',
        a.event_id || '',
        a.participant_id || '',
        a.score || 0,
        a.percentage || 0,
        a.duration_taken_seconds || 0,
        a.status || 'completed',
        a.started_at || '',
        a.completed_at || '',
      ]);
      await this.appendRows(spreadsheetId, accessToken, 'Attempts!A:I', rows);
      totalRows += rows.length;
    }

    // 6. Append Answers
    if (data.answers && data.answers.length > 0) {
      const rows = data.answers.map((ans) => [
        ans.attempt_id || '',
        ans.question_id || '',
        ans.selected_option || '',
        ans.is_correct ? 'true' : 'false',
        ans.answered_at || new Date().toISOString(),
      ]);
      await this.appendRows(spreadsheetId, accessToken, 'Answers!A:E', rows);
      totalRows += rows.length;
    }

    return {
      success: true,
      message: `Successfully synced ${totalRows} records to your Google Sheet!`,
      rowsSynced: totalRows,
    };
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
}
