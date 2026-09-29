import { Event } from '../types/index.js';
import { SAMPLE_QUESTIONS } from './sampleQuestions.js';

/**
 * Static event configuration. The quiz portal no longer stores events in a database —
 * edit this list to add or change events. Questions come from sampleQuestions.ts.
 *
 * Each event picks a subset of question ids from the question bank.
 */
const DEMO_QIDS = SAMPLE_QUESTIONS.map((q) => q.id);

export const STATIC_EVENTS: Event[] = [
  {
    id: 'event-demo-2026',
    event_name: 'Innovit AI Challenge Demo',
    college_name: 'Innovit Partner College',
    event_code: 'DEMO2026',
    description:
      'Test your understanding of modern Artificial Intelligence, Machine Learning, Generative AI, and Agentic AI in 10 quick questions.',
    duration_seconds: 600,
    is_active: true,
    leaderboard_enabled: true,
    question_ids: DEMO_QIDS,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-01-01').toISOString(),
  },
];

export function findEventByCode(code: string): Event | null {
  if (!code) return null;
  const norm = code.trim().toUpperCase();
  return STATIC_EVENTS.find((e) => e.event_code.toUpperCase() === norm) || null;
}

export function findEventById(id: string): Event | null {
  return STATIC_EVENTS.find((e) => e.id === id) || null;
}
