import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Event, Question, Participant, QuizAttempt, ClientQuestion,
  QuizResultPayload, LeaderboardEntry, AdminStats, OptionLetter,
} from '../types/index.js';
import { SAMPLE_QUESTIONS } from './sampleQuestions.js';
import { STATIC_EVENTS, findEventByCode, findEventById } from './staticConfig.js';

/** Single-table Supabase (Postgres) store. One table `participants` holds every
 * per-student record including answers as a JSONB map. Events/questions are static config.
 * Uses the service_role key (bypasses RLS) so only the backend can read/write. */

const TABLE = 'participants';
const pDocId = (eventCode: string, id: string) => `${eventCode.toUpperCase()}_${id.trim().toLowerCase()}`;

// Hardcoded Supabase credentials (server-side only — never bundled into the browser).
// Env vars (SUPABASE_URL / SUPABASE_SERVICE_KEY) override these if present.
const DEFAULT_SUPABASE_URL = 'https://aowkekpseggmcotzeqdv.supabase.co';
const DEFAULT_SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvd2tla3BzZWdnbWNvdHplcWR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDUyODc4OSwiZXhwIjoyMTA2MTA0Nzg5fQ.P421kKOAIC4llU6nuJ9Yb73K5vPJOXCicpP2zfGKMIs';

interface PDoc {
  id: string; event_id: string; event_code: string; full_name: string; identifier: string;
  email: string; mobile: string; college: string; branch: string; year: string;
  score: number; total_questions: number; percentage: number; duration_seconds: number | null;
  status: 'in_progress' | 'completed' | 'expired' | 'reset'; started_at: string;
  completed_at: string | null; device_info: string; answers: Record<string, OptionLetter>; created_at: string;
}

let _client: SupabaseClient | null = null;
function resolveUrl(): string {
  const raw = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  // Treat as project ref: build https://<ref>.supabase.co
  return `https://${raw}.supabase.co`;
}
function client(): SupabaseClient {
  if (_client) return _client;
  const url = resolveUrl();
  const key = process.env.SUPABASE_SERVICE_KEY || DEFAULT_SUPABASE_SERVICE_KEY;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export class SupabaseDatabaseStore {
  async getEventByCode(code: string): Promise<Event | null> { return findEventByCode(code); }
  async getEventById(id: string): Promise<Event | null> { return findEventById(id); }

  async getAllEvents(): Promise<any[]> {
    const out: any[] = [];
    for (const event of STATIC_EVENTS) {
      const { data } = await client().from(TABLE).select('*').eq('event_code', event.event_code);
      const docs = (data || []) as PDoc[];
      const completed = docs.filter((d) => d.status === 'completed');
      const totalScore = completed.reduce((a, c) => a + c.score, 0);
      out.push({ ...event, participantCount: docs.length, completedCount: completed.length, avgScore: completed.length ? Number((totalScore / completed.length).toFixed(1)) : 0 });
    }
    return out;
  }
  async createEvent(_d: any): Promise<Event> { throw new Error('Events are static config. Edit src/server/staticConfig.ts.'); }
  async updateEvent(_id: string, _u: any): Promise<Event> { throw new Error('Events are static config. Edit src/server/staticConfig.ts.'); }
  async deleteEvent(_id: string): Promise<void> { throw new Error('Events are static config. Edit src/server/staticConfig.ts.'); }

  async getAllQuestions(filters?: { topic?: string; difficulty?: string; isActive?: boolean }): Promise<Question[]> {
    let list = [...SAMPLE_QUESTIONS];
    if (filters?.topic) list = list.filter((x) => x.topic.toLowerCase() === filters.topic!.toLowerCase());
    if (filters?.difficulty) list = list.filter((x) => x.difficulty.toLowerCase() === filters.difficulty!.toLowerCase());
    if (filters?.isActive !== undefined) list = list.filter((x) => x.is_active === filters.isActive);
    return list;
  }
  async getQuestionById(id: string): Promise<Question | null> { return SAMPLE_QUESTIONS.find((q) => q.id === id) || null; }

  // Deterministic seeded shuffle so the SAME student always gets the SAME 5 questions
  // (needed for scoring consistency at submit time), while DIFFERENT students get
  // DIFFERENT questions — reducing cheating between neighbors.
  private seededShuffle<T>(arr: T[], seed: string): T[] {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    const rng = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  async getClientQuestionsForEvent(event: Event, seed?: string): Promise<ClientQuestion[]> {
    const pool = SAMPLE_QUESTIONS.filter((q) => q.is_active);
    const toClient = (q: Question): ClientQuestion => ({ id: q.id, question: q.question, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, topic: q.topic, difficulty: q.difficulty });

    // Seeded path: deterministically pick 10 from the full active pool per student.
    if (seed) {
      const ordered = this.seededShuffle(pool, seed);
      return ordered.slice(0, 10).map(toClient);
    }

    // Non-seeded fallback (admin/compatibility): use the event's declared question_ids,
    // backfilling from the active pool if fewer than 10.
    const questions: ClientQuestion[] = [];
    for (const qId of event.question_ids) {
      const q = await this.getQuestionById(qId);
      if (q && q.is_active) questions.push(toClient(q));
    }
    if (questions.length < 10) {
      for (const q of pool) {
        if (questions.length >= 10) break;
        if (!questions.some((e) => e.id === q.id)) questions.push(toClient(q));
      }
    }
    return questions;
  }
  async createQuestion(_d: any): Promise<Question> { throw new Error('Questions are static. Edit src/server/sampleQuestions.ts.'); }
  async updateQuestion(_id: string, _u: any): Promise<Question> { throw new Error('Questions are static. Edit src/server/sampleQuestions.ts.'); }
  async deleteQuestion(_id: string): Promise<void> { throw new Error('Questions are static. Edit src/server/sampleQuestions.ts.'); }

  async getParticipantById(id: string): Promise<PDoc | null> {
    const { data } = await client().from(TABLE).select('*').eq('id', id).maybeSingle();
    return (data as PDoc) || null;
  }
  async getAttemptById(attemptId: string): Promise<QuizAttempt | null> {
    const p = await this.getParticipantById(attemptId);
    if (!p) return null;
    return { id: p.id, event_id: p.event_id, participant_id: p.id, status: p.status, started_at: p.started_at, completed_at: p.completed_at, duration_taken_seconds: p.duration_seconds, score: p.score, percentage: p.percentage, total_questions: p.total_questions, device_info: p.device_info, created_at: p.created_at } as QuizAttempt;
  }
  async getAttemptAnswersMap(attemptId: string): Promise<Record<string, OptionLetter>> {
    const p = await this.getParticipantById(attemptId);
    return (p?.answers as Record<string, OptionLetter>) || {};
  }

  private toParticipant(p: PDoc): Participant {
    return { id: p.id, event_id: p.event_id, full_name: p.full_name, identifier: p.identifier, college_name: p.college, branch: p.branch, year: p.year, created_at: p.created_at } as Participant;
  }
  // __APPEND_HERE__

  async registerStudentAndStartQuiz(data: {
    eventCode: string; fullName: string; identifier: string; collegeName: string;
    branch?: string; year?: string; deviceInfo?: string;
  }): Promise<any> {
    const event = await this.getEventByCode(data.eventCode);
    if (!event) throw new Error(`Event with code '${data.eventCode}' not found.`);
    if (!event.is_active) throw new Error('This quiz event is currently inactive or concluded. Please check with your event coordinator.');
    const normId = data.identifier.trim().toLowerCase();
    const isEmail = normId.includes('@');
    const docId = pDocId(event.event_code, normId);
    const existing = await this.getParticipantById(docId);
    const clientQuestions = await this.getClientQuestionsForEvent(event, normId);

    if (existing) {
      const p = existing;
      if (p.status === 'completed') throw new Error('You have already participated in this quiz.');
      if (p.status === 'in_progress') {
        const start = new Date(p.started_at).getTime();
        const remaining = Math.max(0, event.duration_seconds - Math.floor((Date.now() - start) / 1000));
        if (remaining <= 0) { await this.submitAttempt(p.id); throw new Error('Your quiz time expired. Your score has been submitted.'); }
        return { attempt: await this.getAttemptById(p.id), participant: this.toParticipant(p), event, questions: clientQuestions, remainingSeconds: remaining, existingAnswers: p.answers || {}, isResumed: true };
      }
      if (p.status === 'reset') {
        const started = new Date().toISOString();
        await client().from(TABLE).update({ status: 'in_progress', started_at: started, completed_at: null, duration_seconds: null, score: 0, percentage: 0, answers: {} }).eq('id', docId);
        return { attempt: { id: p.id, event_id: p.event_id, participant_id: p.id, status: 'in_progress', started_at: started, completed_at: null, duration_taken_seconds: null, score: 0, percentage: 0, total_questions: clientQuestions.length, device_info: p.device_info, created_at: p.created_at }, participant: this.toParticipant(p), event, questions: clientQuestions, remainingSeconds: event.duration_seconds, existingAnswers: {}, isResumed: false };
      }
    }

    const now = new Date().toISOString();
    const doc: PDoc = {
      id: docId, event_id: event.id, event_code: event.event_code, full_name: data.fullName.trim(),
      identifier: normId, email: isEmail ? normId : '', mobile: isEmail ? '' : normId,
      college: data.collegeName.trim() || event.college_name, branch: data.branch?.trim() || '', year: data.year?.trim() || '',
      score: 0, total_questions: clientQuestions.length, percentage: 0, duration_seconds: null,
      status: 'in_progress', started_at: now, completed_at: null, device_info: data.deviceInfo || '',
      answers: {}, created_at: now,
    };
    await client().from(TABLE).upsert(doc, { onConflict: 'id' });
    return {
      attempt: { id: doc.id, event_id: event.id, participant_id: doc.id, status: 'in_progress', started_at: now, completed_at: null, duration_taken_seconds: null, score: 0, percentage: 0, total_questions: clientQuestions.length, device_info: doc.device_info, created_at: now },
      participant: this.toParticipant(doc), event, questions: clientQuestions, remainingSeconds: event.duration_seconds, existingAnswers: {}, isResumed: false,
    };
  }

  async saveAttemptAnswer(attemptId: string, questionId: string, selectedOption: OptionLetter): Promise<void> {
    const p = await this.getParticipantById(attemptId);
    if (!p) throw new Error('Attempt not found');
    if (p.status !== 'in_progress') throw new Error('Quiz has already been submitted');
    const event = await this.getEventById(p.event_id);
    if (event) {
      const elapsed = Math.floor((Date.now() - new Date(p.started_at).getTime()) / 1000);
      if (elapsed > event.duration_seconds + 10) { await this.submitAttempt(attemptId); throw new Error('Time has expired.'); }
    }
    const answers = { ...(p.answers || {}), [questionId]: selectedOption };
    await client().from(TABLE).update({ answers }).eq('id', attemptId);
  }

  async submitAttempt(attemptId: string, answersOverride?: Record<string, OptionLetter>): Promise<QuizResultPayload> {
    const p = await this.getParticipantById(attemptId);
    if (!p) throw new Error('Attempt not found');
    if (p.status === 'completed') return (await this.getAttemptResult(attemptId)) as any;
    const event = await this.getEventById(p.event_id);
    if (!event) throw new Error('Event not found');

    const answers: Record<string, OptionLetter> = { ...(p.answers || {}), ...(answersOverride || {}) };
    const clientQuestions = await this.getClientQuestionsForEvent(event, p.identifier);
    let correctCount = 0;
    const questionResults = [];
    for (const cq of clientQuestions) {
      const q = await this.getQuestionById(cq.id);
      if (!q) continue;
      const selected = answers[q.id] || null;
      const isCorrect = selected === q.correct_answer;
      if (isCorrect) correctCount++;
      questionResults.push({ questionId: q.id, question: q.question, optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d, selectedOption: selected, correctAnswer: q.correct_answer, isCorrect, explanation: q.explanation, topic: q.topic });
    }

    const now = new Date();
    const startTime = new Date(p.started_at).getTime();
    const durationTakenSeconds = Math.max(1, Math.min(event.duration_seconds, Math.floor((now.getTime() - startTime) / 1000)));
    const totalQuestions = clientQuestions.length || 5;
    const percentage = Number(((correctCount / totalQuestions) * 100).toFixed(1));

    await client().from(TABLE).update({ status: 'completed', completed_at: now.toISOString(), duration_seconds: durationTakenSeconds, score: correctCount, total_questions: totalQuestions, percentage, answers }).eq('id', attemptId);

    return {
      attemptId: p.id, score: correctCount, totalQuestions, percentage, durationTakenSeconds,
      participant: { fullName: p.full_name, collegeName: p.college, branch: p.branch },
      event: { eventName: event.event_name, collegeName: event.college_name, eventCode: event.event_code, leaderboardEnabled: event.leaderboard_enabled },
      questions: questionResults,
    } as any;
  }

  async getAttemptResult(attemptId: string): Promise<QuizResultPayload | null> {
    const p = await this.getParticipantById(attemptId);
    if (!p || p.status !== 'completed') return null;
    const event = await this.getEventById(p.event_id);
    if (!event) return null;
    const clientQuestions = await this.getClientQuestionsForEvent(event, p.identifier);
    const questionResults = [];
    for (const cq of clientQuestions) {
      const q = await this.getQuestionById(cq.id);
      if (!q) continue;
      const selected = (p.answers as Record<string, OptionLetter>)?.[q.id] || null;
      questionResults.push({ questionId: q.id, question: q.question, optionA: q.option_a, optionB: q.option_b, optionC: q.option_c, optionD: q.option_d, selectedOption: selected, correctAnswer: q.correct_answer, isCorrect: selected === q.correct_answer, explanation: q.explanation, topic: q.topic });
    }
    return {
      attemptId: p.id, score: p.score, totalQuestions: p.total_questions, percentage: p.percentage,
      durationTakenSeconds: p.duration_seconds || 0,
      participant: { fullName: p.full_name, collegeName: p.college, branch: p.branch },
      event: { eventName: event.event_name, collegeName: event.college_name, eventCode: event.event_code, leaderboardEnabled: event.leaderboard_enabled },
      questions: questionResults,
    } as any;
  }

  async resetAttempt(attemptId: string): Promise<void> {
    const p = await this.getParticipantById(attemptId);
    if (!p) throw new Error('Attempt not found');
    await client().from(TABLE).update({ status: 'reset', score: 0, percentage: 0, completed_at: null, duration_seconds: null, answers: {} }).eq('id', attemptId);
  }

  async deleteAttempt(attemptId: string): Promise<void> {
    const p = await this.getParticipantById(attemptId);
    if (!p) throw new Error('Attempt not found');
    await client().from(TABLE).delete().eq('id', attemptId);
  }

  async deleteAllAttempts(eventCode: string): Promise<{ deleted: number }> {
    const event = await this.getEventByCode(eventCode);
    if (!event) throw new Error('Event not found');
    const existing = await client().from(TABLE).select('id', { count: 'exact', head: true }).eq('event_code', event.event_code);
    const count = (existing as any)?.count ?? 0;
    await client().from(TABLE).delete().eq('event_code', event.event_code);
    return { deleted: count };
  }

  async getLeaderboard(eventCode: string): Promise<{ event: any; leaderboard: LeaderboardEntry[] }> {
    const event = await this.getEventByCode(eventCode);
    if (!event) throw new Error('Event not found');
    const { data } = await client().from(TABLE).select('*').eq('event_code', event.event_code).eq('status', 'completed');
    const completed = (data || []) as PDoc[];
    completed.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dA = a.duration_seconds ?? 99999, dB = b.duration_seconds ?? 99999;
      if (dA !== dB) return dA - dB;
      return new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime();
    });
    const leaderboard: LeaderboardEntry[] = completed.map((p, i) => ({
      rank: i + 1, participantName: p.full_name, collegeName: p.college || event.college_name,
      branch: p.branch || '', score: p.score, totalQuestions: p.total_questions,
      durationTakenSeconds: p.duration_seconds || 0, completedAt: p.completed_at || p.created_at,
    }));
    return { event: { eventName: event.event_name, collegeName: event.college_name, eventCode: event.event_code, leaderboardEnabled: event.leaderboard_enabled }, leaderboard };
  }

  async getAdminStats(): Promise<AdminStats> {
    const { data } = await client().from(TABLE).select('*');
    const docs = (data || []) as PDoc[];
    const completed = docs.filter((d) => d.status === 'completed');
    const totalScore = completed.reduce((a, c) => a + c.score, 0);
    return {
      totalParticipants: docs.length, completedAttempts: completed.length,
      activeAttempts: docs.filter((d) => d.status === 'in_progress').length,
      averageScore: completed.length ? Number((totalScore / completed.length).toFixed(2)) : 0,
      highestScore: completed.reduce((m, c) => Math.max(m, c.score), 0),
      totalEvents: STATIC_EVENTS.length, totalQuestions: SAMPLE_QUESTIONS.length,
    };
  }

  async getEventAttemptsDetails(eventCode: string): Promise<any[]> {
    const event = await this.getEventByCode(eventCode);
    if (!event) throw new Error('Event not found');
    const { data } = await client().from(TABLE).select('*').eq('event_code', event.event_code);
    return (data || []).map((a: any) => ({
      attemptId: a.id, participantId: a.id, fullName: a.full_name, identifier: a.identifier,
      collegeName: a.college, branch: a.branch || '', year: a.year || '',
      status: a.status, score: a.score, totalQuestions: a.total_questions, percentage: a.percentage,
      durationTakenSeconds: a.duration_seconds, startedAt: a.started_at, completedAt: a.completed_at,
    }));
  }

  async exportEventCSV(eventCode: string): Promise<string> {
    const attempts = await this.getEventAttemptsDetails(eventCode);
    const headers = ['Rank','Full Name','Email / Mobile','College Name','Branch','Year','Status','Score','Total Questions','Percentage (%)','Time Taken (seconds)','Started At','Completed At'];
    const sorted = [...attempts].sort((a, b) => { if (b.score !== a.score) return b.score - a.score; return (a.durationTakenSeconds || 999) - (b.durationTakenSeconds || 999); });
    const rows = sorted.map((att, idx) => [
      att.status === 'completed' ? idx + 1 : 'N/A',
      `"${att.fullName.replace(/"/g,'""')}"`, `"${att.identifier.replace(/"/g,'""')}"`,
      `"${att.collegeName.replace(/"/g,'""')}"`, `"${att.branch.replace(/"/g,'""')}"`,
      `"${att.year.replace(/"/g,'""')}"`, att.status, att.score, att.totalQuestions, att.percentage,
      att.durationTakenSeconds || '', att.startedAt, att.completedAt || '',
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n';
  }
}
