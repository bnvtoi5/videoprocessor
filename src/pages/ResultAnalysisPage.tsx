import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { DecodedVideoSession } from '../types/video';
import {
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationParams,
} from '../types/algorithm';
import {
  ParameterSensitivitySweepResult,
  TraceableExperimentLogEntry,
} from '../types/research';
import {
  runExperimentGroupA_Stabilization,
  runExperimentGroupB_Background,
  runExperimentGroupC_ProcessingOrder,
  runExperimentGroupD_Ablation,
} from '../evaluation/researchExperiments';
import {
  buildEvidenceGroundedInterpretations,
  generateExperimentChartSvg,
  generateResultsWorkbookXlsxBlob,
  svgStringToPngBlob,
  triggerBrowserDownload,
} from '../evaluation/reporting/exportEngine';

export interface ResultAnalysisPageProps {
  session: DecodedVideoSession;
  stabilizationParams: StabilizationParams;
  frameDiffParams: FrameDiffParams;
  mog2Params: Mog2Params;
  sampleKnnParams: SampleKnnParams;
  morphologyConfig: MorphologyConfig;
  displayConfig: ForegroundDisplayConfig;
  experimentLogs: TraceableExperimentLogEntry[];
  onAppendExperimentLog: (entry: TraceableExperimentLogEntry) => void;
  sensitivitySweeps: ParameterSensitivitySweepResult[];
  onNavigateExportCenter: () => void;
}

export const ResultAnalysisPage: React.FC<ResultAnalysisPageProps> = ({
  session,
  stabilizationParams,
  frameDiffParams,
  mog2Params,
  sampleKnnParams,
  morphologyConfig,
  displayConfig,
  experimentLogs,
  onAppendExperimentLog,
  sensitivitySweeps,
  onNavigateExportCenter,
}) => {
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [isRunningSuite, setIsRunningSuite] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const activeLog = useMemo(() => {
    if (experimentLogs.length === 0) return null;
    if (selectedRunId) {
      const found = experimentLogs.find((l) => l.experimentId === selectedRunId);
      if (found) return found;
    }
    return experimentLogs[experimentLogs.length - 1];
  }, [experimentLogs, selectedRunId]);

  const handleRunQuickAnalysis = async (group: 'A' | 'B' | 'C' | 'D') => {
    if (isRunningSuite) return;
    setIsRunningSuite(true);
    setStatusMessage(
      `Executing Group ${group} comparative DSP evaluation on "${session.metadata.fileName}"...`
    );

    try {
      let log: TraceableExperimentLogEntry;
      if (group === 'A') {
        log = await runExperimentGroupA_Stabilization(
          session,
          stabilizationParams,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          morphologyConfig,
          1,
          (_pct: number, lbl: string) => setStatusMessage(lbl)
        );
      } else if (group === 'B') {
        log = await runExperimentGroupB_Background(
          session,
          stabilizationParams,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          morphologyConfig,
          displayConfig,
          1,
          (_pct: number, lbl: string) => setStatusMessage(lbl)
        );
      } else if (group === 'C') {
        log = await runExperimentGroupC_ProcessingOrder(
          session,
          'lk_ransac',
          'mog2',
          stabilizationParams,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          morphologyConfig,
          displayConfig,
          (_pct: number, lbl: string) => setStatusMessage(lbl)
        );
      } else {
        log = await runExperimentGroupD_Ablation(
          session,
          stabilizationParams,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          morphologyConfig,
          displayConfig,
          (_pct: number, lbl: string) => setStatusMessage(lbl)
        );
      }
      onAppendExperimentLog(log);
      setSelectedRunId(log.experimentId);
    } finally {
      setIsRunningSuite(false);
      setStatusMessage('');
    }
  };

  const interpretations = useMemo(() => {
    if (!activeLog) return [];
    return buildEvidenceGroundedInterpretations(activeLog);
  }, [activeLog]);

  const chartData = useMemo(() => {
    if (!activeLog) return [];
    return activeLog.measuredRows.map((r) => {
      const code = r.algorithmLabel.split('.')[0]?.trim() || r.experimentId;
      return {
        conditionId: code,
        label: r.algorithmLabel,
        f1Pct: r.f1 !== null ? Number((r.f1 * 100).toFixed(2)) : 0,
        iouPct: r.iou !== null ? Number((r.iou * 100).toFixed(2)) : 0,
        precisionPct: r.precision !== null ? Number((r.precision * 100).toFixed(2)) : 0,
        recallPct: r.recall !== null ? Number((r.recall * 100).toFixed(2)) : 0,
        pwc: r.pwcErrorPercent !== null ? Number(r.pwcErrorPercent.toFixed(2)) : 0,
        estJitterRms: r.jitterRmsPx !== null ? Number(r.jitterRmsPx.toFixed(3)) : 0,
        remeasuredJitterRms:
          r.remeasuredJitterRmsPx !== null && r.remeasuredJitterRmsPx !== undefined
            ? Number(r.remeasuredJitterRmsPx.toFixed(3))
            : r.jitterRmsPx !== null
            ? Number(r.jitterRmsPx.toFixed(3))
            : 0,
        maskFlickerPct:
          r.maskFlickerPercent !== null ? Number(r.maskFlickerPercent.toFixed(2)) : 0,
        rawComponents: Number(
          (r.meanRawComponentsPerFrame ?? r.meanComponentsPerFrame ?? 0).toFixed(2)
        ),
        cleanedComponents: Number((r.meanComponentsPerFrame ?? 0).toFixed(2)),
        runtimeMs: Number(r.meanLatencyMs.toFixed(2)),
        fps: Number(r.fps.toFixed(1)),
        diffVsBaselinePct:
          r.diffPixelsVsBaselinePercent !== null &&
          r.diffPixelsVsBaselinePercent !== undefined
            ? Number(r.diffPixelsVsBaselinePercent.toFixed(2))
            : 0,
      };
    });
  }, [activeLog]);

  const perFrameSeries = useMemo(() => {
    if (!activeLog || !activeLog.perFrameRecords || activeLog.perFrameRecords.length === 0) {
      return [];
    }
    const maxFrame = Math.max(...activeLog.perFrameRecords.map((r) => r.frameIndex));
    const codes = Array.from(new Set(activeLog.perFrameRecords.map((r) => r.variantCode)));
    const rows: Record<string, number>[] = [];
    for (let f = 0; f <= maxFrame; f++) {
      const row: Record<string, number> = { frameIndex: f };
      for (const code of codes) {
        const rec = activeLog.perFrameRecords.find(
          (p) => p.variantCode === code && p.frameIndex === f
        );
        if (rec) {
          if (rec.f1Percent !== null && rec.f1Percent !== undefined) {
            row[`${code}_f1`] = Number(rec.f1Percent.toFixed(2));
          }
          if (rec.fgRatioPercent !== null && rec.fgRatioPercent !== undefined) {
            row[`${code}_fgPct`] = Number(rec.fgRatioPercent.toFixed(2));
          }
        }
      }
      rows.push(row);
    }
    return rows;
  }, [activeLog]);

  const handleDownloadChartSvg = (
    type: 'primary_metrics' | 'jitter_comparison' | 'runtime_comparison'
  ) => {
    if (!activeLog) return;
    const svg = generateExperimentChartSvg(activeLog, type);
    triggerBrowserDownload(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      `${activeLog.experimentId}_${type}.svg`
    );
  };

  const handleDownloadChartPng = async (
    type: 'primary_metrics' | 'jitter_comparison' | 'runtime_comparison'
  ) => {
    if (!activeLog) return;
    const svg = generateExperimentChartSvg(activeLog, type);
    const pngBlob = await svgStringToPngBlob(svg);
    if (pngBlob) {
      triggerBrowserDownload(pngBlob, `${activeLog.experimentId}_${type}.png`);
    }
  };

  const handleDownloadWorkbookXlsx = async () => {
    if (!activeLog) return;
    const blob = await generateResultsWorkbookXlsxBlob(activeLog, sensitivitySweeps);
    triggerBrowserDownload(blob, `${activeLog.experimentId}_DSP_Workbook_7Sheets.xlsx`);
  };

  return (
    <div data-testid="result-analysis-page" className="space-y-6">
      {/* Header & Experiment Run Selector */}
      <div className="bg-white border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 uppercase">
              <BarChart3 className="w-4 h-4" />
              <span>SECTION 4 · SCIENTIFIC RESULT ANALYSIS & EVIDENCE-GROUNDED INTERPRETATION</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">
              Quantitative Chart Standards, Statistical Breakdown & 5-Point Academic Interpretation
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Strictly separates Ground-Truth Metrics, Non-Ground-Truth Proxy Metrics, and Computational Runtime Telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRunningSuite}
              data-testid="analysis-run-group-d-btn"
              onClick={() => handleRunQuickAnalysis('D')}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isRunningSuite ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>Run Group D Ablation (D0–D6)</span>
            </button>
            <button
              type="button"
              disabled={isRunningSuite}
              onClick={() => handleRunQuickAnalysis('A')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
            >
              Run Group A (Stabilization)
            </button>
            <button
              type="button"
              disabled={isRunningSuite}
              onClick={() => handleRunQuickAnalysis('B')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
            >
              Run Group B (Background)
            </button>
            <button
              type="button"
              disabled={isRunningSuite}
              onClick={() => handleRunQuickAnalysis('C')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
            >
              Run Group C (Order C1–C3)
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-mono text-blue-900">
            {statusMessage}
          </div>
        )}

        {/* Active Run Selector & Quick Export Strip */}
        {experimentLogs.length > 0 && activeLog && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Active Experiment Run:</span>
              <select
                value={activeLog.experimentId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="bg-slate-50 border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900"
              >
                {experimentLogs.map((log) => (
                  <option key={log.experimentId} value={log.experimentId}>
                    [{log.group}] {log.experimentId} — {log.datasetName} (
                    {log.videoMetadata.frameCount} frames)
                  </option>
                ))}
              </select>
              <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 font-mono text-[11px] text-slate-700">
                Ground Truth:{' '}
                {activeLog.videoMetadata.hasGroundTruth
                  ? 'AVAILABLE (CDnet Masks)'
                  : 'N/A (User Upload)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadWorkbookXlsx}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export 7-Sheet Workbook (.XLSX)</span>
              </button>
              <button
                type="button"
                onClick={onNavigateExportCenter}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open Full Export Center</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!activeLog ? (
        <div className="bg-white border border-slate-200 p-8 text-center space-y-3">
          <div className="text-sm font-bold text-slate-800">
            No Experiment Run Selected Yet
          </div>
          <p className="text-xs text-slate-600 max-w-xl mx-auto">
            Click <strong>&ldquo;Run Group D Ablation (D0–D6)&rdquo;</strong> or any experiment group button above to execute real frame-by-frame algorithms and generate publication-grade charts and interpretations.
          </p>
        </div>
      ) : (
        <>
          {/* CHART 1: GROUND-TRUTH SEGMENTATION ACCURACY */}
          <div className="bg-white border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-mono font-bold text-emerald-700 uppercase">
                  CATEGORY 1 · GROUND-TRUTH SEGMENTATION METRICS (REQUIRES SYNTHETIC GT OR UPLOADED MASK)
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Figure 4.1: Foreground Segmentation F1-Score, IoU, Precision, Recall & PWC across Conditions
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-600 mt-1">
                  <span>
                    Data Source: {activeLog.datasetName} ({activeLog.videoMetadata.resolution})
                  </span>
                  <span>
                    Sample Count: N = {activeLog.videoMetadata.frameCount} frames/condition
                  </span>
                  <span>Units: Percentage (%)</span>
                  <span>Run ID: {activeLog.experimentId}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadChartSvg('primary_metrics')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-mono cursor-pointer"
                >
                  Download .SVG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadChartPng('primary_metrics')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-mono cursor-pointer"
                >
                  Download .PNG
                </button>
              </div>
            </div>

            {!activeLog.videoMetadata.hasGroundTruth ? (
              <div className="bg-amber-50 border border-amber-300 p-4 text-xs font-mono text-amber-900">
                <strong>N/A — Ground Truth Unavailable:</strong> The active video session (
                {activeLog.datasetName}) does not include ground-truth segmentation masks.
                Ground-truth metrics (IoU, Precision, Recall, F1, FPR, FNR, PWC) are strictly
                reported as N/A rather than fabricated. Refer to Category 2 (Proxy Metrics) below
                or switch to a Synthetic Ground-Truth Scenario.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-72 border border-slate-200 p-3 bg-slate-50/50">
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Mean F1-Score, IoU, Precision & Recall (%) by Condition
                  </div>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                      <XAxis dataKey="conditionId" stroke="#334155" fontSize={11} />
                      <YAxis
                        stroke="#334155"
                        fontSize={11}
                        domain={[0, 100]}
                        label={{
                          value: 'Score (%)',
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 11,
                        }}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="f1Pct" name="F1-Score (%)" fill="#2563EB" />
                      <Bar dataKey="iouPct" name="IoU (%)" fill="#059669" />
                      <Bar dataKey="precisionPct" name="Precision (%)" fill="#D97706" />
                      <Bar dataKey="recallPct" name="Recall (%)" fill="#7C3AED" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-72 border border-slate-200 p-3 bg-slate-50/50">
                  <div className="text-xs font-bold text-slate-800 mb-2">
                    Per-Frame F1-Score Temporal Stability Curve (N ={' '}
                    {activeLog.videoMetadata.frameCount} frames)
                  </div>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={perFrameSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                      <XAxis
                        dataKey="frameIndex"
                        stroke="#334155"
                        fontSize={11}
                        label={{
                          value: 'Frame Index (t)',
                          position: 'insideBottom',
                          offset: -2,
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        stroke="#334155"
                        fontSize={11}
                        domain={[0, 100]}
                        label={{
                          value: 'F1-Score (%)',
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 11,
                        }}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartData.slice(0, 5).map((res, idx) => {
                        const colors = ['#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED'];
                        return (
                          <Line
                            key={res.conditionId}
                            type="monotone"
                            dataKey={`${res.conditionId}_f1`}
                            name={`${res.conditionId} F1 (%)`}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* CHART 2: PROXY STABILIZATION & MORPHOLOGICAL COMPONENT METRICS */}
          <div className="bg-white border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-mono font-bold text-blue-700 uppercase">
                  CATEGORY 2 · NON-GROUND-TRUTH PROXY METRICS (AVAILABLE FOR BOTH SYNTHETIC & REAL USER VIDEOS)
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Figure 4.2: Estimated Trajectory Smoothness vs. Re-measured Output Residual Motion & Pre/Post-Morphology Component Counts
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-600 mt-1">
                  <span>Data Source: {activeLog.datasetName}</span>
                  <span>Sample Count: N = {activeLog.videoMetadata.frameCount} frames</span>
                  <span>Units: Pixels (px RMS), Percentage (%), Blobs/Frame</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadChartSvg('jitter_comparison')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-mono cursor-pointer"
                >
                  Download .SVG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadChartPng('jitter_comparison')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-mono cursor-pointer"
                >
                  Download .PNG
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-72 border border-slate-200 p-3 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 mb-2">
                  (1) Estimated Trajectory Jitter vs. (2) Re-measured Stabilized Output Residual Jitter (px RMS)
                </div>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                    <XAxis dataKey="conditionId" stroke="#334155" fontSize={11} />
                    <YAxis
                      stroke="#334155"
                      fontSize={11}
                      label={{
                        value: 'Jitter RMS (px)',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="estJitterRms"
                      name="1. Estimated Trajectory Jitter (px)"
                      fill="#0EA5E9"
                    />
                    <Bar
                      dataKey="remeasuredJitterRms"
                      name="2. Re-measured Output Residual Jitter (px)"
                      fill="#1D4ED8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-72 border border-slate-200 p-3 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-800 mb-2">
                  Connected Component Count: Pre-Morphology Raw vs. Post-Morphology Cleaned (Objects/Frame)
                </div>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                    <XAxis dataKey="conditionId" stroke="#334155" fontSize={11} />
                    <YAxis
                      stroke="#334155"
                      fontSize={11}
                      label={{
                        value: 'Components / Frame',
                        angle: -90,
                        position: 'insideLeft',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="rawComponents"
                      name="Before Morphology (Raw Blobs)"
                      fill="#F59E0B"
                    />
                    <Bar
                      dataKey="cleanedComponents"
                      name="After Morphology + MinArea Filter"
                      fill="#10B981"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* CHART 3: COMPUTATIONAL RUNTIME & THROUGHPUT */}
          <div className="bg-white border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-mono font-bold text-purple-700 uppercase">
                  CATEGORY 3 · COMPUTATIONAL PERFORMANCE & THROUGHPUT TELEMETRY
                </div>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Figure 4.3: Per-Frame Execution Latency (ms/frame) & Real-Time Throughput (FPS)
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-600 mt-1">
                  <span>Resolution: {activeLog.videoMetadata.resolution}</span>
                  <span>Sample Count: N = {activeLog.videoMetadata.frameCount} frames</span>
                  <span>Units: Milliseconds (ms/frame) & Frames Per Second (FPS)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadChartSvg('runtime_comparison')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-mono cursor-pointer"
                >
                  Download .SVG
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadChartPng('runtime_comparison')}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-[11px] font-mono cursor-pointer"
                >
                  Download .PNG
                </button>
              </div>
            </div>

            <div className="h-64 border border-slate-200 p-3 bg-slate-50/50">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                  <XAxis dataKey="conditionId" stroke="#334155" fontSize={11} />
                  <YAxis
                    yAxisId="left"
                    stroke="#7C3AED"
                    fontSize={11}
                    label={{
                      value: 'Latency (ms/frame)',
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#059669"
                    fontSize={11}
                    label={{
                      value: 'Throughput (FPS)',
                      angle: 90,
                      position: 'insideRight',
                      fontSize: 11,
                    }}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="runtimeMs"
                    name="Execution Time (ms/frame)"
                    fill="#7C3AED"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="fps"
                    name="Throughput (FPS)"
                    fill="#10B981"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECTION 6.3: SCIENTIFIC 5-QUESTION EVIDENCE-GROUNDED INTERPRETATION ENGINE */}
          <div
            data-testid="evidence-grounded-interpretations"
            className="bg-white border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <div className="border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700 uppercase">
                <ShieldCheck className="w-4 h-4" />
                <span>SECTION 6.3 · EVIDENCE-GROUNDED SCIENTIFIC RESULT INTERPRETATION (5 MANDATORY QUESTIONS)</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                Automated Quantitative Analysis for Run {activeLog.experimentId}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Every statement below is dynamically derived from the actual numeric measurements of Run {activeLog.experimentId} without generic boilerplate.
              </p>
            </div>

            <div className="space-y-4">
              {interpretations.map((block, idx) => (
                <div
                  key={block.chartId || idx}
                  className="bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {idx + 1}. {block.chartTitle} ({block.metricCategory})
                    </span>
                    <span className="font-mono text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5">
                      N = {activeLog.videoMetadata.frameCount} frames · {activeLog.datasetName}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white border border-slate-200 p-3">
                      <div className="font-bold text-blue-800 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Q1. What does this chart compare?</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{block.whatIsCompared}</p>
                    </div>

                    <div className="bg-white border border-slate-200 p-3">
                      <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Q2. Which configuration performs best or worst?</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {block.bestPerformingVariant}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 p-3">
                      <div className="font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Q3. How large is the difference quantitatively?</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed font-mono text-[11px]">
                        {block.magnitudeOfDifference}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 p-3">
                      <div className="font-bold text-purple-800 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Q4. Why does this happen from a DSP perspective?</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {block.dspMechanismExplanation}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-3">
                    <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Q5. Practical limitation, trade-off & Hypothesis support:</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{block.limitationOrTradeOff}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
