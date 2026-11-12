import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaText?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral' | 'warning' | string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';
  subtitle?: string;
  description?: string;
}

const ACCENT_BORDER: Record<NonNullable<MetricCardProps['accent']>, string> = {
  cyan: 'border-l-blue-600',
  emerald: 'border-l-emerald-600',
  amber: 'border-l-amber-500',
  rose: 'border-l-rose-600',
  slate: 'border-l-slate-400',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  delta,
  deltaText,
  deltaTone,
  accent = 'cyan',
  subtitle,
  description,
}) => {
  const effectiveAccent: NonNullable<MetricCardProps['accent']> =
    deltaTone === 'positive'
      ? 'emerald'
      : deltaTone === 'negative'
      ? 'rose'
      : deltaTone === 'warning'
      ? 'amber'
      : accent;

  const sub = subtitle ?? description;
  const del = delta ?? deltaText;

  return (
    <div
      className={`bg-white border border-slate-200 border-l-2 ${ACCENT_BORDER[effectiveAccent]} p-3 flex flex-col justify-between shadow-2xs`}
    >
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-slate-500">{unit}</span>
        )}
      </div>
      {(del || sub) && (
        <div className="mt-1 flex flex-col gap-0.5 text-[11px] font-mono text-slate-600">
          {del && (
            <span className="text-slate-800 font-semibold truncate">{del}</span>
          )}
          {sub && <span className="text-slate-500 truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
};
