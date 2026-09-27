export type OptionLetter = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: OptionLetter;
  explanation: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Client question without the sensitive correct answer
export interface ClientQuestion {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  topic: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface Event {
  id: string;
  event_name: string;
  college_name: string;
  event_code: string;
  description: string;
  duration_seconds: number;
  is_active: boolean;
  leaderboard_enabled: boolean;
  question_ids: string[];
  created_at: string;
  updated_at?: string;
}

export interface Participant {
  id: string;
  event_id: string;
  full_name: string;
  identifier: string; // Mobile or email
  college_name: string;
  branch?: string;
  year?: string;
  created_at: string;
}

export type AttemptStatus = 'in_progress' | 'completed' | 'expired' | 'reset';

export interface QuizAttempt {
  id: string;
  event_id: string;
  participant_id: string;
  status: AttemptStatus;
  started_at: string;
  completed_at: string | null;
  duration_taken_seconds: number | null;
  score: number;
  percentage: number;
  total_questions: number;
  device_info?: string;
  created_at: string;
}

export interface AttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: OptionLetter | null;
  is_correct: boolean;
  answered_at: string;
}

export interface QuestionResult {
  questionId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: OptionLetter | null;
  correctAnswer: OptionLetter;
  isCorrect: boolean;
  explanation: string;
  topic: string;
}

export interface QuizResultPayload {
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  durationTakenSeconds: number;
  participant: {
    fullName: string;
    collegeName: string;
    branch?: string;
  };
  event: {
    eventName: string;
    collegeName: string;
    eventCode: string;
    leaderboardEnabled: boolean;
  };
  questions: QuestionResult[];
}

export interface LeaderboardEntry {
  rank: number;
  participantName: string;
  collegeName: string;
  branch?: string;
  score: number;
  totalQuestions: number;
  durationTakenSeconds: number;
  completedAt: string;
}

export interface AdminStats {
  totalParticipants: number;
  completedAttempts: number;
  activeAttempts: number;
  averageScore: number;
  highestScore: number;
  totalEvents: number;
  totalQuestions: number;
}
