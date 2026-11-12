import React, { useEffect, useState } from 'react';
import {
  Play,
  FileSpreadsheet,
  FileJson,
  FileText,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DecodedVideoSession } from '../types/video';
import { BenchmarkExperimentRecord, BenchmarkRow } from '../types/benchmark';
import { BenchmarkCharts } from '../components/charts/BenchmarkCharts';
import {
  buildExportFileName,
  generateBenchmarkCsv,
  generateBenchmarkJson,
  generateExperimentReportHtml,
  triggerBrowserDownload,
} from '../evaluation/reportGenerator';

export type BenchmarkSortKey =
  | 'default'
  | 'fastest_fps'
  | 'lowest_time'
  | 'highest_iou'
  | 'best_f1'
  | 'lowest_jitter';

export interface BenchmarkLabProps {
  session: DecodedVideoSession;
  currentRecord: BenchmarkExperimentRecord | null;
  isRunning: boolean;
  progressLabel: string;
  numTrialRuns: 1 | 3;
  onChangeNumTrialRuns: (runs: 1 | 3) => void;
  onRunBenchmark: () => void;
}

export const BenchmarkLab: React.FC<BenchmarkLabProps> = ({
  session,
  currentRecord,
  isRunning,
  progressLabel,
  numTrialRuns,
  onChangeNumTrialRuns,
  onRunBenchmark,
}) => {
  const [sortKey, setSortKey] = useState<BenchmarkSortKey>('default');

  useEffect(() => {
    if (!currentRecord && session.frames.length > 0 && !isRunning) {
      onRunBenchmark();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const sortedRows: BenchmarkRow[] = React.useMemo(() => {
    if (!currentRecord) return [];
    const list = [...currentRecord.rows];
    if (sortKey === 'fastest_fps') {
      list.sort((a, b) => b.fps - a.fps);
    } else if (sortKey === 'lowest_time') {
      list.sort(
        (a, b) => a.algorithmProcessingTimeMs - b.algorithmProcessingTimeMs
      );
    } else if (sortKey === 'highest_iou') {
      list.sort((a, b) => (b.iou ?? -1) - (a.iou ?? -1));
    } else if (sortKey === 'best_f1') {
      list.sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1));
    } else if (sortKey === 'lowest_jitter') {
      list.sort(
        (a, b) => (a.jitterRmsPx ?? 999999) - (b.jitterRmsPx ?? 999999)
      );
    }
    return list;
  }, [currentRecord, sortKey]);

  const handleExportCsv = () => {
    if (!currentRecord) return;
    const csv = generateBenchmarkCsv(currentRecord);
    const fn = buildExportFileName(
      currentRecord.videoFileName,
      'ALL',
      'benchmark_results',
      'csv'
    );
    triggerBrowserDownload(csv, fn, 'text/csv;charset=utf-8');
  };

  const handleExportJson = () => {
    if (!currentRecord) return;
    const json = generateBenchmarkJson(currentRecord);
    const fn = buildExportFileName(
      currentRecord.videoFileName,
      'ALL',
      'benchmark_results',
      'json'
    );
    triggerBrowserDownload(json, fn, 'application/json;charset=utf-8');
  };

  const handleExportHtml = () => {
    if (!currentRecord) return;
    const html = generateExperimentReportHtml(currentRecord);
    const fn = buildExportFileName(
      currentRecord.videoFileName,
      'ALL',
      'experiment_report',
      'html'
    );
    triggerBrowserDownload(html, fn, 'text/html;charset=utf-8');
  };

  const fmtCell = (
    v: number | null,
    digits = 3,
    isGtMetric = false
  ): string => {
    if (v === null || Number.isNaN(v)) {
      return isGtMetric ? 'N/A – Ground Truth Unavailable' : 'N/A';
    }
    return v.toFixed(digits);
  };

  return (
    <div className="space-y-6">
      {/* Top Benchmark Protocol Bar */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            Module D: Quantitative Evaluation & Benchmark Lab
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Standardized benchmark protocol: identical video input, resolution ({session.metadata.processingWidth}×{session.metadata.processingHeight}), frame count ({session.frames.length}), warm-up initialization, and median algorithm runtime measurement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Benchmark trial runs"
            value={numTrialRuns}
            onChange={(e) =>
              onChangeNumTrialRuns(Number(e.target.value) as 1 | 3)
            }
            className="bg-white border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800"
          >
            <option value={1}>1 Trial Run (Fast Check)</option>
            <option value={3}>3 Trial Runs (Median Protocol)</option>
          </select>

          <button
            type="button"
            disabled={isRunning}
            onClick={onRunBenchmark}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {isRunning
                ? progressLabel || 'Running Benchmark Protocol...'
                : 'Run Benchmark Suite'}
            </span>
          </button>

          <button
            type="button"
            disabled={!currentRecord}
            onClick={handleExportCsv}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            disabled={!currentRecord}
            onClick={handleExportJson}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            disabled={!currentRecord}
            onClick={handleExportHtml}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Report HTML</span>
          </button>
        </div>
      </div>

      {/* Ground Truth Availability Notice */}
      {currentRecord && (
        <div
          className={`px-4 py-2.5 border text-xs flex items-center justify-between gap-4 ${
            currentRecord.hasGroundTruth
              ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
              : 'bg-amber-950/30 border-amber-800/80 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {currentRecord.hasGroundTruth ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>
              {currentRecord.hasGroundTruth
                ? `Ground Truth Verified: Pixel-level IoU, Precision, Recall, and F1-Score are computed against ${session.groundTruthMasks.size} reference masks.`
                : 'N/A – Ground Truth Unavailable: Segmentation accuracy metrics (IoU, Precision, Recall, F1) are strictly marked N/A when no Ground Truth masks are loaded. Upload a Ground Truth PNG .zip on Dashboard or load a Synthetic Scenario.'}
            </span>
          </div>
          <span className="font-mono text-[11px] whitespace-nowrap">
            Experiment ID: {currentRecord.experimentId}
          </span>
        </div>
      )}

      {/* Sortable Algorithm Comparison Table */}
      {currentRecord && (
        <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Cross-Algorithm Quantitative Comparison Table
              </h2>
              <p className="text-xs text-slate-600">
                Separates pure Algorithm Processing Time (ms/frame) from Total Pipeline Time (ms). Non-applicable metrics are explicitly marked N/A.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-600 flex items-center gap-1 mr-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                Sort by:
              </span>
              {(
                [
                  { id: 'default', label: 'Default Order' },
                  { id: 'fastest_fps', label: 'Fastest (FPS)' },
                  { id: 'lowest_time', label: 'Lowest Processing Time' },
                  { id: 'highest_iou', label: 'Highest IoU' },
                  { id: 'best_f1', label: 'Best F1' },
                  { id: 'lowest_jitter', label: 'Lowest Jitter' },
                ] as { id: BenchmarkSortKey; label: string }[]
              ).map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSortKey(btn.id)}
                  className={`px-2.5 py-1 border text-xs font-mono cursor-pointer ${
                    sortKey === btn.id
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-700 font-mono bg-slate-50">
                  <th className="py-2.5 px-3">Algorithm</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">
                    Alg Time (ms/f)
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Total Time (ms)
                  </th>
                  <th className="py-2.5 px-3 text-right">FPS</th>
                  <th className="py-2.5 px-3 text-right">Jitter RMS (px)</th>
                  <th className="py-2.5 px-3 text-right">IoU</th>
                  <th className="py-2.5 px-3 text-right">Precision</th>
                  <th className="py-2.5 px-3 text-right">Recall</th>
                  <th className="py-2.5 px-3 text-right">F1-Score</th>
                  <th className="py-2.5 px-3 text-right">Border Loss</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-800/70 hover:bg-slate-800/30 font-mono tabular-nums"
                  >
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-semibold text-slate-100">
                        {row.algorithmName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {row.engineNote}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">
                      {row.category}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-300">
                      {row.algorithmProcessingTimeMs.toFixed(2)} ms
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {row.totalPipelineTimeMs.toFixed(1)} ms
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                      {row.fps.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {fmtCell(row.jitterRmsPx, 3)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {row.category === 'Stabilization'
                        ? 'N/A'
                        : fmtCell(row.iou, 4, true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {row.category === 'Stabilization'
                        ? 'N/A'
                        : fmtCell(row.precision, 4, true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {row.category === 'Stabilization'
                        ? 'N/A'
                        : fmtCell(row.recall, 4, true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {row.category === 'Stabilization'
                        ? 'N/A'
                        : fmtCell(row.f1, 4, true)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {row.borderLossPercent !== null
                        ? `${row.borderLossPercent.toFixed(2)}%`
                        : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={
                          row.status === 'Completed'
                            ? 'text-emerald-400'
                            : row.status === 'Partial Fallback'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7 Scientific Recharts Visualizations */}
      {currentRecord && <BenchmarkCharts record={currentRecord} />}
    </div>
  );
};
