/**
 * Google Sheets Integration & High-Concurrency Adapter for Innovit AI Quiz Portal.
 * 
 * Writes straight, simple, human-readable student records with live scores,
 * eliminating all raw UUIDs and relational foreign-key complexity.
 */

import { loadPersistedAuth, savePersistedAuth } from './persistedAuth.js';

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  accessToken?: string;
}

const STUDENT_HEADERS = [
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
];

export class GoogleSheetsService {
  private spreadsheetId: string;
  private accessToken: string | null = null;

  constructor(spreadsheetId?: string) {
    const saved = loadPersistedAuth();
    this.spreadsheetId =
      spreadsheetId ||
      saved.spreadsheetId ||
      process.env.GOOGLE_SHEET_ID ||
      '1cvtA3tIAhoT2WdUX0HqkeWW7h9g26GD7BUcvZjLoFKk';
    this.accessToken = saved.googleAccessToken || process.env.GOOGLE_SHEETS_ACCESS_TOKEN || null;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
    savePersistedAuth({ googleAccessToken: token, spreadsheetId: this.spreadsheetId });
  }

  public setSpreadsheetId(id: string) {
    this.spreadsheetId = id;
    savePersistedAuth({ spreadsheetId: id, googleAccessToken: this.accessToken || undefined });
  }

  public isConfigured(): boolean {
    return Boolean(this.spreadsheetId && this.spreadsheetId.trim().length > 5);
  }

  public getSpreadsheetUrl(): string {
    return this.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit` : '';
  }

  /**
   * Initializes sheet headers and structure with straight, simple human-readable columns.
   */
  public async ensureSheetStructure(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured() || !this.accessToken) {
      return { success: false, message: 'Google Sheets not connected with OAuth token' };
    }

    try {
      const headersMap: Record<string, string[]> = {
        Participants: STUDENT_HEADERS,
        Leaderboard: [
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
        Questions: [
          '#',
          'Question',
          'Option A',
          'Option B',
          'Option C',
          'Option D',
          'Correct Option',
          'Explanation',
          'Topic',
        ],
        Events: [
          '#',
          'Event Code',
          'Event Name',
          'College Name',
          'Duration',
          'Status',
          'Created At',
        ],
        Attempts: STUDENT_HEADERS,
      };

      await this.ensureTabsExist(Object.keys(headersMap));

      for (const [sheetName, headers] of Object.entries(headersMap)) {
        await this.updateRange(`${sheetName}!A1:Z1`, [headers]).catch(async () => {
          // If update fails because range does not exist, attempt append
          await this.appendRows(`${sheetName}!A1`, [headers], 'RAW').catch(() => {});
        });
      }

      return { success: true, message: 'Sheet tabs and clean headers verified successfully' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to initialize sheets' };
    }
  }

  /**
   * Batch append rows to a specific tab in the Google Spreadsheet
   */
  public async appendRows(
    range: string,
    values: any[][],
    valueInputOption: 'USER_ENTERED' | 'RAW' = 'USER_ENTERED',
  ): Promise<any> {
    if (!this.isConfigured() || !this.accessToken || !values || values.length === 0) {
      return null;
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      this.spreadsheetId,
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Sheets API error (${res.status})`);
    }

    return res.json();
  }

  /**
   * Update/overwrite a specific range in the Google Spreadsheet
   */
  public async updateRange(
    range: string,
    values: any[][],
    valueInputOption: 'USER_ENTERED' | 'RAW' = 'USER_ENTERED',
  ): Promise<any> {
    if (!this.isConfigured() || !this.accessToken || !values || values.length === 0) {
      return null;
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      this.spreadsheetId,
    )}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Google Sheets API error (${res.status})`);
    }

    return res.json();
  }

  private async ensureTabsExist(titles: string[]): Promise<void> {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Cannot open the spreadsheet. Check the ID and that this Google account can edit it.');
    }
    const meta = await metaRes.json();
    const existing = new Set((meta.sheets || []).map((s: any) => s.properties?.title || ''));
    const missing = titles.filter((title) => !existing.has(title));
    if (missing.length === 0) return;

    const requests = missing.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}:batchUpdate`;
    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
    if (!batchRes.ok) {
      const err = await batchRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create sheet tabs');
    }
  }

  private async clearRange(range: string): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      this.spreadsheetId,
    )}/values/${encodeURIComponent(range)}:clear`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to clear ${range}`);
    }
  }

  /** Replace every data row under the header so student details stay on row 2, not buried by append. */
  private async replaceDataRows(sheetName: string, rows: any[][]): Promise<void> {
    await this.clearRange(`${sheetName}!A2:Z5000`);
    if (!rows.length) return;
    await this.updateRange(`${sheetName}!A2`, rows, 'RAW');
  }

  /**
   * Records a student's completed quiz directly into the Participants tab and Leaderboard.
   */
  public async recordCompletedQuiz(
    attempt: {
      id: string;
      eventId: string;
      eventCode?: string;
      participantId: string;
      participantName?: string;
      email?: string;
      mobile?: string;
      college?: string;
      branch?: string;
      year?: string;
      startedAt: string;
      completedAt: string;
      score: number;
      totalQuestions?: number;
      percentage: number;
      durationTakenSeconds: number;
      status: string;
    },
    _answers?: Array<{
      attemptId: string;
      questionId: string;
      selectedOption: string;
      isCorrect: boolean;
      answeredAt: string;
    }>,
  ): Promise<void> {
    if (!this.isConfigured() || !this.accessToken) {
      return;
    }

    try {
      const durationSec = attempt.durationTakenSeconds || 0;
      const m = Math.floor(durationSec / 60);
      const s = durationSec % 60;
      const durText = m > 0 ? `${m}m ${s}s` : `${s}s`;
      const dateText = attempt.completedAt
        ? new Date(attempt.completedAt).toLocaleString('en-IN')
        : new Date().toLocaleString('en-IN');

      // 1. Append clean, readable row straight to Participants tab!
      const participantRow = [
        '',
        attempt.participantName || 'Student',
        attempt.email || '-',
        attempt.mobile || '-',
        attempt.college || 'Engineering College',
        attempt.branch || '-',
        attempt.year || '-',
        `${attempt.score} / ${attempt.totalQuestions || 5}`,
        `${attempt.percentage}%`,
        durText,
        'Completed',
        dateText,
        attempt.eventCode || 'DEMO2026',
      ];
      await this.appendRows('Participants!A:M', [participantRow]);

      // 2. Also append to Leaderboard tab
      const leaderboardRow = [
        '',
        attempt.participantName || 'Student',
        attempt.college || 'Engineering College',
        attempt.branch || '-',
        `${attempt.score} / ${attempt.totalQuestions || 5}`,
        `${attempt.percentage}%`,
        durText,
        dateText,
        attempt.eventCode || 'DEMO2026',
      ];
      await this.appendRows('Leaderboard!A:I', [leaderboardRow]).catch(() => {});
    } catch (err) {
      console.warn('Google Sheets background sync failed:', err);
    }
  }

  /**
   * Sync participant row to Participants tab if registered before quiz completion
   */
  public async recordParticipant(participant: {
    id: string;
    eventId?: string;
    event_id?: string;
    eventCode?: string;
    fullName?: string;
    full_name?: string;
    identifier: string;
    collegeName?: string;
    college_name?: string;
    branch?: string;
    year?: string;
    createdAt?: string;
    created_at?: string;
  }): Promise<void> {
    if (!this.isConfigured() || !this.accessToken) return;

    try {
      const isEmail = (participant.identifier || '').includes('@');
      const row = [
        '',
        participant.fullName || participant.full_name || 'Student',
        isEmail ? participant.identifier : '-',
        isEmail ? '-' : participant.identifier,
        participant.collegeName || participant.college_name || 'Engineering College',
        participant.branch || '-',
        participant.year || '-',
        'In Progress',
        '-',
        '-',
        'In Progress',
        new Date().toLocaleString('en-IN'),
        participant.eventCode || 'DEMO2026',
      ];
      await this.appendRows('Participants!A:M', [row]);
    } catch (err) {
      console.warn('Google Sheets participant sync error:', err);
    }
  }

  /**
   * Complete sync of all events, questions, participants, attempts, and answers to Google Sheets.
   */
  public async syncAllData(data: {
    events: any[];
    questions: any[];
    participants: any[];
    quiz_attempts: any[];
    attempt_answers: any[];
  }): Promise<{ success: boolean; message: string; rowsSynced: number; studentsSynced: number }> {
    if (!this.isConfigured() || !this.accessToken) {
      throw new Error('Google Sheets not connected. Please sign in with Google or connect a Spreadsheet ID.');
    }

    await this.ensureSheetStructure();

    let totalRows = 0;

    const formatDuration = (seconds?: number) => {
      if (!seconds || seconds <= 0) return '-';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

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

    // 1. Tab: Participants — one row per student with contact details and score
    const participantRows = (data.participants || []).map((p, idx) => {
      const isEmail = (p.identifier || '').includes('@');
      const att = (data.quiz_attempts || []).find(
        (a) => a.participant_id === p.id || a.participantId === p.id,
      );
      const ev = (data.events || []).find((e) => e.id === p.event_id || e.id === p.eventId);
      const durationSec = att?.duration_taken_seconds || att?.durationTakenSeconds || 0;
      const durText = formatDuration(durationSec);
      const dateText = formatDate(att?.completed_at || att?.started_at || p.created_at);

      const scoreText = att
        ? (att.status === 'completed' ? `${att.score} / ${att.total_questions || 5}` : 'In Progress')
        : 'Registered';
      const pctText = att && att.status === 'completed' ? `${att.percentage}%` : '-';
      const statusText = att?.status === 'completed' ? 'Completed' : (att ? 'In Progress' : 'Registered');

      return [
        idx + 1,
        p.full_name || p.name || 'Student',
        isEmail ? p.identifier : (p.email || '-'),
        isEmail ? (p.mobile || '-') : (p.identifier || '-'),
        p.college_name || p.college || 'Engineering College',
        p.branch || '-',
        p.year || '-',
        scoreText,
        pctText,
        durText,
        statusText,
        dateText,
        ev?.event_code || p.event_code || 'DEMO2026',
      ];
    });
    await this.replaceDataRows('Participants', participantRows);
    await this.replaceDataRows('Attempts', participantRows);
    totalRows += participantRows.length;

    // 2. Tab: Leaderboard
    const completedAttempts = (data.quiz_attempts || [])
      .filter((a) => a.status === 'completed')
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.duration_taken_seconds || 999) - (b.duration_taken_seconds || 999);
      });

    const leaderboardRows = completedAttempts.map((a, idx) => {
      const p = (data.participants || []).find((part) => part.id === a.participant_id);
      const ev = (data.events || []).find((e) => e.id === a.event_id);
      const durationSec = a.duration_taken_seconds || 0;
      const durText = formatDuration(durationSec);
      const dateText = formatDate(a.completed_at);

      return [
        idx + 1,
        p ? (p.full_name || p.name) : 'Student',
        p ? (p.college_name || p.college) : 'Engineering College',
        p?.branch || '-',
        `${a.score} / ${a.total_questions || 5}`,
        `${a.percentage}%`,
        durText,
        dateText,
        ev?.event_code || 'DEMO2026',
      ];
    });
    await this.replaceDataRows('Leaderboard', leaderboardRows);

    // 3. Tab: Questions
    const questionRows = (data.questions || []).map((q, idx) => [
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
    await this.replaceDataRows('Questions', questionRows);
    totalRows += questionRows.length;

    // 4. Tab: Events
    const eventRows = (data.events || []).map((e, idx) => [
      idx + 1,
      e.event_code || '',
      e.event_name || '',
      e.college_name || '',
      `${Math.round((e.duration_seconds || 300) / 60)} Minutes`,
      e.is_active ? 'Active' : 'Inactive',
      formatDate(e.created_at),
    ]);
    await this.replaceDataRows('Events', eventRows);
    totalRows += eventRows.length;

    const studentCount = participantRows.length;
    return {
      success: true,
      message: studentCount > 0
        ? `Saved ${studentCount} student record${studentCount === 1 ? '' : 's'} to Google Sheets, including name, email or mobile, college, branch, year, and score.`
        : 'Google Sheets updated, but no quiz participants are saved on the server yet.',
      rowsSynced: totalRows,
      studentsSynced: studentCount,
    };
  }
}

export const googleSheetsService = new GoogleSheetsService();
