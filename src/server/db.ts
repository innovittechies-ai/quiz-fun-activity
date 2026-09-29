import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Event,
  Question,
  Participant,
  QuizAttempt,
  AttemptAnswer,
  ClientQuestion,
  QuizResultPayload,
  LeaderboardEntry,
  AdminStats,
  OptionLetter,
} from '../types/index.js';
import { SAMPLE_QUESTIONS } from './sampleQuestions.js';

interface DatabaseSchema {
  events: Event[];
  questions: Question[];
  participants: Participant[];
  quiz_attempts: QuizAttempt[];
  attempt_answers: AttemptAnswer[];
}

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'data')
  : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'innovit_quiz.json');

class DatabaseStore {
  private data: DatabaseSchema = {
    events: [],
    questions: [],
    participants: [],
    quiz_attempts: [],
    attempt_answers: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.seedInitialData();
        this.persist();
      }
    } catch (err) {
      console.error('Error initializing database, seeding fallback in-memory:', err);
      this.seedInitialData();
    }

    // Ensure questions are seeded if empty
    if (this.data.questions.length === 0) {
      this.data.questions = [...SAMPLE_QUESTIONS];
      this.persist();
    }

    // Ensure demo event exists
    if (!this.data.events.some((e) => e.event_code === 'DEMO2026')) {
      const demoQuestions = this.data.questions.slice(0, 5).map((q) => q.id);
      this.data.events.push({
        id: 'event-demo-2026',
        event_name: 'Innovit AI Challenge Demo',
        college_name: 'Innovit Partner College',
        event_code: 'DEMO2026',
        description: 'Test your understanding of modern Artificial Intelligence, Machine Learning, and Generative models in 5 quick questions.',
        duration_seconds: 300,
        is_active: true,
        leaderboard_enabled: true,
        question_ids: demoQuestions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      this.persist();
    }
  }

  private seedInitialData() {
    const demoQuestions = SAMPLE_QUESTIONS.slice(0, 5).map((q) => q.id);
    this.data = {
      events: [
        {
          id: 'event-demo-2026',
          event_name: 'Innovit AI Challenge Demo',
          college_name: 'Innovit Partner College',
          event_code: 'DEMO2026',
          description: 'Test your understanding of modern Artificial Intelligence, Machine Learning, and Generative models in 5 quick questions.',
          duration_seconds: 300,
          is_active: true,
          leaderboard_enabled: true,
          question_ids: demoQuestions,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      questions: [...SAMPLE_QUESTIONS],
      participants: [],
      quiz_attempts: [],
      attempt_answers: [],
    };
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  // --- EVENTS ---

  public getEventByCode(code: string): Event | null {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    return this.data.events.find((e) => e.event_code.toUpperCase() === normalized) || null;
  }

  public getEventById(id: string): Event | null {
    return this.data.events.find((e) => e.id === id) || null;
  }

  public getAllEvents(): (Event & { participantCount: number; completedCount: number; avgScore: number })[] {
    return this.data.events.map((event) => {
      const attempts = this.data.quiz_attempts.filter((a) => a.event_id === event.id);
      const completed = attempts.filter((a) => a.status === 'completed');
      const totalScore = completed.reduce((acc, curr) => acc + curr.score, 0);
      const avgScore = completed.length > 0 ? Number((totalScore / completed.length).toFixed(1)) : 0;

      return {
        ...event,
        participantCount: attempts.length,
        completedCount: completed.length,
        avgScore,
      };
    });
  }

  public createEvent(data: {
    event_name: string;
    college_name: string;
    event_code: string;
    description: string;
    duration_seconds: number;
    leaderboard_enabled: boolean;
    question_ids: string[];
    is_active?: boolean;
  }): Event {
    const code = data.event_code.trim().toUpperCase();
    if (this.getEventByCode(code)) {
      throw new Error(`Event code '${code}' already exists. Please choose a unique code.`);
    }

    // Default to at least 5 questions if none chosen
    let selectedQuestions = data.question_ids;
    if (!selectedQuestions || selectedQuestions.length === 0) {
      selectedQuestions = this.data.questions.slice(0, 5).map((q) => q.id);
    }

    const newEvent: Event = {
      id: crypto.randomUUID(),
      event_name: data.event_name.trim(),
      college_name: data.college_name.trim(),
      event_code: code,
      description: data.description?.trim() || '',
      duration_seconds: Math.max(60, data.duration_seconds || 300),
      is_active: data.is_active !== undefined ? data.is_active : true,
      leaderboard_enabled: data.leaderboard_enabled !== undefined ? data.leaderboard_enabled : true,
      question_ids: selectedQuestions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.data.events.push(newEvent);
    this.persist();
    return newEvent;
  }

  public updateEvent(
    id: string,
    updates: Partial<{
      event_name: string;
      college_name: string;
      event_code: string;
      description: string;
      duration_seconds: number;
      is_active: boolean;
      leaderboard_enabled: boolean;
      question_ids: string[];
    }>,
  ): Event {
    const event = this.getEventById(id);
    if (!event) throw new Error('Event not found');

    if (updates.event_code) {
      const code = updates.event_code.trim().toUpperCase();
      const existing = this.getEventByCode(code);
      if (existing && existing.id !== id) {
        throw new Error(`Event code '${code}' is already in use by another event.`);
      }
      event.event_code = code;
    }

    if (updates.event_name !== undefined) event.event_name = updates.event_name.trim();
    if (updates.college_name !== undefined) event.college_name = updates.college_name.trim();
    if (updates.description !== undefined) event.description = updates.description.trim();
    if (updates.duration_seconds !== undefined) event.duration_seconds = Math.max(60, updates.duration_seconds);
    if (updates.is_active !== undefined) event.is_active = updates.is_active;
    if (updates.leaderboard_enabled !== undefined) event.leaderboard_enabled = updates.leaderboard_enabled;
    if (updates.question_ids && updates.question_ids.length > 0) {
      event.question_ids = updates.question_ids;
    }

    event.updated_at = new Date().toISOString();
    this.persist();
    return event;
  }

  public deleteEvent(id: string): void {
    const idx = this.data.events.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Event not found');
    this.data.events.splice(idx, 1);
    this.persist();
  }

  // --- QUESTIONS ---

  public getAllQuestions(filters?: { topic?: string; difficulty?: string; isActive?: boolean }): Question[] {
    let list = [...this.data.questions];
    if (filters?.topic) {
      list = list.filter((q) => q.topic.toLowerCase() === filters.topic!.toLowerCase());
    }
    if (filters?.difficulty) {
      list = list.filter((q) => q.difficulty.toLowerCase() === filters.difficulty!.toLowerCase());
    }
    if (filters?.isActive !== undefined) {
      list = list.filter((q) => q.is_active === filters.isActive);
    }
    return list;
  }

  public getQuestionById(id: string): Question | null {
    return this.data.questions.find((q) => q.id === id) || null;
  }

  public getClientQuestionsForEvent(event: Event): ClientQuestion[] {
    const questions: ClientQuestion[] = [];
    for (const qId of event.question_ids) {
      const q = this.getQuestionById(qId);
      if (q && q.is_active) {
        questions.push({
          id: q.id,
          question: q.question,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          topic: q.topic,
          difficulty: q.difficulty,
        });
      }
    }

    // If event has fewer than 5 active questions, backfill from active questions bank
    if (questions.length < 5) {
      const allActive = this.data.questions.filter((q) => q.is_active && !questions.some((existing) => existing.id === q.id));
      for (const q of allActive) {
        if (questions.length >= 5) break;
        questions.push({
          id: q.id,
          question: q.question,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          topic: q.topic,
          difficulty: q.difficulty,
        });
      }
    }

    return questions;
  }

  public createQuestion(data: Omit<Question, 'id' | 'created_at' | 'updated_at'>): Question {
    const newQ: Question = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.questions.push(newQ);
    this.persist();
    return newQ;
  }

  public updateQuestion(id: string, updates: Partial<Question>): Question {
    const q = this.getQuestionById(id);
    if (!q) throw new Error('Question not found');
    Object.assign(q, updates, { updated_at: new Date().toISOString() });
    this.persist();
    return q;
  }

  public deleteQuestion(id: string): void {
    const idx = this.data.questions.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Question not found');
    this.data.questions.splice(idx, 1);
    this.persist();
  }

  // --- PARTICIPANTS & ATTEMPTS ---

  public findParticipant(eventId: string, identifier: string): Participant | null {
    const normalizedId = identifier.trim().toLowerCase();
    return (
      this.data.participants.find(
        (p) => p.event_id === eventId && p.identifier.trim().toLowerCase() === normalizedId,
      ) || null
    );
  }

  public getParticipantById(id: string): Participant | null {
    return this.data.participants.find((p) => p.id === id) || null;
  }

  public getAttemptById(attemptId: string): QuizAttempt | null {
    return this.data.quiz_attempts.find((a) => a.id === attemptId) || null;
  }

  public findAttemptByParticipant(participantId: string, eventId: string): QuizAttempt | null {
    return this.data.quiz_attempts.find((a) => a.participant_id === participantId && a.event_id === eventId) || null;
  }

  public registerStudentAndStartQuiz(data: {
    eventCode: string;
    fullName: string;
    identifier: string;
    collegeName: string;
    branch?: string;
    year?: string;
    deviceInfo?: string;
    email?: string;
  }): {
    attempt: QuizAttempt;
    participant: Participant;
    event: Event;
    questions: ClientQuestion[];
    remainingSeconds: number;
    existingAnswers: Record<string, OptionLetter>;
    isResumed: boolean;
  } {
    const event = this.getEventByCode(data.eventCode);
    if (!event) {
      throw new Error(`Event with code '${data.eventCode}' not found.`);
    }

    if (!event.is_active) {
      throw new Error('This quiz event is currently inactive or concluded. Please check with your event coordinator.');
    }

    const normalizedIdentifier = data.identifier.trim().toLowerCase();
    let participant = this.findParticipant(event.id, normalizedIdentifier);

    if (participant) {
      // Check existing attempt
      const attempt = this.findAttemptByParticipant(participant.id, event.id);

      if (attempt) {
        if (attempt.status === 'completed') {
          throw new Error('You have already participated in this quiz.');
        }

        if (attempt.status === 'in_progress') {
          // Check server timer expiry
          const startTime = new Date(attempt.started_at).getTime();
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          const remainingSeconds = Math.max(0, event.duration_seconds - elapsedSeconds);

          if (remainingSeconds <= 0) {
            // Auto submit / expire on server
            this.submitAttempt(attempt.id);
            throw new Error('Your quiz time expired. Your score has been submitted.');
          }

          // Restore existing attempt seamlessly!
          const answers = this.getAttemptAnswersMap(attempt.id);
          const clientQuestions = this.getClientQuestionsForEvent(event);

          return {
            attempt,
            participant,
            event,
            questions: clientQuestions,
            remainingSeconds,
            existingAnswers: answers,
            isResumed: true,
          };
        }

        if (attempt.status === 'reset') {
          // Allowed to restart: update attempt status to in_progress with new started_at
          attempt.status = 'in_progress';
          attempt.started_at = new Date().toISOString();
          attempt.completed_at = null;
          attempt.duration_taken_seconds = null;
          attempt.score = 0;
          attempt.percentage = 0;
          // Clear previous answers
          this.data.attempt_answers = this.data.attempt_answers.filter((a) => a.attempt_id !== attempt.id);
          this.persist();

          const clientQuestions = this.getClientQuestionsForEvent(event);
          return {
            attempt,
            participant,
            event,
            questions: clientQuestions,
            remainingSeconds: event.duration_seconds,
            existingAnswers: {},
            isResumed: false,
          };
        }
      }
    }

    // New participant registration
    if (!participant) {
      participant = {
        id: crypto.randomUUID(),
        event_id: event.id,
        full_name: data.fullName.trim(),
        identifier: normalizedIdentifier,
        college_name: data.collegeName.trim() || event.college_name,
        branch: data.branch?.trim() || '',
        year: data.year?.trim() || '',
        created_at: new Date().toISOString(),
      };
      this.data.participants.push(participant);
    }

    const clientQuestions = this.getClientQuestionsForEvent(event);
    const newAttempt: QuizAttempt = {
      id: crypto.randomUUID(),
      event_id: event.id,
      participant_id: participant.id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_taken_seconds: null,
      score: 0,
      percentage: 0,
      total_questions: clientQuestions.length,
      device_info: data.deviceInfo || '',
      created_at: new Date().toISOString(),
    };

    this.data.quiz_attempts.push(newAttempt);
    this.persist();

    return {
      attempt: newAttempt,
      participant,
      event,
      questions: clientQuestions,
      remainingSeconds: event.duration_seconds,
      existingAnswers: {},
      isResumed: false,
    };
  }

  public saveAttemptAnswer(attemptId: string, questionId: string, selectedOption: OptionLetter): void {
    const attempt = this.getAttemptById(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status !== 'in_progress') throw new Error('Quiz has already been submitted');

    // Check timer
    const event = this.getEventById(attempt.event_id);
    if (event) {
      const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
      if (elapsed > event.duration_seconds + 10) {
        // Exceeded allowed time
        this.submitAttempt(attemptId);
        throw new Error('Time has expired.');
      }
    }

    const existing = this.data.attempt_answers.find(
      (a) => a.attempt_id === attemptId && a.question_id === questionId,
    );

    if (existing) {
      existing.selected_option = selectedOption;
      existing.answered_at = new Date().toISOString();
    } else {
      this.data.attempt_answers.push({
        id: crypto.randomUUID(),
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption,
        is_correct: false, // Calculated on final submit
        answered_at: new Date().toISOString(),
      });
    }

    this.persist();
  }

  public getAttemptAnswersMap(attemptId: string): Record<string, OptionLetter> {
    const answers = this.data.attempt_answers.filter((a) => a.attempt_id === attemptId);
    const map: Record<string, OptionLetter> = {};
    for (const a of answers) {
      if (a.selected_option) {
        map[a.question_id] = a.selected_option;
      }
    }
    return map;
  }

  public submitAttempt(
    attemptId: string,
    answersOverride?: Record<string, OptionLetter>,
  ): QuizResultPayload {
    const attempt = this.getAttemptById(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    // IDEMPOTENCY: If already completed, return existing result without re-scoring or duplicate writes
    if (attempt.status === 'completed') {
      const existingResult = this.getAttemptResult(attemptId);
      if (existingResult) return existingResult;
    }

    const participant = this.getParticipantById(attempt.participant_id);
    if (!participant) throw new Error('Participant not found');

    const event = this.getEventById(attempt.event_id);
    if (!event) throw new Error('Event not found');

    // If answers override provided in submission payload, sync them first
    if (answersOverride) {
      for (const [qId, opt] of Object.entries(answersOverride)) {
        if (opt && ['A', 'B', 'C', 'D'].includes(opt)) {
          const existing = this.data.attempt_answers.find(
            (a) => a.attempt_id === attemptId && a.question_id === qId,
          );
          if (existing) {
            existing.selected_option = opt as OptionLetter;
          } else {
            this.data.attempt_answers.push({
              id: crypto.randomUUID(),
              attempt_id: attemptId,
              question_id: qId,
              selected_option: opt as OptionLetter,
              is_correct: false,
              answered_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // SERVER-SIDE SCORING
    const studentAnswers = this.getAttemptAnswersMap(attemptId);
    const clientQuestions = this.getClientQuestionsForEvent(event);
    let correctCount = 0;
    const questionResults = [];

    for (const cq of clientQuestions) {
      const q = this.getQuestionById(cq.id);
      if (!q) continue;

      const selected = studentAnswers[q.id] || null;
      const isCorrect = selected === q.correct_answer;

      if (isCorrect) {
        correctCount += 1;
      }

      // Update answer is_correct flag in DB
      const ansRecord = this.data.attempt_answers.find(
        (a) => a.attempt_id === attemptId && a.question_id === q.id,
      );
      if (ansRecord) {
        ansRecord.is_correct = isCorrect;
      }

      questionResults.push({
        questionId: q.id,
        question: q.question,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        selectedOption: selected,
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation,
        topic: q.topic,
      });
    }

    const now = new Date();
    const startTime = new Date(attempt.started_at).getTime();
    const durationTakenSeconds = Math.max(1, Math.min(event.duration_seconds, Math.floor((now.getTime() - startTime) / 1000)));

    const totalQuestions = clientQuestions.length || 5;
    const percentage = Number(((correctCount / totalQuestions) * 100).toFixed(1));

    attempt.status = 'completed';
    attempt.completed_at = now.toISOString();
    attempt.duration_taken_seconds = durationTakenSeconds;
    attempt.score = correctCount;
    attempt.total_questions = totalQuestions;
    attempt.percentage = percentage;

    this.persist();

    return {
      attemptId: attempt.id,
      score: correctCount,
      totalQuestions,
      percentage,
      durationTakenSeconds,
      participant: {
        fullName: participant.full_name,
        collegeName: participant.college_name,
        branch: participant.branch,
      },
      event: {
        eventName: event.event_name,
        collegeName: event.college_name,
        eventCode: event.event_code,
        leaderboardEnabled: event.leaderboard_enabled,
      },
      questions: questionResults,
    };
  }

  public getAttemptResult(attemptId: string): QuizResultPayload | null {
    const attempt = this.getAttemptById(attemptId);
    if (!attempt || attempt.status !== 'completed') return null;

    const participant = this.getParticipantById(attempt.participant_id);
    const event = this.getEventById(attempt.event_id);
    if (!participant || !event) return null;

    const studentAnswers = this.getAttemptAnswersMap(attemptId);
    const clientQuestions = this.getClientQuestionsForEvent(event);
    const questionResults = [];

    for (const cq of clientQuestions) {
      const q = this.getQuestionById(cq.id);
      if (!q) continue;

      const selected = studentAnswers[q.id] || null;
      const isCorrect = selected === q.correct_answer;

      questionResults.push({
        questionId: q.id,
        question: q.question,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c,
        optionD: q.option_d,
        selectedOption: selected,
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation,
        topic: q.topic,
      });
    }

    return {
      attemptId: attempt.id,
      score: attempt.score,
      totalQuestions: attempt.total_questions,
      percentage: attempt.percentage,
      durationTakenSeconds: attempt.duration_taken_seconds || 0,
      participant: {
        fullName: participant.full_name,
        collegeName: participant.college_name,
        branch: participant.branch,
      },
      event: {
        eventName: event.event_name,
        collegeName: event.college_name,
        eventCode: event.event_code,
        leaderboardEnabled: event.leaderboard_enabled,
      },
      questions: questionResults,
    };
  }

  public resetAttempt(attemptId: string): void {
    const attempt = this.getAttemptById(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    attempt.status = 'reset';
    attempt.score = 0;
    attempt.percentage = 0;
    attempt.completed_at = null;
    attempt.duration_taken_seconds = null;

    // Delete stored answers
    this.data.attempt_answers = this.data.attempt_answers.filter((a) => a.attempt_id !== attemptId);
    this.persist();
  }

  public deleteAttempt(attemptId: string): void {
    const attempt = this.getAttemptById(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    this.data.participants = this.data.participants.filter((p) => p.id !== attemptId);
    this.data.attempt_answers = this.data.attempt_answers.filter((a) => a.attempt_id !== attemptId);
    this.persist();
  }

  public deleteAllAttempts(eventCode: string): { deleted: number } {
    const event = this.getEventByCode(eventCode);
    if (!event) throw new Error('Event not found');
    const ids = this.data.participants.filter((p) => p.event_code === event.event_code).map((p) => p.id);
    this.data.participants = this.data.participants.filter((p) => p.event_code !== event.event_code);
    this.data.attempt_answers = this.data.attempt_answers.filter((a) => !ids.includes(a.attempt_id));
    this.persist();
    return { deleted: ids.length };
  }

  // --- LEADERBOARD ---

  public getLeaderboard(eventCode: string): {
    event: { eventName: string; collegeName: string; eventCode: string; leaderboardEnabled: boolean };
    leaderboard: LeaderboardEntry[];
  } {
    const event = this.getEventByCode(eventCode);
    if (!event) throw new Error('Event not found');

    const completedAttempts = this.data.quiz_attempts.filter(
      (a) => a.event_id === event.id && a.status === 'completed',
    );

    // Ranking algorithm:
    // 1. Highest score DESC
    // 2. Fastest completion time ASC
    // 3. Earliest submission timestamp ASC
    completedAttempts.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const durA = a.duration_taken_seconds ?? 99999;
      const durB = b.duration_taken_seconds ?? 99999;
      if (durA !== durB) {
        return durA - durB;
      }
      const timeA = new Date(a.completed_at || 0).getTime();
      const timeB = new Date(b.completed_at || 0).getTime();
      return timeA - timeB;
    });

    const leaderboard: LeaderboardEntry[] = completedAttempts.map((attempt, index) => {
      const participant = this.getParticipantById(attempt.participant_id);
      return {
        rank: index + 1,
        participantName: participant ? participant.full_name : 'Anonymous Student',
        collegeName: participant ? participant.college_name : event.college_name,
        branch: participant?.branch || '',
        score: attempt.score,
        totalQuestions: attempt.total_questions,
        durationTakenSeconds: attempt.duration_taken_seconds || 0,
        completedAt: attempt.completed_at || attempt.created_at,
      };
    });

    return {
      event: {
        eventName: event.event_name,
        collegeName: event.college_name,
        eventCode: event.event_code,
        leaderboardEnabled: event.leaderboard_enabled,
      },
      leaderboard,
    };
  }

  // --- ADMIN STATS & EXPORT ---

  public getAdminStats(): AdminStats {
    const totalParticipants = this.data.participants.length;
    const completedAttempts = this.data.quiz_attempts.filter((a) => a.status === 'completed').length;
    const activeAttempts = this.data.quiz_attempts.filter((a) => a.status === 'in_progress').length;

    const completedList = this.data.quiz_attempts.filter((a) => a.status === 'completed');
    const totalScore = completedList.reduce((acc, curr) => acc + curr.score, 0);
    const averageScore = completedList.length > 0 ? Number((totalScore / completedList.length).toFixed(2)) : 0;
    const highestScore = completedList.reduce((max, curr) => Math.max(max, curr.score), 0);

    return {
      totalParticipants,
      completedAttempts,
      activeAttempts,
      averageScore,
      highestScore,
      totalEvents: this.data.events.length,
      totalQuestions: this.data.questions.length,
    };
  }

  public getEventAttemptsDetails(eventCode: string) {
    const event = this.getEventByCode(eventCode);
    if (!event) throw new Error('Event not found');

    const attempts = this.data.quiz_attempts.filter((a) => a.event_id === event.id);

    return attempts.map((a) => {
      const p = this.getParticipantById(a.participant_id);
      return {
        attemptId: a.id,
        participantId: a.participant_id,
        fullName: p ? p.full_name : 'Unknown',
        identifier: p ? p.identifier : 'Unknown',
        email: (p as any)?.email || '',
        mobile: (p as any)?.mobile || '',
        collegeName: p ? p.college_name : 'Unknown',
        branch: p?.branch || '',
        year: p?.year || '',
        eventCode: event.event_code,
        status: a.status,
        score: a.score,
        totalQuestions: a.total_questions,
        percentage: a.percentage,
        durationTakenSeconds: a.duration_taken_seconds,
        startedAt: a.started_at,
        completedAt: a.completed_at,
      };
    });
  }

  public exportEventCSV(eventCode: string): string {
    const attempts = this.getEventAttemptsDetails(eventCode);
    const headers = [
      'Rank',
      'Full Name',
      'Email / Mobile',
      'College Name',
      'Branch',
      'Year',
      'Status',
      'Score',
      'Total Questions',
      'Percentage (%)',
      'Time Taken (seconds)',
      'Started At',
      'Completed At',
    ];

    // Sort by rank
    const sorted = [...attempts].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.durationTakenSeconds || 999) - (b.durationTakenSeconds || 999);
    });

    const rows = sorted.map((att, idx) => [
      att.status === 'completed' ? idx + 1 : 'N/A',
      `"${att.fullName.replace(/"/g, '""')}"`,
      `"${att.identifier.replace(/"/g, '""')}"`,
      `"${att.collegeName.replace(/"/g, '""')}"`,
      `"${att.branch.replace(/"/g, '""')}"`,
      `"${att.year.replace(/"/g, '""')}"`,
      att.status,
      att.score,
      att.totalQuestions,
      att.percentage,
      att.durationTakenSeconds || '',
      att.startedAt,
      att.completedAt || '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n') + '\r\n';
  }

  public getRawData() {
    return {
      events: this.data.events,
      questions: this.data.questions,
      participants: this.data.participants,
      quiz_attempts: this.data.quiz_attempts,
      attempt_answers: this.data.attempt_answers,
    };
  }
}

// Supabase credentials are hardcoded in supabaseDb.ts (server-side only).
// The store always uses Supabase; no env-var check needed.
import { SupabaseDatabaseStore } from './supabaseDb.js';

const db = new SupabaseDatabaseStore();

export { db };
