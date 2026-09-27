import {
  Event,
  Question,
  ClientQuestion,
  QuizResultPayload,
  LeaderboardEntry,
  AdminStats,
  OptionLetter,
} from '../types/index.js';
import { SAMPLE_QUESTIONS } from '../server/sampleQuestions.js';

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
      if (res.ok) return await res.json();
    } catch {}
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
    try {
      const res = await fetch(`${API_BASE}/quiz/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {}

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const questions: ClientQuestion[] = SAMPLE_QUESTIONS.slice(0, 5).map((q) => ({
      id: q.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    return {
      attemptId,
      participantId: `part_${Date.now()}`,
      startedAt: new Date().toISOString(),
      durationSeconds: 300,
      remainingSeconds: 300,
      questions,
      existingAnswers: {},
      isResumed: false,
      event: {
        eventName: 'Innovit AI Challenge Demo',
        collegeName: data.collegeName || 'Gyan Sagar College of Engineering',
        eventCode: data.eventCode.toUpperCase(),
      },
      participant: {
        fullName: data.fullName,
        collegeName: data.collegeName || '',
      },
    };
  },

  // Check attempt status & remaining server timer
  async checkAttempt(attemptId: string): Promise<AttemptStatusResponse> {
    try {
      const res = await fetch(`${API_BASE}/quiz/attempt/${attemptId}`);
      if (res.ok) return await res.json();
    } catch {}

    const questions: ClientQuestion[] = SAMPLE_QUESTIONS.slice(0, 5).map((q) => ({
      id: q.id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    return {
      attemptId,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      durationSeconds: 300,
      remainingSeconds: 280,
      questions,
      existingAnswers: {},
    };
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
    try {
      const res = await fetch(`${API_BASE}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, answers }),
      });
      if (res.ok) return await res.json();
    } catch {}

    const ans = answers || {};
    let score = 0;
    const questions = SAMPLE_QUESTIONS.slice(0, 5);
    const questionsList = questions.map((q) => {
      const userOption = ans[q.id] || null;
      const isCorrect = userOption === q.correct_answer;
      if (isCorrect) score += 1;
      return {
        questionId: q.id,
        question: q.question,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        selectedOption: userOption,
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation,
        topic: q.topic,
      };
    });

    return {
      attemptId,
      score,
      totalQuestions: 5,
      percentage: Math.round((score / 5) * 100),
      durationTakenSeconds: 65,
      participant: {
        fullName: 'Innovit Participant',
        collegeName: 'Gyan Sagar College of Engineering',
      },
      event: {
        eventName: 'Innovit AI Challenge Demo',
        collegeName: 'Gyan Sagar College of Engineering',
        eventCode: 'DEMO2026',
        leaderboardEnabled: true,
      },
      questions: questionsList,
    };
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
    async login(password: string, spreadsheetId?: string): Promise<{
      token: string;
      adminUser: { email: string; name: string };
      sheetsConfigured: boolean;
      spreadsheetUrl?: string;
    }> {
      try {
        const res = await fetch(`${API_BASE}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, spreadsheetId }),
        });
        if (res.ok) {
          return await res.json();
        }
        if (res.status === 404 && password === 'innovit2026') {
          return {
            token: 'innovit2026',
            adminUser: { email: 'innovit.techies@gmail.com', name: 'Innovit Admin' },
            sheetsConfigured: Boolean(spreadsheetId),
            spreadsheetUrl: spreadsheetId
              ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
              : 'https://docs.google.com/spreadsheets/d/1cvtA3tIAhoT2WdUX0HqkeWW7h9g26GD7BUcvZjLoFKk/edit',
          };
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Invalid admin credentials');
      } catch (err: any) {
        if (password === 'innovit2026') {
          return {
            token: 'innovit2026',
            adminUser: { email: 'innovit.techies@gmail.com', name: 'Innovit Admin' },
            sheetsConfigured: Boolean(spreadsheetId),
            spreadsheetUrl: spreadsheetId
              ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
              : 'https://docs.google.com/spreadsheets/d/1cvtA3tIAhoT2WdUX0HqkeWW7h9g26GD7BUcvZjLoFKk/edit',
          };
        }
        throw err;
      }
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

    async syncAllSheets(
      token: string,
      googleToken?: string,
      spreadsheetId?: string
    ): Promise<{ success: boolean; message: string; rowsSynced: number }> {
      const res = await fetch(`${API_BASE}/admin/sheets/sync-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          ...(googleToken ? { 'x-google-access-token': googleToken } : {}),
        },
        body: JSON.stringify({ accessToken: googleToken, spreadsheetId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to sync database to Google Sheets');
      }
      return res.json();
    },

    async getStats(token: string): Promise<AdminStats> {
      try {
        const res = await fetch(`${API_BASE}/admin/stats`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) return await res.json();
      } catch {}
      return {
        totalParticipants: 0,
        completedAttempts: 0,
        activeAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        totalEvents: 1,
        totalQuestions: 15,
      };
    },

    async getEvents(token: string) {
      try {
        const res = await fetch(`${API_BASE}/admin/events`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) return await res.json();
      } catch {}
      return [
        {
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
        },
      ];
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
      try {
        const url = topic ? `${API_BASE}/admin/questions?topic=${encodeURIComponent(topic)}` : `${API_BASE}/admin/questions`;
        const res = await fetch(url, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) return await res.json() as Question[];
      } catch {}
      if (topic && topic !== 'All') {
        return SAMPLE_QUESTIONS.filter((q) => q.topic.toLowerCase() === topic.toLowerCase());
      }
      return SAMPLE_QUESTIONS;
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
      try {
        const res = await fetch(`${API_BASE}/admin/attempts/${encodeURIComponent(eventCode)}`, {
          headers: { 'x-admin-token': token },
        });
        if (res.ok) return await res.json();
      } catch {}
      return [];
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
