import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  RefreshCw,
  Sliders,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DecodedVideoSession } from '../types/video';
import {
  BackgroundMethodId,
  BackgroundRunResult,
  ForegroundDisplayConfig,
  FrameDiffParams,
  Mog2Params,
  MorphologyConfig,
  SampleKnnParams,
} from '../types/algorithm';
import { executeBackgroundTask } from '../core/workerBridge';
import { maskToRgba } from '../algorithms/background/foregroundExtraction';
import { exportRgbaFramesToVideoFile } from '../core/videoEncoder';
import { FrameCanvas } from '../components/video/FrameCanvas';
import { MetricCard } from '../components/common/MetricCard';

export interface BackgroundLabProps {
  session: DecodedVideoSession;
  selectedMethod: BackgroundMethodId;
  onSelectMethod: (m: BackgroundMethodId) => void;
  frameDiffParams: FrameDiffParams;
  onChangeFrameDiffParams: (p: FrameDiffParams) => void;
  mog2Params: Mog2Params;
  onChangeMog2Params: (p: Mog2Params) => void;
  sampleKnnParams: SampleKnnParams;
  onChangeSampleKnnParams: (p: SampleKnnParams) => void;
  enableMorphology: boolean;
  onChangeEnableMorphology: (v: boolean) => void;
  morphologyConfig: MorphologyConfig;
  onChangeMorphologyConfig: (c: MorphologyConfig) => void;
  displayConfig: ForegroundDisplayConfig;
  onChangeDisplayConfig: (d: ForegroundDisplayConfig) => void;
  resultsByMethod: Record<BackgroundMethodId, BackgroundRunResult | null>;
  onUpdateMethodResult: (
    method: BackgroundMethodId,
    result: BackgroundRunResult
  ) => void;
}

export const BackgroundLab: React.FC<BackgroundLabProps> = ({
  session,
  selectedMethod,
  onSelectMethod,
  frameDiffParams,
  onChangeFrameDiffParams,
  mog2Params,
  onChangeMog2Params,
  sampleKnnParams,
  onChangeSampleKnnParams,
  enableMorphology,
  onChangeEnableMorphology,
  morphologyConfig,
  onChangeMorphologyConfig,
  displayConfig,
  onChangeDisplayConfig,
  resultsByMethod,
  onUpdateMethodResult,
}) => {
  const [frameIdx, setFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [showRawVsCleaned, setShowRawVsCleaned] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const totalFrames = session.frames.length;
  const safeIdx = Math.min(Math.max(0, frameIdx), Math.max(0, totalFrames - 1));

  const activeResult = resultsByMethod[selectedMethod];

  // Automatically execute active method when entering lab or changing session/method
  useEffect(() => {
    if (!activeResult && totalFrames > 0 && !isRunning) {
      handleRunCurrentMethod(selectedMethod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, selectedMethod]);

  useEffect(() => {
    if (!isPlaying || isRunning) return;
    const intervalMs = Math.max(
      40,
      Math.round(1000 / Math.max(5, session.metadata.samplingFps))
    );
    const timer = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % Math.max(1, totalFrames));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlaying, isRunning, totalFrames, session.metadata.samplingFps]);

  const handleRunCurrentMethod = async (
    methodToRun: BackgroundMethodId = selectedMethod
  ) => {
    if (totalFrames === 0 || isRunning) return;
    setIsRunning(true);
    setStatusLabel(`Đang tách nền bằng thuật toán ${methodToRun.toUpperCase()}...`);
    try {
      const res = await executeBackgroundTask(
        session,
        methodToRun,
        frameDiffParams,
        mog2Params,
        sampleKnnParams,
        enableMorphology,
        morphologyConfig,
        displayConfig,
        (pct, lbl) => setStatusLabel(`${lbl} (${pct}%)`)
      );
      onUpdateMethodResult(methodToRun, res);
      setIsPlaying(true);
    } finally {
      setIsRunning(false);
      setStatusLabel('');
    }
  };

  const handleRunAllThreeAlgorithms = async () => {
    if (totalFrames === 0 || isRunning) return;
    setIsRunning(true);
    try {
      const methods: BackgroundMethodId[] = [
        'frame_diff',
        'mog2',
        'sample_knn',
      ];
      for (const m of methods) {
        setStatusLabel(`Đang chạy so sánh thuật toán ${m.toUpperCase()}...`);
        const res = await executeBackgroundTask(
          session,
          m,
          frameDiffParams,
          mog2Params,
          sampleKnnParams,
          enableMorphology,
          morphologyConfig,
          displayConfig
        );
        onUpdateMethodResult(m, res);
      }
      setIsPlaying(true);
    } finally {
      setIsRunning(false);
      setStatusLabel('');
    }
  };

  const handleExportViewVideo = async (
    viewKey: 'mask' | 'foreground' | 'background' | 'overlay'
  ) => {
    if (!activeResult) return;
    const w = session.metadata.processingWidth;
    const h = session.metadata.processingHeight;

    let framesToEncode: Uint8ClampedArray[] = [];
    if (viewKey === 'mask') {
      framesToEncode = activeResult.cleanedMasks.map((m) =>
        maskToRgba(m, w, h)
      );
    } else if (viewKey === 'foreground') {
      framesToEncode = activeResult.foregroundOnlyFrames;
    } else if (viewKey === 'background') {
      framesToEncode = activeResult.backgroundOnlyFrames;
    } else {
      framesToEncode = activeResult.overlayFrames;
    }

    try {
      setExportingType(viewKey);
      const algTag =
        selectedMethod === 'frame_diff'
          ? 'FrameDiff'
          : selectedMethod === 'mog2'
          ? 'MOG2'
          : 'SampleKNN';
      await exportRgbaFramesToVideoFile(
        framesToEncode,
        w,
        h,
        session.metadata.samplingFps,
        session.metadata.fileName,
        algTag,
        viewKey
      );
    } finally {
      setExportingType(null);
    }
  };

  const w = session.metadata.processingWidth;
  const h = session.metadata.processingHeight;
  const origRgba = session.frames[safeIdx]?.rgba;

  const rawMaskRgba = activeResult?.binaryMasks[safeIdx]
    ? maskToRgba(activeResult.binaryMasks[safeIdx], w, h)
    : undefined;
  const cleanedMaskRgba = activeResult?.cleanedMasks[safeIdx]
    ? maskToRgba(activeResult.cleanedMasks[safeIdx], w, h)
    : undefined;

  const overlayRgba = activeResult?.overlayFrames[safeIdx];
  const fgOnlyRgba = activeResult?.foregroundOnlyFrames[safeIdx];
  const bgOnlyRgba = activeResult?.backgroundOnlyFrames[safeIdx];
  const currentBoxes = activeResult?.boundingBoxesPerFrame[safeIdx] ?? [];
  const currentMetrics = activeResult?.frameMetrics[safeIdx];

  const fmtMetric = (v: number | null | undefined) =>
    v === null || v === undefined
      ? 'N/A (Video tự tải không có Ground Truth)'
      : `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-5">
      {/* Top Clear Header & Export Buttons */}
      <div className="bg-[#111827] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
            KẾT QUẢ 2 · MODULE B: BACKGROUND & FOREGROUND SEPARATION LAB
          </div>
          <h1 className="text-base font-bold text-slate-100 mt-0.5">
            Kết Quả Tách Lọc Nền & Vật Thể Chuyển Động ({session.metadata.fileName})
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Xem đồng thời 5 màn hình kết quả: Video gốc, Mặt nạ nhị phân (Mask), Tô màu vật thể (Overlay), Chỉ giữ Vật thể (Foreground), và Chỉ giữ Nền tĩnh (Background).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => handleRunCurrentMethod(selectedMethod)}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>
              {isRunning ? statusLabel || 'Đang xử lý...' : 'Chạy Lại Thuật Toán'}
            </span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunAllThreeAlgorithms}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Chạy So Sánh Cả 3 Thuật Toán</span>
          </button>

          <button
            type="button"
            disabled={!activeResult || exportingType !== null}
            onClick={() => handleExportViewVideo('foreground')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {exportingType === 'foreground' ? 'Đang xuất...' : 'Tải Video Vật Thể (FG)'}
            </span>
          </button>

          <button
            type="button"
            disabled={!activeResult || exportingType !== null}
            onClick={() => handleExportViewVideo('background')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {exportingType === 'background' ? 'Đang xuất...' : 'Tải Video Nền (BG)'}
            </span>
          </button>

          <button
            type="button"
            disabled={!activeResult || exportingType !== null}
            onClick={() => handleExportViewVideo('mask')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {exportingType === 'mask' ? 'Đang xuất...' : 'Tải Video Mask'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Video Results Workspace */}
      <div className="bg-[#111827] border border-slate-800 p-4 space-y-4">
        {/* Algorithm Selector Tabs + Playback Transport Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0B0E17] border border-slate-800 p-3">
          {/* 3-Algorithm Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400 mr-1">
              Chọn thuật toán tách nền:
            </span>
            <button
              type="button"
              onClick={() => onSelectMethod('frame_diff')}
              className={`py-1.5 px-3 text-xs font-semibold transition-colors cursor-pointer ${
                selectedMethod === 'frame_diff'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              B1. Frame Diff (Trừ ảnh)
            </button>
            <button
              type="button"
              onClick={() => onSelectMethod('mog2')}
              className={`py-1.5 px-3 text-xs font-semibold transition-colors cursor-pointer ${
                selectedMethod === 'mog2'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              B2. MOG2 (Khuyên dùng)
            </button>
            <button
              type="button"
              onClick={() => onSelectMethod('sample_knn')}
              className={`py-1.5 px-3 text-xs font-semibold transition-colors cursor-pointer ${
                selectedMethod === 'sample_knn'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              B3. Sample KNN
            </button>
          </div>

          {/* Playback Controls */}
          <div className="flex flex-wrap items-center gap-3 flex-1 justify-end min-w-[260px]">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Phát đồng bộ (Play)</span>
                </>
              )}
            </button>
            <button
              type="button"
              aria-label="Previous frame"
              onClick={() => {
                setIsPlaying(false);
                setFrameIdx((p) => Math.max(0, p - 1));
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next frame"
              onClick={() => {
                setIsPlaying(false);
                setFrameIdx((p) => Math.min(totalFrames - 1, p + 1));
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              aria-label="Background lab timeline slider"
              min={0}
              max={Math.max(0, totalFrames - 1)}
              value={safeIdx}
              onChange={(e) => {
                setIsPlaying(false);
                setFrameIdx(Number(e.target.value));
              }}
              className="w-32 sm:w-44 accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-200 tabular-nums whitespace-nowrap">
              Frame {safeIdx + 1}/{totalFrames}
            </span>

            <button
              type="button"
              onClick={() => setShowAdvancedParams((prev) => !prev)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tùy chỉnh tham số & Lọc nhiễu</span>
              {showAdvancedParams ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 5 Simultaneous Views Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FrameCanvas
            rgba={origRgba}
            width={w}
            height={h}
            title="1. VIDEO GỐC + KHUNG ĐỐI TƯỢNG"
            subtitle={`Phát hiện ${currentBoxes.length} vật thể chuyển động`}
            boundingBoxes={currentBoxes}
            showBoundingBoxes={displayConfig.showBoundingBoxes}
            testId="bg-original-canvas"
          />
          <FrameCanvas
            rgba={showRawVsCleaned ? rawMaskRgba : cleanedMaskRgba}
            width={w}
            height={h}
            title={
              showRawVsCleaned
                ? '2a. MẶT NẠ NHỊ PHÂN THÔ (Raw Mask)'
                : '2. MẶT NẠ NHỊ PHÂN (Binary FG Mask)'
            }
            subtitle={
              currentMetrics
                ? `Tỷ lệ vật thể: ${(currentMetrics.foregroundRatio * 100).toFixed(1)}%`
                : 'Trắng = Vật thể, Đen = Nền'
            }
            testId="bg-mask-canvas"
          />
          <FrameCanvas
            rgba={overlayRgba}
            width={w}
            height={h}
            title="3. TÔ MÀU VẬT THỂ (Foreground Overlay)"
            subtitle={`${currentBoxes.length} vật thể`}
            testId="bg-overlay-canvas"
          />
          <FrameCanvas
            rgba={fgOnlyRgba}
            width={w}
            height={h}
            title="4. KẾT QUẢ TÁCH VẬT THỂ (Foreground Only)"
            subtitle="Đã xóa nền tĩnh"
            testId="bg-fg-only-canvas"
          />
          <FrameCanvas
            rgba={bgOnlyRgba}
            width={w}
            height={h}
            title="5. KẾT QUẢ NỀN TĨNH (Background Only)"
            subtitle="Mô hình nền tái tạo"
            testId="bg-bg-only-canvas"
          />
          {showRawVsCleaned ? (
            <FrameCanvas
              rgba={cleanedMaskRgba}
              width={w}
              height={h}
              title="2b. MẶT NẠ ĐÃ LỌC NHIỄU (Cleaned Mask)"
              subtitle="Sau khi lọc Morphology"
            />
          ) : (
            <div className="bg-[#0B0E17] border border-slate-800 p-4 flex flex-col justify-between text-xs">
              <div>
                <div className="font-semibold text-emerald-400 border-b border-slate-800 pb-2">
                  Thông Số Khung Hình Hiện Tại (#{safeIdx + 1})
                </div>
                <div className="mt-2.5 space-y-1.5 font-mono text-xs text-slate-300 tabular-nums">
                  <div>Thuật toán: {activeResult?.engineUsed ?? 'Đang khởi tạo'}</div>
                  <div>
                    Số vùng chuyển động: {currentBoxes.length} (Diện tích ≥{' '}
                    {morphologyConfig.minComponentArea}px²)
                  </div>
                  <div>
                    Tỷ lệ diện tích vật thể:{' '}
                    {((currentMetrics?.foregroundRatio ?? 0) * 100).toFixed(2)}%
                  </div>
                  <div>
                    Độ nhấp nháy mặt nạ (Flicker):{' '}
                    {((currentMetrics?.flickerRatio ?? 0) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-cyan-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRawVsCleaned}
                    onChange={(e) => setShowRawVsCleaned(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>So sánh Mask trước & sau lọc nhiễu</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Advanced Algorithm & Morphology Controls */}
        {showAdvancedParams && (
          <div className="bg-[#0B0E17] border border-slate-800 p-4 grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
            {/* Column 1: Active Algorithm Parameters */}
            <div className="space-y-3">
              <div className="font-semibold text-cyan-400 border-b border-slate-800 pb-1.5">
                1. Tham Số Thuật Toán ({selectedMethod.toUpperCase()})
              </div>

              {selectedMethod === 'frame_diff' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Chế độ ảnh nền tham chiếu (Reference Mode)
                    </label>
                    <select
                      value={frameDiffParams.referenceMode}
                      onChange={(e) =>
                        onChangeFrameDiffParams({
                          ...frameDiffParams,
                          referenceMode: e.target
                            .value as FrameDiffParams['referenceMode'],
                        })
                      }
                      className="w-full bg-[#111827] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
                    >
                      <option value="first_frame">Khung hình đầu tiên (I_0)</option>
                      <option value="median_first_n">
                        Trung vị N khung hình đầu (Median)
                      </option>
                      <option value="adaptive_running">
                        Trung bình trượt thích nghi ((1-α)B + αI_t)
                      </option>
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Ngưỡng sai biệt độ sáng (Threshold)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {frameDiffParams.threshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={1}
                      value={frameDiffParams.threshold}
                      onChange={(e) =>
                        onChangeFrameDiffParams({
                          ...frameDiffParams,
                          threshold: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              )}

              {selectedMethod === 'mog2' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Số khung hình lịch sử (History)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {mog2Params.history}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={250}
                      step={10}
                      value={mog2Params.history}
                      onChange={(e) =>
                        onChangeMog2Params({
                          ...mog2Params,
                          history: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Ngưỡng phương sai (Variance Threshold)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {mog2Params.varThreshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={64}
                      step={2}
                      value={mog2Params.varThreshold}
                      onChange={(e) =>
                        onChangeMog2Params({
                          ...mog2Params,
                          varThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Tốc độ học nền (Learning Rate α)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {mog2Params.learningRate.toFixed(3)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.005}
                      max={0.15}
                      step={0.005}
                      value={mog2Params.learningRate}
                      onChange={(e) =>
                        onChangeMog2Params({
                          ...mog2Params,
                          learningRate: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                  <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                    <span>Phát hiện và loại bỏ bóng đổ (Detect Shadows)</span>
                    <input
                      type="checkbox"
                      checked={mog2Params.detectShadows}
                      onChange={(e) =>
                        onChangeMog2Params({
                          ...mog2Params,
                          detectShadows: e.target.checked,
                        })
                      }
                      className="accent-cyan-500"
                    />
                  </label>
                </div>
              )}

              {selectedMethod === 'sample_knn' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Số mẫu lịch sử (N Samples)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {sampleKnnParams.numSamples}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={28}
                      step={2}
                      value={sampleKnnParams.numSamples}
                      onChange={(e) =>
                        onChangeSampleKnnParams({
                          ...sampleKnnParams,
                          numSamples: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Số láng giềng gần nhất (K Neighbors)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        K = {sampleKnnParams.kNeighbors}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={sampleKnnParams.kNeighbors}
                      onChange={(e) =>
                        onChangeSampleKnnParams({
                          ...sampleKnnParams,
                          kNeighbors: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-300 mb-1">
                      <span>Ngưỡng khoảng cách màu (Distance R)</span>
                      <span className="font-mono text-cyan-400 tabular-nums">
                        {sampleKnnParams.distanceThreshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={65}
                      step={2}
                      value={sampleKnnParams.distanceThreshold}
                      onChange={(e) =>
                        onChangeSampleKnnParams({
                          ...sampleKnnParams,
                          distanceThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Morphological Filtering */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-semibold text-cyan-400">
                  2. Chuỗi Lọc Nhiễu Hình Thái Học (Morphology)
                </span>
                <input
                  type="checkbox"
                  checked={enableMorphology}
                  onChange={(e) => onChangeEnableMorphology(e.target.checked)}
                  className="accent-cyan-500"
                />
              </div>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Làm mờ Gaussian 3×3 (Khử nhiễu hạt)</span>
                <input
                  type="checkbox"
                  disabled={!enableMorphology}
                  checked={morphologyConfig.enableGaussianBlur}
                  onChange={(e) =>
                    onChangeMorphologyConfig({
                      ...morphologyConfig,
                      enableGaussianBlur: e.target.checked,
                    })
                  }
                  className="accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Phép Mở (Morphological Opening - Xóa đốm trắng)</span>
                <input
                  type="checkbox"
                  disabled={!enableMorphology}
                  checked={morphologyConfig.enableOpening}
                  onChange={(e) =>
                    onChangeMorphologyConfig({
                      ...morphologyConfig,
                      enableOpening: e.target.checked,
                    })
                  }
                  className="accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Phép Đóng (Morphological Closing - Lấp lỗ rỗng)</span>
                <input
                  type="checkbox"
                  disabled={!enableMorphology}
                  checked={morphologyConfig.enableClosing}
                  onChange={(e) =>
                    onChangeMorphologyConfig({
                      ...morphologyConfig,
                      enableClosing: e.target.checked,
                    })
                  }
                  className="accent-cyan-500"
                />
              </label>

              <div className="pt-1">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Lọc bỏ vùng nhiễu nhỏ hơn (Min Area)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {morphologyConfig.minComponentArea} px²
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={250}
                  step={5}
                  value={morphologyConfig.minComponentArea}
                  onChange={(e) =>
                    onChangeMorphologyConfig({
                      ...morphologyConfig,
                      minComponentArea: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Column 3: Display & Bounding Box Settings */}
            <div className="space-y-2.5">
              <div className="font-semibold text-cyan-400 border-b border-slate-800 pb-1.5">
                3. Tùy Chỉnh Hiển Thị Vật Thể
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Độ đậm lớp tô màu (Overlay Opacity)</span>
                  <span className="font-mono text-emerald-400 tabular-nums">
                    {Math.round(displayConfig.overlayOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={0.95}
                  step={0.05}
                  value={displayConfig.overlayOpacity}
                  onChange={(e) =>
                    onChangeDisplayConfig({
                      ...displayConfig,
                      overlayOpacity: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Vẽ đường viền vật thể (Contours)</span>
                <input
                  type="checkbox"
                  checked={displayConfig.showContours}
                  onChange={(e) =>
                    onChangeDisplayConfig({
                      ...displayConfig,
                      showContours: e.target.checked,
                    })
                  }
                  className="accent-cyan-500"
                />
              </label>

              <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                <span>Vẽ khung chữ nhật bao quanh vật thể (Bounding Box)</span>
                <input
                  type="checkbox"
                  checked={displayConfig.showBoundingBoxes}
                  onChange={(e) =>
                    onChangeDisplayConfig({
                      ...displayConfig,
                      showBoundingBoxes: e.target.checked,
                    })
                  }
                  className="accent-amber-500"
                />
              </label>
            </div>
          </div>
        )}

        {/* 3-Algorithm Side-by-Side Mask Comparison Strip */}
        {(resultsByMethod.frame_diff ||
          resultsByMethod.mog2 ||
          resultsByMethod.sample_knn) && (
          <div className="bg-[#0B0E17] border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">
                So Sánh Mặt Nạ Nhị Phân Giữa 3 Thuật Toán Tại Khung Hình #{safeIdx + 1}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Nhấn nút "Chạy So Sánh Cả 3 Thuật Toán" ở góc trên để cập nhật đủ 3 khung hình
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['frame_diff', 'mog2', 'sample_knn'] as BackgroundMethodId[]).map(
                (mId) => {
                  const r = resultsByMethod[mId];
                  const mRgba = r?.cleanedMasks[safeIdx]
                    ? maskToRgba(r.cleanedMasks[safeIdx], w, h)
                    : undefined;
                  const titleMap: Record<BackgroundMethodId, string> = {
                    frame_diff: 'B1. Frame Differencing (Trừ ảnh)',
                    mog2: 'B2. MOG2 (Hỗn hợp Gaussian)',
                    sample_knn: 'B3. Sample-based KNN',
                  };
                  return (
                    <FrameCanvas
                      key={mId}
                      rgba={mRgba}
                      width={w}
                      height={h}
                      title={titleMap[mId]}
                      subtitle={
                        r
                          ? r.meanIoU !== null
                            ? `IoU: ${(r.meanIoU * 100).toFixed(1)}% | ${r.fps.toFixed(0)} FPS`
                            : `Tốc độ: ${r.fps.toFixed(0)} FPS`
                          : 'Nhấn "Chạy So Sánh Cả 3 Thuật Toán"'
                      }
                    />
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quantitative Segmentation Metrics Cards */}
      {activeResult && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Độ Chính Xác IoU (So với GT)"
            value={fmtMetric(activeResult.meanIoU)}
            deltaText="IoU = TP / (TP + FP + FN)"
            deltaTone={activeResult.meanIoU !== null ? 'positive' : 'neutral'}
            description="Độ trùng khớp giữa mặt nạ dự đoán và Ground Truth (chỉ có trên video mẫu chuẩn)."
          />
          <MetricCard
            label="Điểm F1-Score"
            value={fmtMetric(activeResult.meanF1)}
            deltaText="F1 = 2·P·R / (P + R)"
            deltaTone={activeResult.meanF1 !== null ? 'positive' : 'neutral'}
            description="Trung bình điều hòa giữa Precision và Recall."
          />
          <MetricCard
            label="Tỷ Lệ Diện Tích Vật Thể"
            value={`${(activeResult.meanForegroundRatio * 100).toFixed(2)}%`}
            deltaText="Trung bình toàn video"
            deltaTone="neutral"
            description="Tỷ lệ phần trăm diện tích khung hình được phân loại là vật thể chuyển động."
          />
          <MetricCard
            label="Độ Nhấp Nháy Mặt Nạ (Mask Flicker)"
            value={`${(activeResult.meanMaskFlicker * 100).toFixed(2)}%`}
            deltaText="Càng thấp càng ổn định"
            deltaTone="neutral"
            description="Mức độ biến động mặt nạ giữa các khung hình liên tiếp."
          />
          <MetricCard
            label="Tốc Độ Xử Lý Tách Nền"
            value={activeResult.fps.toFixed(1)}
            unit="FPS"
            deltaText={`${activeResult.avgProcessingTimeMs.toFixed(2)} ms / frame`}
            deltaTone="positive"
            description="Số khung hình xử lý được mỗi giây trên trình duyệt."
          />
        </div>
      )}
    </div>
  );
};
