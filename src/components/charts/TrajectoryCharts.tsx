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

  const tooltipStyle = {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    color: '#0F172A',
    fontSize: '11px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Translation X */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs">
        <div className="text-xs font-bold text-slate-900 mb-1">
          Camera Trajectory — Translation X (px)
        </div>
        <div className="text-[11px] text-slate-500 mb-3">
          Độ dịch chuyển ngang tích lũy trước và sau làm mượt Gaussian
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="frame"
                stroke="#64748B"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="rawX"
                name="Quỹ đạo gốc X"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lkSmoothX"
                name="Làm mượt LK X"
                stroke="#0284C7"
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
      <div className="bg-white border border-slate-200 p-4 shadow-xs">
        <div className="text-xs font-bold text-slate-900 mb-1">
          Camera Trajectory — Translation Y (px)
        </div>
        <div className="text-[11px] text-slate-500 mb-3">
          Độ dịch chuyển dọc tích lũy trước và sau làm mượt Gaussian
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="frame"
                stroke="#64748B"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="rawY"
                name="Quỹ đạo gốc Y"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lkSmoothY"
                name="Làm mượt LK Y"
                stroke="#0284C7"
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
      <div className="bg-white border border-slate-200 p-4 shadow-xs">
        <div className="text-xs font-bold text-slate-900 mb-1">
          Camera Trajectory — Góc Xoay θ (độ)
        </div>
        <div className="text-[11px] text-slate-500 mb-3">
          Góc xoay camera tích lũy và đường làm mượt xoay
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="frame"
                stroke="#64748B"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line
                type="monotone"
                dataKey="rawAngle"
                name="Góc gốc (độ)"
                stroke="#F59E0B"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lkSmoothAngle"
                name="Làm mượt LK θ"
                stroke="#0284C7"
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
