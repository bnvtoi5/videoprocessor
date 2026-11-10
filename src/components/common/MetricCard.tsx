import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  description: string;
  deltaText?: string;
  deltaTone?: 'positive' | 'warning' | 'neutral';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  description,
  deltaText,
  deltaTone = 'neutral',
}) => {
  const toneColor =
    deltaTone === 'positive'
      ? 'text-emerald-400'
      : deltaTone === 'warning'
      ? 'text-amber-400'
      : 'text-slate-400';

  return (
    <div className="bg-[#111827] border border-slate-800 p-4 flex flex-col justify-between">
      <div>
        <div className="text-xs font-medium text-slate-400 tracking-wide">
          {label}
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-mono font-semibold text-slate-100 tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-mono text-slate-400">{unit}</span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col gap-1">
        {deltaText && (
          <div className={`text-xs font-mono tabular-nums ${toneColor}`}>
            {deltaText}
          </div>
        )}
        <div className="text-xs text-slate-400 leading-relaxed">
          {description}
        </div>
      </div>
    </div>
  );
};
