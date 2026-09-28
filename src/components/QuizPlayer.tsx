import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClientQuestion, OptionLetter, QuizResultPayload } from '../types/index.js';
import { api } from '../services/api.js';
import {
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  Flame,
  BrainCircuit,
} from 'lucide-react';

interface QuizPlayerProps {
  attemptId: string;
  questions: ClientQuestion[];
  initialRemainingSeconds: number;
  initialAnswers: Record<string, OptionLetter>;
  onComplete: (result: QuizResultPayload) => void;
  eventName: string;
  collegeName: string;
}

export const QuizPlayer: React.FC<QuizPlayerProps> = ({
  attemptId,
  questions,
  initialRemainingSeconds,
  initialAnswers,
  onComplete,
  eventName,
  collegeName,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionLetter>>(initialAnswers);
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemainingSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const currentQ = questions[currentIndex];
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false);

  // Auto-submit handler
  const performSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);

      const result = await api.submitQuiz(attemptId, answers);
      onComplete(result);
    } catch (err: any) {
      console.error('Submission error:', err);
      // Attempt to load finalized result if server already auto-submitted
      try {
        const result = await api.getResult(attemptId);
        onComplete(result);
      } catch (fallbackErr) {
        alert(err.message || 'Error submitting quiz. Please notify the administrator.');
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    }
  }, [attemptId, answers, onComplete]);

  // Server countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          performSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [performSubmit]);

  // Periodic resync with server (every 20s) to keep timer true and detect server-side auto-expiry
  useEffect(() => {
    syncTimerRef.current = setInterval(async () => {
      try {
        const status = await api.checkAttempt(attemptId);
        if (status.status === 'completed' || status.expired) {
          if (status.result) {
            onComplete(status.result);
          } else {
            const res = await api.getResult(attemptId);
            onComplete(res);
          }
        } else if (typeof status.remainingSeconds === 'number') {
          setRemainingSeconds(status.remainingSeconds);
        }
      } catch (e) {
        // Silent catch for periodic ping
      }
    }, 20000);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [attemptId, onComplete]);

  // Option selection: strictly kept in frontend React state during the active quiz to eliminate per-click network requests
  const handleSelectOption = (option: OptionLetter) => {
    if (!currentQ || isSubmitting) return;

    const newAnswers = { ...answers, [currentQ.id]: option };
    setAnswers(newAnswers);
  };

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = answeredCount === questions.length;
  const isTimeCritical = remainingSeconds <= 60;
  const isTimeUrgent = remainingSeconds <= 20;

  const optionLetters: OptionLetter[] = ['A', 'B', 'C', 'D'];
  const optionKeys = ['option_a', 'option_b', 'option_c', 'option_d'] as const;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">
      {/* Sticky Quiz Header */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 mb-6 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          {/* Progress Info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Question {currentIndex + 1} of {questions.length}
              </span>
              {currentQ?.topic && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-cyan-300 border border-slate-700">
                  {currentQ.topic}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-xs">
              {eventName} &bull; {collegeName}
            </p>
          </div>

          {/* Countdown Clock */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm sm:text-base tracking-wider transition-all duration-300 ${
              isTimeUrgent
                ? 'bg-rose-500/20 text-rose-300 border-rose-500 animate-pulse shadow-rose-500/30 shadow-lg'
                : isTimeCritical
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20 shadow-md'
                : 'bg-slate-900 text-cyan-300 border-cyan-500/30'
            }`}
          >
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'animate-spin' : ''}`} />
            <span>{formatTime(remainingSeconds)}</span>
          </div>
        </div>

        {/* Progress Dots Bar */}
        <div className="flex items-center gap-1.5 mt-2.5">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answers[q.id]);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 flex-1 rounded-full transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-cyan-400 ring-2 ring-cyan-400/40 h-2'
                    : isAnswered
                    ? 'bg-indigo-500 hover:bg-indigo-400'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
                title={`Jump to Question ${idx + 1}`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Question Card */}
      {currentQ && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-2xl mb-6 relative overflow-hidden">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold text-sm">
              {currentIndex + 1}
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white leading-relaxed">
              {currentQ.question}
            </h2>
          </div>

          {/* Options List */}
          <div className="space-y-3">
            {optionLetters.map((letter, optIdx) => {
              const optionText = currentQ[optionKeys[optIdx]];
              const isSelected = answers[currentQ.id] === letter;

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleSelectOption(letter)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 group cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/25 border-cyan-400/80 shadow-md shadow-indigo-500/20 text-white ring-1 ring-cyan-400/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950 text-slate-200'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-cyan-400 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
                    }`}
                  >
                    {letter}
                  </div>
                  <span className="text-sm sm:text-base font-normal leading-snug pt-0.5">
                    {optionText}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status micro-indicator */}
          <div className="flex items-center justify-between mt-4 text-[11px] text-slate-400 px-1">
            <span>
              {answers[currentQ.id] ? (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Option {answers[currentQ.id]} selected
                </span>
              ) : (
                <span className="text-slate-400">Select one option to continue</span>
              )}
            </span>
            <span className="text-slate-500 font-medium">
              Tap any option to change
            </span>
          </div>
        </div>
      )}

      {/* Navigation Buttons Footer */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0 || isSubmitting}
          className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-sm flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Submit Quiz</span>
          </button>
        )}
      </div>

      {/* Direct Submit quick access button if all answered */}
      {currentIndex < questions.length - 1 && isAllAnswered && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowConfirmModal(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-4 cursor-pointer"
          >
            All {questions.length} questions answered! Click here to review and submit now &rarr;
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <BrainCircuit className="w-6 h-6 text-cyan-400" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Submit Your Quiz?</h3>

            <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <p className="font-semibold mb-1">
                You have answered <span className="text-white font-bold">{answeredCount}</span> of{' '}
                <span className="text-white font-bold">{questions.length}</span> questions.
              </p>
              {!isAllAnswered && (
                <p className="text-amber-400 flex items-center justify-center gap-1 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {questions.length - answeredCount} unanswered questions will count as 0 marks.
                </p>
              )}
              <p className="text-slate-400 mt-2">
                Time remaining: <span className="font-mono text-cyan-300">{formatTime(remainingSeconds)}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Keep Reviewing
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  performSubmit();
                }}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                {isSubmitting ? 'Calculating...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
