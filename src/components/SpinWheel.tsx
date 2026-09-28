import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Shuffle, Gift, Trophy, Phone } from 'lucide-react';

export interface WheelParticipant {
  attemptId: string;
  fullName: string;
  identifier: string;
  score?: number;
  totalQuestions?: number;
  percentage?: number;
  branch?: string;
  year?: string;
}

interface SpinWheelProps {
  participants: WheelParticipant[];
  eventCode: string;
}

// 8 segment colors (clockwise from top), matching the requested design.
const SEGMENT_COLORS = [
  '#7DD3FC', // light blue
  '#FDE047', // yellow
  '#4ADE80', // bright green
  '#FB923C', // orange
  '#F87171', // red
  '#7DD3FC', // light blue
  '#FDE047', // yellow
  '#FB923C', // orange
];

const SEGMENT_COUNT = 8;
const SIZE = 400;
const CX = 200;
const CY = 200;
const R = 178;
const TEXT_RADIUS = 116;
const SPIN_DURATION_MS = 4800;

const polar = (angleDeg: number, radius: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(a), y: CY - radius * Math.cos(a) };
};

const wedgePath = (centerAngle: number, half = 22.5) => {
  const start = centerAngle - half;
  const end = centerAngle + half;
  const s = polar(start, R);
  const e = polar(end, R);
  return `M ${CX} ${CY} L ${s.x} ${s.y} A ${R} ${R} 0 0 1 ${e.x} ${e.y} Z`;
};

const maskPhone = (id: string) => {
  if (!id) return '';
  const digits = id.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
};

const firstName = (full: string) => {
  if (!full) return '—';
  const parts = full.trim().split(/\s+/);
  return parts[0];
};

export const SpinWheel: React.FC<SpinWheelProps> = ({ participants, eventCode }) => {
  const [finalists, setFinalists] = useState<WheelParticipant[]>([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelParticipant | null>(null);
  const [storedWinner, setStoredWinner] = useState<WheelParticipant | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const completed = useMemo(
    () => participants.filter((p) => p && p.fullName),
    [participants]
  );

  const storageKey = `innovit_luckydraw_${eventCode}`;

  // Load any previously-saved winner for this event (one-time draw persistence).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setStoredWinner(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Build the initial finalists pool when participants arrive.
  useEffect(() => {
    if (completed.length === 0) {
      setFinalists([]);
      return;
    }
    if (finalists.length === 0) {
      setFinalists(sampleFinalists(completed, SEGMENT_COUNT));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  const sampleFinalists = (pool: WheelParticipant[], n: number) => {
    if (pool.length <= n) return [...pool];
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  };

  const reshuffleFinalists = () => {
    if (spinning || completed.length === 0) return;
    setWinner(null);
    setStoredWinner(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setFinalists(sampleFinalists(completed, SEGMENT_COUNT));
    setRotation(0);
  };

  const handleSpin = () => {
    if (spinning || finalists.length === 0 || storedWinner) return;
    // Fair pick: each finalist has equal probability.
    const winnerIndex = Math.floor(Math.random() * finalists.length);
    // Rotate so that the chosen segment's center lands at the top (pointer).
    // Segment i center is at angle i*45 (clockwise from top). Rotating clockwise
    // by `rot` moves it to (i*45 + rot) mod 360. We want that = 0 (top).
    const target = (360 - winnerIndex * 45) % 360;
    const fullSpins = 5;
    const newRotation = rotation + 360 * fullSpins + ((target - (rotation % 360) + 360) % 360);
    setSpinning(true);
    setWinner(null);
    setRotation(newRotation);
    window.setTimeout(() => {
      const w = finalists[winnerIndex];
      setWinner(w);
      setSpinning(false);
      try {
        localStorage.setItem(storageKey, JSON.stringify(w));
        setStoredWinner(w);
      } catch {
        /* ignore */
      }
      // Celebrate!
      try {
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.45 }, colors: ['#4ADE80', '#FDE047', '#7DD3FC', '#FB923C'] });
        setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.6 } }), 400);
      } catch {
        /* ignore */
      }
    }, SPIN_DURATION_MS + 120);
  };

  const resetDraw = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setStoredWinner(null);
    setWinner(null);
    setRotation(0);
    setFinalists(sampleFinalists(completed, SEGMENT_COUNT));
  };

  // Empty state
  if (completed.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-200 mb-4">
          <Gift className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-emerald-900 mb-2">No participants yet</h2>
        <p className="text-sm text-slate-600">
          The lucky draw wheel will be available once students complete the quiz for event{' '}
          <span className="font-mono font-bold text-emerald-700">{eventCode}</span>.
        </p>
      </div>
    );
  }

  const shownWinner = winner || storedWinner;
  const locked = !!storedWinner && !spinning;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
          <Gift className="w-4 h-4 text-emerald-600" />
          Innovit Lucky Draw &bull; T-Shirt Giveaway
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-emerald-900 mb-1">Spin the Wheel</h2>
        <p className="text-sm text-slate-600">
          {completed.length} completed participant{completed.length === 1 ? '' : 's'} for{' '}
          <span className="font-mono font-bold text-emerald-700">{eventCode}</span>. 8 random finalists are loaded on the wheel.
        </p>
      </div>

      {locked && shownWinner && (
        <div className="mb-6 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-lg text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-200 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-3">
            <Trophy className="w-3.5 h-3.5" /> Winner Already Drawn
          </div>
          <p className="text-xs text-amber-700 mb-1">Congratulations to the T-shirt winner</p>
          <p className="text-2xl font-black text-amber-900">{shownWinner.fullName}</p>
          <p className="text-sm font-mono text-amber-700 mt-1 flex items-center justify-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {shownWinner.identifier}
          </p>
          {typeof shownWinner.score === 'number' && (
            <p className="text-xs text-amber-600 mt-1">
              Score: {shownWinner.score}/{shownWinner.totalQuestions ?? 10} ({shownWinner.percentage ?? 0}%)
              {shownWinner.branch ? ` • ${shownWinner.branch}` : ''}
            </p>
          )}
          <button
            onClick={resetDraw}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset & Draw Again
          </button>
        </div>
      )}

      {/* Wheel */}
      <div className="flex flex-col items-center">
        <div ref={wheelRef} className="relative" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="w-full h-full"
            style={{ filter: 'drop-shadow(0 10px 25px rgba(16,185,129,0.25))' }}
          >
            {/* Outer rim */}
            <circle cx={CX} cy={CY} r={R + 10} fill="#0f172a" />
            <circle cx={CX} cy={CY} r={R + 6} fill="#1e293b" />

            {/* Rotating wheel group */}
            <g
              style={{
                transform: `rotate(${rotation}deg)`,
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transition: spinning
                  ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                  : 'none',
              }}
            >
              {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
                const centerAngle = i * 45;
                const p = finalists[i];
                const label = p ? `${firstName(p.fullName)} • ${maskPhone(p.identifier)}` : '— • —';
                const flip = centerAngle > 90 && centerAngle < 270;
                return (
                  <g key={i}>
                    <path d={wedgePath(centerAngle)} fill={SEGMENT_COLORS[i]} stroke="#0f172a" strokeWidth={1.5} />
                    <g transform={`rotate(${centerAngle} ${CX} ${CY})`}>
                      <text
                        x={CX}
                        y={CY - TEXT_RADIUS}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={13}
                        fontWeight={800}
                        fill="#0f172a"
                        transform={flip ? `rotate(180 ${CX} ${CY - TEXT_RADIUS})` : undefined}
                      >
                        {label}
                      </text>
                    </g>
                  </g>
                );
              })}
              {/* White dots on the rim at each segment center */}
              {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
                const centerAngle = i * 45;
                const dot = polar(centerAngle, R + 3);
                return <circle key={`dot-${i}`} cx={dot.x} cy={dot.y} r={4.5} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />;
              })}
            </g>

            {/* Pointer (fixed at top, pointing down) */}
            <polygon
              points={`${CX - 16},${CY - R - 34} ${CX + 16},${CY - R - 34} ${CX},${CY - R - 2}`}
              fill="#FBBF24"
              stroke="#EA580C"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <circle cx={CX} cy={CY - R - 34} r={5} fill="#EA580C" />

            {/* Central hub / SPIN button */}
            <circle cx={CX} cy={CY} r={42} fill="#0f172a" />
            <circle
              cx={CX}
              cy={CY}
              r={36}
              fill="#ffffff"
              stroke="#10b981"
              strokeWidth={2}
              style={{ cursor: spinning || locked ? 'not-allowed' : 'pointer' }}
              onClick={handleSpin}
            />
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={15}
              fontWeight={900}
              fill="#065f46"
              style={{ pointerEvents: 'none', letterSpacing: '0.5px' }}
            >
              SPIN
            </text>
          </svg>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            onClick={handleSpin}
            disabled={spinning || locked || finalists.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Gift className="w-4 h-4" />
            {spinning ? 'Spinning…' : 'Spin the Wheel'}
          </button>
          <button
            onClick={reshuffleFinalists}
            disabled={spinning || locked}
            className="px-5 py-3 rounded-xl bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Shuffle className="w-4 h-4" /> Reshuffle Finalists
          </button>
        </div>

        {/* Finalists list */}
        <div className="mt-8 w-full max-w-md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 text-center">
            Today's 8 Finalists
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {finalists.map((f, i) => (
              <div
                key={f.attemptId || i}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                  shownWinner && shownWinner.attemptId === f.attemptId
                    ? 'bg-amber-100 border-amber-300'
                    : 'bg-white border-emerald-200'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COUNT] }}
                />
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 truncate">{f.fullName}</div>
                  <div className="font-mono text-[10px] text-slate-500">{maskPhone(f.identifier)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
