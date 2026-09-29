import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { QuizResultPayload } from '../types/index.js';
import {
  Trophy,
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  HelpCircle,
  Award,
  Instagram,
  Linkedin,
  Heart,
} from 'lucide-react';

interface QuizResultProps {
  result: QuizResultPayload;
  onHome: () => void;
}

export const QuizResult: React.FC<QuizResultProps> = ({ result, onHome }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Confetti celebration if passed with high score
    if (result.score >= 3) {
      try {
        confetti({
          particleCount: result.score === 5 ? 120 : 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Safe fallback
      }
    }
  }, [result.score]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const getTierInfo = (score: number, total: number) => {
    const ratio = score / total;
    if (ratio === 1) {
      return {
        badge: 'AGI Architect 🧠⚡',
        message: 'Flawless 100%! You understand AI better than most model weights.',
        color: 'from-amber-400 to-yellow-500 text-yellow-950',
      };
    }
    if (ratio >= 0.8) {
      return {
        badge: 'Deep Neural Thinker 🚀',
        message: 'Outstanding performance! You have deep technical AI intuition.',
        color: 'from-cyan-400 to-indigo-500 text-white',
      };
    }
    if (ratio >= 0.6) {
      return {
        badge: 'Gradient Descent Specialist 📊',
        message: 'Solid score! Your loss function is converging nicely.',
        color: 'from-indigo-400 to-purple-500 text-white',
      };
    }
    if (ratio >= 0.2) {
      return {
        badge: 'Prompt Engineering Apprentice 🌱',
        message: 'Good attempt! A few more epochs and you will dominate the leaderboard.',
        color: 'from-slate-400 to-slate-500 text-white',
      };
    }
    return {
      badge: 'Needs More Training Epochs 🔄',
      message: 'Time to fine-tune your parameters and brush up on modern AI concepts!',
      color: 'from-rose-500 to-orange-500 text-white',
    };
  };

  const tier = getTierInfo(result.score, result.totalQuestions);

  const handleShare = () => {
    const shareText = `🎯 I scored ${result.score}/${result.totalQuestions} (${result.percentage}%) in the ${result.event.eventName} organized by Innovit at ${result.participant.collegeName}! Can you beat my time of ${formatSeconds(result.durationTakenSeconds)}?`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Header Score Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 sm:p-8 text-center shadow-2xl mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-4">
          <Award className="w-3.5 h-3.5 text-cyan-400" />
          Official Quiz Result
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          {result.participant.fullName}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">
          {result.event.eventName} &bull; {result.participant.collegeName}
        </p>

        {/* Score Ring Display */}
        <div className="inline-flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/80 border border-indigo-500/40 shadow-xl mb-4">
          <span className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-white font-mono">
            {result.score} / {result.totalQuestions}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-cyan-400 mt-1 uppercase tracking-wider">
            {result.percentage}% Correct
          </span>
        </div>

        {/* Tier Badge */}
        <div className="mb-4">
          <span
            className={`inline-block px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-gradient-to-r shadow-md ${tier.color}`}
          >
            {tier.badge}
          </span>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto">
            {tier.message}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-4 border-t border-slate-800 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">Time Taken:</span>
            <span className="font-bold text-white font-mono">{formatSeconds(result.durationTakenSeconds)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Correct:</span>
            <span className="font-bold text-emerald-400 font-mono">
              {result.score} of {result.totalQuestions}
            </span>
          </div>
        </div>

        {/* Actions Button Row */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
          <button
            onClick={handleShare}
            className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span>{copied ? 'Score Copied to Clipboard!' : 'Share Result'}</span>
          </button>
        </div>
      </div>

      {/* Follow Us on Instagram & LinkedIn */}
      <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-fuchsia-900/30 via-rose-900/20 to-blue-900/30 border border-fuchsia-500/30 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white">Loved the challenge? Follow Innovit for more!</h3>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://www.instagram.com/innovit_technologies"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400 hover:opacity-90 text-white font-bold text-sm shadow-lg transition-all"
          >
            <Instagram className="w-4 h-4" />
            <span>@innovit_technologies</span>
          </a>
          <a
            href="https://www.linkedin.com/school/innovit-technology/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A66C2] hover:bg-[#0a4fb0] text-white font-bold text-sm shadow-lg transition-all"
          >
            <Linkedin className="w-4 h-4" />
            <span>Innovit Technologies</span>
          </a>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">Stay connected for upcoming challenges, internships, and AI workshops.</p>
      </div>

      {/* Question Review Section with Explanations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            Question-by-Question Review & Explanations
          </h2>
        </div>

        {result.questions.map((q, idx) => {
          const isCorrect = q.isCorrect;
          const selectedText = q.selectedOption
            ? q[`option${q.selectedOption}` as keyof typeof q]
            : 'Unanswered';
          const correctText = q[`option${q.correctAnswer}` as keyof typeof q];

          return (
            <div
              key={q.questionId}
              className={`p-5 rounded-2xl border transition-all ${
                isCorrect
                  ? 'bg-slate-900/80 border-emerald-500/30 shadow-sm'
                  : 'bg-slate-900/80 border-rose-500/30 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Question {idx + 1} &bull; {q.topic}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isCorrect
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> +1 Mark (Correct)
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> 0 Marks (Incorrect)
                    </>
                  )}
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-semibold text-white mb-3 leading-snug">
                {q.question}
              </h3>

              {/* Answers Comparison */}
              <div className="space-y-1.5 text-xs sm:text-sm mb-3">
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    isCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <span>
                    Your Answer:{' '}
                    <strong className="text-white">
                      {q.selectedOption ? `Option ${q.selectedOption}` : 'None'}
                    </strong>
                  </span>
                  <span className="text-xs truncate max-w-[200px] text-slate-300">
                    {selectedText}
                  </span>
                </div>

                {!isCorrect && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-between">
                    <span>
                      Correct Answer:{' '}
                      <strong className="text-emerald-400">Option {q.correctAnswer}</strong>
                    </span>
                    <span className="text-xs truncate max-w-[200px] text-slate-300">
                      {correctText}
                    </span>
                  </div>
                )}
              </div>

              {/* Explanation Card */}
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 leading-relaxed">
                <span className="font-bold text-cyan-300 block mb-0.5">💡 Why this is right:</span>
                {q.explanation}
              </div>
            </div>
          );
        })}
      </div>

      {/* Return home link */}
      <div className="text-center mt-8">
        <button
          onClick={onHome}
          className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          &larr; Back to Innovit AI Quiz Home
        </button>
      </div>
    </div>
  );
};
