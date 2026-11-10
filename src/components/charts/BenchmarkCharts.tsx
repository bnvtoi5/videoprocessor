import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BenchmarkExperimentRecord } from '../../types/benchmark';

export interface BenchmarkChartsProps {
  record: BenchmarkExperimentRecord;
}

export const BenchmarkCharts: React.FC<BenchmarkChartsProps> = ({ record }) => {
  const stabRows = record.rows.filter(
    (r) => r.category === 'Stabilization' || r.category === 'Combined Pipeline'
  );
  const segRows = record.rows.filter(
    (r) =>
      r.category === 'Background Separation' ||
      r.category === 'Combined Pipeline'
  );

  const stabilityBarData = stabRows.map((r) => ({
    name: r.algorithmName.replace(/^[A-Z0-9]+\.\s*/, ''),
    translationJitterRms: Number((r.jitterRmsPx ?? 0).toFixed(3)),
    rotationJitterRms: Number(((r.rotationJitterRmsDeg ?? 0) * 10).toFixed(3)),
    borderLoss: Number((r.borderLossPercent ?? 0).toFixed(2)),
  }));

  const segmentationBarData = segRows.map((r) => ({
    name: r.algorithmName.replace(/^[A-Z0-9]+\.\s*/, ''),
    IoU: Number(((r.iou ?? 0) * 100).toFixed(2)),
    F1: Number(((r.f1 ?? 0) * 100).toFixed(2)),
    Precision: Number(((r.precision ?? 0) * 100).toFixed(2)),
    Recall: Number(((r.recall ?? 0) * 100).toFixed(2)),
  }));

  const fpsChartData = record.rows
    .filter((r) => r.id !== 'stab_original')
    .map((r) => ({
      name: r.algorithmName.replace(/^[A-Z0-9]+\.\s*/, ''),
      fps: Number(r.fps.toFixed(1)),
      frameTimeMs: Number(r.algorithmProcessingTimeMs.toFixed(2)),
      totalPipelineMs: Number(r.totalPipelineTimeMs.toFixed(1)),
    }));

  const scatterData = record.rows
    .filter((r) => r.id !== 'stab_original')
    .map((r) => {
      // Quality proxy: for segmentation use F1*100 (or 100 - flicker if no GT); for stabilization use 100 / (1 + jitter)
      let qualityScore = 0;
      if (r.f1 !== null) {
        qualityScore = r.f1 * 100;
      } else if (r.jitterRmsPx !== null) {
        qualityScore = 100 / (1 + r.jitterRmsPx);
      } else {
        qualityScore = Math.max(0, 100 - (r.maskFlickerPercent ?? 10) * 5);
      }
      return {
        name: r.algorithmName,
        fps: Number(r.fps.toFixed(2)),
        quality: Number(qualityScore.toFixed(2)),
        timeMs: Number(r.algorithmProcessingTimeMs.toFixed(2)),
      };
    });

  const tooltipStyle = {
    backgroundColor: '#0B0E17',
    borderColor: '#334155',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Camera Trajectory Line Chart */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            1. Camera Trajectory Line Chart (X/Y Cumulative Displacement)
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            Comparison of Unstabilized Raw Trajectory vs Smoothed LK+RANSAC and ECC
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={record.trajectorySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="frame" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="originalX"
                  name="Original Raw X"
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
                <Line
                  type="monotone"
                  dataKey="eccSmoothX"
                  name="ECC Smooth X"
                  stroke="#10B981"
                  strokeWidth={1.75}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Translation/Rotation High-Frequency Jitter Residual Chart */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            2. High-Frequency Jitter Compensation Magnitude (px)
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            Per-frame corrective displacement |P_smooth(t) - P_raw(t)| removed by stabilization
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={record.trajectorySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="frame" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="lkJitterDelta"
                  name="LK+RANSAC Jitter Removed (px)"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="eccJitterDelta"
                  name="ECC Jitter Removed (px)"
                  stroke="#F59E0B"
                  strokeWidth={1.75}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 3: Stability Comparison Bar Chart */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            3. Stability Comparison Bar Chart (Second-Order Jitter RMS & Border Loss)
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            Lower Jitter RMS indicates smoother camera trajectory
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stabilityBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="translationJitterRms"
                  name="Translation Jitter RMS (px)"
                  fill="#06B6D4"
                />
                <Bar
                  dataKey="rotationJitterRms"
                  name="Rotation Jitter RMS (×10 deg)"
                  fill="#F59E0B"
                />
                <Bar
                  dataKey="borderLoss"
                  name="Border Loss (%)"
                  fill="#64748B"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Segmentation IoU / F1 Grouped Bar Chart */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            4. Segmentation Accuracy Grouped Bar Chart (IoU, F1, Precision, Recall %)
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            {record.hasGroundTruth
              ? 'Evaluated against pixel-aligned Ground Truth masks'
              : 'N/A – Ground Truth Unavailable (Upload GT ZIP or use Synthetic Demo to populate)'}
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentationBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#64748B"
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="IoU" name="IoU (%)" fill="#06B6D4" />
                <Bar dataKey="F1" name="F1-Score (%)" fill="#10B981" />
                <Bar dataKey="Precision" name="Precision (%)" fill="#3B82F6" />
                <Bar dataKey="Recall" name="Recall (%)" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 5: Processing FPS Chart */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            5. Processing Throughput (FPS)
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            Effective algorithm throughput in frames per second
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fpsChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis type="number" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  stroke="#64748B"
                  tick={{ fontSize: 9 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="fps" name="Throughput (FPS)" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 6: Processing Time Chart */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            6. Median Frame Latency (ms / frame)
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            Pure algorithm runtime excluding video decode/encode
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fpsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 9 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="frameTimeMs"
                  name="Median ms / frame"
                  fill="#F59E0B"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 7: Speed vs Quality Scatter Plot */}
        <div className="bg-[#111827] border border-slate-800 p-4">
          <div className="text-xs font-semibold text-slate-200 mb-1">
            7. Speed (FPS) vs Quality Score Scatter Plot
          </div>
          <div className="text-[11px] text-slate-400 mb-3">
            Pareto trade-off between throughput (FPS) and accuracy/stability
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  type="number"
                  dataKey="fps"
                  name="Throughput"
                  unit=" fps"
                  stroke="#64748B"
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="quality"
                  name="Quality Score"
                  unit="%"
                  stroke="#64748B"
                  tick={{ fontSize: 10 }}
                />
                <ZAxis type="category" dataKey="name" name="Algorithm" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Scatter
                  name="Evaluated Algorithms"
                  data={scatterData}
                  fill="#06B6D4"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
