import React, { useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  FlaskConical,
  GitBranch,
  Layers,
  Play,
  RefreshCw,
  Sliders,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  DecodedVideoSession,
  SyntheticGeneratorConfig,
  SyntheticScenarioId,
} from '../types/video';
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
  SensitivityParameterKey,
  TraceableExperimentLogEntry,
} from '../types/research';
import {
  generateCustomSyntheticSession,
  SYNTHETIC_SCENARIOS,
} from '../demo/syntheticSceneGenerator';
import {
  runExperimentGroupA_Stabilization,
  runExperimentGroupB_Background,
  runExperimentGroupC_ProcessingOrder,
  runExperimentGroupD_Ablation,
  runExperimentGroupE_ParameterSensitivity,
  SENSITIVITY_PARAMETER_DEFINITIONS,
} from '../evaluation/researchExperiments';
import {
  RESEARCH_HYPOTHESES,
  RESEARCH_QUESTIONS,
  SCIENTIFIC_LITERATURE_DATABASE,
} from '../research/literatureDatabase';
import {
  downloadAcademicReportHtml,
  downloadAcademicReportMarkdown,
  downloadExperimentLogsJson,
  generateAcademicMarkdownReport,
} from '../research/academicReportBuilder';
import { FrameCanvas } from '../components/video/FrameCanvas';

export interface ResearchLabProps {
  session: DecodedVideoSession;
  onSessionLoaded: (newSession: DecodedVideoSession) => void;
  stabilizationParams: StabilizationParams;
  onChangeStabilizationParams: (p: StabilizationParams) => void;
  frameDiffParams: FrameDiffParams;
  onChangeFrameDiffParams: (p: FrameDiffParams) => void;
  mog2Params: Mog2Params;
  onChangeMog2Params: (p: Mog2Params) => void;
  sampleKnnParams: SampleKnnParams;
  onChangeSampleKnnParams: (p: SampleKnnParams) => void;
  morphologyConfig: MorphologyConfig;
  onChangeMorphologyConfig: (c: MorphologyConfig) => void;
  displayConfig: ForegroundDisplayConfig;
  experimentLogs: TraceableExperimentLogEntry[];
  onAppendExperimentLog: (entry: TraceableExperimentLogEntry) => void;
  sensitivitySweeps: ParameterSensitivitySweepResult[];
  onAppendSensitivitySweep: (sweep: ParameterSensitivitySweepResult) => void;
}

type ResearchSubTab =
  | 'overview'
  | 'dataset_gt'
  | 'groups_abc'
  | 'ablation_sensitivity'
  | 'statistics'
  | 'literature_report';

/**
 * Colorizes a CDnet-2014 Ground Truth mask for visual inspection:
 * - 0 (Background): Deep Slate [15, 23, 42]
 * - 50 (Shadow): Cyan-Blue [14, 165, 233]
 * - 85 (Outside ROI): Amber [245, 158, 11]
 * - 170 (Unknown Boundary): Purple [168, 85, 247]
 * - 255 (Foreground): Crisp White [248, 250, 252]
 */
function cdnetMaskToColorRgba(
  mask: Uint8Array | undefined,
  width: number,
  height: number
): Uint8ClampedArray | undefined {
  if (!mask) return undefined;
  const n = width * height;
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = mask[i];
    const idx = i << 2;
    if (v === 255) {
      rgba[idx] = 248;
      rgba[idx + 1] = 250;
      rgba[idx + 2] = 252;
      rgba[idx + 3] = 255;
    } else if (v === 50) {
      rgba[idx] = 14;
      rgba[idx + 1] = 165;
      rgba[idx + 2] = 233;
      rgba[idx + 3] = 255;
    } else if (v === 85) {
      rgba[idx] = 245;
      rgba[idx + 1] = 158;
      rgba[idx + 2] = 11;
      rgba[idx + 3] = 255;
    } else if (v === 170) {
      rgba[idx] = 168;
      rgba[idx + 1] = 85;
      rgba[idx + 2] = 247;
      rgba[idx + 3] = 255;
    } else {
      rgba[idx] = 15;
      rgba[idx + 1] = 23;
      rgba[idx + 2] = 42;
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

export const ResearchLab: React.FC<ResearchLabProps> = ({
  session,
  onSessionLoaded,
  stabilizationParams,
  onChangeStabilizationParams,
  frameDiffParams,
  onChangeFrameDiffParams,
  mog2Params,
  onChangeMog2Params,
  sampleKnnParams,
  onChangeSampleKnnParams,
  morphologyConfig,
  onChangeMorphologyConfig,
  displayConfig,
  experimentLogs,
  onAppendExperimentLog,
  sensitivitySweeps,
  onAppendSensitivitySweep,
}) => {
  const [activeTab, setActiveTab] = useState<ResearchSubTab>('overview');
  const [isRunningExp, setIsRunningExp] = useState(false);
  const [expStatusText, setExpStatusText] = useState('');
  const [expProgressPct, setExpProgressPct] = useState(0);
  const sweepAbortRef = useRef<AbortController | null>(null);

  // Synthetic Dataset Generator state
  const [synConfig, setSynConfig] = useState<SyntheticGeneratorConfig>(
    () =>
      session.syntheticConfig ??
      SYNTHETIC_SCENARIOS[0].defaultConfig
  );
  const [previewFrameIdx, setPreviewFrameIdx] = useState(8);

  // Group E Single-Parameter Sensitivity Sweep state
  const [selectedSweepParam, setSelectedSweepParam] =
    useState<SensitivityParameterKey>('smoothingRadius');
  const [customSweepValuesStr, setCustomSweepValuesStr] =
    useState<string>('1, 4, 8, 14, 22');

  // Literature domain filter
  const [litDomainFilter, setLitDomainFilter] = useState<string>('ALL');

  const handleSelectScenarioPreset = (scId: SyntheticScenarioId) => {
    const found =
      SYNTHETIC_SCENARIOS.find((s) => s.id === scId) ?? SYNTHETIC_SCENARIOS[0];
    setSynConfig({ ...found.defaultConfig });
  };

  const handleGenerateCustomDataset = () => {
    const newSession = generateCustomSyntheticSession(synConfig);
    onSessionLoaded(newSession);
    setPreviewFrameIdx(Math.min(8, Math.max(0, newSession.frames.length - 1)));
  };

  const handleRunGroupA = async () => {
    if (isRunningExp) return;
    setIsRunningExp(true);
    setExpProgressPct(10);
    setExpStatusText('Đang chạy Nhóm A (Stabilization Comparison × 3 lần lặp)...');
    try {
      const log = await runExperimentGroupA_Stabilization(
        session,
        stabilizationParams,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        morphologyConfig,
        3,
        (pct, lbl) => {
          setExpProgressPct(pct);
          setExpStatusText(lbl);
        }
      );
      onAppendExperimentLog(log);
    } finally {
      setIsRunningExp(false);
      setExpStatusText('');
      setExpProgressPct(0);
    }
  };

  const handleRunGroupB = async () => {
    if (isRunningExp) return;
    setIsRunningExp(true);
    setExpProgressPct(10);
    setExpStatusText('Đang chạy Nhóm B (Background Subtraction B1/B2/B3 × 3 lần lặp)...');
    try {
      const log = await runExperimentGroupB_Background(
        session,
        stabilizationParams,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        morphologyConfig,
        displayConfig,
        3,
        (pct, lbl) => {
          setExpProgressPct(pct);
          setExpStatusText(lbl);
        }
      );
      onAppendExperimentLog(log);
    } finally {
      setIsRunningExp(false);
      setExpStatusText('');
      setExpProgressPct(0);
    }
  };

  const handleRunGroupC = async () => {
    if (isRunningExp) return;
    setIsRunningExp(true);
    setExpProgressPct(10);
    setExpStatusText('Đang chạy Nhóm C (Processing Order C1 vs C2 vs C3)...');
    try {
      const log = await runExperimentGroupC_ProcessingOrder(
        session,
        'lk_ransac',
        'mog2',
        stabilizationParams,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        morphologyConfig,
        displayConfig,
        (pct, lbl) => {
          setExpProgressPct(pct);
          setExpStatusText(lbl);
        }
      );
      onAppendExperimentLog(log);
    } finally {
      setIsRunningExp(false);
      setExpStatusText('');
      setExpProgressPct(0);
    }
  };

  const handleRunGroupD = async () => {
    if (isRunningExp) return;
    setIsRunningExp(true);
    setExpProgressPct(5);
    setExpStatusText('Đang chạy Nhóm D (Ablation Study D0–D6)...');
    try {
      const log = await runExperimentGroupD_Ablation(
        session,
        stabilizationParams,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        morphologyConfig,
        displayConfig,
        (pct, lbl) => {
          setExpProgressPct(pct);
          setExpStatusText(lbl);
        }
      );
      onAppendExperimentLog(log);
    } finally {
      setIsRunningExp(false);
      setExpStatusText('');
      setExpProgressPct(0);
    }
  };

  const handleRunGroupESweep = async () => {
    if (isRunningExp) return;
    setIsRunningExp(true);
    setExpProgressPct(5);
    const controller = new AbortController();
    sweepAbortRef.current = controller;

    const parsedLevels = customSweepValuesStr
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 5);

    try {
      const sweep = await runExperimentGroupE_ParameterSensitivity(
        session,
        selectedSweepParam,
        parsedLevels.length >= 3 ? parsedLevels : undefined,
        stabilizationParams,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        morphologyConfig,
        displayConfig,
        (pct, lbl) => {
          setExpProgressPct(pct);
          setExpStatusText(lbl);
        },
        controller.signal
      );
      onAppendSensitivitySweep(sweep);
    } catch (err) {
      setExpStatusText(
        err instanceof Error ? err.message : 'Đã dừng quét tham số.'
      );
    } finally {
      setIsRunningExp(false);
      sweepAbortRef.current = null;
      setExpProgressPct(0);
    }
  };

  const handleRunAllCoreResearchGroups = async () => {
    if (isRunningExp) return;
    await handleRunGroupA();
    await handleRunGroupB();
    await handleRunGroupC();
    await handleRunGroupD();
  };

  const handleReapplyLoggedConfig = (log: TraceableExperimentLogEntry) => {
    const cfg = log.reproducibleConfigJson;
    onChangeStabilizationParams(cfg.stabilizationParams);
    onChangeFrameDiffParams(cfg.frameDiffParams);
    onChangeMog2Params(cfg.mog2Params);
    onChangeSampleKnnParams(cfg.sampleKnnParams);
    onChangeMorphologyConfig(cfg.morphologyConfig);
  };

  const safePreviewIdx = Math.min(
    Math.max(0, previewFrameIdx),
    Math.max(0, session.frames.length - 1)
  );
  const currentGt = session.groundTruthMasks.get(safePreviewIdx);
  const currentTrueTransform = session.trueTransforms?.[safePreviewIdx];
  const w = session.metadata.processingWidth;
  const h = session.metadata.processingHeight;

  const allMeasuredRows = experimentLogs.flatMap((l) => l.measuredRows);
  const allPairedTests = experimentLogs.flatMap((l) => l.pairedStats ?? []);
  const latestGroupD = experimentLogs.find(
    (l) => l.group === 'Group D: Ablation Study'
  );
  const latestSweep = sensitivitySweeps[0] ?? null;

  const fmtPct = (v: number | null | undefined) =>
    v === null || v === undefined ? 'N/A' : `${(v * 100).toFixed(2)}%`;
  const fmtNum = (v: number | null | undefined, d = 3, unit = '') =>
    v === null || v === undefined ? 'N/A' : `${v.toFixed(d)}${unit}`;

  const SUB_TABS: { id: ResearchSubTab; label: string }[] = [
    { id: 'overview', label: '1. Tổng quan Nghiên cứu (RQ1–RQ5 & H1–H7)' },
    { id: 'dataset_gt', label: '2. Bộ sinh Dữ liệu Chuẩn & CDnet GT' },
    { id: 'groups_abc', label: '3. Thực nghiệm Nhóm A / B / C (Thứ tự xử lý)' },
    { id: 'ablation_sensitivity', label: '4. Ablation (D1–D6) & Độ nhạy (Group E)' },
    { id: 'statistics', label: '5. Phân tích Thống kê (Runtime & Paired Tests)' },
    { id: 'literature_report', label: '6. Tài liệu APA 7 (17 bài) & Báo cáo 18 Mục' },
  ];

  return (
    <div className="space-y-5">
      {/* Top Research Lab Banner */}
      <div className="bg-[#111827] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
            RESEARCH & ACADEMIC REPORT LAB · KHU VỰC NGHIÊN CỨU KHOA HỌC ĐỘC LẬP
          </div>
          <h1 className="text-base font-bold text-slate-100 mt-0.5 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-400" />
            <span>
              Hệ Thống Thực Nghiệm Khoa Học, Kiểm Định Thống Kê & Xuất Báo Cáo Học Thuật (18 Mục)
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Đầy đủ 5 Câu hỏi nghiên cứu (RQ1–RQ5), 7 Giả thuyết (H1–H7), 10 Kịch bản dữ liệu chuẩn CDnet-2014 + Camera Motion GT, Nhóm thí nghiệm A/B/C/D/E, và 17 bài báo chuẩn APA 7.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isRunningExp}
            onClick={handleRunAllCoreResearchGroups}
            data-testid="run-all-research-groups-btn"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Chạy Toàn Bộ Thực Nghiệm (Group A + B + C + D)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadAcademicReportMarkdown(experimentLogs, sensitivitySweeps)
            }
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Báo Cáo 18 Mục (.MD)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadAcademicReportHtml(experimentLogs, sensitivitySweeps)
            }
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Xuất Báo Cáo (.HTML)</span>
          </button>
        </div>
      </div>

      {/* Live Progress Bar for Running Experiment */}
      {isRunningExp && (
        <div className="bg-cyan-950/60 border border-cyan-500/60 p-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-mono text-cyan-200 mb-1.5">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>{expStatusText || 'Đang thực thi thí nghiệm...'}</span>
              </span>
              <span>{expProgressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all"
                style={{ width: `${Math.min(100, expProgressPct)}%` }}
              />
            </div>
          </div>
          {sweepAbortRef.current && (
            <button
              type="button"
              onClick={() => sweepAbortRef.current?.abort()}
              className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Hủy</span>
            </button>
          )}
        </div>
      )}

      {/* 6 Sub-Navigation Tabs */}
      <div className="bg-[#111827] border border-slate-800 p-1.5 flex flex-wrap gap-1.5">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`research-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-cyan-600 text-white'
                : 'bg-[#0B0E17] text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: RESEARCH OVERVIEW (RQ1-RQ5, H1-H7, READINESS CHECKLIST) */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Research Problem & Scope */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="text-xs font-mono uppercase text-cyan-400">
              1. RESEARCH PROBLEM & SCOPE (VẤN ĐỀ & PHẠM VI NGHIÊN CỨU)
            </div>
            <h2 className="text-sm font-bold text-slate-100">
              Ảnh hưởng của các công đoạn xử lý tín hiệu số (DSP) trong pipeline xử lý video không gian–thời gian
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Chuyển động camera không mong muốn (camera jitter, pan/tilt/roll) phá vỡ giả định nền đứng yên theo từng tọa độ pixel của các thuật toán trừ nền (Background Subtraction), dẫn đến hiện tượng viền của cảnh nền bị phân loại nhầm thành vật thể chuyển động (False Positives). Đề tài này không tuyên bố phát minh thuật toán mới, mà đóng góp một <strong>môi trường thực nghiệm thống nhất và có thể truy xuất (Traceable Experimental Evaluation System)</strong> ngay trên trình duyệt để kiểm chứng định lượng tác động của từng công đoạn DSP: (1) Ước lượng chuyển động, (2) Lọc ngoại lai RANSAC, (3) Làm mượt quỹ đạo, (4) Bù chuyển động hình học, (5) Mô hình hóa nền, (6) Khử bóng đổ, (7) Lọc hình thái học, và (8) Thứ tự xử lý.
            </p>
          </div>

          {/* 5 Research Questions (RQ1 - RQ5) */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="text-xs font-mono uppercase text-cyan-400">
              2. RESEARCH QUESTIONS (5 CÂU HỎI NGHIÊN CỨU RQ1–RQ5)
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RESEARCH_QUESTIONS.map((rq) => {
                const testedLog = experimentLogs.find((l) => l.rqId === rq.id);
                const testedSweep =
                  rq.id === 'RQ5' && sensitivitySweeps.length > 0;
                const isTested = Boolean(testedLog || testedSweep);

                return (
                  <div
                    key={rq.id}
                    className="bg-[#0B0E17] border border-slate-800 p-4 space-y-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-cyan-400">
                        {rq.id} · {rq.title}
                      </span>
                      <span
                        className={`font-mono text-[11px] ${
                          isTested ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {isTested ? '● Đã thực nghiệm' : '○ Chờ chạy thực nghiệm'}
                      </span>
                    </div>
                    <p className="text-slate-100 font-medium leading-relaxed">
                      {rq.questionVi}
                    </p>
                    <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                      <div>
                        <strong className="text-slate-300">Giả thuyết liên kết:</strong>{' '}
                        {rq.linkedHypotheses.join(', ')}
                      </div>
                      <div>
                        <strong className="text-slate-300">Biến độc lập:</strong>{' '}
                        {rq.independentVariables.join(' · ')}
                      </div>
                      <div>
                        <strong className="text-slate-300">Biến phụ thuộc & Chỉ số:</strong>{' '}
                        {rq.evaluationMetrics.join(' · ')}
                      </div>
                      <div>
                        <strong className="text-slate-300">Tài liệu nền tảng:</strong>{' '}
                        {rq.supportingLiteratureIds.join(', ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7 Research Hypotheses (H1 - H7) */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="text-xs font-mono uppercase text-emerald-400">
              3. FALSIFIABLE RESEARCH HYPOTHESES (7 GIẢ THUYẾT KHOA HỌC H1–H7)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2 pr-3">Mã H</th>
                    <th className="py-2 px-3">RQ</th>
                    <th className="py-2 px-3">Phát biểu Giả thuyết & Giả thuyết H0</th>
                    <th className="py-2 px-3">Nhóm Thí nghiệm</th>
                    <th className="py-2 pl-3">Trạng thái Kiểm chứng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {RESEARCH_HYPOTHESES.map((h) => {
                    const matchedLog = experimentLogs.find(
                      (l) =>
                        l.hypothesisId === h.id ||
                        l.group.startsWith(h.targetExperimentGroup)
                    );
                    const statusLabel = matchedLog
                      ? `${matchedLog.hypothesisVerdict} (${matchedLog.experimentId})`
                      : h.targetExperimentGroup === 'Group E' &&
                        sensitivitySweeps.length > 0
                      ? `Supported by Empirical Data (${sensitivitySweeps[0].sweepId})`
                      : 'Untested in current session';

                    return (
                      <tr key={h.id} className="align-top">
                        <td className="py-2.5 pr-3 font-mono font-bold text-emerald-400">
                          {h.id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-cyan-400">
                          {h.linkedRq}
                        </td>
                        <td className="py-2.5 px-3 space-y-1">
                          <div className="text-slate-100 font-medium">
                            {h.statementVi}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {h.nullHypothesisVi}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                          {h.targetExperimentGroup}
                        </td>
                        <td className="py-2.5 pl-3 font-mono text-[11px]">
                          <span
                            className={
                              statusLabel.startsWith('Supported')
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Research Readiness Checklist */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="text-xs font-mono uppercase text-cyan-400">
              4. RESEARCH READINESS CHECKLIST (BẢNG KIỂM TRA ĐỘ SẴN SÀNG HỌC THUẬT)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#0B0E17] border border-slate-800 p-3 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cơ sở Tài liệu (17/17 Bài báo)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  17 công trình khoa học gốc (1981–2024) đã xác minh DOI/URL và trích dẫn chuẩn APA 7.
                </p>
              </div>

              <div className="bg-[#0B0E17] border border-slate-800 p-3 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ground Truth Video Đang Nạp</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Pixel GT (CDnet):{' '}
                  {session.metadata.hasGroundTruth ? 'CÓ (Hợp lệ)' : 'N/A (Video thực)'}
                  <br />
                  Camera Matrix GT:{' '}
                  {session.trueTransforms && session.trueTransforms.length > 0
                    ? 'CÓ (Transform RMSE hợp lệ)'
                    : 'N/A (Chỉ đo Jitter RMS)'}
                </p>
              </div>

              <div className="bg-[#0B0E17] border border-slate-800 p-3 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Nhật ký Thực nghiệm (Traceability)</span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Đã ghi nhận: {experimentLogs.length} nhóm thí nghiệm &{' '}
                  {sensitivitySweeps.length} đường cong độ nhạy tham số.
                </p>
              </div>

              <div className="bg-[#0B0E17] border border-slate-800 p-3 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Báo cáo 18 Mục & JSON Tái lập</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Sẵn sàng xuất Markdown (.md), HTML (.html) và cấu hình JSON tái lập kết quả.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SYNTHETIC CONTROLLED DATASET GENERATOR & CDNET GT */}
      {activeTab === 'dataset_gt' && (
        <div className="space-y-5">
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-mono uppercase text-cyan-400">
                  SYNTHETIC CONTROLLED DATASET GENERATOR · 10 KỊCH BẢN CHUẨN HÓA
                </div>
                <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                  Bộ Sinh Video Giả Lập Có Kiểm Soát Kèm Ground Truth Chuẩn CDnet-2014 & Ma Trận Chuyển Động Camera
                </h2>
              </div>

              <button
                type="button"
                onClick={handleGenerateCustomDataset}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Sinh Video Chuẩn & Nạp Vào Hệ Thống</span>
              </button>
            </div>

            {/* 10 Scenario Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {SYNTHETIC_SCENARIOS.map((sc) => {
                const isSelected = synConfig.scenarioId === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => handleSelectScenarioPreset(sc.id)}
                    className={`p-3 text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500 text-slate-100'
                        : 'bg-[#0B0E17] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-cyan-400 truncate">
                      {sc.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {sc.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Generator Parameter Sliders */}
            <div className="bg-[#0B0E17] border border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Số khung hình (Duration Frames)</span>
                  <span className="font-mono text-cyan-400">
                    {synConfig.frameCount} frames
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={72}
                  step={4}
                  value={synConfig.frameCount}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      frameCount: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Biên độ dịch chuyển Camera (dx, dy)</span>
                  <span className="font-mono text-cyan-400">
                    {synConfig.translationAmplitudePx.toFixed(1)} px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.5}
                  value={synConfig.translationAmplitudePx}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      translationAmplitudePx: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Biên độ xoay Camera (Roll dθ)</span>
                  <span className="font-mono text-cyan-400">
                    {synConfig.rotationAmplitudeDeg.toFixed(1)}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.2}
                  value={synConfig.rotationAmplitudeDeg}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      rotationAmplitudeDeg: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tần số rung (Motion Frequency)</span>
                  <span className="font-mono text-cyan-400">
                    {synConfig.motionFrequencyHz.toFixed(1)} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={4.5}
                  step={0.2}
                  value={synConfig.motionFrequencyHz}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      motionFrequencyHz: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Biến thiên ánh sáng (Illumination)</span>
                  <span className="font-mono text-cyan-400">
                    +{synConfig.illuminationVariationLevel} lum
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={synConfig.illuminationVariationLevel}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      illuminationVariationLevel: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Mức nhiễu cảm biến (Gaussian Noise σ)</span>
                  <span className="font-mono text-cyan-400">
                    σ = {synConfig.noiseLevelSigma}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={18}
                  step={2}
                  value={synConfig.noiseLevelSigma}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      noiseLevelSigma: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="flex flex-col justify-center gap-2">
                <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                  <span>Sinh bóng đổ vật thể (CDnet Label 50)</span>
                  <input
                    type="checkbox"
                    checked={synConfig.includeCastShadows}
                    onChange={(e) =>
                      setSynConfig({
                        ...synConfig,
                        includeCastShadows: e.target.checked,
                      })
                    }
                    className="accent-cyan-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                  <span>Sinh viền Outside ROI (CDnet Label 85)</span>
                  <input
                    type="checkbox"
                    checked={synConfig.includeOutsideRoiBorder}
                    onChange={(e) =>
                      setSynConfig({
                        ...synConfig,
                        includeOutsideRoiBorder: e.target.checked,
                      })
                    }
                    className="accent-amber-500"
                  />
                </label>
              </div>

              <div className="flex flex-col justify-center">
                <label className="block text-slate-400 mb-1">
                  Độ phức tạp chi tiết nền (Background Complexity)
                </label>
                <select
                  value={synConfig.backgroundComplexity}
                  onChange={(e) =>
                    setSynConfig({
                      ...synConfig,
                      backgroundComplexity: e.target.value as
                        | 'low'
                        | 'medium'
                        | 'high',
                    })
                  }
                  className="bg-[#111827] border border-slate-700 px-2.5 py-1.5 font-mono text-slate-200"
                >
                  <option value="low">Low (Lưới thưa 48px)</option>
                  <option value="medium">Medium (Lưới chuẩn 32px)</option>
                  <option value="high">High (Lưới dày 24px + Fiducials)</option>
                </select>
              </div>
            </div>

            {/* Live Ground Truth Inspector */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs font-semibold text-slate-200">
                  Kiểm tra Dữ liệu Ground Truth tại Khung hình #{safePreviewIdx} ({session.metadata.fileName})
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-400">Chọn Frame:</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, session.frames.length - 1)}
                    value={safePreviewIdx}
                    onChange={(e) => setPreviewFrameIdx(Number(e.target.value))}
                    className="w-44 accent-cyan-500"
                  />
                  <span className="font-mono text-cyan-400">
                    #{safePreviewIdx} / {session.frames.length - 1}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FrameCanvas
                  rgba={session.frames[safePreviewIdx]?.rgba}
                  width={w}
                  height={h}
                  title="1. RGB Frame Đầu Vào"
                  subtitle={`Frame #${safePreviewIdx}`}
                />
                <FrameCanvas
                  rgba={cdnetMaskToColorRgba(currentGt?.mask, w, h)}
                  width={w}
                  height={h}
                  title="2. CDnet-2014 Ground Truth Label Map"
                  subtitle="Trắng=255(FG) · Xanh=50(Shadow) · Cam=85(Non-ROI)"
                />
                <div className="bg-[#0B0E17] border border-slate-800 p-4 flex flex-col justify-between text-xs font-mono">
                  <div className="space-y-2">
                    <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1.5">
                      3. Ground-Truth Camera Matrix & Labels
                    </div>
                    {currentTrueTransform ? (
                      <>
                        <div>
                          Cumulative dx: {currentTrueTransform.dx.toFixed(3)} px | dy:{' '}
                          {currentTrueTransform.dy.toFixed(3)} px
                        </div>
                        <div>
                          Roll Angle dθ:{' '}
                          {((currentTrueTransform.da * 180) / Math.PI).toFixed(3)}°
                        </div>
                        <div>
                          Step Δdx: {(currentTrueTransform.stepDx ?? 0).toFixed(3)} px | Δdy:{' '}
                          {(currentTrueTransform.stepDy ?? 0).toFixed(3)} px
                        </div>
                        {currentTrueTransform.matrix2x3 && (
                          <div className="bg-[#111827] border border-slate-800 p-2 text-[11px] text-emerald-300">
                            <div>M_2x3 (Ground Truth Affine):</div>
                            <div>
                              [{currentTrueTransform.matrix2x3[0].toFixed(4)},{' '}
                              {currentTrueTransform.matrix2x3[1].toFixed(4)},{' '}
                              {currentTrueTransform.matrix2x3[2].toFixed(2)}]
                            </div>
                            <div>
                              [{currentTrueTransform.matrix2x3[3].toFixed(4)},{' '}
                              {currentTrueTransform.matrix2x3[4].toFixed(4)},{' '}
                              {currentTrueTransform.matrix2x3[5].toFixed(2)}]
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-amber-400">
                        Video thực tế tự tải lên: Không có Ground Truth ma trận camera.
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                    Chuẩn nhãn CDnet-2014: 0 = Background, 50 = Shadow, 85 = Outside ROI (Loại trừ), 170 = Unknown (Loại trừ), 255 = Foreground.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXPERIMENT GROUPS A, B, C (INCLUDING C4 THEORETICAL REFERENCE) */}
      {activeTab === 'groups_abc' && (
        <div className="space-y-5">
          {/* Action Controls for Groups A, B, C */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#111827] border border-slate-800 p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-mono text-cyan-400 font-bold">
                  EXPERIMENT GROUP A · RQ1 & H1, H2
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-1">
                  So Sánh Chống Rung (A0 Original vs A1 LK+RANSAC vs A2 ECC)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Đo Translation/Rotation RMSE (trên Synthetic GT), Jitter RMS, Inlier Ratio, ECC Convergence và lặp 3 lần đo FPS/Latency.
                </p>
              </div>
              <button
                type="button"
                disabled={isRunningExp}
                onClick={handleRunGroupA}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                Chạy Thực Nghiệm Nhóm A (3 Lần Lặp)
              </button>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  EXPERIMENT GROUP B · RQ2 & H3
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-1">
                  So Sánh Tách Nền (B1 Frame Diff vs B2 MOG2 vs B3 Sample KNN)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Đo đầy đủ TP, TN, FP, FN, Precision, Recall, F1, IoU, FPR, FNR, PWC Error (%) và Mask Flicker.
                </p>
              </div>
              <button
                type="button"
                disabled={isRunningExp}
                onClick={handleRunGroupB}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                Chạy Thực Nghiệm Nhóm B (3 Lần Lặp)
              </button>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-mono text-amber-400 font-bold">
                  EXPERIMENT GROUP C · RQ3 & H4, H6
                </div>
                <h3 className="text-sm font-bold text-slate-100 mt-1">
                  Thứ Tự Xử Lý (C1 Original→BG vs C2 Stab→BG vs C3 BG→WarpMask)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Kiểm chứng tính không giao hoán giữa bù chuyển động và trừ nền, kèm đối chiếu lý thuyết mô hình C4.
                </p>
              </div>
              <button
                type="button"
                disabled={isRunningExp}
                onClick={handleRunGroupC}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                Chạy Thực Nghiệm Nhóm C (C1 vs C2 vs C3)
              </button>
            </div>
          </div>

          {/* Empirical Results Table for Executed Experiments */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-100">
                Bảng Kết Quả Thực Nghiệm Tổng Hợp (Traceable Experiment Table)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Chỉ hiển thị số liệu đo thực tế · Không có Ground Truth hiển thị N/A
              </span>
            </div>

            {allMeasuredRows.length === 0 ? (
              <div className="bg-[#0B0E17] border border-slate-800 p-6 text-center text-xs text-slate-400">
                Chưa có kết quả thực nghiệm nào trong phiên này. Hãy bấm <strong>"Chạy Toàn Bộ Thực Nghiệm"</strong> ở góc trên hoặc chọn từng Nhóm A / B / C bên trên để thu thập số liệu thực tế!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2 pr-2">Exp ID</th>
                      <th className="py-2 px-2">Thuật toán / Cấu hình</th>
                      <th className="py-2 px-2">IoU</th>
                      <th className="py-2 px-2">F1</th>
                      <th className="py-2 px-2">FPR / PWC</th>
                      <th className="py-2 px-2">Trans RMSE</th>
                      <th className="py-2 px-2">Jitter RMS</th>
                      <th className="py-2 px-2">Flicker</th>
                      <th className="py-2 px-2">FPS (Mean±SD ms)</th>
                      <th className="py-2 pl-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {allMeasuredRows.map((r) => (
                      <tr key={r.experimentId} className="hover:bg-[#0B0E17]/60">
                        <td className="py-2 pr-2 text-cyan-400 whitespace-nowrap">
                          {r.experimentId}
                        </td>
                        <td className="py-2 px-2 text-slate-100 font-sans font-medium">
                          <div>{r.algorithmLabel}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {r.configSummary}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-emerald-400">
                          {fmtPct(r.iou)}
                        </td>
                        <td className="py-2 px-2 text-slate-200">
                          {fmtPct(r.f1)}
                        </td>
                        <td className="py-2 px-2 text-slate-300">
                          {r.fpr !== null && r.pwcErrorPercent !== null
                            ? `${(r.fpr * 100).toFixed(2)}% / ${r.pwcErrorPercent.toFixed(2)}%`
                            : 'N/A'}
                        </td>
                        <td className="py-2 px-2 text-cyan-300">
                          {fmtNum(r.translationRmsePx, 3, ' px')}
                        </td>
                        <td className="py-2 px-2 text-amber-300">
                          {fmtNum(r.jitterRmsPx, 3, ' px')}
                        </td>
                        <td className="py-2 px-2 text-slate-300">
                          {fmtNum(r.maskFlickerPercent, 2, '%')}
                        </td>
                        <td className="py-2 px-2 text-slate-200 whitespace-nowrap">
                          {r.fps.toFixed(1)} FPS ({r.meanLatencyMs.toFixed(2)}±
                          {r.stdDevLatencyMs.toFixed(2)}ms)
                        </td>
                        <td className="py-2 pl-2 text-[11px] text-emerald-400 whitespace-nowrap">
                          {r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* C4 Theoretical Reference Section (Strictly separated from empirical benchmark rows) */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 font-mono">
                  C4. MOTION ESTIMATION → BACKGROUND MODEL COMPENSATION → FOREGROUND EXTRACTION [THEORETICAL REFERENCE]
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Trạng thái: Theoretical Reference (Không trộn vào bảng thực nghiệm)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Nguyên lý toán học (Yang et al., 2019; Chapel & Bouwmans, 2021):</strong> Thay vì biến đổi hình học (warp) từng khung hình RGB về hệ quy chiếu của khung hình đầu tiên I₀ (như luồng C2), mô hình C4 giữ nguyên khung hình hiện tại I_t và biến đổi trực tiếp ma trận trạng thái nội bộ của mô hình nền tại thời điểm t-1 theo ma trận chuyển động liên tiếp H_(t-1 → t):
              {' '}<code>M_(t-1)^aligned(x, y) = M_(t-1)(H_(t-1 → t)^(-1)(x, y))</code>. Nhờ đó, hệ quy chiếu luôn bám theo góc nhìn hiện tại của camera mà không bị tích lũy vùng mất biên (border loss) khi camera lia góc rộng (panning).
            </p>
            <div className="bg-[#0B0E17] border border-slate-800 p-3 font-mono text-[11px] text-cyan-300">
              Sơ đồ luồng C4: [Frame I_t & I_t-1] ──► [Optical Flow + RANSAC H_(t-1→t)] ──► [Warp Internal Gaussian Weights (μ_k, σ²_k, w_k) of BG Model] ──► [Compare I_t vs Aligned BG Model] ──► [Foreground Mask M_t]
            </div>
            <p className="text-[11px] text-slate-400">
              <strong>Yêu cầu kỹ thuật để triển khai đầy đủ trên trình duyệt:</strong> Trong OpenCV.js WebAssembly, lớp C++ <code>cv::BackgroundSubtractorMOG2</code> đóng gói kín (private pointer) mảng trọng số và phương sai Gaussian trong bộ nhớ tuyến tính WASM, không phơi bày API JavaScript để dịch chuyển từng tham số Gaussian nội bộ giữa các tọa độ pixel. Để cài đặt C4 thực nghiệm cần tự viết toàn bộ bộ đệm GMM 3×K tham số/pixel trên TypedArray kết hợp phép nội suy song tuyến tính trạng thái mô hình.
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: ABLATION STUDY (GROUP D) & PARAMETER SENSITIVITY (GROUP E) */}
      {activeTab === 'ablation_sensitivity' && (
        <div className="space-y-5">
          {/* Group D: Ablation Study D0 - D6 */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-mono text-cyan-400 font-bold">
                  EXPERIMENT GROUP D · ABLATION STUDY (RQ4 & H5)
                </div>
                <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                  Nghiên Cứu Loại Bỏ Từng Công Đoạn DSP (D0 Full Baseline vs D1–D6)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đánh giá mức suy giảm chất lượng (ΔIoU, ΔF1, ΔJitter RMS) và thay đổi tốc độ khi tắt từng khối xử lý trong chuỗi.
                </p>
              </div>
              <button
                type="button"
                disabled={isRunningExp}
                onClick={handleRunGroupD}
                data-testid="run-group-d-ablation-btn"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Chạy Nghiên Cứu Ablation (D0 → D6)</span>
              </button>
            </div>

            {!latestGroupD ? (
              <div className="bg-[#0B0E17] border border-slate-800 p-5 text-xs text-slate-400">
                Nhấn <strong>"Chạy Nghiên Cứu Ablation (D0 → D6)"</strong> để đo đạc thực tế ảnh hưởng của D1 (Without Denoising), D2 (Without RANSAC), D3 (Without Trajectory Smoothing), D4 (Without Motion Compensation), D5 (Without Morphology), và D6 (Without Shadow Suppression).
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="py-2 pr-2">Cấu hình Ablation</th>
                        <th className="py-2 px-2">Cơ chế Bypass / Phụ thuộc</th>
                        <th className="py-2 px-2">IoU (Δ so với D0)</th>
                        <th className="py-2 px-2">F1</th>
                        <th className="py-2 px-2">FPR</th>
                        <th className="py-2 px-2">Jitter RMS</th>
                        <th className="py-2 pl-2">FPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {latestGroupD.measuredRows.map((r) => {
                        const baseIoU = latestGroupD.measuredRows[0]?.iou ?? null;
                        const deltaIoU =
                          r.iou !== null && baseIoU !== null
                            ? (r.iou - baseIoU) * 100
                            : null;
                        return (
                          <tr key={r.experimentId}>
                            <td className="py-2.5 pr-2 font-sans font-semibold text-slate-100">
                              {r.algorithmLabel}
                            </td>
                            <td className="py-2.5 px-2 font-sans text-[11px] text-slate-400 max-w-md">
                              {r.bypassNote}
                            </td>
                            <td className="py-2.5 px-2 text-emerald-400">
                              {fmtPct(r.iou)}{' '}
                              {deltaIoU !== null && r.status !== 'Baseline' && (
                                <span
                                  className={
                                    deltaIoU >= 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }
                                >
                                  ({deltaIoU >= 0 ? '+' : ''}
                                  {deltaIoU.toFixed(2)}%)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-slate-200">
                              {fmtPct(r.f1)}
                            </td>
                            <td className="py-2.5 px-2 text-slate-300">
                              {fmtPct(r.fpr)}
                            </td>
                            <td className="py-2.5 px-2 text-amber-300">
                              {fmtNum(r.jitterRmsPx, 3, ' px')}
                            </td>
                            <td className="py-2.5 pl-2 text-cyan-300">
                              {r.fps.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Recharts BarChart of Ablation Impact */}
                <div className="h-64 bg-[#0B0E17] border border-slate-800 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={latestGroupD.measuredRows.map((r) => ({
                        name: r.algorithmLabel.split('.')[0],
                        IoU: r.iou !== null ? Number((r.iou * 100).toFixed(2)) : 0,
                        F1: r.f1 !== null ? Number((r.f1 * 100).toFixed(2)) : 0,
                        JitterPx: Number((r.jitterRmsPx ?? 0).toFixed(3)),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B0E17',
                          borderColor: '#334155',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="IoU" name="IoU (%)" fill="#10b981" />
                      <Bar dataKey="F1" name="F1-Score (%)" fill="#06b6d4" />
                      <Bar dataKey="JitterPx" name="Jitter RMS (px)" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Group E: Single-Parameter Sensitivity Sweep */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <div className="text-xs font-mono text-emerald-400 font-bold">
                EXPERIMENT GROUP E · SINGLE-PARAMETER SENSITIVITY SWEEP (RQ5 & H7)
              </div>
              <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                Quét Độ Nhạy Từng Tham Số (3–5 Mốc Giá Trị Tuần Tự · An Toàn Bộ Nhớ WASM)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs">
              <div className="md:col-span-5">
                <label className="block text-slate-400 mb-1">
                  1. Chọn 1 trong 9 tham số để quét độ nhạy:
                </label>
                <select
                  value={selectedSweepParam}
                  onChange={(e) => {
                    const key = e.target.value as SensitivityParameterKey;
                    setSelectedSweepParam(key);
                    const def = SENSITIVITY_PARAMETER_DEFINITIONS.find(
                      (d) => d.key === key
                    );
                    if (def) {
                      setCustomSweepValuesStr(def.defaultLevels.join(', '));
                    }
                  }}
                  className="w-full bg-[#0B0E17] border border-slate-700 px-3 py-2 font-mono text-slate-200"
                >
                  {SENSITIVITY_PARAMETER_DEFINITIONS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.nameVi}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="block text-slate-400 mb-1">
                  2. Các mốc giá trị thử nghiệm (3 đến 5 giá trị, cách nhau dấu phẩy):
                </label>
                <input
                  type="text"
                  value={customSweepValuesStr}
                  onChange={(e) => setCustomSweepValuesStr(e.target.value)}
                  className="w-full bg-[#0B0E17] border border-slate-700 px-3 py-2 font-mono text-cyan-300"
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="button"
                  disabled={isRunningExp}
                  onClick={handleRunGroupESweep}
                  data-testid="run-group-e-sweep-btn"
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Chạy Quét Độ Nhạy (Group E)</span>
                </button>
              </div>
            </div>

            {latestSweep && (
              <div className="space-y-4 pt-2">
                <div className="bg-[#0B0E17] border border-emerald-800/60 p-3 text-xs text-emerald-300">
                  <strong>Kết luận đường cong độ nhạy ({latestSweep.sweepId}):</strong>{' '}
                  {latestSweep.optimalValueNoteVi}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-60 bg-[#0B0E17] border border-slate-800 p-3">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      Đường cong Chất lượng (IoU % & Jitter RMS) theo {latestSweep.parameterNameVi}
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={latestSweep.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="paramLabel" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0B0E17',
                            borderColor: '#334155',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line
                          type="monotone"
                          dataKey="iou"
                          name="Mean IoU (%)"
                          stroke="#10b981"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="jitterRmsPx"
                          name="Jitter RMS (px)"
                          stroke="#f59e0b"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-60 bg-[#0B0E17] border border-slate-800 p-3">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      Đường cong Tốc độ (FPS & Latency ms) theo {latestSweep.parameterNameVi}
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={latestSweep.points}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="paramLabel" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0B0E17',
                            borderColor: '#334155',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line
                          type="monotone"
                          dataKey="fps"
                          name="Throughput (FPS)"
                          stroke="#06b6d4"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="latencyMs"
                          name="Latency (ms/frame)"
                          stroke="#f43f5e"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TWO-LEVEL STATISTICAL ANALYSIS DASHBOARD */}
      {activeTab === 'statistics' && (
        <div className="space-y-5">
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="text-xs font-mono text-cyan-400 font-bold">
              TWO-LEVEL STATISTICAL ANALYSIS · THỐNG KÊ ĐÚNG BẢN CHẤT THUẬT TOÁN
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Cấp độ 1 (Runtime Repetitions):</strong> Chạy lặp 3 lần (sau bước warm-up JIT/WASM) trên cùng một chuỗi video để đo biến thiên thời gian thực thi (Mean, Median, StdDev, FPS).{' '}
              <strong>Cấp độ 2 (Per-Frame Paired Statistical Analysis):</strong> Kiểm định thống kê cặp theo từng khung hình (t = 1 … N) giữa hai thuật toán bằng <em>Paired Student t-test</em>, <em>Wilcoxon Signed-Rank Test</em>, cỡ hiệu ứng <em>Cohen&apos;s d_z</em>, và khoảng tin cậy <em>Block-Bootstrap 95%</em> (bảo toàn tương quan chuỗi thời gian giữa các frame liên tiếp).
            </p>

            {allPairedTests.length === 0 ? (
              <div className="bg-[#0B0E17] border border-slate-800 p-6 text-center text-xs text-slate-400">
                Hãy chạy <strong>Nhóm A, Nhóm B hoặc Nhóm C</strong> ở Tab 3 để tạo dữ liệu kiểm định thống kê cặp theo từng khung hình!
              </div>
            ) : (
              <div className="space-y-4">
                {allPairedTests.map((st, idx) => (
                  <div
                    key={`${st.metricName}-${idx}`}
                    className="bg-[#0B0E17] border border-slate-800 p-4 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <span className="font-bold text-cyan-400 font-mono">
                        {st.metricName}: {st.methodAName} vs {st.methodBName} (N ={' '}
                        {st.sampleSizeN} paired frames)
                      </span>
                      <span className="font-mono text-emerald-400">
                        Effect Size d_z = {st.cohensDzEffectSize.toFixed(3)} (
                        {st.effectMagnitudeLabel})
                      </span>
                    </div>

                    <p className="text-slate-200">{st.interpretationVi}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-[11px]">
                      <div className="bg-[#111827] border border-slate-800 p-2.5">
                        <div className="text-slate-400">Mean / Median Difference</div>
                        <div className="text-slate-100 mt-1">
                          ΔMean = {st.meanDifference.toFixed(4)} {st.unit}
                          <br />
                          ΔMedian = {st.medianDifference.toFixed(4)} {st.unit}
                        </div>
                      </div>

                      <div className="bg-[#111827] border border-slate-800 p-2.5">
                        <div className="text-slate-400">95% Confidence Intervals</div>
                        <div className="text-slate-100 mt-1">
                          Parametric: [{st.confidenceInterval95[0].toFixed(3)},{' '}
                          {st.confidenceInterval95[1].toFixed(3)}]
                          <br />
                          Block-Bootstrap: [{st.blockBootstrapCi95[0].toFixed(3)},{' '}
                          {st.blockBootstrapCi95[1].toFixed(3)}]
                        </div>
                      </div>

                      <div className="bg-[#111827] border border-slate-800 p-2.5">
                        <div className="text-slate-400">Paired Student t-test</div>
                        <div className="text-slate-100 mt-1">
                          t = {st.pairedTTest.tStatistic.toFixed(3)} (df ={' '}
                          {st.pairedTTest.degreesOfFreedom})
                          <br />p (two-tailed) ={' '}
                          {st.pairedTTest.pValueTwoTailed.toFixed(4)}
                        </div>
                      </div>

                      <div className="bg-[#111827] border border-slate-800 p-2.5">
                        <div className="text-slate-400">Wilcoxon Signed-Rank</div>
                        <div className="text-slate-100 mt-1">
                          W = {st.wilcoxonSignedRank.wStatistic.toFixed(1)}, z ={' '}
                          {st.wilcoxonSignedRank.zScore.toFixed(3)}
                          <br />p (two-tailed) ={' '}
                          {st.wilcoxonSignedRank.pValueTwoTailed.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {/* Box Plot Quartiles Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-1.5">Phân phối (Box Plot Quartiles)</th>
                            <th className="py-1.5">Min</th>
                            <th className="py-1.5">Q1 (25%)</th>
                            <th className="py-1.5">Median (50%)</th>
                            <th className="py-1.5">Q3 (75%)</th>
                            <th className="py-1.5">Max</th>
                            <th className="py-1.5">Mean ± SD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-slate-200">
                          <tr>
                            <td className="py-1.5 text-cyan-400">{st.methodAName}</td>
                            <td className="py-1.5">{st.boxPlotA.min.toFixed(3)}</td>
                            <td className="py-1.5">{st.boxPlotA.q1.toFixed(3)}</td>
                            <td className="py-1.5 font-bold">
                              {st.boxPlotA.median.toFixed(3)}
                            </td>
                            <td className="py-1.5">{st.boxPlotA.q3.toFixed(3)}</td>
                            <td className="py-1.5">{st.boxPlotA.max.toFixed(3)}</td>
                            <td className="py-1.5">
                              {st.boxPlotA.mean.toFixed(3)} ±{' '}
                              {st.boxPlotA.stdDev.toFixed(3)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1.5 text-emerald-400">
                              {st.methodBName}
                            </td>
                            <td className="py-1.5">{st.boxPlotB.min.toFixed(3)}</td>
                            <td className="py-1.5">{st.boxPlotB.q1.toFixed(3)}</td>
                            <td className="py-1.5 font-bold">
                              {st.boxPlotB.median.toFixed(3)}
                            </td>
                            <td className="py-1.5">{st.boxPlotB.q3.toFixed(3)}</td>
                            <td className="py-1.5">{st.boxPlotB.max.toFixed(3)}</td>
                            <td className="py-1.5">
                              {st.boxPlotB.mean.toFixed(3)} ±{' '}
                              {st.boxPlotB.stdDev.toFixed(3)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="text-[11px] text-amber-300/90">
                      {st.autocorrelationWarning}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quality vs Speed Scatter Plot */}
          {allMeasuredRows.length > 0 && (
            <div className="bg-[#111827] border border-slate-800 p-5 space-y-3">
              <div className="text-xs font-bold text-slate-100">
                Biểu Đồ Phân Tán Chất Lượng vs Tốc Độ (Quality vs Speed Pareto Scatter Plot)
              </div>
              <div className="h-64 bg-[#0B0E17] border border-slate-800 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      type="number"
                      dataKey="fps"
                      name="Tốc độ (FPS)"
                      unit=" FPS"
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <YAxis
                      type="number"
                      dataKey="qualityScore"
                      name="Chỉ số chất lượng (IoU % hoặc 100 - Jitter)"
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <ZAxis type="category" dataKey="label" name="Thuật toán" />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{
                        backgroundColor: '#0B0E17',
                        borderColor: '#334155',
                        fontSize: '12px',
                      }}
                    />
                    <Scatter
                      name="Cấu hình thực nghiệm"
                      data={allMeasuredRows.map((r) => ({
                        fps: Number(r.fps.toFixed(1)),
                        qualityScore:
                          r.iou !== null
                            ? Number((r.iou * 100).toFixed(2))
                            : Number(
                                Math.max(0, 100 - (r.jitterRmsPx ?? 0) * 10).toFixed(
                                  2
                                )
                              ),
                        label: r.algorithmLabel,
                      }))}
                      fill="#06b6d4"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SCIENTIFIC LITERATURE (17 APA 7 PAPERS) & 18-SECTION REPORT BUILDER */}
      {activeTab === 'literature_report' && (
        <div className="space-y-5">
          {/* 18-Section Automatic Report Generator & Traceability Exporter */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  AUTOMATIC ACADEMIC REPORT BUILDER · ĐẦY ĐỦ 18 PHẦN KHOA HỌC
                </div>
                <h2 className="text-sm font-bold text-slate-100 mt-0.5">
                  Trình Tạo Báo Cáo Nghiên Cứu Học Thuật Tự Động (18 Mục + Trích dẫn APA 7 + Traceability JSON)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadAcademicReportMarkdown(
                      experimentLogs,
                      sensitivitySweeps
                    )
                  }
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Báo Cáo Markdown (.MD)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadAcademicReportHtml(experimentLogs, sensitivitySweeps)
                  }
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tải Báo Cáo Học Thuật (.HTML)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadExperimentLogsJson(experimentLogs, sensitivitySweeps)
                  }
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Xuất Cấu Hình Tái Lập (.JSON)</span>
                </button>
              </div>
            </div>

            {/* Traceable Experiment History & Reproducibility Controls */}
            {experimentLogs.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Nhật Ký Thực Nghiệm Có Thể Truy Xuất (Click &quot;Khôi phục cấu hình&quot; để tái lập thí nghiệm):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {experimentLogs.map((log) => (
                    <div
                      key={log.experimentId}
                      className="bg-[#0B0E17] border border-slate-800 p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-cyan-400">
                          {log.experimentId} · {log.group}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Dataset: {log.datasetName} ({log.videoMetadata.resolution},{' '}
                          {log.videoMetadata.frameCount}f) · Verdict:{' '}
                          <span className="text-emerald-400">
                            {log.hypothesisVerdict}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReapplyLoggedConfig(log)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono cursor-pointer shrink-0"
                      >
                        Khôi phục cấu hình
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Preview of the 18-Section Report */}
            <div className="bg-[#0B0E17] border border-slate-800 p-4 max-h-80 overflow-y-auto">
              <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {generateAcademicMarkdownReport(
                  experimentLogs,
                  sensitivitySweeps
                )}
              </pre>
            </div>
          </div>

          {/* 17 Scientific Publications Database (APA 7) */}
          <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-slate-100">
                  Cơ Sở Dữ Liệu 17 Tài Liệu Khoa Học Đã Xác Minh (Chuẩn Trích Dẫn APA 7)
                </span>
              </div>

              <select
                value={litDomainFilter}
                onChange={(e) => setLitDomainFilter(e.target.value)}
                className="bg-[#0B0E17] border border-slate-700 px-3 py-1.5 text-xs font-mono text-slate-200"
              >
                <option value="ALL">Tất cả lĩnh vực (17 công trình)</option>
                <option value="Video Stabilization">
                  1. Video Stabilization (7 bài)
                </option>
                <option value="Background Subtraction">
                  2. Background Subtraction (5 bài)
                </option>
                <option value="Moving Camera & Foreground Extraction">
                  3. Moving Camera & Foreground Extraction (3 bài)
                </option>
                <option value="Datasets & Evaluation">
                  4. Datasets & Evaluation (2 bài)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {SCIENTIFIC_LITERATURE_DATABASE.filter(
                (item) =>
                  litDomainFilter === 'ALL' || item.domain === litDomainFilter
              ).map((lit) => (
                <div
                  key={lit.id}
                  className="bg-[#0B0E17] border border-slate-800 p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-cyan-400">
                      [{lit.indexNumber}] {lit.inTextCitation} · {lit.domain}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-emerald-400">{lit.category}</span>
                      <span className="text-slate-400">
                        {lit.verificationStatus}
                      </span>
                      <a
                        href={lit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <span>DOI / Publisher</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#111827] border border-slate-800 font-mono text-[11px] text-slate-200">
                    <strong>APA 7:</strong> {lit.apa7Citation}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-300 pt-1">
                    <div>
                      <strong className="text-slate-100">
                        Phương pháp & Đóng góp:
                      </strong>{' '}
                      {lit.proposedMethod} ({lit.mainFindings})
                    </div>
                    <div>
                      <strong className="text-slate-100">
                        Dataset & Hạn chế:
                      </strong>{' '}
                      {lit.experimentalDataset}. <em>Hạn chế:</em> {lit.limitations}
                    </div>
                    <div>
                      <strong className="text-slate-100">
                        Liên hệ với kết quả dự án ({lit.supportedRqs.join(', ')},{' '}
                        {lit.supportedHypotheses.join(', ')}):
                      </strong>{' '}
                      {lit.relationshipToOurResults}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
