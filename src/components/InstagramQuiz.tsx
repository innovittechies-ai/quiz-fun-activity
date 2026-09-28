import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Instagram, Gift, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';

interface QuizOption {
  label: string;
  correct: boolean;
}

const QUESTION = 'What is the Instagram ID of Innovit?';

const OPTIONS: QuizOption[] = [
  { label: '@innovit_technologies', correct: true },
  { label: '@innovittechnologies', correct: false },
  { label: '@innovit_technology', correct: false },
  { label: '@innovit.tech', correct: false },
];

const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const InstagramQuiz: React.FC = () => {
  const [options, setOptions] = useState<QuizOption[]>(() => shuffle(OPTIONS));
  const [selected, setSelected] = useState<QuizOption | null>(null);

  const correctOption = useMemo(() => OPTIONS.find((o) => o.correct)!, []);

  const handlePick = (opt: QuizOption) => {
    if (selected) return;
    setSelected(opt);
    if (opt.correct) {
      try {
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 }, colors: ['#4ADE80', '#FDE047', '#7DD3FC', '#FB923C'] });
        setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.6 } }), 350);
      } catch {
        /* ignore */
      }
    }
  };

  const reset = () => {
    setSelected(null);
    setOptions(shuffle(OPTIONS));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
          <Instagram className="w-4 h-4 text-emerald-600" />
          Follow &amp; Win &bull; Surprise T-Shirt
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-emerald-900 mb-1">Quick Instagram Quiz</h2>
        <p className="text-sm text-slate-600">
          Ask the student the question below. They pick one option. Get it right &mdash; win a T-shirt!
        </p>
      </div>

      {/* Question card */}
      <div className="p-6 rounded-2xl bg-white border border-emerald-200 shadow-xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400 flex items-center justify-center">
            <Instagram className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Question</p>
            <h3 className="text-lg font-black text-slate-800 leading-snug">{QUESTION}</h3>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt, i) => {
            const isPicked = selected === opt;
            const reveal = !!selected;
            const isCorrect = opt.correct;
            let cls = 'bg-white border-emerald-200 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50';
            if (reveal && isCorrect) {
              cls = 'bg-emerald-50 border-emerald-500 text-emerald-800';
            } else if (reveal && isPicked && !isCorrect) {
              cls = 'bg-rose-50 border-rose-500 text-rose-800';
            } else if (reveal) {
              cls = 'bg-white border-slate-200 text-slate-400 opacity-70';
            }
            return (
              <button
                key={i}
                onClick={() => handlePick(opt)}
                disabled={!!selected}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all cursor-pointer disabled:cursor-not-allowed ${cls}`}
              >
                <span className="font-mono">{opt.label}</span>
                {reveal && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                {reveal && isPicked && !isCorrect && <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Result */}
        {selected && (
          <div className="mt-5">
            {selected.correct ? (
              <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Trophy className="w-3.5 h-3.5" /> Winner
                </div>
                <p className="text-lg font-black text-amber-900">🎉 Correct! You win a T-shirt!</p>
                <p className="text-xs text-amber-700 mt-1">
                  The correct Instagram ID is{' '}
                  <span className="font-mono font-bold">{correctOption.label}</span>. Don&apos;t forget to follow us!
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-center">
                <p className="text-sm font-bold text-rose-800">❌ Not quite!</p>
                <p className="text-xs text-rose-600 mt-1">
                  The correct Instagram ID is{' '}
                  <span className="font-mono font-bold">{correctOption.label}</span>. Better luck next time!
                </p>
              </div>
            )}

            <div className="text-center mt-4">
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Next Student / Reset
              </button>
            </div>
          </div>
        )}

        {!selected && (
          <p className="text-[11px] text-slate-400 text-center mt-4 flex items-center justify-center gap-1">
            <Gift className="w-3.5 h-3.5" /> One-time live activity &bull; Admin only
          </p>
        )}
      </div>
    </div>
  );
};
