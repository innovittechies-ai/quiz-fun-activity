import {
  Event,
  Question,
  ClientQuestion,
  QuizResultPayload,
  LeaderboardEntry,
  AdminStats,
  OptionLetter,
} from '../types/index.js';

const API_BASE = '/api';

export interface RegisterQuizResponse {
  attemptId: string;
  participantId: string;
  startedAt: string;
  durationSeconds: number;
  remainingSeconds: number;
  questions: ClientQuestion[];
  existingAnswers: Record<string, OptionLetter>;
  isResumed: boolean;
  event: {
    eventName: string;
    collegeName: string;
    eventCode: string;
  };
  participant: {
    fullName: string;
    collegeName: string;
  };
}

export interface AttemptStatusResponse {
  attemptId: string;
  status: 'in_progress' | 'completed' | 'expired' | 'reset';
  startedAt: string;
  durationSeconds: number;
  remainingSeconds: number;
  questions: ClientQuestion[];
  existingAnswers: Record<string, OptionLetter>;
  expired?: boolean;
  result?: QuizResultPayload;
}

export const api = {
  // Public Event API
  async getEvent(code: string): Promise<Event> {
    const res = await fetch(`${API_BASE}/events/${encodeURIComponent(code)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Event code '${code}' not found.`);
    }
    return res.json();
  },

  // Student registration & start
  async registerQuiz(data: {
    eventCode: string;
    fullName: string;
    identifier: string;
    collegeName: string;
    branch?: string;
    year?: string;
  }): Promise<RegisterQuizResponse> {
    const res = await fetch(`${API_BASE}/quiz/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start quiz');
    }
    return res.json();
  },

  // Check attempt status & remaining server timer
  async checkAttempt(attemptId: string): Promise<AttemptStatusResponse> {
    const res = await fetch(`${API_BASE}/quiz/attempt/${attemptId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to check attempt status');
    }
    return res.json();
  },

  // Autosave answer
  async saveAnswer(attemptId: string, questionId: string, selectedOption: OptionLetter): Promise<void> {
    const res = await fetch(`${API_BASE}/quiz/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, questionId, selectedOption }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save answer');
    }
  },

  // Submit quiz
  async submitQuiz(attemptId: string, answers?: Record<string, OptionLetter>): Promise<QuizResultPayload> {
    const res = await fetch(`${API_BASE}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, answers }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit quiz');
    }
    return res.json();
  },

  // Get result
  async getResult(attemptId: string): Promise<QuizResultPayload> {
    const res = await fetch(`${API_BASE}/quiz/result/${attemptId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch result');
    }
    return res.json();
  },

  // Leaderboard
  async getLeaderboard(eventCode: string): Promise<{
    event: { eventName: string; collegeName: string; eventCode: string; leaderboardEnabled: boolean };
    leaderboard: LeaderboardEntry[];
  }> {
    const res = await fetch(`${API_BASE}/leaderboard/${encodeURIComponent(eventCode)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch leaderboard');
    }
    return res.json();
  },

  // Admin APIs
  admin: {
    async login(password: string): Promise<string> {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Invalid admin password');
      }
      const data = await res.json();
      return data.token;
    },

    async googleLogin(accessToken: string, spreadsheetId?: string): Promise<{
      token: string;
      adminUser: { email: string; name: string; picture?: string };
      sheetsConfigured: boolean;
      spreadsheetUrl?: string;
    }> {
      const res = await fetch(`${API_BASE}/admin/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, spreadsheetId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Google login failed');
      }
      return res.json();
    },

    async configureSheets(token: string, spreadsheetId: string, accessToken?: string) {
      const res = await fetch(`${API_BASE}/admin/sheets/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ spreadsheetId, accessToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to configure Google Sheets');
      }
      return res.json();
    },

    async getSheetsStatus(token: string) {
      const res = await fetch(`${API_BASE}/admin/sheets/status`, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to get Google Sheets status');
      return res.json();
    },

    async syncAllSheets(token: string): Promise<{ success: boolean; message: string; rowsSynced: number }> {
      const res = await fetch(`${API_BASE}/admin/sheets/sync-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to sync database to Google Sheets');
      }
      return res.json();
    },

    async getStats(token: string): Promise<AdminStats> {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },

    async getEvents(token: string) {
      const res = await fetch(`${API_BASE}/admin/events`, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to load events');
      return res.json();
    },

    async createEvent(token: string, eventData: any) {
      const res = await fetch(`${API_BASE}/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(eventData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create event');
      }
      return res.json();
    },

    async updateEvent(token: string, id: string, eventData: any) {
      const res = await fetch(`${API_BASE}/admin/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(eventData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update event');
      }
      return res.json();
    },

    async deleteEvent(token: string, id: string) {
      const res = await fetch(`${API_BASE}/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },

    async getQuestions(token: string, topic?: string) {
      const url = topic ? `${API_BASE}/admin/questions?topic=${encodeURIComponent(topic)}` : `${API_BASE}/admin/questions`;
      const res = await fetch(url, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to load questions');
      return res.json() as Promise<Question[]>;
    },

    async createQuestion(token: string, qData: any) {
      const res = await fetch(`${API_BASE}/admin/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(qData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create question');
      }
      return res.json();
    },

    async updateQuestion(token: string, id: string, qData: any) {
      const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(qData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update question');
      }
      return res.json();
    },

    async deleteQuestion(token: string, id: string) {
      const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to delete question');
      return res.json();
    },

    async getAttempts(token: string, eventCode: string) {
      const res = await fetch(`${API_BASE}/admin/attempts/${encodeURIComponent(eventCode)}`, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to load attempts');
      return res.json();
    },

    async resetAttempt(token: string, attemptId: string) {
      const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}/reset`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reset attempt');
      }
      return res.json();
    },

    getExportUrl(token: string, eventCode: string) {
      return `${API_BASE}/admin/export/${encodeURIComponent(eventCode)}`;
    },
  },
};
