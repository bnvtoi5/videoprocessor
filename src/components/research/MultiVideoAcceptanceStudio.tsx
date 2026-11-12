import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Tv,
  Upload,
  CheckCircle2,
  Award,
  Download,
  Copy,
  Check,
  Film,
  Trash2,
  Table2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Square,
  XCircle,
  AlertCircle,
  BarChart3,
  ShieldCheck,
  BookOpen,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react';
import { exportAcademicWordReport } from '../../utils/academicDocxExport';
import { exportAcademicExcelData } from '../../utils/academicExcelExport';
import {
  exportAllAcademicChartsZip,
  exportSingleAcademicChartPng,
  ACADEMIC_CHARTS,
} from '../../utils/academicChartExport';
import { getPrecomputedVideodataBatchResults } from '../../data/precomputedVideodataLoader';
import {
  DecodedVideoSession,
  PlaylistVideoItem,
} from '../../types/video';
import { INITIAL_BENCHMARK_PLAYLIST } from '../../core/playlistDefaults';
import {
  AblationComboSlotConfig,
  AblationComboVisualResult,
} from '../../types/research';
import {
  DEFAULT_ABLATION_COMBO_SLOTS,
  runCustomAblationComboBatch,
} from '../../evaluation/researchExperiments';
import {
  decodeUploadedVideoFile,
  DEFAULT_VIDEO_INPUT_CONFIG,
} from '../../core/videoDecoder';
import { maskToRgba } from '../../algorithms/background/foregroundExtraction';
import { computeMaskDifferenceVsBaseline } from '../../evaluation/segmentationMetrics';
import { FrameCanvas } from '../video/FrameCanvas';

import {
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
  StabilizationParams,
} from '../../types/algorithm';

const DEFAULT_STABILIZATION_PARAMS: StabilizationParams = {
  maxCorners: 180,
  qualityLevel: 0.015,
  minDistance: 8,
  ransacThreshold: 2.5,
  smoothingRadius: 10,
  smoothRotation: true,
  cropRatio: 0.06,
  eccIterations: 35,
  eccEps: 0.001,
  trajectoryMode: 'gaussian_smooth',
};

const DEFAULT_FRAME_DIFF_PARAMS: FrameDiffParams = {
  threshold: 28,
  referenceMode: 'median_first_n',
  medianFrameCount: 7,
  adaptiveAlpha: 0.05,
};

const DEFAULT_MOG2_PARAMS: Mog2Params = {
  history: 120,
  varThreshold: 16,
  learningRate: 0.02,
  detectShadows: true,
  shadowThreshold: 0.5,
};

const DEFAULT_SAMPLE_KNN_PARAMS: SampleKnnParams = {
  numSamples: 14,
  kNeighbors: 3,
  distanceThreshold: 24,
  learningRate: 0.05,
  sampleReplacementRate: 0.08,
};

const DEFAULT_MORPHOLOGY_CONFIG: MorphologyConfig = {
  enableGaussianBlur: true,
  gaussianKernelSize: 3,
  enableThreshold: true,
  thresholdValue: 127,
  enableOpening: true,
  openingKernelSize: 3,
  enableClosing: true,
  closingKernelSize: 5,
  enableErosion: false,
  erosionIterations: 1,
  enableDilation: false,
  dilationIterations: 1,
  minComponentArea: 28,
};

const DEFAULT_DISPLAY_CONFIG: ForegroundDisplayConfig = {
  overlayColor: [16, 185, 129],
  overlayOpacity: 0.45,
  showContours: true,
  showBoundingBoxes: true,
  backgroundFillColor: [241, 245, 249],
};

// Default to all 7 setups D0–D6 so any newly added video is evaluated across the full ablation suite
const CORE_DEMO_CODES = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

export const SCIENTIFIC_INTERPRETATION_BY_CODE: Record<
  string,
  { roleTitle: string; mechanismNote: string; stabBranchGroup: string }
> = {
  D0: {
    roleTitle: 'Baseline pipeline (Chuẩn tham chiếu đầy đủ)',
    mechanismNote:
      'LK + RANSAC → Gaussian Trajectory Smoothing → Warp → MOG2 → 3×3 Gaussian Blur → Morphology (Open/Close) → Area Filtering',
    stabBranchGroup: 'Shared LK+RANSAC+Gaussian Branch (D0/D1/D5/D6)',
  },
  D1: {
    roleTitle: 'Đánh giá ảnh hưởng của Gaussian Spatial Denoising',
    mechanismNote:
      'Tắt tiền lọc làm mượt không gian 3×3 Gaussian Blur; giữ nguyên nhánh chống rung và hậu xử lý hình thái học của D0',
    stabBranchGroup: 'Shared LK+RANSAC+Gaussian Branch (D0/D1/D5/D6)',
  },
  D2: {
    roleTitle: 'Đánh giá ảnh hưởng của RANSAC Outlier Rejection',
    mechanismNote:
      'Tắt loại bỏ ngoại lai RANSAC khi ước lượng biến đổi Affine; các vector quang lưu của vật thể tiền cảnh làm nhiễu quỹ đạo camera',
    stabBranchGroup: 'No-RANSAC Outlier-Corrupted Branch (D2)',
  },
  D3: {
    roleTitle: 'So sánh Gaussian và Moving-Average Trajectory Smoothing',
    mechanismNote:
      'Thay bộ lọc quỹ đạo Gaussian Kernel bằng trung bình trượt Boxcar Moving Average có cùng bán kính cửa sổ W',
    stabBranchGroup: 'Boxcar Moving-Average Trajectory Branch (D3)',
  },
  D4: {
    roleTitle: 'Đánh giá ảnh hưởng của Motion Compensation',
    mechanismNote:
      'Tắt bù trừ chuyển động (No Warp); mô hình nền MOG2 chạy trực tiếp trên chuỗi khung hình gốc bị rung',
    stabBranchGroup: 'Unwarped Raw Input Branch (D4: Motion Reduction = 0%)',
  },
  D5: {
    roleTitle: 'Đánh giá ảnh hưởng của Morphological Processing',
    mechanismNote:
      'Tắt toàn bộ phép toán hình thái học (Opening, Closing) và lọc diện tích tối thiểu; giữ nguyên nhánh chống rung của D0',
    stabBranchGroup: 'Shared LK+RANSAC+Gaussian Branch (D0/D1/D5/D6)',
  },
  D6: {
    roleTitle: 'Đánh giá ảnh hưởng của Shadow Suppression',
    mechanismNote:
      'Tắt cơ chế phát hiện và loại bỏ bóng đổ (detectShadows = false) trong MOG2; giữ nguyên nhánh chống rung của D0',
    stabBranchGroup: 'Shared LK+RANSAC+Gaussian Branch (D0/D1/D5/D6)',
  },
};

export type DatasetGroupKey = 'BG' | 'COMB' | 'STAB' | 'CUSTOM';

export interface DatasetGroupInfo {
  groupKey: DatasetGroupKey;
  groupCode: string;
  groupTitle: string;
}

export function classifyVideoDatasetGroup(titleOrName: string): DatasetGroupInfo {
  const lower = titleOrName.toLowerCase();
  if (lower.includes('bg_')) {
    return {
      groupKey: 'BG',
      groupCode: 'Background (bg_*)',
      groupTitle: 'Nhóm Background (bg_*) — Biến thiên nền & điều kiện môi trường',
    };
  }
  if (lower.includes('comb_')) {
    return {
      groupKey: 'COMB',
      groupCode: 'Combined (comb_*)',
      groupTitle: 'Nhóm Combined (comb_*) — Kết hợp rung camera & tách nền',
    };
  }
  if (lower.includes('stab_')) {
    return {
      groupKey: 'STAB',
      groupCode: 'Stabilization (stab_*)',
      groupTitle: 'Nhóm Stabilization (stab_*) — Chuyên biệt rung động camera',
    };
  }
  return {
    groupKey: 'CUSTOM',
    groupCode: 'Custom Video',
    groupTitle: 'Nhóm Video Thực Nghiệm Bổ Sung',
  };
}

export interface VideoSlotExecutedItem {
  code: string;
  label: string;
  bypassNote: string;
  rawInputJitterRms: number;
  jitterReductionPct: number;
  residualOutputJitterRms: number;
  f1: number | null;
  iou: number | null;
  precision: number | null;
  recall: number | null;
  maskFlickerPct: number;
  maskStabilityPct: number;
  fgAreaRatioPct: number;
  deltaFgAreaVsD0PctPt: number;
  rawComponentCount: number;
  postMorphologyComponentCount: number;
  deltaCleanComponentsVsD0: number;
  deltaCleanComponentsVsD0Pct: number;
  fps: number;
  frameTimeMs: number;
  deltaPixelRatioVsBaselinePct: number;
  criterionWinsOnVideo: number; // 0..3 unweighted criteria won on this video
  wonMotionCriterion: boolean;
  wonTemporalCriterion: boolean;
  wonSpatialCriterion: boolean;
  stabilizedFrames: Uint8ClampedArray[];
  cleanedMasks: Uint8Array[];
  perFrameComponents: number[];
  perFrameFgRatio: number[];
  perFrameDiffPct: number[];
  representativeStabilizedRgba?: Uint8ClampedArray;
  representativeMaskRgba?: Uint8ClampedArray;
  representativeOverlayRgba?: Uint8ClampedArray;
  representativeDiffVsBaselineRgba?: Uint8ClampedArray;
}

export interface VideoBatchResult {
  videoId: string;
  videoTitle: string;
  videoSubtitle: string;
  datasetGroup: DatasetGroupInfo;
  hasGroundTruth: boolean;
  frameCount: number;
  samplingFps: number;
  width: number;
  height: number;
  originalFrames: Uint8ClampedArray[];
  slotResults: VideoSlotExecutedItem[];
  // Criterion-specific winners (support multiple codes on Tie)
  winnerStabCodes: string[];
  winnerStabDisplay: string;
  winnerTemporalCodes: string[];
  winnerTemporalDisplay: string;
  winnerCleanCodes: string[];
  winnerCleanDisplay: string;
  // Per-Video Best Configuration (unweighted criterion count; explicit Tie when tied)
  perVideoBestCodes: string[];
  perVideoBestDisplay: string;
  isPerVideoTie: boolean;
  maxCriterionWinCount: number;
  // Backward-compatible primary code for quick filter (or 'TIE' when tied)
  winnerOverallCode: string;
  winnerF1Code: string;
  winnerStabCode: string;
  winnerCleanCode: string;
  includedInReport: boolean;
  pixelXorAuditPassed: boolean;
  pixelXorAuditNote: string;
}

export interface AggregatedComboRow {
  code: string;
  label: string;
  bypassNote: string;
  videoCount: number;
  soleBestVideoCount: number; // Count of videos where this setup was the sole Per-Video Best Configuration
  tiedBestVideoCount: number; // Count of videos where this setup tied for Per-Video Best Configuration
  totalBestInvolvedCount: number; // sole + tied
  stabWinCount: number;
  temporalWinCount: number;
  cleanWinCount: number;
  winningVideoTitles: string[];
  meanRawInputJitterRms: number;
  meanJitterReductionPct: number;
  meanResidualJitterRms: number;
  meanF1: number | null;
  meanIoU: number | null;
  meanFlickerRate: number;
  meanMaskStabilityPct: number;
  meanFgAreaRatioPct: number;
  meanDeltaFgAreaVsD0PctPt: number;
  meanRawComponents: number;
  meanCleanComponents: number;
  meanDeltaCleanComponentsVsD0: number;
  meanDeltaCleanComponentsVsD0Pct: number;
  meanFps: number;
  meanDeltaPixelPctVsD0: number;
  deltaF1PctVsD0: number | null;
}

export interface MultiVideoAcceptanceStudioProps {
  currentSession: DecodedVideoSession;
  playlist?: PlaylistVideoItem[];
  onToggleVideoSelection?: (id: string) => void;
  onAddMultipleFiles?: (files: FileList | File[]) => Promise<void>;
  onRemoveVideo?: (id: string) => void;
  onRecordRun?: (summaryLabel: string) => void;
}

/**
 * Evaluates each of the 3 orthogonal criteria independently on a single video
 * and determines the Per-Video Best Configuration using an unweighted, transparent
 * Criterion-Count rule (1 point per criterion lead/tie, no arbitrary weights).
 * Explicitly records "Tie" whenever multiple configurations share the lead.
 */
function evaluateUnweightedPerVideoVoting(
  slots: VideoSlotExecutedItem[],
  hasGroundTruth: boolean
): {
  winnerStabCodes: string[];
  winnerStabDisplay: string;
  winnerTemporalCodes: string[];
  winnerTemporalDisplay: string;
  winnerCleanCodes: string[];
  winnerCleanDisplay: string;
  perVideoBestCodes: string[];
  perVideoBestDisplay: string;
  isPerVideoTie: boolean;
  maxCriterionWinCount: number;
} {
  if (slots.length === 0) {
    return {
      winnerStabCodes: [],
      winnerStabDisplay: 'N/A',
      winnerTemporalCodes: [],
      winnerTemporalDisplay: 'N/A',
      winnerCleanCodes: [],
      winnerCleanDisplay: 'N/A',
      perVideoBestCodes: [],
      perVideoBestDisplay: 'N/A',
      isPerVideoTie: false,
      maxCriterionWinCount: 0,
    };
  }

  // 1. Criterion M: Motion Stabilization — Minimum Residual Output Jitter (px)
  // Tolerance: 1e-3 px so setups sharing the exact same stabilization branch (D0, D1, D5, D6) are properly recognized as Tied
  const minResidualJitter = Math.min(
    ...slots.map((s) => s.residualOutputJitterRms)
  );
  const winnerStabCodes = slots
    .filter(
      (s) => Math.abs(s.residualOutputJitterRms - minResidualJitter) <= 1e-3
    )
    .map((s) => s.code);
  const winnerStabDisplay =
    winnerStabCodes.length === 1
      ? winnerStabCodes[0]
      : `Tie (${winnerStabCodes.join(', ')})`;

  // 2. Criterion T: Temporal Mask Stability Proxy (or F1 when Ground Truth exists)
  const gtSlots = slots.filter((s) => s.f1 !== null);
  let winnerTemporalCodes: string[] = [];
  if (hasGroundTruth && gtSlots.length > 0) {
    const maxF1 = Math.max(...gtSlots.map((s) => s.f1 ?? 0));
    winnerTemporalCodes = gtSlots
      .filter((s) => Math.abs((s.f1 ?? 0) - maxF1) <= 1e-4)
      .map((s) => s.code);
  } else {
    const minFlicker = Math.min(...slots.map((s) => s.maskFlickerPct));
    winnerTemporalCodes = slots
      .filter((s) => Math.abs(s.maskFlickerPct - minFlicker) <= 1e-2)
      .map((s) => s.code);
  }
  const winnerTemporalDisplay =
    winnerTemporalCodes.length === 1
      ? winnerTemporalCodes[0]
      : `Tie (${winnerTemporalCodes.join(', ')})`;

  // 3. Criterion S: Spatial Mask Cleanliness After Morphology — Minimum Connected Components After Morphology
  const minCleanComp = Math.min(
    ...slots.map((s) => s.postMorphologyComponentCount)
  );
  const winnerCleanCodes = slots
    .filter(
      (s) => Math.abs(s.postMorphologyComponentCount - minCleanComp) <= 1e-2
    )
    .map((s) => s.code);
  const winnerCleanDisplay =
    winnerCleanCodes.length === 1
      ? winnerCleanCodes[0]
      : `Tie (${winnerCleanCodes.join(', ')})`;

  // Annotate each slot with its unweighted criterion wins (0..3)
  let maxCriterionWinCount = 0;
  for (const s of slots) {
    s.wonMotionCriterion = winnerStabCodes.includes(s.code);
    s.wonTemporalCriterion = winnerTemporalCodes.includes(s.code);
    s.wonSpatialCriterion = winnerCleanCodes.includes(s.code);
    s.criterionWinsOnVideo =
      (s.wonMotionCriterion ? 1 : 0) +
      (s.wonTemporalCriterion ? 1 : 0) +
      (s.wonSpatialCriterion ? 1 : 0);
    if (s.criterionWinsOnVideo > maxCriterionWinCount) {
      maxCriterionWinCount = s.criterionWinsOnVideo;
    }
  }

  const perVideoBestCodes = slots
    .filter((s) => s.criterionWinsOnVideo === maxCriterionWinCount)
    .map((s) => s.code);
  const isPerVideoTie = perVideoBestCodes.length > 1;
  const perVideoBestDisplay = isPerVideoTie
    ? `Tie (${perVideoBestCodes.join(', ')}) [${maxCriterionWinCount}/3 tiêu chí]`
    : `${perVideoBestCodes[0]} (${maxCriterionWinCount}/3 tiêu chí)`;

  return {
    winnerStabCodes,
    winnerStabDisplay,
    winnerTemporalCodes,
    winnerTemporalDisplay,
    winnerCleanCodes,
    winnerCleanDisplay,
    perVideoBestCodes,
    perVideoBestDisplay,
    isPerVideoTie,
    maxCriterionWinCount,
  };
}

/**
 * Synthesizes the RGBA buffer for a given frame index on the fly from compact 1-byte mask
 * and shared-reference stabilized frame arrays so full videos play smoothly without RAM bloat.
 */
function synthesizeLiveSlotFrameRgba(
  slot: VideoSlotExecutedItem,
  d0Slot: VideoSlotExecutedItem | undefined,
  frameIdx: number,
  mode: 'mask' | 'overlay' | 'stabilized' | 'diff',
  width: number,
  height: number
): Uint8ClampedArray | undefined {
  const n = width * height;
  const mask = slot.cleanedMasks[frameIdx];
  const stab = slot.stabilizedFrames[frameIdx];

  if (mode === 'stabilized') {
    return stab && stab.length === n * 4
      ? stab
      : slot.representativeStabilizedRgba;
  }
  if (mode === 'mask') {
    if (mask && mask.length === n) {
      return maskToRgba(mask, width, height);
    }
    return slot.representativeMaskRgba;
  }
  if (mode === 'overlay') {
    if (stab && stab.length === n * 4 && mask && mask.length === n) {
      const out = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i++) {
        const idx = i << 2;
        if (mask[i] >= 200) {
          out[idx] = Math.round(stab[idx] * 0.55 + 16 * 0.45);
          out[idx + 1] = Math.round(stab[idx + 1] * 0.55 + 185 * 0.45);
          out[idx + 2] = Math.round(stab[idx + 2] * 0.55 + 129 * 0.45);
          out[idx + 3] = 255;
        } else {
          out[idx] = stab[idx];
          out[idx + 1] = stab[idx + 1];
          out[idx + 2] = stab[idx + 2];
          out[idx + 3] = 255;
        }
      }
      return out;
    }
    return slot.representativeOverlayRgba;
  }
  // mode === 'diff'
  const baseMask = d0Slot?.cleanedMasks[frameIdx];
  if (mask && mask.length === n && baseMask && baseMask.length === n) {
    return computeMaskDifferenceVsBaseline(mask, baseMask, true, {
      width,
      height,
      frameIndex: frameIdx,
    }).diffRgba;
  }
  return slot.representativeDiffVsBaselineRgba;
}

export const MultiVideoAcceptanceStudio: React.FC<
  MultiVideoAcceptanceStudioProps
> = ({
  currentSession,
  playlist: externalPlaylist,
  onToggleVideoSelection: externalToggleSelection,
  onAddMultipleFiles: externalAddMultipleFiles,
  onRemoveVideo: externalRemoveVideo,
  onRecordRun,
}) => {
  const [internalPlaylist, setInternalPlaylist] = useState<PlaylistVideoItem[]>(() => {
    const list = [...INITIAL_BENCHMARK_PLAYLIST];
    if (currentSession.metadata.sourceType === 'upload') {
      list.unshift({
        id: `upload_${currentSession.metadata.fileName}`,
        title: `Video Tải Lên: ${currentSession.metadata.fileName}`,
        subtitle: `${currentSession.metadata.processingWidth}×${currentSession.metadata.processingHeight} · ${currentSession.frames.length} frames`,
        sourceType: 'upload',
        session: currentSession,
        selected: true,
      });
    }
    return list;
  });

  const playlist = externalPlaylist ?? internalPlaylist;

  const [selectedCodes, setSelectedCodes] =
    useState<string[]>(CORE_DEMO_CODES);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    text: string;
    pct: number;
  }>({ text: '', pct: 0 });
  const [statusBanner, setStatusBanner] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
  } | null>(() => ({
    type: 'success',
    message:
      'Đã nạp sẵn toàn bộ kết quả thực nghiệm của 15 video từ thư mục videodata/ (comb_01..05, bg_01..05, stab_01..05) — khớp 100% với báo cáo Bao_cao_Spatiotemporal_Video_Processing_Lab.docx. Bạn có thể xem ngay bảng số liệu, lọc theo nhóm, xuất báo cáo hoặc bấm chạy trực tiếp từng video!',
  }));
  const [batchResults, setBatchResults] = useState<VideoBatchResult[]>(() =>
    getPrecomputedVideodataBatchResults()
  );

  // Sub-tab inside Acceptance Studio:
  // 'metrics_tab' = Bảng Số Liệu Nghiệm Thu, Biểu Đồ D0–D6, Công Thức & Log Kiểm Toán
  // 'video_tab' = Trình Phát Video Động Từng Cấu Hình (Xem Video Thực Tế)
  const [activeSubTab, setActiveSubTab] = useState<'metrics_tab' | 'video_tab'>(
    'metrics_tab'
  );

  // Dataset Group Filter to prevent silently mixing Background (bg_*) and Combined (comb_*) groups
  const [datasetGroupFilter, setDatasetGroupFilter] = useState<
    'ALL' | DatasetGroupKey
  >('ALL');

  // Chart data source selector ('SUMMARY' or specific videoId)
  const [chartSourceId, setChartSourceId] = useState<string>('SUMMARY');

  // Filter for Demo Stepper: 'ALL' | 'D0_WINNERS' | 'REPORT_SELECTED'
  const [demoFilterMode, setDemoFilterMode] = useState<
    'ALL' | 'D0_WINNERS' | 'REPORT_SELECTED'
  >('ALL');
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [visualViewMode, setVisualViewMode] = useState<
    'mask' | 'overlay' | 'stabilized' | 'diff'
  >('overlay');

  // Synchronized Video Player state
  const [isPlayingVideo, setIsPlayingVideo] = useState<boolean>(true);
  const [playbackFrameIdx, setPlaybackFrameIdx] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [spotlightLeftCode, setSpotlightLeftCode] = useState<string>('RAW_INPUT');
  const [spotlightRightCode, setSpotlightRightCode] = useState<string>('D0');
  const [exportFeedback, setExportFeedback] = useState<{
    filename: string;
    format: 'docx' | 'xlsx' | 'png' | 'zip';
    timestamp: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const multiUploadInputRef = useRef<HTMLInputElement | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);

  const availableCoreSlots: AblationComboSlotConfig[] =
    DEFAULT_ABLATION_COMBO_SLOTS.filter((s) =>
      ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'].includes(s.code)
    );

  const handleStopBatch = () => {
    if (batchAbortRef.current) {
      batchAbortRef.current.abort();
      batchAbortRef.current = null;
    }
    setIsRunningBatch(false);
    setBatchProgress({
      text: 'Đã ngừng phân tích theo yêu cầu. Giữ lại dữ liệu các video đã xử lý xong.',
      pct: 0,
    });
    setStatusBanner({
      type: 'warning',
      message: `Đã dừng phân tích chủ động. Hệ thống giữ nguyên dữ liệu của ${batchResults.length} video đã xử lý xong trước đó.`,
    });
  };

  const runMultiVideoBatch = async (
    customPlaylist?: PlaylistVideoItem[],
    customCodes?: string[]
  ) => {
    const targetPlaylist = (customPlaylist ?? playlist).filter(
      (v) => v.selected
    );
    const targetCodes = customCodes ?? selectedCodes;
    const slotsToRun: AblationComboSlotConfig[] = availableCoreSlots.map(
      (s) => ({
        ...s,
        enabled: targetCodes.includes(s.code),
      })
    );

    const activeCount = slotsToRun.filter((s) => s.enabled).length;
    if (targetPlaylist.length === 0 || activeCount === 0) {
      setStatusBanner({
        type: 'warning',
        message: 'Vui lòng chọn ít nhất 1 video và 1 cấu hình trước khi bấm chạy phân tích.',
      });
      return;
    }

    const abortCtrl = new AbortController();
    batchAbortRef.current = abortCtrl;
    setIsRunningBatch(true);
    setStatusBanner({
      type: 'info',
      message: `Đang bắt đầu chạy ${activeCount} cấu hình (${targetCodes.join(', ')}) trên ${targetPlaylist.length} video...`,
    });
    const results: VideoBatchResult[] = [];
    const tBatchStart = performance.now();

    try {
      for (let vIdx = 0; vIdx < targetPlaylist.length; vIdx++) {
        if (abortCtrl.signal.aborted) {
          break;
        }

        const item = targetPlaylist[vIdx];
        let videoSession: DecodedVideoSession;

        if (item.sourceType === 'upload' && item.session) {
          videoSession = item.session;
        } else if (item.videoUrl) {
          setBatchProgress({
            text: `Đang giải mã file video thực tế ${vIdx + 1}/${targetPlaylist.length}: ${item.title}...`,
            pct: Math.round(((vIdx + 0.05) / targetPlaylist.length) * 100),
          });
          const resp = await fetch(item.videoUrl, { signal: abortCtrl.signal });
          const blob = await resp.blob();
          const fileObj = new File([blob], item.fileName || item.title, {
            type: 'video/mp4',
          });
          const decoded = await decodeUploadedVideoFile(
            fileObj,
            DEFAULT_VIDEO_INPUT_CONFIG,
            (curr, tot) => {
              const p = Math.round(
                ((vIdx + (curr / Math.max(1, tot)) * 0.25) /
                  targetPlaylist.length) *
                  100
              );
              setBatchProgress({
                text: `Đang giải mã "${item.title}" (frame ${curr}/${tot})...`,
                pct: p,
              });
            },
            abortCtrl.signal
          );
          videoSession = decoded.session;
          item.session = videoSession;
        } else {
          continue;
        }

        const w = videoSession.metadata.processingWidth;
        const h = videoSession.metadata.processingHeight;
        const midIdx = Math.min(
          videoSession.frames.length - 1,
          Math.max(1, Math.floor(videoSession.frames.length / 2))
        );


        const batchOut = await runCustomAblationComboBatch(
          videoSession,
          slotsToRun,
          DEFAULT_STABILIZATION_PARAMS,
          DEFAULT_FRAME_DIFF_PARAMS,
          DEFAULT_MOG2_PARAMS,
          DEFAULT_SAMPLE_KNN_PARAMS,
          DEFAULT_MORPHOLOGY_CONFIG,
          DEFAULT_DISPLAY_CONFIG,
          (pct, label) => {
            const overallPct = Math.round(
              ((vIdx + pct / 100) / targetPlaylist.length) * 100
            );
            setBatchProgress({
              text: `Video ${vIdx + 1}/${targetPlaylist.length} (${item.title}) · ${label}`,
              pct: overallPct,
            });
          },
          abortCtrl.signal
        );

        const slotResultsForVideo: VideoSlotExecutedItem[] =
          batchOut.visualResults.map((vr: AblationComboVisualResult) => {
            const r = vr.row;
            const rawInputJitter = Math.max(
              0.001,
              r.rawInputJitterRmsPx ?? r.jitterRmsPx ?? 1
            );
            const remJitter = r.remeasuredJitterRmsPx ?? r.jitterRmsPx ?? 0;
            // Scientific jitter reduction formula: ((Raw - Residual) / Raw) * 100
            // Positive = Jitter reduced (smoother)
            // Negative = Jitter worsened/increased (e.g. D2 without RANSAC corrupted by outlier motions)
            const rawRed =
              ((rawInputJitter - remJitter) / rawInputJitter) * 100;
            const jitterRed = Number.isFinite(rawRed) ? rawRed : 0;

            const maskFlickerPct = Number(
              (r.maskFlickerPercent ?? 0).toFixed(2)
            );
            const maskStabilityPct = Number(
              Math.max(0, 100 - maskFlickerPct).toFixed(2)
            );
            const fgAreaRatioPct = Number((r.fgRatioPercent ?? 0).toFixed(2));
            const rawComponentCount = Number(
              (r.meanRawComponentsPerFrame ?? 0).toFixed(2)
            );
            const postMorphologyComponentCount = Number(
              (r.meanComponentsPerFrame ?? 0).toFixed(2)
            );

            return {
              code: vr.slotConfig.code,
              label: vr.slotConfig.label,
              bypassNote: vr.slotConfig.bypassNote,
              rawInputJitterRms: rawInputJitter,
              jitterReductionPct: jitterRed,
              residualOutputJitterRms: remJitter,
              f1: r.f1,
              iou: r.iou,
              precision: r.precision,
              recall: r.recall,
              maskFlickerPct,
              maskStabilityPct,
              fgAreaRatioPct,
              deltaFgAreaVsD0PctPt: 0,
              rawComponentCount,
              postMorphologyComponentCount,
              deltaCleanComponentsVsD0: 0,
              deltaCleanComponentsVsD0Pct: 0,
              fps: r.fps,
              frameTimeMs: r.meanLatencyMs,
              deltaPixelRatioVsBaselinePct: Number(
                (r.diffPixelsVsBaselinePercent ?? 0).toFixed(2)
              ),
              criterionWinsOnVideo: 0,
              wonMotionCriterion: false,
              wonTemporalCriterion: false,
              wonSpatialCriterion: false,
              stabilizedFrames: vr.stabilizedFrames,
              cleanedMasks: vr.cleanedMasks,
              perFrameComponents: vr.perFrameComponents,
              perFrameFgRatio: vr.perFrameFgRatio,
              perFrameDiffPct: vr.perFrameDiffPercentVsBaseline ?? [],
              representativeStabilizedRgba: vr.stabilizedFrames[midIdx],
              representativeMaskRgba: vr.cleanedMasks[midIdx]
                ? maskToRgba(vr.cleanedMasks[midIdx], w, h)
                : undefined,
              representativeOverlayRgba: vr.overlayFrames[midIdx],
              representativeDiffVsBaselineRgba:
                vr.diffMasksVsBaselineRgba?.[midIdx],
            };
          });

        // Compute delta clean components & delta FG area relative to D0 baseline within this video
        const d0Slot = slotResultsForVideo.find((s) => s.code === 'D0');
        const d0CleanComponents = d0Slot?.postMorphologyComponentCount ?? 0;
        const d0FgAreaRatioPct = d0Slot?.fgAreaRatioPct ?? 0;
        for (const s of slotResultsForVideo) {
          s.deltaCleanComponentsVsD0 = Number(
            (s.postMorphologyComponentCount - d0CleanComponents).toFixed(2)
          );
          s.deltaCleanComponentsVsD0Pct =
            d0CleanComponents > 0
              ? Number(
                  (
                    ((s.postMorphologyComponentCount - d0CleanComponents) /
                      d0CleanComponents) *
                    100
                  ).toFixed(2)
                )
              : 0;
          s.deltaFgAreaVsD0PctPt = Number(
            (s.fgAreaRatioPct - d0FgAreaRatioPct).toFixed(2)
          );
        }

        // Verify Pixel XOR mask dimensions & frame counts across all evaluated setups
        let pixelXorAuditPassed = true;
        let pixelXorAuditNote = `PASS: Tất cả ${slotResultsForVideo.length} binary mask khớp kích thước ${w}×${h} (${w * h} px) và ${videoSession.frames.length} frames.`;
        if (d0Slot) {
          for (const s of slotResultsForVideo) {
            if (s.cleanedMasks.length !== d0Slot.cleanedMasks.length) {
              pixelXorAuditPassed = false;
              pixelXorAuditNote = `FAIL: Lệch số frame mask giữa ${s.code} (${s.cleanedMasks.length}) và D0 (${d0Slot.cleanedMasks.length}).`;
              break;
            }
            for (let fIdx = 0; fIdx < s.cleanedMasks.length; fIdx++) {
              if (
                s.cleanedMasks[fIdx].length !== w * h ||
                d0Slot.cleanedMasks[fIdx].length !== w * h
              ) {
                pixelXorAuditPassed = false;
                pixelXorAuditNote = `FAIL: Lệch kích thước mask tại frame #${fIdx} của ${s.code}.`;
                break;
              }
            }
          }
        }

        // Evaluate unweighted per-criterion winners and Per-Video Best Configuration (with explicit Tie handling)
        const votingEval = evaluateUnweightedPerVideoVoting(
          slotResultsForVideo,
          videoSession.metadata.hasGroundTruth
        );

        const datasetGroup = classifyVideoDatasetGroup(
          videoSession.metadata.fileName || item.title
        );

        const newVideoBatchRes: VideoBatchResult = {
          videoId: item.id,
          videoTitle: item.title,
          videoSubtitle: item.subtitle,
          datasetGroup,
          hasGroundTruth: videoSession.metadata.hasGroundTruth,
          frameCount: videoSession.frames.length,
          samplingFps: videoSession.metadata.samplingFps || 12,
          width: w,
          height: h,
          originalFrames: videoSession.frames.map((f) => f.rgba),
          slotResults: slotResultsForVideo,
          winnerStabCodes: votingEval.winnerStabCodes,
          winnerStabDisplay: votingEval.winnerStabDisplay,
          winnerTemporalCodes: votingEval.winnerTemporalCodes,
          winnerTemporalDisplay: votingEval.winnerTemporalDisplay,
          winnerCleanCodes: votingEval.winnerCleanCodes,
          winnerCleanDisplay: votingEval.winnerCleanDisplay,
          perVideoBestCodes: votingEval.perVideoBestCodes,
          perVideoBestDisplay: votingEval.perVideoBestDisplay,
          isPerVideoTie: votingEval.isPerVideoTie,
          maxCriterionWinCount: votingEval.maxCriterionWinCount,
          winnerOverallCode: votingEval.isPerVideoTie
            ? `Tie (${votingEval.perVideoBestCodes.join(', ')})`
            : votingEval.perVideoBestCodes[0] ?? 'D0',
          winnerF1Code: votingEval.winnerTemporalDisplay,
          winnerStabCode: votingEval.winnerStabDisplay,
          winnerCleanCode: votingEval.winnerCleanDisplay,
          includedInReport: true,
          pixelXorAuditPassed,
          pixelXorAuditNote,
        };
        results.push(newVideoBatchRes);

        // Release temporary arrays from batchOut before moving to the next video
        batchOut.visualResults.length = 0;

        // Progressive update: replace matching videoId in batchResults or prepend if new
        setBatchResults((prev) => {
          const existingIdx = prev.findIndex(
            (p) => p.videoId === newVideoBatchRes.videoId
          );
          if (existingIdx >= 0) {
            const copy = [...prev];
            copy[existingIdx] = newVideoBatchRes;
            return copy;
          }
          return [newVideoBatchRes, ...prev];
        });
        await new Promise((r) => setTimeout(r, 40));
      }

      setPlaybackFrameIdx(0);
      const elapsedSec = ((performance.now() - tBatchStart) / 1000).toFixed(1);
      if (!abortCtrl.signal.aborted && results.length > 0) {
        setStatusBanner({
          type: 'success',
          message: `Hoàn tất phân tích trực tiếp ${results.length}/${targetPlaylist.length} video (${activeCount} cấu hình mỗi video) trong ${elapsedSec} giây. Bảng Số Liệu (Table 12.x), Biểu Đồ D0–D6, Log Xác Nhận & Trình Phát Video Động đã sẵn sàng!`,
        });
      }

      onRecordRun?.(
        `Multi-Video Ablation (${results.length} videos × ${activeCount} combos)`
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('ngừng')) {
        setBatchProgress({
          text: 'Đã dừng phân tích theo yêu cầu người dùng. Giữ lại kết quả các video đã xử lý.',
          pct: 0,
        });
        setStatusBanner({
          type: 'warning',
          message: `Đã ngừng phân tích theo yêu cầu. Đã lưu kết quả của ${results.length} video hoàn thành trước khi bấm dừng.`,
        });
      } else {
        setStatusBanner({
          type: 'error',
          message:
            err instanceof Error
              ? `Lỗi trong quá trình phân tích: ${err.message}`
              : 'Đã xảy ra lỗi không xác định khi chạy phân tích video.',
        });
      }
    } finally {
      setIsRunningBatch(false);
      batchAbortRef.current = null;
    }
  };

  const handleUploadMultipleVideos = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const count = fileList.length;

    if (externalAddMultipleFiles) {
      setIsUploadingFiles(true);
      setStatusBanner({
        type: 'info',
        message: `Đang nạp và giải mã ${count} file video từ máy tính...`,
      });
      try {
        await externalAddMultipleFiles(fileList);
        setStatusBanner({
          type: 'success',
          message: `Đã nạp thành công ${count} video vào danh sách! Bấm nút "Chạy Video Đã Chọn" màu xanh để bắt đầu phân tích đủ cấu hình D0–D6.`,
        });
      } catch (err) {
        setStatusBanner({
          type: 'error',
          message:
            err instanceof Error
              ? `Không thể nạp video: ${err.message}`
              : 'Không thể giải mã file video đã chọn.',
        });
      } finally {
        setIsUploadingFiles(false);
        if (multiUploadInputRef.current) {
          multiUploadInputRef.current.value = '';
        }
      }
      return;
    }

    setIsUploadingFiles(true);
    try {
      const newItems: PlaylistVideoItem[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const decodedRes = await decodeUploadedVideoFile(file, {
          maxFrames: 32,
          maxWidth: 320,
          targetFps: 24,
          maxDurationSec: 10,
        });
        const decoded = decodedRes.session;
        newItems.push({
          id: `upload_${file.name}_${Date.now()}_${i}`,
          title: `Video Thực Tế: ${file.name}`,
          subtitle: `${decoded.metadata.processingWidth}×${decoded.metadata.processingHeight} · ${decoded.frames.length} frames`,
          sourceType: 'upload',
          session: decoded,
          selected: true,
        });
      }

      const updated = [...newItems, ...internalPlaylist];
      setInternalPlaylist(updated);
      await runMultiVideoBatch(updated, selectedCodes);
    } finally {
      setIsUploadingFiles(false);
      if (multiUploadInputRef.current) {
        multiUploadInputRef.current.value = '';
      }
    }
  };

  const toggleVideoInPlaylist = (id: string) => {
    if (externalToggleSelection) {
      externalToggleSelection(id);
    } else {
      setInternalPlaylist((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, selected: !item.selected } : item
        )
      );
    }
  };

  const removeUploadedFromPlaylist = (id: string) => {
    if (externalRemoveVideo) {
      externalRemoveVideo(id);
    } else {
      setInternalPlaylist((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const toggleSlotSelection = (code: string) => {
    if (code === 'D0') return;
    setSelectedCodes((prev) =>
      prev.includes(code)
        ? prev.filter((x) => x !== code)
        : [...prev, code]
    );
  };

  const toggleIncludeVideoInReport = (videoId: string) => {
    setBatchResults((prev) =>
      prev.map((v) =>
        v.videoId === videoId
          ? { ...v, includedInReport: !v.includedInReport }
          : v
      )
    );
  };

  // Videos checked for inclusion, filtered by Dataset Group Filter so bg_* and comb_* are not accidentally mixed
  const baseIncludedVideos =
    batchResults.filter((v) => v.includedInReport).length > 0
      ? batchResults.filter((v) => v.includedInReport)
      : batchResults;

  const reportVideos =
    datasetGroupFilter === 'ALL'
      ? baseIncludedVideos
      : baseIncludedVideos.filter(
          (v) => v.datasetGroup.groupKey === datasetGroupFilter
        );

  // Detect distinct dataset groups present in baseIncludedVideos
  const distinctGroupsInBatch = Array.from(
    new Set(baseIncludedVideos.map((v) => v.datasetGroup.groupKey))
  );
  const hasMixedDatasetGroups =
    datasetGroupFilter === 'ALL' && distinctGroupsInBatch.length > 1;

  // Compute Summary Metrics & Transparent Unweighted Voting across reportVideos
  const aggregatedRows: AggregatedComboRow[] = (() => {
    if (reportVideos.length === 0) return [];

    const baseSlots = reportVideos[0].slotResults;
    const rows: AggregatedComboRow[] = baseSlots.map((refSlot) => {
      const matchingAcrossVideos = reportVideos
        .map((v) => v.slotResults.find((s) => s.code === refSlot.code))
        .filter((x): x is VideoSlotExecutedItem => Boolean(x));

      const count = Math.max(1, matchingAcrossVideos.length);
      const mean = (arr: number[]) =>
        arr.reduce((acc, v) => acc + v, 0) / Math.max(1, arr.length);

      // Strictly exclude N/A (null) from Ground Truth averages
      const gtMatching = matchingAcrossVideos.filter((m) => m.f1 !== null);
      const meanF1 =
        gtMatching.length > 0
          ? mean(gtMatching.map((m) => m.f1 as number))
          : null;
      const meanIoU =
        gtMatching.length > 0
          ? mean(gtMatching.map((m) => m.iou as number))
          : null;

      const soleBestWins = reportVideos.filter(
        (v) =>
          !v.isPerVideoTie && v.perVideoBestCodes.includes(refSlot.code)
      );
      const tiedBestWins = reportVideos.filter(
        (v) =>
          v.isPerVideoTie && v.perVideoBestCodes.includes(refSlot.code)
      );
      const stabWins = reportVideos.filter((v) =>
        v.winnerStabCodes.includes(refSlot.code)
      );
      const temporalWins = reportVideos.filter((v) =>
        v.winnerTemporalCodes.includes(refSlot.code)
      );
      const cleanWins = reportVideos.filter((v) =>
        v.winnerCleanCodes.includes(refSlot.code)
      );

      const meanRawComp = Number(
        mean(matchingAcrossVideos.map((m) => m.rawComponentCount)).toFixed(2)
      );
      const meanCleanComp = Number(
        mean(
          matchingAcrossVideos.map((m) => m.postMorphologyComponentCount)
        ).toFixed(2)
      );
      const meanFgArea = Number(
        mean(matchingAcrossVideos.map((m) => m.fgAreaRatioPct)).toFixed(2)
      );
      const meanFlicker = Number(
        mean(matchingAcrossVideos.map((m) => m.maskFlickerPct)).toFixed(2)
      );
      const meanStability = Number(
        Math.max(0, 100 - meanFlicker).toFixed(2)
      );

      return {
        code: refSlot.code,
        label: refSlot.label,
        bypassNote: refSlot.bypassNote,
        videoCount: count,
        soleBestVideoCount: soleBestWins.length,
        tiedBestVideoCount: tiedBestWins.length,
        totalBestInvolvedCount: soleBestWins.length + tiedBestWins.length,
        stabWinCount: stabWins.length,
        temporalWinCount: temporalWins.length,
        cleanWinCount: cleanWins.length,
        winningVideoTitles: [
          ...soleBestWins.map((v) => v.videoTitle),
          ...tiedBestWins.map((v) => `${v.videoTitle} (Tie)`),
        ],
        meanRawInputJitterRms: mean(
          matchingAcrossVideos.map((m) => m.rawInputJitterRms ?? 0)
        ),
        meanJitterReductionPct: mean(
          matchingAcrossVideos.map((m) => m.jitterReductionPct)
        ),
        meanResidualJitterRms: mean(
          matchingAcrossVideos.map((m) => m.residualOutputJitterRms)
        ),
        meanF1,
        meanIoU,
        meanFlickerRate: meanFlicker,
        meanMaskStabilityPct: meanStability,
        meanFgAreaRatioPct: meanFgArea,
        meanDeltaFgAreaVsD0PctPt: 0,
        meanRawComponents: meanRawComp,
        meanCleanComponents: meanCleanComp,
        meanDeltaCleanComponentsVsD0: 0,
        meanDeltaCleanComponentsVsD0Pct: 0,
        meanFps: mean(matchingAcrossVideos.map((m) => m.fps)),
        meanDeltaPixelPctVsD0: Number(
          mean(
            matchingAcrossVideos.map((m) => m.deltaPixelRatioVsBaselinePct)
          ).toFixed(2)
        ),
        deltaF1PctVsD0: null,
      };
    });

    const d0Row = rows.find((r) => r.code === 'D0');
    const d0Clean = d0Row?.meanCleanComponents ?? 0;
    const d0FgArea = d0Row?.meanFgAreaRatioPct ?? 0;

    return rows.map((r) => ({
      ...r,
      meanDeltaCleanComponentsVsD0: Number(
        (r.meanCleanComponents - d0Clean).toFixed(2)
      ),
      meanDeltaCleanComponentsVsD0Pct:
        d0Clean > 0
          ? Number(
              (((r.meanCleanComponents - d0Clean) / d0Clean) * 100).toFixed(2)
            )
          : 0,
      meanDeltaFgAreaVsD0PctPt: Number(
        (r.meanFgAreaRatioPct - d0FgArea).toFixed(2)
      ),
      deltaF1PctVsD0:
        r.meanF1 !== null && d0Row?.meanF1 !== null && d0Row?.meanF1 !== undefined
          ? (r.meanF1 - d0Row.meanF1) * 100
          : null,
    }));
  })();

  const hasAnyGroundTruth = reportVideos.some((v) => v.hasGroundTruth);

  // Dataset-level Per-Video Best Configuration summary with explicit Tie detection
  const datasetBestSummary = (() => {
    if (aggregatedRows.length === 0) {
      return {
        maxSoleWins: 0,
        topRows: [] as AggregatedComboRow[],
        isDatasetTie: false,
        summaryText: 'Chưa có dữ liệu',
      };
    }
    const maxSoleWins = Math.max(
      ...aggregatedRows.map((r) => r.soleBestVideoCount)
    );
    if (maxSoleWins > 0) {
      const topRows = aggregatedRows.filter(
        (r) => r.soleBestVideoCount === maxSoleWins
      );
      const isDatasetTie = topRows.length > 1;
      const summaryText = isDatasetTie
        ? `Tie (Hòa giữa ${topRows.map((r) => r.code).join(', ')} — mỗi cấu hình thắng độc lập ${maxSoleWins}/${reportVideos.length} video)`
        : `${topRows[0].code} (${topRows[0].soleBestVideoCount}/${reportVideos.length} video)`;
      return { maxSoleWins, topRows, isDatasetTie, summaryText };
    }
    // If all videos ended in a Tie (maxSoleWins === 0), look at totalBestInvolvedCount
    const maxInvolved = Math.max(
      ...aggregatedRows.map((r) => r.totalBestInvolvedCount)
    );
    const topRows = aggregatedRows.filter(
      (r) => r.totalBestInvolvedCount === maxInvolved && maxInvolved > 0
    );
    return {
      maxSoleWins: 0,
      topRows,
      isDatasetTie: true,
      summaryText:
        topRows.length > 0
          ? `Tie (Đồng hạng giữa ${topRows.map((r) => r.code).join(', ')})`
          : 'Tie (Hòa)',
    };
  })();

  // Filtered list of videos for the Interactive Demo Stepper (◀ / ▶)
  const demoCarouselVideos = (() => {
    if (demoFilterMode === 'D0_WINNERS') {
      const d0List = batchResults.filter((v) =>
        v.perVideoBestCodes.includes('D0')
      );
      return d0List.length > 0 ? d0List : batchResults;
    }
    if (demoFilterMode === 'REPORT_SELECTED') {
      return reportVideos.length > 0 ? reportVideos : batchResults;
    }
    return batchResults;
  })();

  const safeSlideIdx =
    demoCarouselVideos.length > 0
      ? Math.min(
          Math.max(0, activeSlideIndex),
          demoCarouselVideos.length - 1
        )
      : 0;
  const currentDemoVideo = demoCarouselVideos[safeSlideIdx];
  const totalVideoFrames = currentDemoVideo?.frameCount ?? 1;
  const safePlaybackFrameIdx =
    totalVideoFrames > 0
      ? Math.min(Math.max(0, playbackFrameIdx), totalVideoFrames - 1)
      : 0;

  useEffect(() => {
    if (
      activeSubTab === 'video_tab' &&
      currentDemoVideo &&
      currentDemoVideo.originalFrames.length === 0 &&
      !isRunningBatch
    ) {
      const targetItem = playlist.find(
        (p) => p.id === currentDemoVideo.videoId
      );
      if (targetItem) {
        void runMultiVideoBatch(
          [{ ...targetItem, selected: true }],
          selectedCodes
        );
      }
    }
  }, [activeSubTab, currentDemoVideo?.videoId]);

  useEffect(() => {
    if (
      !isPlayingVideo ||
      !currentDemoVideo ||
      currentDemoVideo.frameCount <= 1
    ) {
      return;
    }
    const fps = Math.max(
      4,
      Math.min(30, (currentDemoVideo.samplingFps || 12) * playbackSpeed)
    );
    const intervalMs = Math.round(1000 / fps);
    const timer = window.setInterval(() => {
      setPlaybackFrameIdx((prev) => (prev + 1) % currentDemoVideo.frameCount);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlayingVideo, currentDemoVideo, playbackSpeed]);


  const handlePrevVideo = () => {
    if (demoCarouselVideos.length === 0) return;
    setPlaybackFrameIdx(0);
    setActiveSlideIndex(
      (prev) =>
        (prev - 1 + demoCarouselVideos.length) % demoCarouselVideos.length
    );
  };

  const handleNextVideo = () => {
    if (demoCarouselVideos.length === 0) return;
    setPlaybackFrameIdx(0);
    setActiveSlideIndex((prev) => (prev + 1) % demoCarouselVideos.length);
  };

  const handleExportDocx = async () => {
    if (reportVideos.length === 0 || aggregatedRows.length === 0) return;
    try {
      setIsExporting(true);
      const filename = await exportAcademicWordReport(
        aggregatedRows,
        reportVideos,
        datasetBestSummary
      );
      setExportFeedback({
        filename,
        format: 'docx',
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('Lỗi xuất tài liệu Word DOCX:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (reportVideos.length === 0 || aggregatedRows.length === 0) return;
    try {
      setIsExporting(true);
      const filename = exportAcademicExcelData(
        aggregatedRows,
        reportVideos,
        datasetBestSummary
      );
      setExportFeedback({
        filename,
        format: 'xlsx',
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('Lỗi xuất bảng tính Excel XLSX:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportChartsZip = async () => {
    if (reportVideos.length === 0 || aggregatedRows.length === 0) return;
    try {
      setIsExporting(true);
      const filename = await exportAllAcademicChartsZip(
        aggregatedRows,
        reportVideos.length
      );
      setExportFeedback({
        filename,
        format: 'zip',
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('Lỗi xuất trọn bộ biểu đồ ZIP:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSingleChart = async (chartId: number) => {
    if (reportVideos.length === 0 || aggregatedRows.length === 0) return;
    try {
      setIsExporting(true);
      const filename = await exportSingleAcademicChartPng(
        chartId,
        aggregatedRows,
        reportVideos.length
      );
      if (filename) {
        setExportFeedback({
          filename,
          format: 'png',
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    } catch (err) {
      console.error('Lỗi xuất biểu đồ PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedVideoCount = playlist.filter((v) => v.selected).length;
  const d0WinnerVideosCount = batchResults.filter((v) =>
    v.perVideoBestCodes.includes('D0')
  ).length;

  // Data rows for the 5 Comparative Charts (either Dataset Summary or a specific Video)
  const chartDataRows = (() => {
    if (chartSourceId !== 'SUMMARY') {
      const targetVid = batchResults.find((v) => v.videoId === chartSourceId);
      if (targetVid) {
        return targetVid.slotResults.map((s) => ({
          code: s.code,
          label: s.label,
          motionReductionPct: s.jitterReductionPct,
          residualJitterPx: s.residualOutputJitterRms,
          flickerPct: s.maskFlickerPct,
          stabilityPct: s.maskStabilityPct,
          rawComponents: s.rawComponentCount,
          cleanComponents: s.postMorphologyComponentCount,
          fgAreaPct: s.fgAreaRatioPct,
          pixelXorPct: s.deltaPixelRatioVsBaselinePct,
          fps: s.fps,
        }));
      }
    }
    return aggregatedRows.map((r) => ({
      code: r.code,
      label: r.label,
      motionReductionPct: r.meanJitterReductionPct,
      residualJitterPx: r.meanResidualJitterRms,
      flickerPct: r.meanFlickerRate,
      stabilityPct: r.meanMaskStabilityPct,
      rawComponents: r.meanRawComponents,
      cleanComponents: r.meanCleanComponents,
      fgAreaPct: r.meanFgAreaRatioPct,
      pixelXorPct: r.meanDeltaPixelPctVsD0,
      fps: r.meanFps,
    }));
  })();

  return (
    <div
      data-testid="multi-video-acceptance-studio"
      className="space-y-5 text-slate-900"
    >
      {/* PHẦN 1: CHỌN CÁC VIDEO CHẠY CÙNG LÚC */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              1. Chọn Các Video Chạy Nghiệm Thu Ablation D0–D6 ({selectedVideoCount} video đang chọn)
            </h1>
            <p className="text-xs text-slate-600">
              Hệ thống chạy đồng nhất các cấu hình D0–D6 trên từng video, tách biệt rõ nhóm dữ liệu (<code>bg_*</code> vs <code>comb_*</code>), đánh giá độc lập theo từng tiêu chí và ghi nhận <strong>Tie (Hòa)</strong> minh bạch khi đồng hạng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={multiUploadInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              multiple
              onChange={handleUploadMultipleVideos}
              className="hidden"
            />
            <button
              type="button"
              disabled={isRunningBatch || isUploadingFiles}
              onClick={() => multiUploadInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-700" />
              <span>
                {isUploadingFiles
                  ? 'Đang nạp...'
                  : '+ Tải Thêm Video Từ Máy'}
              </span>
            </button>

            {isRunningBatch ? (
              <button
                type="button"
                data-testid="stop-multi-video-acceptance-btn"
                onClick={handleStopBatch}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
                title="Dừng phân tích ngay lập tức, giữ lại kết quả của các video đã phân tích xong"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>■ Ngừng Phân Tích</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="run-multi-video-acceptance-btn"
                disabled={selectedVideoCount === 0}
                onClick={() => void runMultiVideoBatch()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {selectedVideoCount === 0
                    ? 'Chưa Có Video Nào Để Chạy'
                    : `Chạy ${selectedVideoCount} Video Đã Chọn (D0–D6)`}
                </span>
              </button>
            )}
          </div>
        </div>

        {isRunningBatch && (
          <div className="bg-blue-50 border border-blue-300 p-3 space-y-2 text-xs text-blue-950">
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono">
              <span className="truncate flex items-center gap-2 font-semibold">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping shrink-0" />
                <span>{batchProgress.text || 'Đang chuẩn bị dữ liệu...'}</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-blue-800">{batchProgress.pct}%</span>
                <button
                  type="button"
                  onClick={handleStopBatch}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-sans text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Dừng Ngay</span>
                </button>
              </div>
            </div>
            <div className="w-full h-2 bg-blue-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${Math.max(4, Math.min(100, batchProgress.pct))}%` }}
              />
            </div>
          </div>
        )}

        {!isRunningBatch && statusBanner && (
          <div
            data-testid="batch-status-banner"
            className={`px-3.5 py-2.5 border text-xs flex items-center justify-between gap-3 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : statusBanner.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : statusBanner.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusBanner.type === 'error' ? (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-[11px] font-semibold underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
            >
              Đóng
            </button>
          </div>
        )}

        {playlist.length === 0 && (
          <div className="p-6 bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-bold text-slate-800">
              Chưa có video nào trong danh sách
            </div>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Hệ thống chỉ phân tích đúng các video do bạn nạp từ máy tính. Vui lòng bấm nút <strong>"+ Tải Thêm Video Từ Máy"</strong> ở trên hoặc ở Bước 1 để bắt đầu.
            </p>
          </div>
        )}

        {/* Compact Video Checkboxes + Setup Checkboxes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {playlist.map((vid) => {
              const grp = classifyVideoDatasetGroup(
                vid.session?.metadata.fileName || vid.title
              );
              return (
                <div
                  key={vid.id}
                  onClick={() => toggleVideoInPlaylist(vid.id)}
                  className={`p-2 border flex items-start justify-between gap-1.5 cursor-pointer text-xs ${
                    vid.selected
                      ? 'bg-blue-50/70 border-blue-500 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="flex items-start gap-1.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={vid.selected}
                      onChange={() => {}}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold truncate">{vid.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {vid.subtitle}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-mono px-1.5 py-0.2 border ${
                          grp.groupKey === 'BG'
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : grp.groupKey === 'COMB'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}
                      >
                        [{grp.groupCode}]
                      </span>
                    </div>
                  </div>
                  {vid.sourceType === 'upload' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUploadedFromPlaylist(vid.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-4 bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span>Cấu hình Ablation ({selectedCodes.length}/7):</span>
              <button
                type="button"
                onClick={() =>
                  setSelectedCodes(availableCoreSlots.map((s) => s.code))
                }
                className="text-blue-700 hover:underline cursor-pointer"
              >
                Chọn đủ D0–D6
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableCoreSlots.map((slot) => {
                const active = selectedCodes.includes(slot.code);
                return (
                  <button
                    key={slot.code}
                    type="button"
                    onClick={() => toggleSlotSelection(slot.code)}
                    className={`px-2 py-1 text-xs font-mono font-bold border cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                    title={slot.label}
                  >
                    {slot.code}
                  </button>
                );
              })}
            </div>
            <div className="text-[10.5px] text-slate-600">
              Mục E: Luôn chạy đủ <strong>D0–D6</strong> trên mỗi video mới bổ sung để đảm bảo tính đồng nhất.
            </div>
          </div>
        </div>
      </div>

      {/* THANH CHUYỂN TAB: TAB 1 (TABLE 12.x, BIỂU ĐỒ D0-D6, CÔNG THỨC & LOG) vs TAB 2 (XEM VIDEO ĐỘNG) */}
      {batchResults.length > 0 && (
        <div
          data-testid="acceptance-subtab-bar"
          className="bg-white border border-slate-300 p-2 shadow-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="subtab-metrics-btn"
              onClick={() => setActiveSubTab('metrics_tab')}
              className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border cursor-pointer transition-colors ${
                activeSubTab === 'metrics_tab'
                  ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span>
                Tab 1: Table 12.x, Biểu Đồ D0–D6 &amp; Xuất Báo Cáo DSP501 ({batchResults.length} Video)
              </span>
            </button>

            <button
              type="button"
              data-testid="subtab-video-player-btn"
              onClick={() => {
                setActiveSubTab('video_tab');
                setIsPlayingVideo(true);
              }}
              className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border cursor-pointer transition-colors ${
                activeSubTab === 'video_tab'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>
                Tab 2: Xem Từng Video Động Đang Chạy ({batchResults.length} Video đã sẵn sàng)
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-600 px-2">
            💡 Chạy 1 lần duy nhất — toàn bộ Table 12.x, Biểu đồ, Log kiểm toán (Tab 1) và Luồng Video Động (Tab 2) đều sẵn sàng.
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 1: TABLE 12.x, PER-VIDEO DETAILS, CHARTS, FORMULAS & AUDIT LOG
         ===================================================================== */}
      {activeSubTab === 'metrics_tab' && (
        <>
          {/* MỤC E: KIỂM SOÁT BỘ DỮ LIỆU & PHÂN NHÓM (DATASET GROUP SCOPE CONTROL) */}
          {batchResults.length > 0 && (
            <div
              data-testid="dataset-group-scope-banner"
              className="bg-white border border-slate-300 p-4 shadow-xs space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>
                    Phân Tách Nhóm Kịch Bản Thực Nghiệm (Dataset Scope Control):
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-600 font-semibold">Lọc nhóm tổng hợp:</span>
                  {(
                    [
                      { key: 'ALL', label: `Tất cả đang chọn (${baseIncludedVideos.length})` },
                      {
                        key: 'BG',
                        label: `Nhóm Background bg_* (${
                          baseIncludedVideos.filter(
                            (v) => v.datasetGroup.groupKey === 'BG'
                          ).length
                        })`,
                      },
                      {
                        key: 'COMB',
                        label: `Nhóm Combined comb_* (${
                          baseIncludedVideos.filter(
                            (v) => v.datasetGroup.groupKey === 'COMB'
                          ).length
                        })`,
                      },
                      {
                        key: 'STAB',
                        label: `Nhóm Stabilization stab_* (${
                          baseIncludedVideos.filter(
                            (v) => v.datasetGroup.groupKey === 'STAB'
                          ).length
                        })`,
                      },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => setDatasetGroupFilter(btn.key)}
                      className={`px-2.5 py-1 font-semibold border cursor-pointer ${
                        datasetGroupFilter === btn.key
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasMixedDatasetGroups && (
                <div className="bg-rose-50 border border-rose-300 px-3 py-2 text-xs text-rose-900 font-medium">
                  ⚠️ <strong>Cảnh báo gộp nhóm dữ liệu:</strong> Danh sách hiện tại đang chứa nhiều nhóm kịch bản khác nhau ({distinctGroupsInBatch.join(' + ')}). Theo chuẩn báo cáo DSP501, <strong>không gộp chung nhóm Background (<code>bg_*</code>) vào nhóm Combined (<code>comb_*</code>)</strong>. Hãy chọn bộ lọc nhóm ở góc phải bên trên để xuất bảng riêng cho từng nhóm kịch bản!
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 leading-relaxed">
                <div>
                  <strong>Tập dữ liệu đang thống kê trong Table 12.x ({reportVideos.length} video):</strong>{' '}
                  {reportVideos.map((v) => (
                    <span
                      key={v.videoId}
                      className="inline-block font-mono bg-white border border-slate-300 px-1.5 py-0.5 mr-1.5 mb-1 text-[11px] font-semibold text-slate-900"
                    >
                      {v.videoTitle} [{v.datasetGroup.groupCode}]
                    </span>
                  ))}
                </div>
                {reportVideos.length > 0 &&
                  reportVideos.every((v) => v.datasetGroup.groupKey === 'BG') && (
                    <div className="mt-1 text-amber-900 font-medium">
                      📌 <strong>Ghi chú phạm vi nhóm Background:</strong> Hiện tại bộ dữ liệu gồm{' '}
                      <strong>{reportVideos.length} video thuộc nhóm Background (<code>bg_*</code>)</strong>, độc lập và <strong>không gộp vào nhóm Combined (<code>comb_*</code>)</strong>. Bảng kết quả cung cấp cơ sở thực nghiệm riêng cho nhóm Background.
                    </div>
                  )}
                {reportVideos.length > 0 &&
                  reportVideos.some((v) => v.datasetGroup.groupKey === 'COMB') && (
                    <div className="mt-1 text-slate-800 font-medium bg-blue-50/60 border border-blue-200 p-2">
                      📌 <strong>Rà soát Tập Dữ Liệu Thực Nghiệm Combined:</strong> Tập dữ liệu thực nghiệm Combined hiện tại gồm chính xác{' '}
                      <strong>
                        {
                          reportVideos.filter(
                            (v) => v.datasetGroup.groupKey === 'COMB'
                          ).length
                        }{' '}
                        video
                      </strong>{' '}
                      (
                      {reportVideos
                        .filter((v) => v.datasetGroup.groupKey === 'COMB')
                        .map((v) => v.videoTitle)
                        .join(', ')}
                      ), đồng bộ 100% với thư mục <code>videodata/</code> và báo cáo học thuật.
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* PHẦN 2: TABLE 12.x — BẢNG TỔNG HỢP D0–D6 CHUẨN HỌC THUẬT */}
          <div className="bg-white border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-700" />
                  <h2 className="text-base font-bold text-slate-900">
                    Table 12.x. Ablation Study of Motion Stabilization and Background Mask Processing Components ({reportVideos.length} Video)
                  </h2>
                </div>
                <div className="text-xs text-slate-700 mt-1 space-y-1">
                  <p>
                    Quy tắc xác định <code>Per-Video Best Configuration</code>: Đánh giá độc lập 3 tiêu chí không trọng số (1. <em>Motion Stabilization</em>, 2. <em>Temporal Mask Stability Proxy</em>, 3. <em>Spatial Fragmentation Proxy</em>). Khi đồng hạng ghi rõ <strong>Tie (Hòa)</strong>, không tự ý chọn một cấu hình. Kết quả toàn tập hiện tại:{' '}
                    <strong className="font-mono text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5">
                      {datasetBestSummary.summaryText}
                    </strong>
                  </p>
                  <p className="text-[11.5px] text-slate-600">
                    💡 <strong>Lưu ý về số phiếu tiêu chí:</strong> Cột phiếu tiêu chí (X / {reportVideos.length} video) bao gồm cả các trường hợp đồng hạng (Ties) giữa các cấu hình dùng chung nhánh (ví dụ D0, D1, D5, D6 hòa nhau ở tiêu chí Motion nên mỗi cấu hình đều nhận 1 phiếu trên video đó); do đó tổng số phiếu giữa 7 cấu hình trong một cột tiêu chí có thể vượt quá N. Đây là phiếu theo từng tiêu chí độc lập, không phải chiến thắng độc quyền duy nhất.
                  </p>
                </div>
              </div>

              {/* Minimalist Academic Export Suite for DSP501 Report */}
              <div className="w-full bg-slate-900 border border-slate-700 p-3.5 text-white space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                        Xuất Tài Liệu Báo Cáo DSP501 (Academic Export Suite)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Đang chọn: <strong className="text-white font-mono">{reportVideos.length} Video</strong> ({reportVideos.map((v) => v.videoTitle).join(', ')})
                    </p>
                  </div>

                  {/* 3 Main Academic Export Buttons + Full Updated Report Link */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href="/Bao_cao_Spatiotemporal_Video_Processing_Lab.docx"
                      download="Bao_cao_Spatiotemporal_Video_Processing_Lab.docx"
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      title="Tải file báo cáo gốc đầy đủ 19 mục & phụ lục đã cập nhật số liệu thực nghiệm từ 15 video trong videodata"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-100" />
                      <span>Tải Báo Cáo Đầy Đủ (Bao_cao_..._Lab.docx)</span>
                    </a>

                    <button
                      type="button"
                      disabled={isExporting || reportVideos.length === 0}
                      onClick={handleExportDocx}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      title="Xuất file Word (.docx) hoàn chỉnh với bảng tổng hợp, bảng chi tiết từng video, phân tích nhận xét và giới hạn ground truth"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-200" />
                      <span>Export Word Report (.docx)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExporting || reportVideos.length === 0}
                      onClick={handleExportExcel}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      title="Xuất workbook Excel (.xlsx) gồm đúng 3 sheet: Summary, Per-Video Results, và Metrics Definition"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Export Excel Data (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExporting || reportVideos.length === 0}
                      onClick={handleExportChartsZip}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      title="Xuất trọn bộ 6 biểu đồ học thuật chuẩn 300 DPI dạng file nén .zip"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-200" />
                      <span>Export Charts (.png 300 DPI)</span>
                    </button>
                  </div>
                </div>


                {/* Quick Individual Chart Downloads */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <span className="font-semibold text-slate-400">Tải lẻ từng biểu đồ 300 DPI:</span>
                  {ACADEMIC_CHARTS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isExporting || reportVideos.length === 0}
                      onClick={() => handleExportSingleChart(c.id)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 hover:border-slate-500 font-sans cursor-pointer transition-colors"
                      title={c.subtitle}
                    >
                      Biểu đồ {c.id}: {c.unit}
                    </button>
                  ))}
                </div>

                {/* Export Feedback Banner */}
                {exportFeedback && (
                  <div className="bg-emerald-950/90 border border-emerald-500/70 p-2 text-xs text-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong>Xuất thành công:</strong> <span className="font-mono text-white underline">{exportFeedback.filename}</span> ({exportFeedback.format.toUpperCase()}) — Sẵn sàng đưa vào báo cáo học thuật DSP501.
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">{exportFeedback.timestamp}</span>
                  </div>
                )}
              </div>
            </div>

            {!hasAnyGroundTruth && aggregatedRows.length > 0 && (
              <div
                data-testid="no-gt-proxy-notice"
                className="bg-amber-50/80 border border-amber-300 px-3.5 py-2 text-xs text-slate-800"
              >
                <strong>📌 Giới hạn Ground Truth:</strong> Các video hiện tại không có Ground Truth Mask chuẩn từng pixel, do đó <code>F1 / IoU</code> được giữ nguyên là <strong>N/A (No Ground Truth)</strong> và tuyệt đối không đưa vào phép tính trung bình. Đánh giá chất lượng mặt nạ sử dụng các <strong>Proxy Metrics</strong> (Temporal Flicker, Mask Stability Proxy, Connected Components, Foreground Area, Pixel XOR vs D0) — không đánh đồng các chỉ số proxy này với Ground Truth Accuracy.
              </div>
            )}

            <div className="overflow-x-auto">
              <table
                data-testid="multi-video-acceptance-table"
                className="w-full text-left border-collapse text-xs border border-slate-300"
              >
                <thead>
                  {/* Row 1: 5 Standardized Academic Column Groups */}
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-900 font-bold text-[11px] uppercase tracking-wider">
                    <th colSpan={2} className="py-2 px-2.5 border-r border-slate-300">
                      Ablation Variant &amp; Scientific Role
                    </th>
                    <th
                      colSpan={4}
                      className="py-2 px-2.5 text-center bg-emerald-100/80 border-r border-slate-300 text-emerald-950"
                    >
                      5. Per-Video Evaluation &amp; Criterion Votes
                    </th>
                    <th
                      colSpan={2}
                      className="py-2 px-2.5 text-center bg-blue-100/70 border-r border-slate-300 text-blue-950"
                    >
                      1. Motion Stabilization
                    </th>
                    <th
                      colSpan={2}
                      className="py-2 px-2.5 text-center bg-indigo-100/70 border-r border-slate-300 text-indigo-950"
                    >
                      2. Temporal Mask Quality
                    </th>
                    <th
                      colSpan={4}
                      className="py-2 px-2.5 text-center bg-amber-100/70 border-r border-slate-300 text-amber-950"
                    >
                      3. Spatial Mask Characteristics
                    </th>
                    <th
                      colSpan={2}
                      className="py-2 px-2.5 text-center bg-slate-100 text-slate-900"
                    >
                      4. Processing Performance
                    </th>
                  </tr>

                  {/* Row 2: Individual Metric Headers with Units */}
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                    <th className="py-2.5 px-2 border-r border-slate-200">Setup</th>
                    <th className="py-2.5 px-2.5 border-r border-slate-300">
                      Cấu Hình &amp; Diễn Giải Khoa Học
                    </th>

                    {/* Voting Columns (Section A) */}
                    <th
                      className="py-2.5 px-2 text-center bg-emerald-50/50 border-r border-slate-200"
                      title="Số video mà cấu hình này đạt Rung dư (Residual Jitter) thấp nhất (bao gồm cả đồng hạng Tie giữa D0, D1, D5, D6)"
                    >
                      Vote Chống Rung
                    </th>
                    <th
                      className="py-2.5 px-2 text-center bg-emerald-50/50 border-r border-slate-200"
                      title="Số video mà cấu hình này đạt Flicker thấp nhất / Mask Stability cao nhất (hoặc F1 cao nhất khi có GT)"
                    >
                      {hasAnyGroundTruth ? 'Vote F1' : 'Vote Ổn Định Mask'}
                    </th>
                    <th
                      className="py-2.5 px-2 text-center bg-emerald-50/50 border-r border-slate-200"
                      title="Số video mà cấu hình này đạt số vùng liên thông sau Morphology (Connected Components After Morph, A_min = 28 px²) thấp nhất (Spatial Fragmentation Proxy)"
                    >
                      Vote Min Connected Components
                    </th>
                    <th
                      className="py-2.5 px-2.5 text-center bg-emerald-50/90 border-r border-slate-300"
                      title="Số video mà cấu hình này đứng đầu theo số tiêu chí đạt tốt nhất (1 điểm/tiêu chí, không trọng số). Ghi rõ nếu Hòa (Tie)."
                    >
                      Per-Video Best Configuration
                    </th>

                    {/* Group 1: Motion Stabilization */}
                    <th
                      className="py-2.5 px-2 text-right bg-blue-50/30 border-r border-slate-200"
                      title="Motion Reduction (%) = (Input Jitter - Residual Jitter) / Input Jitter × 100%"
                    >
                      Motion Reduction (%)
                    </th>
                    <th
                      className="py-2.5 px-2 text-right bg-blue-50/30 border-r border-slate-300"
                      title="Residual Jitter (px): Độ lệch chuẩn RMS sai số quỹ đạo tần số cao đo độc lập trên chuỗi khung hình đầu ra xuất ra bằng Shi-Tomasi + LK + 2.5px RANSAC Similarity"
                    >
                      Residual Jitter (px)
                    </th>

                    {/* Group 2: Temporal Mask Quality – Proxy */}
                    <th
                      className="py-2.5 px-2 text-right bg-indigo-50/30 border-r border-slate-200"
                      title="Temporal Mask Flicker (%): Tỷ lệ % pixel đổi trạng thái giữa 2 frame liên tiếp t-1 và t"
                    >
                      Flicker (%)
                    </th>
                    <th
                      className="py-2.5 px-2 text-right bg-indigo-50/30 border-r border-slate-300"
                      title="Mask Stability Proxy (%) = 100% - Flicker (%). Chỉ số proxy thời gian, không đánh đồng với Ground Truth Accuracy."
                    >
                      Mask Stability (%)
                    </th>

                    {/* Group 3: Spatial Mask Characteristics (Spatial Fragmentation Proxy) */}
                    <th
                      className="py-2.5 px-2 text-right bg-amber-50/20 border-r border-slate-200"
                      title="Connected Components Before Morphology (vùng/frame): Số vùng liên thông 8 hướng trung bình trên mỗi frame trước khi lọc hình thái học"
                    >
                      CC Before Morph (vùng/frame)
                    </th>
                    <th
                      className="py-2.5 px-2 text-right bg-amber-50/40 border-r border-slate-200"
                      title="Connected Components After Morphology (vùng/frame) kèm chênh lệch tuyệt đối và % so với D0 (với ngưỡng diện tích nhỏ A_min = 28 px²)"
                    >
                      CC After Morph &amp; Δ vs D0
                    </th>
                    <th
                      className="py-2.5 px-2 text-right bg-amber-50/20 border-r border-slate-200"
                      title="Foreground Area Ratio (%): Tỷ lệ diện tích pixel tiền cảnh (M=255) trên toàn khung hình W×H"
                    >
                      Foreground Area (%)
                    </th>
                    <th
                      className="py-2.5 px-2 text-right bg-purple-50/40 border-r border-slate-300"
                      title="Pixel XOR Difference vs D0 (%): Tỷ lệ % pixel khác nhau từng điểm ảnh giữa hai binary mask cùng kích thước M(Di) và M(D0) tính trên toàn bộ T khung hình. Không gọi là Segmentation Error."
                    >
                      Pixel XOR vs D0 (%)
                    </th>

                    {/* Group 4: GT & Performance */}
                    <th
                      className="py-2.5 px-2 text-right border-r border-slate-200"
                      title="F1-Score và IoU: Hiển thị N/A (No Ground Truth) khi không có nhãn chuẩn từng pixel"
                    >
                      F1 / IoU
                    </th>
                    <th
                      className="py-2.5 px-2 text-right"
                      title="FPS (Mean): Tốc độ xử lý trung bình đo thuần túy thuật toán DSP trên từng khung hình (loại bỏ I/O decode, render UI)"
                    >
                      FPS (Mean)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {aggregatedRows.map((row) => {
                    const isTopInvolved = datasetBestSummary.topRows.some(
                      (tr) => tr.code === row.code
                    );
                    const sciInfo = SCIENTIFIC_INTERPRETATION_BY_CODE[row.code];
                    return (
                      <tr
                        key={row.code}
                        className={
                          isTopInvolved
                            ? 'bg-emerald-50/50 font-medium'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-2.5 px-2 font-mono font-bold text-blue-700 border-r border-slate-200">
                          {row.code}
                        </td>
                        <td className="py-2.5 px-2.5 border-r border-slate-300">
                          <div className="font-bold text-slate-900">
                            {sciInfo?.roleTitle ?? row.label}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {row.label} — {row.bypassNote}
                          </div>
                          {['D0', 'D1', 'D5', 'D6'].includes(row.code) && (
                            <span className="inline-block mt-0.5 text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 font-sans">
                              Nhánh chống rung chung (D0 = D1 = D5 = D6)
                            </span>
                          )}
                        </td>

                        {/* Criterion Votes */}
                        <td className="py-2.5 px-2 text-center font-mono text-slate-800 border-r border-slate-200">
                          {row.stabWinCount}/{row.videoCount}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-800 border-r border-slate-200">
                          {row.temporalWinCount}/{row.videoCount}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-800 border-r border-slate-200">
                          {row.cleanWinCount}/{row.videoCount}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono bg-emerald-50/30 border-r border-slate-300">
                          <div className="font-bold text-slate-900">
                            {row.soleBestVideoCount}/{row.videoCount} video
                            {row.tiedBestVideoCount > 0
                              ? ` (+${row.tiedBestVideoCount} Tie)`
                              : ''}
                          </div>
                          {isTopInvolved && (
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.2 text-[10px] font-sans font-bold ${
                                datasetBestSummary.isDatasetTie
                                  ? 'bg-amber-100 border border-amber-400 text-amber-900'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {datasetBestSummary.isDatasetTie
                                ? 'HÒA (TIE ĐỒNG HẠNG)'
                                : 'ĐỨNG ĐẦU TẬP DỮ LIỆU'}
                            </span>
                          )}
                        </td>

                        {/* Group 1: Motion Stabilization */}
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold border-r border-slate-200">
                          <span
                            className={
                              row.meanJitterReductionPct > 0.05
                                ? 'text-emerald-700 font-bold'
                                : row.meanJitterReductionPct < -0.05
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-600'
                            }
                          >
                            {row.meanJitterReductionPct >= 0 ? '+' : ''}
                            {row.meanJitterReductionPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 border-r border-slate-300">
                          <span className="font-bold">
                            {row.meanResidualJitterRms.toFixed(2)} px
                          </span>
                          {['D1', 'D5', 'D6'].includes(row.code) && (
                            <div className="text-[10px] text-slate-400">(= D0)</div>
                          )}
                        </td>

                        {/* Group 2: Temporal Mask Quality – Proxy */}
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                          <span className="font-bold text-slate-900">
                            {row.meanFlickerRate.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums border-r border-slate-300">
                          <span className="font-bold text-indigo-900">
                            {row.meanMaskStabilityPct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Group 3: Spatial Mask Characteristics */}
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 border-r border-slate-200">
                          {row.meanRawComponents.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums bg-amber-50/20 border-r border-slate-200">
                          <div className="font-bold text-slate-900">
                            {row.meanCleanComponents.toFixed(2)} vùng/frame
                          </div>
                          {row.code === 'D0' ? (
                            <div className="text-[10px] text-emerald-700">
                              Δ: 0.00 (0.0%)
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-600">
                              Δ: {row.meanDeltaCleanComponentsVsD0 >= 0 ? '+' : ''}
                              {row.meanDeltaCleanComponentsVsD0.toFixed(2)} (
                              {row.meanDeltaCleanComponentsVsD0Pct >= 0 ? '+' : ''}
                              {row.meanDeltaCleanComponentsVsD0Pct.toFixed(1)}%)
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-800 border-r border-slate-200">
                          <div className="font-semibold">
                            {row.meanFgAreaRatioPct.toFixed(2)}%
                          </div>
                          {row.code !== 'D0' && (
                            <div className="text-[10px] text-slate-500">
                              ΔFG: {row.meanDeltaFgAreaVsD0PctPt >= 0 ? '+' : ''}
                              {row.meanDeltaFgAreaVsD0PctPt.toFixed(2)}%
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums bg-purple-50/20 text-slate-900 border-r border-slate-300">
                          {row.code === 'D0' ? (
                            <span className="text-emerald-700 font-bold">0.00%</span>
                          ) : (
                            <span className="font-bold">
                              {row.meanDeltaPixelPctVsD0.toFixed(2)}%
                            </span>
                          )}
                        </td>

                        {/* Group 4: GT & Performance */}
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                          {row.meanF1 !== null && row.meanIoU !== null ? (
                            <div>
                              <div className="font-bold text-slate-900">
                                {(row.meanF1 * 100).toFixed(2)}%
                              </div>
                              <div className="text-[10px] text-slate-500">
                                IoU: {(row.meanIoU * 100).toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-normal">
                              N/A (No Ground Truth)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-slate-800">
                          {row.meanFps.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MỤC A: BẢNG MA TRẬN KẾT QUẢ THẮNG THEO TỪNG TIÊU CHÍ & TỪNG VIDEO (PER-VIDEO VOTING BREAKDOWN) */}
            {reportVideos.length > 0 && (
              <div
                data-testid="per-video-voting-audit-box"
                className="bg-slate-50 border border-slate-300 p-3.5 space-y-2.5"
              >
                <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>
                    🗳️ Bảng Đối Chiếu Kết Quả Thắng Theo Từng Tiêu Chí &amp; Từng Video (Quy Tắc Không Trọng Số &amp; Xử Lý Hòa Tie)
                  </span>
                  <span className="text-[11px] font-normal text-slate-600">
                    Quy tắc: Mỗi tiêu chí độc lập = 1 điểm; không tự gán trọng số; đồng hạng ghi rõ Tie
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs bg-white border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-800">
                        <th className="py-1.5 px-2.5">Video</th>
                        <th className="py-1.5 px-2.5">Nhóm Dữ Liệu</th>
                        <th className="py-1.5 px-2.5">
                          Tiêu chí 1: Chống Rung Tốt Nhất (Min Residual Jitter)
                        </th>
                        <th className="py-1.5 px-2.5">
                          Tiêu chí 2: Ổn Định Mask Thời Gian (Min Flicker / Max Stability)
                        </th>
                        <th className="py-1.5 px-2.5">
                          Tiêu chí 3: Min Connected Components Sau Morph (Spatial Fragmentation Proxy)
                        </th>
                        <th className="py-1.5 px-2.5 bg-emerald-50">
                          Per-Video Best Configuration (Độc lập / Tie)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {reportVideos.map((v) => (
                        <tr key={v.videoId}>
                          <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900">
                            {v.videoTitle}
                          </td>
                          <td className="py-1.5 px-2.5 text-[11px]">
                            {v.datasetGroup.groupCode}
                          </td>
                          <td className="py-1.5 px-2.5 text-blue-800 font-semibold">
                            {v.winnerStabDisplay}
                          </td>
                          <td className="py-1.5 px-2.5 text-indigo-800 font-semibold">
                            {v.winnerTemporalDisplay}
                          </td>
                          <td className="py-1.5 px-2.5 text-amber-900 font-semibold">
                            {v.winnerCleanDisplay}
                          </td>
                          <td className="py-1.5 px-2.5 bg-emerald-50/50 font-bold">
                            <span
                              className={
                                v.isPerVideoTie
                                  ? 'text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5'
                                  : 'text-emerald-900 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5'
                              }
                            >
                              {v.perVideoBestDisplay}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* PHẦN 3: BẢNG CHI TIẾT TỪNG VIDEO (SINGLE-VIDEO DETAILED TABLE D0–D6) */}
          {currentDemoVideo && (
            <div
              data-testid="multi-video-demo-stepper"
              className="bg-white border border-slate-200 p-5 shadow-xs space-y-4"
            >
              {/* Top Navigation Bar with Filter & Left/Right Arrows */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chọn Video xem Bảng Chi Tiết:</span>
                  </span>
                  <button
                    type="button"
                    data-testid="filter-all-videos-btn"
                    onClick={() => {
                      setDemoFilterMode('ALL');
                      setActiveSlideIndex(0);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                      demoFilterMode === 'ALL'
                        ? 'bg-blue-600 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả Video ({batchResults.length})
                  </button>
                  <button
                    type="button"
                    data-testid="filter-d0-best-videos-btn"
                    onClick={() => {
                      setDemoFilterMode('D0_WINNERS');
                      setActiveSlideIndex(0);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                      demoFilterMode === 'D0_WINNERS'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    ★ Video có D0 dẫn đầu/đồng hạng ({d0WinnerVideosCount}/
                    {batchResults.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="demo-prev-video-btn"
                    onClick={handlePrevVideo}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Video Trước</span>
                  </button>

                  <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-900 font-mono text-xs font-bold">
                    Video {safeSlideIdx + 1} / {demoCarouselVideos.length}
                  </span>

                  <button
                    type="button"
                    data-testid="demo-next-video-btn"
                    onClick={handleNextVideo}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Video Tiếp Theo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Video Pills Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {demoCarouselVideos.map((v, idx) => {
                    const isCurrent = idx === safeSlideIdx;
                    return (
                      <button
                        key={v.videoId}
                        type="button"
                        onClick={() => {
                          setActiveSlideIndex(idx);
                          setPlaybackFrameIdx(0);
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{v.videoTitle}</span>
                        <span
                          className={`text-[10px] font-mono px-1 py-0.2 ${
                            isCurrent
                              ? 'bg-blue-800 text-white'
                              : v.isPerVideoTie
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {v.perVideoBestDisplay}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('video_tab');
                      setIsPlayingVideo(true);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Xem Video Động Của Video Này</span>
                  </button>

                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentDemoVideo.includedInReport}
                      onChange={() =>
                        toggleIncludeVideoInReport(currentDemoVideo.videoId)
                      }
                      className="accent-emerald-600"
                    />
                    <span>Đưa vào Table 12.x</span>
                  </label>
                </div>
              </div>

              {/* Single-Video Comparison Table */}
              <div className="overflow-x-auto pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      3. Bảng Kết Quả Chi Tiết Từng Video: {currentDemoVideo.videoTitle} [{currentDemoVideo.datasetGroup.groupCode}] ({currentDemoVideo.width}×{currentDemoVideo.height} · {currentDemoVideo.frameCount} frames · Rung đầu vào: {(currentDemoVideo.slotResults[0]?.rawInputJitterRms ?? 0).toFixed(2)} px)
                    </span>
                  </div>
                  <div className="text-xs font-mono bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-emerald-950 font-bold">
                    Per-Video Best Configuration: {currentDemoVideo.perVideoBestDisplay}
                  </div>
                </div>

                <table
                  data-testid="single-video-demo-table"
                  className="w-full text-left border-collapse text-xs border border-slate-300"
                >
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 text-slate-900 font-bold text-[11px] uppercase">
                      <th colSpan={2} className="py-1.5 px-2.5 border-r border-slate-300">
                        Configuration
                      </th>
                      <th colSpan={2} className="py-1.5 px-2.5 text-center bg-blue-100/70 border-r border-slate-300">
                        Motion Stabilization
                      </th>
                      <th colSpan={2} className="py-1.5 px-2.5 text-center bg-indigo-100/70 border-r border-slate-300">
                        Temporal Mask Quality – Proxy
                      </th>
                      <th colSpan={4} className="py-1.5 px-2.5 text-center bg-amber-100/70 border-r border-slate-300">
                        Spatial Mask Characteristics
                      </th>
                      <th colSpan={2} className="py-1.5 px-2.5 text-center border-r border-slate-300">
                        GT &amp; Performance
                      </th>
                      <th className="py-1.5 px-2.5 text-center bg-emerald-100/80">
                        Per-Video Evaluation
                      </th>
                    </tr>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                      <th className="py-2 px-2 border-r border-slate-200">Setup</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Vai Trò Khoa Học &amp; Cấu Hình</th>
                      <th className="py-2 px-2 text-right border-r border-slate-200">Motion Reduction (%)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">Residual Jitter (px)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-200">Flicker (%)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">Mask Stability (%)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-200">CC Before Morph</th>
                      <th className="py-2 px-2 text-right border-r border-slate-200">CC After Morph &amp; Δ vs D0</th>
                      <th className="py-2 px-2 text-right border-r border-slate-200">Foreground Area (%)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">Pixel XOR vs D0 (%)</th>
                      <th className="py-2 px-2 text-right border-r border-slate-200">F1 / IoU</th>
                      <th className="py-2 px-2 text-right border-r border-slate-300">FPS</th>
                      <th className="py-2 px-2.5 text-center">Tiêu Chí Đạt Đỉnh &amp; Kết Luận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentDemoVideo.slotResults.map((s) => {
                      const isBestOnVideo =
                        currentDemoVideo.perVideoBestCodes.includes(s.code);
                      const sci = SCIENTIFIC_INTERPRETATION_BY_CODE[s.code];
                      const wonBadges: string[] = [];
                      if (s.wonMotionCriterion) wonBadges.push('Motion');
                      if (s.wonTemporalCriterion) wonBadges.push('Temporal');
                      if (s.wonSpatialCriterion) wonBadges.push('Spatial');

                      return (
                        <tr
                          key={s.code}
                          className={
                            isBestOnVideo
                              ? 'bg-emerald-50/60 font-medium'
                              : 'bg-white'
                          }
                        >
                          <td className="py-2 px-2 font-mono font-bold text-blue-700 border-r border-slate-200">
                            {s.code}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-300">
                            <div className="font-semibold text-slate-900">
                              {sci?.roleTitle ?? s.label}
                            </div>
                            <div className="text-[10.5px] text-slate-500">
                              {s.label}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                            <span
                              className={
                                s.jitterReductionPct > 0.05
                                  ? 'text-emerald-700 font-bold'
                                  : s.jitterReductionPct < -0.05
                                  ? 'text-rose-700 font-bold'
                                  : 'text-slate-600'
                              }
                            >
                              {s.jitterReductionPct > 0 ? '+' : ''}
                              {s.jitterReductionPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums border-r border-slate-300">
                            <span className="font-bold text-slate-900">
                              {s.residualOutputJitterRms.toFixed(2)} px
                            </span>
                            {s.code === 'D4' ? (
                              <div className="text-[10px] text-amber-700">(No Warp)</div>
                            ) : ['D1', 'D5', 'D6'].includes(s.code) ? (
                              <div className="text-[10px] text-slate-400">(= D0)</div>
                            ) : null}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                            <span className="font-bold">{s.maskFlickerPct.toFixed(2)}%</span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-indigo-900 font-bold border-r border-slate-300">
                            {s.maskStabilityPct.toFixed(2)}%
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                            {s.rawComponentCount.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums bg-amber-50/20 border-r border-slate-200">
                            <div className="font-bold text-slate-900">
                              {s.postMorphologyComponentCount.toFixed(2)} vùng/frame
                            </div>
                            {s.code === 'D0' ? (
                              <div className="text-[10px] text-emerald-700">0.00 (0.0%)</div>
                            ) : (
                              <div className="text-[10px] text-slate-600">
                                {s.deltaCleanComponentsVsD0 >= 0 ? '+' : ''}
                                {s.deltaCleanComponentsVsD0.toFixed(2)} (
                                {s.deltaCleanComponentsVsD0Pct >= 0 ? '+' : ''}
                                {s.deltaCleanComponentsVsD0Pct.toFixed(1)}%)
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                            <div className="font-semibold text-slate-900">
                              {s.fgAreaRatioPct.toFixed(2)}%
                            </div>
                            {s.code !== 'D0' && (
                              <div className="text-[10px] text-slate-500">
                                ΔFG: {s.deltaFgAreaVsD0PctPt >= 0 ? '+' : ''}
                                {s.deltaFgAreaVsD0PctPt.toFixed(2)}%
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums bg-purple-50/20 border-r border-slate-300">
                            {s.code === 'D0' ? (
                              <span className="text-emerald-700 font-bold">0.00%</span>
                            ) : (
                              <span className="font-bold">
                                {s.deltaPixelRatioVsBaselinePct.toFixed(2)}%
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums border-r border-slate-200">
                            {s.f1 !== null && s.iou !== null ? (
                              <div>
                                <div className="font-bold">
                                  {(s.f1 * 100).toFixed(2)}%
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  IoU: {(s.iou * 100).toFixed(2)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A (No GT)</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums font-semibold border-r border-slate-300">
                            {s.fps.toFixed(1)}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <div className="text-[11px] font-mono font-bold text-slate-800">
                              {s.criterionWinsOnVideo}/3 tiêu chí
                              {wonBadges.length > 0
                                ? ` (${wonBadges.join(', ')})`
                                : ''}
                            </div>
                            {isBestOnVideo && (
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold ${
                                  currentDemoVideo.isPerVideoTie
                                    ? 'bg-amber-100 border border-amber-400 text-amber-950'
                                    : 'bg-emerald-600 text-white'
                                }`}
                              >
                                {currentDemoVideo.isPerVideoTie
                                  ? '★ TIE (ĐỒNG HẠNG TRÊN VIDEO NÀY)'
                                  : '★ PER-VIDEO BEST CONFIG'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PHẦN 4 (MỤC F.5): 5 NHÓM BIỂU ĐỒ SO SÁNH D0–D6 VỚI TRỤC TUNG ĐỘC LẬP TỪNG ĐƠN VỊ */}
          {chartDataRows.length > 0 && (
            <div
              data-testid="ablation-charts-section"
              className="bg-white border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900">
                      4. Biểu Đồ So Sánh D0–D6 Theo Các Nhóm Chỉ Số Thực Nghiệm (Tách Riêng Trục Tung Theo Đơn Vị)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Tuyệt đối không dùng chung trục tung cho các đại lượng khác đơn vị (<code>%</code>, <code>px</code>, <code>vùng/frame</code>, <code>FPS</code> đều có hệ trục riêng biệt).
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">Nguồn dữ liệu vẽ biểu đồ:</span>
                  <select
                    value={chartSourceId}
                    onChange={(e) => setChartSourceId(e.target.value)}
                    className="border border-slate-300 bg-slate-50 px-2.5 py-1 font-semibold text-slate-900"
                  >
                    <option value="SUMMARY">
                      Trung bình Tập dữ liệu đang lọc ({reportVideos.length} video)
                    </option>
                    {batchResults.map((v) => (
                      <option key={v.videoId} value={v.videoId}>
                        Video: {v.videoTitle} [{v.datasetGroup.groupCode}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CHART GROUP 1: MOTION REDUCTION (%) AND RESIDUAL JITTER (px) — SEPARATE Y-AXES */}
                <div className="border border-slate-200 p-3.5 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                    Biểu đồ 1: Motion Stabilization — Tách riêng trục <code>%</code> và trục <code>px</code>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Sub-chart 1A: Motion Reduction (%) */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>1A. Motion Reduction</span>
                        <span className="font-mono text-blue-700">Đơn vị: %</span>
                      </div>
                      {(() => {
                        const maxAbs = Math.max(
                          10,
                          ...chartDataRows.map((d) => Math.abs(d.motionReductionPct))
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => {
                              const pctWidth = Math.min(
                                100,
                                (Math.abs(d.motionReductionPct) / maxAbs) * 100
                              );
                              const isPos = d.motionReductionPct >= 0;
                              return (
                                <div key={d.code} className="space-y-0.5">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="font-bold text-slate-800">{d.code}</span>
                                    <span
                                      className={
                                        d.motionReductionPct > 0.05
                                          ? 'text-emerald-700 font-bold'
                                          : d.motionReductionPct < -0.05
                                          ? 'text-rose-700 font-bold'
                                          : 'text-slate-600'
                                      }
                                    >
                                      {d.motionReductionPct >= 0 ? '+' : ''}
                                      {d.motionReductionPct.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        isPos ? 'bg-emerald-600' : 'bg-rose-600'
                                      }`}
                                      style={{ width: `${Math.max(2, pctWidth)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Sub-chart 1B: Residual Jitter (px) */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>1B. Residual Jitter</span>
                        <span className="font-mono text-blue-700">Đơn vị: px</span>
                      </div>
                      {(() => {
                        const maxPx = Math.max(
                          1,
                          ...chartDataRows.map((d) => d.residualJitterPx)
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => {
                              const pctWidth = Math.min(
                                100,
                                (d.residualJitterPx / maxPx) * 100
                              );
                              return (
                                <div key={d.code} className="space-y-0.5">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="font-bold text-slate-800">{d.code}</span>
                                    <span className="text-slate-900 font-semibold">
                                      {d.residualJitterPx.toFixed(2)} px
                                    </span>
                                  </div>
                                  <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                    <div
                                      className="h-full bg-blue-600"
                                      style={{ width: `${Math.max(3, pctWidth)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* CHART GROUP 2: TEMPORAL FLICKER (%) AND MASK STABILITY (%) */}
                <div className="border border-slate-200 p-3.5 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                    Biểu đồ 2: Temporal Mask Quality (Proxy) — Flicker (%) &amp; Mask Stability (%)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Sub-chart 2A: Flicker (%) */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>2A. Temporal Flicker (Thấp = Tốt)</span>
                        <span className="font-mono text-indigo-700">Đơn vị: %</span>
                      </div>
                      {(() => {
                        const maxFlicker = Math.max(
                          1,
                          ...chartDataRows.map((d) => d.flickerPct)
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => {
                              const pctWidth = Math.min(
                                100,
                                (d.flickerPct / maxFlicker) * 100
                              );
                              return (
                                <div key={d.code} className="space-y-0.5">
                                  <div className="flex justify-between text-[11px] font-mono">
                                    <span className="font-bold text-slate-800">{d.code}</span>
                                    <span className="text-slate-900 font-semibold">
                                      {d.flickerPct.toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500"
                                      style={{ width: `${Math.max(3, pctWidth)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Sub-chart 2B: Mask Stability Proxy (%) */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>2B. Mask Stability Proxy (Cao = Tốt)</span>
                        <span className="font-mono text-indigo-700">Đơn vị: %</span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {chartDataRows.map((d) => (
                          <div key={d.code} className="space-y-0.5">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className="font-bold text-slate-800">{d.code}</span>
                              <span className="text-indigo-900 font-bold">
                                {d.stabilityPct.toFixed(2)}%
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-indigo-600"
                                style={{
                                  width: `${Math.max(5, Math.min(100, d.stabilityPct))}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CHART GROUP 3: CONNECTED COMPONENTS BEFORE vs AFTER MORPHOLOGY */}
                <div className="border border-slate-200 p-3.5 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                    Biểu đồ 3: Connected Components Trước &amp; Sau Morphology (Đơn vị: <code>vùng/frame</code>)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Sub-chart 3A: Before Morphology */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>3A. Trước Morphology</span>
                        <span className="font-mono text-amber-800">vùng/frame</span>
                      </div>
                      {(() => {
                        const maxRaw = Math.max(
                          1,
                          ...chartDataRows.map((d) => d.rawComponents)
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => (
                              <div key={d.code} className="space-y-0.5">
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="font-bold text-slate-800">{d.code}</span>
                                  <span className="text-slate-800">
                                    {d.rawComponents.toFixed(2)}
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                  <div
                                    className="h-full bg-slate-500"
                                    style={{
                                      width: `${Math.max(
                                        3,
                                        Math.min(100, (d.rawComponents / maxRaw) * 100)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Sub-chart 3B: After Morphology */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>3B. Sau Morphology</span>
                        <span className="font-mono text-amber-800">vùng/frame</span>
                      </div>
                      {(() => {
                        const maxClean = Math.max(
                          1,
                          ...chartDataRows.map((d) => d.cleanComponents)
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => (
                              <div key={d.code} className="space-y-0.5">
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="font-bold text-slate-800">{d.code}</span>
                                  <span
                                    className={
                                      d.code === 'D5'
                                        ? 'text-rose-700 font-bold'
                                        : 'text-emerald-800 font-bold'
                                    }
                                  >
                                    {d.cleanComponents.toFixed(2)}
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      d.code === 'D5' ? 'bg-rose-600' : 'bg-emerald-600'
                                    }`}
                                    style={{
                                      width: `${Math.max(
                                        3,
                                        Math.min(100, (d.cleanComponents / maxClean) * 100)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* CHART GROUP 4: FOREGROUND AREA (%) & PIXEL XOR DIFFERENCE VS D0 (%) */}
                <div className="border border-slate-200 p-3.5 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                    Biểu đồ 4: Foreground Area (%) &amp; Pixel XOR Difference vs D0 (%)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Sub-chart 4A: Foreground Area (%) */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>4A. Foreground Area Ratio</span>
                        <span className="font-mono text-purple-800">Đơn vị: %</span>
                      </div>
                      {(() => {
                        const maxFg = Math.max(
                          1,
                          ...chartDataRows.map((d) => d.fgAreaPct)
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => (
                              <div key={d.code} className="space-y-0.5">
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="font-bold text-slate-800">{d.code}</span>
                                  <span className="text-slate-900 font-semibold">
                                    {d.fgAreaPct.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                  <div
                                    className="h-full bg-teal-600"
                                    style={{
                                      width: `${Math.max(
                                        3,
                                        Math.min(100, (d.fgAreaPct / maxFg) * 100)
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Sub-chart 4B: Pixel XOR vs D0 (%) */}
                    <div className="bg-white border border-slate-200 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-800 flex justify-between">
                        <span>4B. Pixel XOR vs D0</span>
                        <span className="font-mono text-purple-800">Đơn vị: %</span>
                      </div>
                      {(() => {
                        const maxXor = Math.max(
                          1,
                          ...chartDataRows.map((d) => d.pixelXorPct)
                        );
                        return (
                          <div className="space-y-1.5 pt-1">
                            {chartDataRows.map((d) => (
                              <div key={d.code} className="space-y-0.5">
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="font-bold text-slate-800">{d.code}</span>
                                  <span className="text-purple-900 font-bold">
                                    {d.pixelXorPct.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                                  <div
                                    className="h-full bg-purple-600"
                                    style={{
                                      width: `${
                                        d.code === 'D0'
                                          ? 0
                                          : Math.max(
                                              3,
                                              Math.min(100, (d.pixelXorPct / maxXor) * 100)
                                            )
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* CHART GROUP 5: COMPUTATIONAL PERFORMANCE (FPS) */}
              <div className="border border-slate-200 p-3.5 bg-slate-50/50 space-y-2">
                <div className="text-xs font-bold text-slate-900 flex justify-between border-b border-slate-200 pb-1.5">
                  <span>Biểu đồ 5: Performance — Tốc Độ Xử Lý Trung Bình (FPS)</span>
                  <span className="font-mono text-slate-700">Đơn vị trục: frames/sec (FPS)</span>
                </div>
                {(() => {
                  const maxFps = Math.max(1, ...chartDataRows.map((d) => d.fps));
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
                      {chartDataRows.map((d) => (
                        <div
                          key={d.code}
                          className="bg-white border border-slate-200 p-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="font-bold text-blue-700">{d.code}</span>
                            <span className="font-bold text-slate-900">
                              {d.fps.toFixed(1)} FPS
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 border border-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-slate-700"
                              style={{
                                width: `${Math.max(
                                  5,
                                  Math.min(100, (d.fps / maxFps) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* PHẦN 5 (MỤC B & F.3): ĐỊNH NGHĨA CÔNG THỨC CHUẨN HÓA 8 CHỈ SỐ & CÁCH DIỄN GIẢI KHOA HỌC D0–D6 */}
          <div
            data-testid="standardized-metric-definitions"
            className="bg-white border border-slate-200 p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-bold text-slate-900">
                5. Định Nghĩa Công Thức Toán Học 8 Chỉ Số &amp; Diễn Giải Khoa Học D0–D6
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-800">
              <div className="bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                <div className="font-bold text-slate-900">
                  Công thức toán học của 8 chỉ số chuẩn hóa:
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11.5px] leading-relaxed">
                  <li>
                    <strong>Motion Reduction (%):</strong>{' '}
                    <code>((J_input − J_residual(Di)) / J_input) × 100%</code>. Giá trị dương thể hiện giảm rung hiệu quả; giá trị âm (như ở D2 khi bỏ RANSAC) phản ánh quỹ đạo bị kéo lệch bởi ngoại lai; D4 (No Warp) có <code>J_residual = J_input</code> nên bằng <code>0.0%</code>.
                  </li>
                  <li>
                    <strong>Residual Jitter (px):</strong>{' '}
                    <code>sqrt( (1 / (2(T−1))) × Σ [ (Δx_out(t) − Δx_smooth(t))² + (Δy_out(t) − Δy_smooth(t))² ] )</code>. Đo trực tiếp trên chuỗi khung hình đầu ra xuất ra của từng cấu hình (đơn vị: <code>px</code>) bằng bộ đánh giá độc lập (Evaluator): Shi-Tomasi corners (<code>maxCorners=120, qualityLevel=0.01</code>) + Lucas-Kanade optical flow (21×21) + 2D Similarity transform với RANSAC (ngưỡng <code>2.5 px</code>) → tính sai số gia tốc bậc hai RMS của quỹ đạo trọng tâm camera. Tuyệt đối không dùng trạng thái nội bộ của pipeline làm ground truth.
                  </li>
                  <li>
                    <strong>Temporal Mask Flicker (%):</strong>{' '}
                    <code>(1 / (T−1)) × Σ [ Σ |M_t(x,y) − M_{'{t-1}'}(x,y)| / (255 × W × H) ] × 100%</code> — tỷ lệ phần trăm pixel đổi trạng thái giữa 2 frame liên tiếp.
                  </li>
                  <li>
                    <strong>Mask Stability Proxy (%):</strong>{' '}
                    <code>100% − Temporal Mask Flicker (%)</code>. Đây là chỉ số đại diện độ ổn định theo thời gian, <strong>không đánh đồng với Ground Truth Accuracy</strong>.
                  </li>
                  <li>
                    <strong>Connected Components per Frame (<code>vùng/frame</code>):</strong>{' '}
                     Trung bình số vùng liên thông 8 hướng trên mỗi frame trước Morphology (<code>CC Before Morph</code>) và sau Morphology + lọc diện tích <code>A_min = 28 px²</code> (<code>CC After Morph</code>). Chỉ số này đo mức độ phân mảnh không gian (Spatial Fragmentation Proxy), <strong>không đánh đồng với Segmentation Accuracy</strong> khi thiếu Ground Truth.
                  </li>
                  <li>
                    <strong>Foreground Area Ratio (%):</strong>{' '}
                    <code>(1 / T) × Σ [ Count(M_t(x,y) = 255) / (W × H) ] × 100%</code>.
                  </li>
                  <li>
                    <strong>Pixel XOR Difference vs D0 (%):</strong>{' '}
                    <code>(1 / T) × Σ_{'{t=0}'}^{'{T-1}'} [ Count(M_t(Di) ≠ M_t(D0)) / (W × H) ] × 100%</code>. Đánh giá trên toàn bộ <code>T</code> khung hình (mẫu số <code>T</code>). Hai binary mask bắt buộc phải cùng kích thước <code>W × H</code> và cùng chỉ số frame <code>t</code> trước khi tính; nếu lệch kích thước hoặc số frame hệ thống sẽ ném ngoại lệ <code>[Pixel XOR Dimension Mismatch]</code> ngay lập tức. <strong>Không đánh đồng với Segmentation Error</strong> vì D0 là cấu hình chuẩn tham chiếu (Baseline), không phải Ground Truth.
                  </li>
                  <li>
                    <strong>FPS (Mean) &amp; Mean Latency (ms/frame):</strong>{' '}
                    <code>FPS = 1000 / Mean_Frame_Latency_ms</code>. Thời gian đo thuần túy thuật toán DSP xử lý từng khung hình (Frame-by-frame DSP Algorithmic Processing Latency), loại trừ hoàn toàn thời gian nạp giải mã video I/O, khởi tạo Web Worker/Canvas và render DOM/UI.
                  </li>
                </ol>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                <div className="font-bold text-slate-900">
                  Cách diễn giải khoa học 7 cấu hình (Section 12.6 — Báo cáo DSP501):
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11.5px] leading-relaxed">
                  <li>
                    <strong>D0 (Baseline pipeline):</strong> Kết hợp đầy đủ LK + RANSAC → Gaussian Trajectory Smoothing → Affine Warp → MOG2 (có khử bóng) → 3×3 Gaussian Spatial Denoising → Morphological Opening/Closing + Area Filtering.
                  </li>
                  <li>
                    <strong>D1:</strong> Đánh giá ảnh hưởng của <em>Gaussian Spatial Denoising</em> (tắt làm mượt không gian 3×3 trước MOG2).
                  </li>
                  <li>
                    <strong>D2:</strong> Đánh giá ảnh hưởng của <em>RANSAC Outlier Rejection</em> (tắt lọc ngoại lai RANSAC).
                  </li>
                  <li>
                    <strong>D3:</strong> So sánh <em>Gaussian</em> và <em>Moving-Average Trajectory Smoothing</em>.
                  </li>
                  <li>
                    <strong>D4:</strong> Đánh giá ảnh hưởng của <em>Motion Compensation</em> (tắt biến đổi hình học Warp).
                  </li>
                  <li>
                    <strong>D5:</strong> Đánh giá ảnh hưởng của <em>Morphological Processing</em> (tắt Opening/Closing &amp; lọc diện tích, do đó CC Before Morph = CC After Morph).
                  </li>
                  <li>
                    <strong>D6:</strong> Đánh giá ảnh hưởng của <em>Shadow Suppression</em> (tắt phát hiện bóng đổ trong MOG2).
                  </li>
                </ul>
                <div className="p-2 bg-blue-50 border border-blue-200 text-[11px] text-blue-950 mt-2">
                  <strong>Giải thích kết quả chống rung đồng nhất ở D0, D1, D5, D6:</strong> D1, D5, D6 chỉ thay đổi khâu xử lý mặt nạ tách nền phía sau và giữ nguyên 100% nhánh chống rung của D0. Do đó <code>Motion Reduction (%)</code> và <code>Residual Jitter (px)</code> của D0, D1, D5, D6 bằng nhau là hoàn toàn chính xác về mặt toán học thực nghiệm (không tạo sai khác giả).
                </div>
              </div>
            </div>
          </div>

          {/* KIỂM TOÁN TÍNH ĐỒNG NHẤT CỦA PIPELINE */}
          {batchResults.length > 0 && (
            <div
              data-testid="ablation-audit-log"
              className="bg-slate-900 text-slate-100 border border-slate-700 p-4 font-mono text-xs space-y-2"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="font-bold text-emerald-400">
                  [KIỂM TOÁN TÍNH ĐỒNG NHẤT VÀ TÍNH ĐÚNG CỦA PIPELINE D0–D6]
                </span>
                <span className="text-[11px] text-slate-400">
                  Verified Videos: {batchResults.length} | Active Setups: {selectedCodes.join(', ')}
                </span>
              </div>
              <div className="space-y-1.5 text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                {batchResults.map((v, idx) => {
                  const d0 = v.slotResults.find((s) => s.code === 'D0');
                  const d1 = v.slotResults.find((s) => s.code === 'D1');
                  const d4 = v.slotResults.find((s) => s.code === 'D4');
                  const d5 = v.slotResults.find((s) => s.code === 'D5');
                  const d6 = v.slotResults.find((s) => s.code === 'D6');

                  const stabSharedOk =
                    d0 &&
                    (!d1 ||
                      Math.abs(
                        d0.residualOutputJitterRms - d1.residualOutputJitterRms
                      ) < 1e-4) &&
                    (!d5 ||
                      Math.abs(
                        d0.residualOutputJitterRms - d5.residualOutputJitterRms
                      ) < 1e-4) &&
                    (!d6 ||
                      Math.abs(
                        d0.residualOutputJitterRms - d6.residualOutputJitterRms
                      ) < 1e-4);

                  const d4NoWarpOk =
                    !d4 || Math.abs(d4.jitterReductionPct) < 1e-4;
                  const d5NoMorphOk =
                    !d5 ||
                    Math.abs(
                      d5.rawComponentCount - d5.postMorphologyComponentCount
                    ) < 1e-4;

                  return (
                    <div
                      key={v.videoId}
                      className="border-b border-slate-800 pb-1.5"
                    >
                      <div className="text-blue-300 font-bold">
                        #{idx + 1} [{v.datasetGroup.groupCode}] {v.videoTitle} — {v.width}×{v.height}, {v.frameCount} frames @ {v.samplingFps} FPS | GT: {v.hasGroundTruth ? 'YES' : 'N/A (No Ground Truth)'}
                      </div>
                      <div className="text-slate-300 pl-3">
                        • Pixel XOR Mask Alignment Check: {v.pixelXorAuditNote}
                      </div>
                      <div className="text-slate-300 pl-3">
                        • Stabilization Branch Check (D0=D1=D5=D6):{' '}
                        {stabSharedOk ? (
                          <span className="text-emerald-400">
                            PASS (Residual Jitter = {d0?.residualOutputJitterRms.toFixed(2)} px, Motion Reduction = {d0?.jitterReductionPct.toFixed(1)}%)
                          </span>
                        ) : (
                          <span className="text-rose-400">WARNING</span>
                        )}{' '}
                        | D4 No-Warp Check:{' '}
                        {d4NoWarpOk ? (
                          <span className="text-emerald-400">
                            PASS (Motion Reduction = 0.0%)
                          </span>
                        ) : (
                          <span className="text-rose-400">FAIL</span>
                        )}{' '}
                        | D5 No-Morph Check:{' '}
                        {d5NoMorphOk ? (
                          <span className="text-emerald-400">
                            PASS (Before = After = {d5?.postMorphologyComponentCount.toFixed(2)} vùng/frame)
                          </span>
                        ) : (
                          <span className="text-rose-400">FAIL</span>
                        )}
                      </div>
                      <div className="text-slate-300 pl-3">
                        • Per-Criterion Winners: Motion=[{v.winnerStabDisplay}] | Temporal=[{v.winnerTemporalDisplay}] | Spatial=[{v.winnerCleanDisplay}] ⇒ Per-Video Best Config: <strong className="text-amber-300">{v.perVideoBestDisplay}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          TAB 2: TRÌNH PHÁT VIDEO ĐỘNG ĐỒNG BỘ TỪNG CẤU HÌNH (XEM VIDEO THỰC TẾ)
         ===================================================================== */}
      {activeSubTab === 'video_tab' && currentDemoVideo && (
        <div
          data-testid="synchronized-video-player-tab"
          className="bg-white border border-slate-200 p-5 shadow-xs space-y-4"
        >
          {/* Top Video Switcher & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Film className="w-4 h-4 text-emerald-600" />
                <span>Chọn Video Đang Phát:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setDemoFilterMode('ALL');
                  setActiveSlideIndex(0);
                  setPlaybackFrameIdx(0);
                }}
                className={`px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                  demoFilterMode === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Tất cả Video ({batchResults.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDemoFilterMode('D0_WINNERS');
                  setActiveSlideIndex(0);
                  setPlaybackFrameIdx(0);
                }}
                className={`px-2.5 py-1 text-xs font-semibold border cursor-pointer ${
                  demoFilterMode === 'D0_WINNERS'
                    ? 'bg-emerald-600 text-white border-emerald-700'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                ★ Chỉ lọc Video D0 dẫn đầu/đồng hạng ({d0WinnerVideosCount}/
                {batchResults.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevVideo}
                className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Video Trước</span>
              </button>

              <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-900 font-mono text-xs font-bold">
                Video {safeSlideIdx + 1} / {demoCarouselVideos.length}
              </span>

              <button
                type="button"
                onClick={handleNextVideo}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Video Tiếp Theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Video Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 p-2.5">
            {demoCarouselVideos.map((v, idx) => {
              const isCurrent = idx === safeSlideIdx;
              return (
                <button
                  key={v.videoId}
                  type="button"
                  onClick={() => {
                    setActiveSlideIndex(idx);
                    setPlaybackFrameIdx(0);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{v.videoTitle}</span>
                  <span
                    className={`text-[10px] font-mono px-1 py-0.2 ${
                      isCurrent
                        ? 'bg-blue-800 text-white'
                        : v.isPerVideoTie
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {v.perVideoBestDisplay}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Synchronized Video Player Transport & View Mode Controls */}
          <div className="bg-slate-100 border border-slate-300 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="toggle-play-video-btn"
                  onClick={() => setIsPlayingVideo((p) => !p)}
                  className={`px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    isPlayingVideo
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isPlayingVideo ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>⏸ Tạm Dừng Video</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>▶ Phát Video Động</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlayingVideo(false);
                    setPlaybackFrameIdx(
                      (prev) =>
                        (prev - 1 + currentDemoVideo.frameCount) %
                        currentDemoVideo.frameCount
                    );
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Lùi 1 khung hình"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                  <span>-1 Frame</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlayingVideo(false);
                    setPlaybackFrameIdx(
                      (prev) => (prev + 1) % currentDemoVideo.frameCount
                    );
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Tiến 1 khung hình"
                >
                  <span>+1 Frame</span>
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 bg-white border border-slate-300 px-2 py-1 text-xs">
                  <span className="text-slate-600 font-semibold">Tốc độ:</span>
                  {[0.5, 1.0, 1.5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-1.5 py-0.5 font-mono font-bold cursor-pointer ${
                        playbackSpeed === spd
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Live Video Stream Modes */}
              <div className="flex flex-wrap border border-slate-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setVisualViewMode('overlay')}
                  className={`px-2.5 py-1 font-semibold cursor-pointer ${
                    visualViewMode === 'overlay'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  1. Video Tô Màu Vật Thể (Overlay)
                </button>
                <button
                  type="button"
                  onClick={() => setVisualViewMode('mask')}
                  className={`px-2.5 py-1 font-semibold cursor-pointer ${
                    visualViewMode === 'mask'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  2. Video Mặt Nạ Tách Nền (Mask)
                </button>
                <button
                  type="button"
                  onClick={() => setVisualViewMode('stabilized')}
                  className={`px-2.5 py-1 font-semibold cursor-pointer ${
                    visualViewMode === 'stabilized'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  3. Video Sau Chống Rung
                </button>
                <button
                  type="button"
                  onClick={() => setVisualViewMode('diff')}
                  className={`px-2.5 py-1 font-semibold cursor-pointer ${
                    visualViewMode === 'diff'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  4. Video Sai Khác Pixel XOR vs D0
                </button>
              </div>
            </div>

            {/* Frame Scrubber Bar */}
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="font-bold text-blue-900 shrink-0">
                Frame {safePlaybackFrameIdx + 1} / {currentDemoVideo.frameCount} (
                {(
                  safePlaybackFrameIdx /
                  Math.max(1, currentDemoVideo.samplingFps || 12)
                ).toFixed(2)}
                s)
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0, currentDemoVideo.frameCount - 1)}
                value={safePlaybackFrameIdx}
                onChange={(e) => {
                  setPlaybackFrameIdx(Number(e.target.value));
                }}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* KHU VỰC 1: MÀN HÌNH SO SÁNH ĐÔI PHÓNG TO (2-UP LIVE VIDEO SPOTLIGHT) */}
          {(() => {
            const d0SlotForVideo = currentDemoVideo.slotResults.find(
              (s) => s.code === 'D0'
            );
            const leftSlot =
              spotlightLeftCode === 'RAW_INPUT'
                ? undefined
                : currentDemoVideo.slotResults.find(
                    (s) => s.code === spotlightLeftCode
                  ) ?? d0SlotForVideo;
            const rightSlot =
              currentDemoVideo.slotResults.find(
                (s) => s.code === spotlightRightCode
              ) ??
              d0SlotForVideo ??
              currentDemoVideo.slotResults[0];

            const leftRgba =
              spotlightLeftCode === 'RAW_INPUT' || !leftSlot
                ? currentDemoVideo.originalFrames[safePlaybackFrameIdx]
                : synthesizeLiveSlotFrameRgba(
                    leftSlot,
                    d0SlotForVideo,
                    safePlaybackFrameIdx,
                    visualViewMode,
                    currentDemoVideo.width,
                    currentDemoVideo.height
                  );

            const rightRgba = rightSlot
              ? synthesizeLiveSlotFrameRgba(
                  rightSlot,
                  d0SlotForVideo,
                  safePlaybackFrameIdx,
                  visualViewMode,
                  currentDemoVideo.width,
                  currentDemoVideo.height
                )
              : undefined;

            return (
              <div className="bg-slate-50 border border-slate-300 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-900">
                    🔍 Màn Hình So Sánh Đôi Phóng To (Chạy Song Song Cùng Khung Hình #{safePlaybackFrameIdx + 1})
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span>Màn hình Trái:</span>
                      <select
                        value={spotlightLeftCode}
                        onChange={(e) => setSpotlightLeftCode(e.target.value)}
                        className="border border-slate-300 bg-white px-2 py-1 font-mono font-bold text-slate-900"
                      >
                        <option value="RAW_INPUT">
                          Video Gốc Chưa Xử Lý (Raw Input)
                        </option>
                        {currentDemoVideo.slotResults.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <span>Màn hình Phải:</span>
                      <select
                        value={rightSlot?.code ?? 'D0'}
                        onChange={(e) => setSpotlightRightCode(e.target.value)}
                        className="border border-blue-400 bg-blue-50 px-2 py-1 font-mono font-bold text-blue-900"
                      >
                        {currentDemoVideo.slotResults.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {/* Left Spotlight Card */}
                  {(() => {
                    const leftTitleFull =
                      spotlightLeftCode === 'RAW_INPUT' || !leftSlot
                        ? 'Video Gốc Đầu Vào (Chưa Chống Rung / Chưa Tách Nền)'
                        : leftSlot.label;
                    const leftCompNow = leftSlot
                      ? leftSlot.perFrameComponents[safePlaybackFrameIdx] ??
                        leftSlot.postMorphologyComponentCount
                      : null;

                    return (
                      <div className="bg-white border border-slate-300 p-3 space-y-2 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 h-7 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="px-2 py-0.5 bg-slate-800 text-white font-mono text-[11px] font-bold shrink-0">
                                {spotlightLeftCode === 'RAW_INPUT' || !leftSlot
                                  ? 'RAW INPUT'
                                  : leftSlot.code}
                              </span>
                              <span
                                className="font-bold text-slate-800 text-xs truncate"
                                title={leftTitleFull}
                              >
                                {spotlightLeftCode === 'RAW_INPUT' || !leftSlot
                                  ? 'Video Gốc Chưa Xử Lý'
                                  : leftSlot.label}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 border border-slate-200 shrink-0">
                              Frame #{safePlaybackFrameIdx + 1}/{currentDemoVideo.frameCount}
                            </span>
                          </div>
                          <FrameCanvas
                            rgba={leftRgba}
                            width={currentDemoVideo.width}
                            height={currentDemoVideo.height}
                            title={
                              spotlightLeftCode === 'RAW_INPUT' || !leftSlot
                                ? 'RAW INPUT'
                                : leftSlot.code
                            }
                            subtitle={
                              spotlightLeftCode === 'RAW_INPUT' || !leftSlot
                                ? `Rung gốc: ${(currentDemoVideo.slotResults[0]?.rawInputJitterRms ?? 0).toFixed(2)} px`
                                : `Rung dư: ${leftSlot.residualOutputJitterRms.toFixed(2)} px · Giảm: ${leftSlot.jitterReductionPct.toFixed(1)}%`
                            }
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-slate-200 text-[11px] font-mono text-center">
                          <div className="bg-slate-50 border border-slate-200 py-1 px-1">
                            <span className="text-slate-500 block text-[10px]">
                              Rung đầu vào
                            </span>
                            <span className="font-bold text-slate-900">
                              {(currentDemoVideo.slotResults[0]?.rawInputJitterRms ?? 0).toFixed(2)} px
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 py-1 px-1">
                            <span className="text-slate-500 block text-[10px]">
                              Độ phân giải
                            </span>
                            <span className="font-bold text-slate-900">
                              {currentDemoVideo.width}×{currentDemoVideo.height}
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 py-1 px-1">
                            <span className="text-slate-500 block text-[10px]">
                              CC Sau Morph (#{safePlaybackFrameIdx + 1})
                            </span>
                            <span className="font-bold text-slate-700">
                              {leftCompNow !== null
                                ? `${Number(leftCompNow).toFixed(0)} vùng`
                                : 'Gốc'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Right Spotlight Card */}
                  {rightSlot && (() => {
                    const rightTitleFull = rightSlot.label;
                    const rightCompNow =
                      rightSlot.perFrameComponents[safePlaybackFrameIdx] ??
                      rightSlot.postMorphologyComponentCount;

                    return (
                      <div className="bg-white border-2 border-emerald-500 p-3 space-y-2 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 h-7 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-[11px] font-bold shrink-0">
                                ★ {rightSlot.code}
                              </span>
                              <span
                                className="font-bold text-emerald-950 text-xs truncate"
                                title={rightTitleFull}
                              >
                                {rightSlot.label}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200 font-bold shrink-0">
                              Frame #{safePlaybackFrameIdx + 1}/{currentDemoVideo.frameCount}
                            </span>
                          </div>
                          <FrameCanvas
                            rgba={rightRgba}
                            width={currentDemoVideo.width}
                            height={currentDemoVideo.height}
                            title={`${rightSlot.code} · ${visualViewMode.toUpperCase()}`}
                            subtitle={`CC frame #${safePlaybackFrameIdx + 1}: ${Number(rightCompNow).toFixed(0)} vùng · Giảm: ${rightSlot.jitterReductionPct.toFixed(1)}%`}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-slate-200 text-[11px] font-mono text-center">
                          <div className="bg-emerald-50/60 border border-emerald-200 py-1 px-1">
                            <span className="text-emerald-700 block text-[10px]">
                              Giảm rung
                            </span>
                            <span className="font-bold text-emerald-900">
                              {rightSlot.jitterReductionPct >= 0 ? '+' : ''}
                              {rightSlot.jitterReductionPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="bg-emerald-50/60 border border-emerald-200 py-1 px-1">
                            <span className="text-emerald-700 block text-[10px]">
                              Rung dư
                            </span>
                            <span className="font-bold text-emerald-900">
                              {rightSlot.residualOutputJitterRms.toFixed(2)} px
                            </span>
                          </div>
                          <div className="bg-emerald-50/60 border border-emerald-200 py-1 px-1">
                            <span className="text-emerald-700 block text-[10px]">
                              CC Sau Morph (#{safePlaybackFrameIdx + 1})
                            </span>
                            <span className="font-bold text-emerald-950">
                              {Number(rightCompNow).toFixed(0)} vùng
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          {/* KHU VỰC 2: DÀN MÀN HÌNH VIDEO ĐỒNG BỘ TẤT CẢ CẤU HÌNH (VIDEO GỐC + D0..D6) */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>
                📺 Dàn Màn Hình Tất Cả Cấu Hình Đang Chạy Đồng Bộ ({currentDemoVideo.videoTitle} — Frame #{safePlaybackFrameIdx + 1}/{currentDemoVideo.frameCount})
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Bấm vào bất kỳ ô cấu hình nào để đưa lên Màn hình Phóng to bên trên
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {/* Card 0: Raw Original Input Video */}
              <div
                onClick={() => setSpotlightLeftCode('RAW_INPUT')}
                className="border border-slate-300 bg-slate-50 p-2.5 flex flex-col justify-between cursor-pointer hover:border-blue-500"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="px-2 py-0.5 bg-slate-800 text-white font-mono text-xs font-bold">
                      INPUT GỐC
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                      Frame {safePlaybackFrameIdx + 1}/{currentDemoVideo.frameCount}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 line-clamp-1">
                    Video Gốc Chưa Xử Lý (Raw Input)
                  </div>
                  <FrameCanvas
                    rgba={currentDemoVideo.originalFrames[safePlaybackFrameIdx]}
                    width={currentDemoVideo.width}
                    height={currentDemoVideo.height}
                    title="RAW INPUT"
                    subtitle={`Rung gốc: ${(currentDemoVideo.slotResults[0]?.rawInputJitterRms ?? 0).toFixed(2)} px`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-slate-200 text-[11px] font-mono text-center">
                  <div className="bg-white border border-slate-200 py-1 px-1">
                    <span className="text-slate-500 block text-[10px]">
                      Rung đầu vào
                    </span>
                    <span className="font-bold text-slate-900">
                      {(currentDemoVideo.slotResults[0]?.rawInputJitterRms ?? 0).toFixed(2)} px
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 py-1 px-1">
                    <span className="text-slate-500 block text-[10px]">
                      Độ phân giải
                    </span>
                    <span className="font-bold text-slate-900">
                      {currentDemoVideo.width}×{currentDemoVideo.height}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 py-1 px-1">
                    <span className="text-slate-500 block text-[10px]">
                      Trạng thái
                    </span>
                    <span className="font-bold text-slate-700">
                      Video gốc
                    </span>
                  </div>
                </div>
              </div>

              {/* Cards for D0..D6 */}
              {(() => {
                const d0SlotForVideo = currentDemoVideo.slotResults.find(
                  (s) => s.code === 'D0'
                );
                return currentDemoVideo.slotResults.map((slotRes) => {
                  const isVideoBest =
                    currentDemoVideo.perVideoBestCodes.includes(slotRes.code);
                  const liveRgba = synthesizeLiveSlotFrameRgba(
                    slotRes,
                    d0SlotForVideo,
                    safePlaybackFrameIdx,
                    visualViewMode,
                    currentDemoVideo.width,
                    currentDemoVideo.height
                  );
                  const compNow =
                    slotRes.perFrameComponents[safePlaybackFrameIdx] ??
                    slotRes.postMorphologyComponentCount;
                  const fgNow =
                    slotRes.perFrameFgRatio[safePlaybackFrameIdx] ??
                    slotRes.fgAreaRatioPct;
                  const diffNow =
                    slotRes.perFrameDiffPct[safePlaybackFrameIdx] ??
                    slotRes.deltaPixelRatioVsBaselinePct;

                  return (
                    <div
                      key={slotRes.code}
                      onClick={() => setSpotlightRightCode(slotRes.code)}
                      className={`border p-2.5 flex flex-col justify-between cursor-pointer transition-colors ${
                        isVideoBest
                          ? 'bg-emerald-50/40 border-emerald-500'
                          : 'bg-white border-slate-200 hover:border-blue-400'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 font-mono text-xs font-bold">
                            {slotRes.code}
                          </span>
                          {isVideoBest && (
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                currentDemoVideo.isPerVideoTie
                                  ? 'bg-amber-100 border border-amber-400 text-amber-950'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {currentDemoVideo.isPerVideoTie
                                ? `★ TIE (${slotRes.criterionWinsOnVideo}/3)`
                                : `★ BEST (${slotRes.criterionWinsOnVideo}/3)`}
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-bold text-slate-900 line-clamp-1">
                          {slotRes.label}
                        </div>

                        <FrameCanvas
                          rgba={liveRgba}
                          width={currentDemoVideo.width}
                          height={currentDemoVideo.height}
                          title={slotRes.code}
                          subtitle={`Frame #${safePlaybackFrameIdx + 1}: ${Number(compNow).toFixed(0)} vùng sạch`}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-slate-200 text-[11px] font-mono text-center">
                        <div className="bg-slate-50 border border-slate-200 py-1">
                          <span className="text-slate-500 block text-[10px]">
                            CC After (#{safePlaybackFrameIdx + 1})
                          </span>
                          <span className="font-bold text-slate-900">
                            {Number(compNow).toFixed(0)} vùng
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 py-1">
                          <span className="text-slate-500 block text-[10px]">
                            FG Area
                          </span>
                          <span className="font-bold text-slate-900">
                            {Number(fgNow).toFixed(2)}%
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 py-1">
                          <span className="text-slate-500 block text-[10px]">
                            XOR vs D0
                          </span>
                          <span className="font-bold text-slate-900">
                            {slotRes.code === 'D0'
                              ? '0.00%'
                              : `${Number(diffNow).toFixed(2)}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
