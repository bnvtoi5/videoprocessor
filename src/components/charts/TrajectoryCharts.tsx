import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrajectoryState } from '../../types/algorithm';

export interface TrajectoryChartsProps {
  lkTrajectories: TrajectoryState[];
  eccTrajectories?: TrajectoryState[];
}

export const TrajectoryCharts: React.FC<TrajectoryChartsProps> = ({
  lkTrajectories,
  eccTrajectories,
}) => {
  const data = lkTrajectories.map((t, idx) => {
    const ecc = eccTrajectories?.[idx];
    return {
      frame: t.frameIndex,
      rawX: Number(t.rawX.toFixed(2)),
      lkSmoothX: Number(t.smoothX.toFixed(2)),
      eccSmoothX: ecc ? Number(ecc.smoothX.toFixed(2)) : undefined,
      rawY: Number(t.rawY.toFixed(2)),
      lkSmoothY: Number(t.smoothY.toFixed(2)),
      eccSmoothY: ecc ? Number(ecc.smoothY.toFixed(2)) : undefined,
      rawAngle: Number(t.rawAngle.toFixed(3)),
      lkSmoothAngle: Number(t.smoothAngle.toFixed(3)),
      eccSmoothAngle: ecc ? Number(ecc.smoothAngle.toFixed(3)) : undefined,
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Translation X */}
      <div className="bg-[#111827] border border-slate-800 p-4">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          Camera Trajectory — Translation X (px)
        </div>
        <div className="text-[11px] text-slate-400 mb-3">
          Cumulative horizontal camera displacement before and after Gaussian smoothing
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="frame"
                stroke="#64748B"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0E17',
                  borderColor: '#334155',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="rawX"
                name="Raw Trajectory X"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lkSmoothX"
                name="LK+RANSAC Smooth X"
                stroke="#06B6D4"
                strokeWidth={2}
                dot={false}
              />
              {eccTrajectories && eccTrajectories.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="eccSmoothX"
                  name="ECC Smooth X"
                  stroke="#10B981"
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Translation Y */}
      <div className="bg-[#111827] border border-slate-800 p-4">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          Camera Trajectory — Translation Y (px)
        </div>
        <div className="text-[11px] text-slate-400 mb-3">
          Cumulative vertical camera displacement before and after Gaussian smoothing
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="frame"
                stroke="#64748B"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0E17',
                  borderColor: '#334155',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="rawY"
                name="Raw Trajectory Y"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lkSmoothY"
                name="LK+RANSAC Smooth Y"
                stroke="#06B6D4"
                strokeWidth={2}
                dot={false}
              />
              {eccTrajectories && eccTrajectories.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="eccSmoothY"
                  name="ECC Smooth Y"
                  stroke="#10B981"
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Rotation Angle */}
      <div className="bg-[#111827] border border-slate-800 p-4">
        <div className="text-xs font-semibold text-slate-200 mb-1">
          Camera Trajectory — Roll Rotation θ (deg)
        </div>
        <div className="text-[11px] text-slate-400 mb-3">
          Cumulative in-plane angular trajectory and rotational stabilization curve
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis
                dataKey="frame"
                stroke="#64748B"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0E17',
                  borderColor: '#334155',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="rawAngle"
                name="Raw Angle (deg)"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lkSmoothAngle"
                name="LK+RANSAC Smooth θ"
                stroke="#06B6D4"
                strokeWidth={2}
                dot={false}
              />
              {eccTrajectories && eccTrajectories.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="eccSmoothAngle"
                  name="ECC Smooth θ"
                  stroke="#10B981"
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
