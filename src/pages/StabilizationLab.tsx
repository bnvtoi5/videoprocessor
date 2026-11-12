import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  RefreshCw,
  AlertTriangle,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DecodedVideoSession } from '../types/video';
import {
  StabilizationParams,
  StabilizationRunResult,
} from '../types/algorithm';
import { executeStabilizationTask } from '../core/workerBridge';
import { exportRgbaFramesToVideoFile } from '../core/videoEncoder';
import { FrameCanvas } from '../components/video/FrameCanvas';
import { TrajectoryCharts } from '../components/charts/TrajectoryCharts';
import { MetricCard } from '../components/common/MetricCard';

export interface StabilizationLabProps {
  session: DecodedVideoSession;
  params: StabilizationParams;
  onChangeParams: (params: StabilizationParams) => void;
  lkResult: StabilizationRunResult | null;
  eccResult: StabilizationRunResult | null;
  onUpdateResults: (
    lk: StabilizationRunResult,
    ecc: StabilizationRunResult
  ) => void;
}

export const StabilizationLab: React.FC<StabilizationLabProps> = ({
  session,
  params,
  onChangeParams,
  lkResult,
  eccResult,
  onUpdateResults,
}) => {
  const [frameIdx, setFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const [exportingTag, setExportingTag] = useState<string | null>(null);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // Motion tracking overlay visibility toggles
  const [showInliers, setShowInliers] = useState(true);
  const [showOutliers, setShowOutliers] = useState(true);
  const [showMotionVectors, setShowMotionVectors] = useState(true);

  const totalFrames = session.frames.length;
  const safeFrameIdx = Math.min(Math.max(0, frameIdx), Math.max(0, totalFrames - 1));

  // Auto-run stabilization when entering lab or when user uploads a new video
  useEffect(() => {
    if (!lkResult && !eccResult && totalFrames > 0 && !isRunning) {
      handleRunStabilizationComparison();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

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

  const handleRunStabilizationComparison = async () => {
    if (totalFrames === 0 || isRunning) return;
    setIsRunning(true);
    setStatusLabel('Đang chạy thuật toán A1: LK Optical Flow + RANSAC...');
    try {
      const lk = await executeStabilizationTask(
        session.frames,
        'lk_ransac',
        params,
        (pct, lbl) => setStatusLabel(`${lbl} (${pct}%)`)
      );
      setStatusLabel('Đang chạy thuật toán A2: ECC Stabilization...');
      const ecc = await executeStabilizationTask(
        session.frames,
        'ecc',
        params,
        (pct, lbl) => setStatusLabel(`${lbl} (${pct}%)`)
      );
      onUpdateResults(lk, ecc);
      setStatusLabel('Đã hoàn tất chống rung video!');
      setIsPlaying(true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportVideo = async (method: 'lk_ransac' | 'ecc') => {
    const target = method === 'lk_ransac' ? lkResult : eccResult;
    if (!target || target.stabilizedFrames.length === 0) return;

    try {
      setExportingTag(method);
      await exportRgbaFramesToVideoFile(
        target.stabilizedFrames,
        session.metadata.processingWidth,
        session.metadata.processingHeight,
        session.metadata.samplingFps,
        session.metadata.fileName,
        method === 'lk_ransac' ? 'LK-RANSAC' : 'ECC',
        'stabilized'
      );
    } finally {
      setExportingTag(null);
    }
  };

  const origFrame = session.frames[safeFrameIdx]?.rgba;
  const lkFrame = lkResult?.stabilizedFrames[safeFrameIdx] ?? origFrame;
  const eccFrame = eccResult?.stabilizedFrames[safeFrameIdx] ?? origFrame;
  const trackedPts = lkResult?.trackedFeaturesPerFrame[safeFrameIdx] ?? [];
  const currLkTransform = lkResult?.transforms[safeFrameIdx];
  const currEccTransform = eccResult?.transforms[safeFrameIdx];

  const jitterReductionPercent =
    lkResult && lkResult.rawTranslationJitterRms > 1e-5
      ? ((lkResult.rawTranslationJitterRms -
          lkResult.stabilizedTranslationJitterRms) /
          lkResult.rawTranslationJitterRms) *
        100
      : 0;

  return (
    <div className="space-y-5">
      {/* Top Clear Result Header & Action Buttons */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-blue-700 font-bold">
            KẾT QUẢ 1 · MODULE A: VIDEO STABILIZATION LAB
          </div>
          <h1 className="text-base font-bold text-slate-900 mt-0.5">
            Kết Quả Chống Rung Video ({session.metadata.fileName})
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Ba màn hình bên dưới đang phát song song: (1) Video gốc bị rung, (2) Video đã chống rung bằng LK + RANSAC, và (3) Video đã chống rung bằng ECC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunStabilizationComparison}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>
              {isRunning ? statusLabel || 'Đang xử lý...' : 'Chạy Lại Chống Rung'}
            </span>
          </button>

          <button
            type="button"
            disabled={!lkResult || exportingTag !== null}
            onClick={() => handleExportVideo('lk_ransac')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {exportingTag === 'lk_ransac'
                ? 'Đang xuất file...'
                : 'Tải Video Chống Rung (LK+RANSAC)'}
            </span>
          </button>

          <button
            type="button"
            disabled={!eccResult || exportingTag !== null}
            onClick={() => handleExportVideo('ecc')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {exportingTag === 'ecc' ? 'Đang xuất...' : 'Tải Video ECC'}
            </span>
          </button>
        </div>
      </div>

      {/* Processing Progress Banner if currently running */}
      {isRunning && (
        <div className="bg-cyan-950/60 border border-cyan-500/50 p-4 flex items-center gap-3 text-sm text-cyan-200">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
          <span className="font-medium">
            {statusLabel || 'Đang chạy thuật toán chống rung trên từng khung hình...'}
          </span>
        </div>
      )}

      {/* Main Full-Width Video Comparison Stage (Front and Center!) */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
        {/* Prominent Playback Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Tạm dừng (Pause)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Phát đồng bộ 3 Video (Play)</span>
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
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
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
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex items-center gap-3 min-w-[200px]">
            <input
              type="range"
              aria-label="Stabilization timeline frame slider"
              min={0}
              max={Math.max(0, totalFrames - 1)}
              value={safeFrameIdx}
              onChange={(e) => {
                setIsPlaying(false);
                setFrameIdx(Number(e.target.value));
              }}
              className="flex-1 accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-200 tabular-nums whitespace-nowrap">
              Khung hình {safeFrameIdx + 1} / {totalFrames}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedParams((prev) => !prev)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tùy chỉnh tham số nâng cao</span>
            {showAdvancedParams ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* 3 Synchronized Video Canvases */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FrameCanvas
            rgba={origFrame}
            width={session.metadata.processingWidth}
            height={session.metadata.processingHeight}
            title="1. VIDEO GỐC (Chưa chống rung)"
            subtitle={
              currLkTransform
                ? `Theo dõi ${currLkTransform.inliersCount}/${currLkTransform.totalFeatures} điểm chuẩn`
                : 'Baseline'
            }
            trackedFeatures={trackedPts}
            showInliers={showInliers}
            showOutliers={showOutliers}
            showMotionVectors={showMotionVectors}
            testId="stab-original-canvas"
          />
          <FrameCanvas
            rgba={lkFrame}
            width={session.metadata.processingWidth}
            height={session.metadata.processingHeight}
            title="2. KẾT QUẢ: Chống rung LK + RANSAC"
            subtitle={
              currLkTransform
                ? `Bù lệch dx:${currLkTransform.dx.toFixed(1)}px dy:${currLkTransform.dy.toFixed(1)}px`
                : 'Đã làm mượt'
            }
            testId="stab-lk-canvas"
          />
          <FrameCanvas
            rgba={eccFrame}
            width={session.metadata.processingWidth}
            height={session.metadata.processingHeight}
            title="3. KẾT QUẢ: Chống rung ECC"
            subtitle={
              currEccTransform
                ? currEccTransform.eccConverged
                  ? `Hội tụ ECC: ${currEccTransform.eccScore.toFixed(2)}`
                  : 'Fallback: Identity'
                : 'Đã làm mượt'
            }
            testId="stab-ecc-canvas"
          />
        </div>

        {/* Collapsible Advanced Parameters Drawer */}
        {showAdvancedParams && (
          <div className="bg-slate-50 border border-slate-200 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="text-xs font-bold text-blue-700">
                Bảng Điều Chỉnh Tham Số Thuật Toán Chống Rung (Nhấn "Chạy Lại Chống Rung" sau khi chỉnh)
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInliers}
                    onChange={(e) => setShowInliers(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>Hiện điểm Inliers (Xanh lá)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOutliers}
                    onChange={(e) => setShowOutliers(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span>Hiện điểm nhiễu Outliers (Cam)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMotionVectors}
                    onChange={(e) => setShowMotionVectors(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Hiện vector chuyển động</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Số điểm đặc trưng tối đa (Max Corners)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {params.maxCorners}
                  </span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={400}
                  step={20}
                  value={params.maxCorners}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      maxCorners: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Ngưỡng chất lượng góc (Quality Level)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {params.qualityLevel.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.005}
                  max={0.1}
                  step={0.005}
                  value={params.qualityLevel}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      qualityLevel: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Khoảng cách tối thiểu (Min Distance)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {params.minDistance} px
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={24}
                  step={2}
                  value={params.minDistance}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      minDistance: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Ngưỡng lọc nhiễu RANSAC</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {params.ransacThreshold.toFixed(1)} px
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={8.0}
                  step={0.5}
                  value={params.ransacThreshold}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      ransacThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Bán kính làm mượt quỹ đạo (Smoothing R)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    R = {params.smoothingRadius}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={25}
                  step={1}
                  value={params.smoothingRadius}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      smoothingRadius: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Tỷ lệ cắt viền đen (Crop Ratio)</span>
                  <span className="font-mono text-cyan-400 tabular-nums">
                    {(params.cropRatio * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.15}
                  step={0.01}
                  value={params.cropRatio}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      cropRatio: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Số vòng lặp tối đa ECC</span>
                  <span className="font-mono text-emerald-400 tabular-nums">
                    {params.eccIterations}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={params.eccIterations}
                  onChange={(e) =>
                    onChangeParams({
                      ...params,
                      eccIterations: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="flex flex-col justify-between">
                <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                  <span>Làm mượt góc xoay (Roll Smoothing)</span>
                  <input
                    type="checkbox"
                    checked={params.smoothRotation}
                    onChange={(e) =>
                      onChangeParams({
                        ...params,
                        smoothRotation: e.target.checked,
                      })
                    }
                    className="accent-cyan-500"
                  />
                </label>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-slate-400">ECC Epsilon:</span>
                  <select
                    value={params.eccEps}
                    onChange={(e) =>
                      onChangeParams({
                        ...params,
                        eccEps: Number(e.target.value),
                      })
                    }
                    className="bg-white border border-slate-300 px-2 py-1 text-xs font-mono text-slate-800"
                  >
                    <option value={0.01}>1e-2 (Nhanh)</option>
                    <option value={0.001}>1e-3 (Chuẩn)</option>
                    <option value={0.0001}>1e-4 (Chính xác)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ECC Non-convergence Notice if any frames fell back to identity */}
        {eccResult && eccResult.eccFailedFrames.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-800 px-3.5 py-2.5 text-xs text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Thuật toán ECC không hội tụ tại {eccResult.eccFailedFrames.length} khung hình và đã tự động dùng ma trận đơn vị (Identity fallback) để đảm bảo video không bị lỗi.
            </span>
          </div>
        )}
      </div>

      {/* Result Metrics Grid */}
      {lkResult && eccResult && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Độ Rung Sau Xử Lý (Jitter RMS - LK)"
            value={lkResult.stabilizedTranslationJitterRms.toFixed(3)}
            unit="px"
            deltaText={`Trước khi chống rung: ${lkResult.rawTranslationJitterRms.toFixed(3)} px (Giảm ${Math.abs(jitterReductionPercent).toFixed(1)}% độ rung)`}
            deltaTone="positive"
            description="Sai phân bậc hai RMS của quỹ đạo camera (càng nhỏ nghĩa là video càng mượt)."
          />
          <MetricCard
            label="Độ Rung Góc Xoay (Rotation RMS)"
            value={lkResult.stabilizedRotationJitterRms.toFixed(4)}
            unit="deg"
            deltaText={`Gốc: ${lkResult.rawRotationJitterRms.toFixed(4)} deg`}
            deltaTone="positive"
            description="Độ rung lắc góc nghiêng của camera trước và sau khi làm mượt."
          />
          <MetricCard
            label="Điểm Đặc Trưng Hợp Lệ (RANSAC Inliers)"
            value={`${lkResult.meanInlierCount.toFixed(1)} (${lkResult.meanInlierRatio.toFixed(1)}%)`}
            deltaText="Similarity Transform (dx, dy, dθ, s)"
            deltaTone="neutral"
            description="Số lượng và tỷ lệ điểm đặc trưng nền tĩnh được RANSAC giữ lại để ước lượng chuyển động camera."
          />
          <MetricCard
            label="Tỷ Lệ Hội Tụ ECC"
            value={eccResult.eccConvergenceRate.toFixed(1)}
            unit="%"
            deltaText={`Jitter ECC: ${eccResult.stabilizedTranslationJitterRms.toFixed(3)} px`}
            deltaTone={eccResult.eccConvergenceRate >= 95 ? 'positive' : 'warning'}
            description="Tỷ lệ khung hình mà thuật toán ECC hội tụ thành công."
          />
          <MetricCard
            label="Tốc Độ Xử Lý & Vùng Hiển Thị"
            value={`${lkResult.fps.toFixed(1)} / ${eccResult.fps.toFixed(1)}`}
            unit="FPS"
            deltaText={`Vùng ảnh hợp lệ: ${lkResult.meanValidAreaPercent.toFixed(1)}%`}
            deltaTone="neutral"
            description="Tốc độ xử lý trung bình (FPS) của LK+RANSAC so với ECC."
          />
        </div>
      )}

      {/* Trajectory Analysis Charts */}
      {lkResult && (
        <TrajectoryCharts
          lkTrajectories={lkResult.trajectories}
          eccTrajectories={eccResult?.trajectories}
        />
      )}
    </div>
  );
};
