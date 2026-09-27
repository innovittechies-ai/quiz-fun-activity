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
    try {
      const res = await fetch(`${API_BASE}/events/${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          id: data.id,
          event_name: data.event_name || data.eventName || '',
          college_name: data.college_name || data.collegeName || '',
          event_code: data.event_code || data.eventCode || code.toUpperCase(),
          description: data.description || '',
          duration_seconds: data.duration_seconds ?? data.durationSeconds ?? 300,
          is_active: data.is_active ?? data.isActive ?? true,
          leaderboard_enabled: data.leaderboard_enabled ?? data.leaderboardEnabled ?? true,
          question_ids: data.question_ids || [],
          created_at: data.created_at || data.createdAt || new Date().toISOString(),
          updated_at: data.updated_at || data.updatedAt,
        };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Event code '${code}' not found.`);
    } catch (err: any) {
      if (err?.message && !String(err.message).includes('Failed to fetch')) throw err;
    }
    if (code.toUpperCase() === 'DEMO2026') {
      return {
        id: 'event-demo-2026',
        event_name: 'Innovit AI Challenge Demo',
        college_name: 'Gyan Sagar College of Engineering',
        event_code: 'DEMO2026',
        description: 'Test your understanding of modern Artificial Intelligence, Machine Learning, and Generative models in 5 quick questions.',
        duration_seconds: 300,
        is_active: true,
        leaderboard_enabled: true,
        question_ids: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw new Error(`Event code '${code}' not found.`);
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
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed. Your details were not saved.');
  },

  // Check attempt status & remaining server timer
  async checkAttempt(attemptId: string): Promise<AttemptStatusResponse> {
    const res = await fetch(`${API_BASE}/quiz/attempt/${attemptId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Quiz attempt not found');
    }
    return res.json();
  },

  // Autosave answer
  async saveAnswer(attemptId: string, questionId: string, selectedOption: OptionLetter): Promise<void> {
    try {
      await fetch(`${API_BASE}/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, questionId, selectedOption }),
      });
    } catch {
      // safe ignore in fallback mode
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
      throw new Error(err.error || 'Failed to submit quiz. Your details were not saved.');
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
    try {
      const res = await fetch(`${API_BASE}/leaderboard/${encodeURIComponent(eventCode)}`);
      if (res.ok) return await res.json();
    } catch {}

    return {
      event: {
        eventName: 'Innovit AI Challenge Demo',
        collegeName: 'Gyan Sagar College of Engineering',
        eventCode: eventCode.toUpperCase(),
        leaderboardEnabled: true,
      },
      leaderboard: [
        {
          rank: 1,
          participantName: 'Aditya S.',
          collegeName: 'Gyan Sagar College',
          branch: 'CSE',
          score: 5,
          totalQuestions: 5,
          durationTakenSeconds: 78,
          completedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        },
        {
          rank: 2,
          participantName: 'Priya K.',
          collegeName: 'Gyan Sagar College',
          branch: 'IT',
          score: 4,
          totalQuestions: 5,
          durationTakenSeconds: 94,
          completedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        },
      ],
    };
  },

  // Admin APIs
  admin: {
    async login(password: string): Promise<{
      token: string;
      adminUser: { email: string; name: string };
    }> {
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Invalid admin credentials');
      }
      return res.json();
    },

    async googleLogin(accessToken: string): Promise<{
      token: string;
      adminUser: { email: string; name: string; picture?: string };
    }> {
      const res = await fetch(`${API_BASE}/admin/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Google login failed');
      }
      return res.json();
    },


    async getStats(token: string): Promise<AdminStats> {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load admin stats');
      }
      return res.json();
    },

    async getEvents(token: string) {
      const res = await fetch(`${API_BASE}/admin/events`, {
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load events');
      }
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load questions');
      }
      return await res.json() as Question[];
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load student attempts');
      }
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
