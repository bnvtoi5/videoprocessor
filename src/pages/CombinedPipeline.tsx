import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RefreshCw,
  Download,
  AlertTriangle,
  GitMerge,
} from 'lucide-react';
import { DecodedVideoSession } from '../types/video';
import {
  BackgroundMethodId,
  CombinedPipelineComparisonResult,
  CombinedPipelineConfig,
  StabilizationMethodId,
} from '../types/algorithm';
import { executeCombinedPipelineTask } from '../core/workerBridge';
import { maskToRgba } from '../algorithms/background/foregroundExtraction';
import { exportRgbaFramesToVideoFile } from '../core/videoEncoder';
import { FrameCanvas } from '../components/video/FrameCanvas';
import { MetricCard } from '../components/common/MetricCard';

export interface CombinedPipelineProps {
  session: DecodedVideoSession;
  config: CombinedPipelineConfig;
  onChangeConfig: (cfg: CombinedPipelineConfig) => void;
  comparisonResult: CombinedPipelineComparisonResult | null;
  onUpdateResult: (res: CombinedPipelineComparisonResult) => void;
}

export const CombinedPipeline: React.FC<CombinedPipelineProps> = ({
  session,
  config,
  onChangeConfig,
  comparisonResult,
  onUpdateResult,
}) => {
  const [frameIdx, setFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');
  const [exportingFlow, setExportingFlow] = useState<string | null>(null);

  const totalFrames = session.frames.length;
  const safeIdx = Math.min(Math.max(0, frameIdx), Math.max(0, totalFrames - 1));

  useEffect(() => {
    if (!comparisonResult && totalFrames > 0 && !isRunning) {
      handleRunCombinedExperiment();
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

  const handleRunCombinedExperiment = async () => {
    if (totalFrames === 0 || isRunning) return;
    setIsRunning(true);
    setStatusLabel('Đang chạy kết hợp Chống rung + Tách nền (Luồng A vs Luồng B)...');
    try {
      const res = await executeCombinedPipelineTask(
        session,
        config,
        (pct, lbl) => setStatusLabel(`${lbl} (${pct}%)`)
      );
      onUpdateResult(res);
      setIsPlaying(true);
    } finally {
      setIsRunning(false);
      setStatusLabel('');
    }
  };

  const handleExportCombinedOutput = async (flow: 'flowA' | 'flowB') => {
    if (!comparisonResult) return;
    const target =
      flow === 'flowA'
        ? comparisonResult.flowA_OriginalToBg
        : comparisonResult.flowB_StabilizedToBg;
    try {
      setExportingFlow(flow);
      await exportRgbaFramesToVideoFile(
        target.overlayFrames,
        session.metadata.processingWidth,
        session.metadata.processingHeight,
        session.metadata.samplingFps,
        session.metadata.fileName,
        `${config.stabilizationMethod}_${config.backgroundMethod}`,
        flow === 'flowA' ? 'FlowA_Unstabilized_BG' : 'FlowB_Stabilized_BG'
      );
    } finally {
      setExportingFlow(null);
    }
  };

  const w = session.metadata.processingWidth;
  const h = session.metadata.processingHeight;
  const origRgba = session.frames[safeIdx]?.rgba;
  const stabRgba =
    comparisonResult?.stabilizationResult.stabilizedFrames[safeIdx] ?? origRgba;

  const flowAMaskRgba = comparisonResult?.flowA_OriginalToBg.cleanedMasks[safeIdx]
    ? maskToRgba(comparisonResult.flowA_OriginalToBg.cleanedMasks[safeIdx], w, h)
    : undefined;
  const flowBMaskRgba = comparisonResult?.flowB_StabilizedToBg.cleanedMasks[safeIdx]
    ? maskToRgba(comparisonResult.flowB_StabilizedToBg.cleanedMasks[safeIdx], w, h)
    : undefined;

  const flowAOverlay = comparisonResult?.flowA_OriginalToBg.overlayFrames[safeIdx];
  const flowBOverlay = comparisonResult?.flowB_StabilizedToBg.overlayFrames[safeIdx];

  const flowAIoU = comparisonResult?.flowA_OriginalToBg.meanIoU ?? null;
  const flowBIoU = comparisonResult?.flowB_StabilizedToBg.meanIoU ?? null;

  return (
    <div className="space-y-5">
      {/* Top Clear Header */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-700 font-bold">
            KẾT QUẢ 3 · MODULE C: COMBINED SPATIOTEMPORAL PIPELINE
          </div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <GitMerge className="w-4 h-4 text-blue-600" />
            <span>
              Kết Hợp Chống Rung Trước Khi Tách Nền ({session.metadata.fileName})
            </span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            So sánh trực tiếp: (Bên trái) Tách nền ngay trên video gốc bị rung vs (Bên phải) Chống rung camera trước rồi mới tách nền để giảm nhiễu giả.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunCombinedExperiment}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>
              {isRunning ? statusLabel || 'Đang xử lý...' : 'Chạy Lại Luồng Kết Hợp'}
            </span>
          </button>

          <button
            type="button"
            disabled={!comparisonResult || exportingFlow !== null}
            onClick={() => handleExportCombinedOutput('flowB')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {exportingFlow === 'flowB'
                ? 'Đang xuất...'
                : 'Tải Video Kết Quả (Đã Chống Rung + Tách Nền)'}
            </span>
          </button>
        </div>
      </div>

      {/* Controls & Playback Bar */}
      <div className="bg-white border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Bước 1 (Chống rung):</span>
            <select
              value={config.stabilizationMethod}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  stabilizationMethod: e.target.value as StabilizationMethodId,
                })
              }
              className="bg-white border border-slate-300 px-2.5 py-1.5 font-mono text-slate-800"
            >
              <option value="lk_ransac">A1. LK + RANSAC</option>
              <option value="ecc">A2. ECC Stabilization</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Bước 2 (Tách nền):</span>
            <select
              value={config.backgroundMethod}
              onChange={(e) =>
                onChangeConfig({
                  ...config,
                  backgroundMethod: e.target.value as BackgroundMethodId,
                })
              }
              className="bg-white border border-slate-300 px-2.5 py-1.5 font-mono text-slate-800"
            >
              <option value="frame_diff">B1. Frame Differencing</option>
              <option value="mog2">B2. MOG2 (Khuyên dùng)</option>
              <option value="sample_knn">B3. Sample KNN</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
          <input
            type="range"
            aria-label="Combined pipeline frame slider"
            min={0}
            max={Math.max(0, totalFrames - 1)}
            value={safeIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setFrameIdx(Number(e.target.value));
            }}
            className="w-36 accent-cyan-500 cursor-pointer"
          />
          <span className="font-mono text-slate-300 tabular-nums">
            Frame {safeIdx + 1}/{totalFrames}
          </span>
        </div>
      </div>

      {/* Strong Camera Motion Warning Banner */}
      {comparisonResult?.highCameraMotionWarning && (
        <div className="bg-amber-950/50 border border-amber-700 px-4 py-3 text-xs text-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <strong>Cảnh báo chuyển động camera lớn:</strong> Độ dịch chuyển tích lũy trung bình của camera là {comparisonResult.meanCameraDisplacementPx.toFixed(1)} px. Khi camera lia quá nhanh, các thuật toán trừ nền tĩnh sẽ cần thời gian thích nghi lại.
          </div>
        </div>
      )}

      {/* Dual-Flow Visual Comparison: Flow A vs Flow B */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Flow A: Original -> Background Subtraction */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-amber-700">
                LUỒNG A: Tách Nền Trực Tiếp Trên Video Rung (Chưa Chống Rung)
              </h2>
              <p className="text-[11px] text-slate-500">
                Rung lắc camera làm viền cảnh nền bị nhận nhầm thành vật thể chuyển động
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              IoU:{' '}
              {flowAIoU !== null ? `${(flowAIoU * 100).toFixed(1)}%` : 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <FrameCanvas
              rgba={origRgba}
              width={w}
              height={h}
              title="A1. Video gốc (Rung)"
              testId="combined-flowA-input"
            />
            <FrameCanvas
              rgba={flowAMaskRgba}
              width={w}
              height={h}
              title="A2. Mask bị nhiễu rung"
              testId="combined-flowA-mask"
            />
            <FrameCanvas
              rgba={flowAOverlay}
              width={w}
              height={h}
              title="A3. Kết quả Luồng A"
              testId="combined-flowA-overlay"
            />
          </div>
        </div>

        {/* Flow B: Stabilization -> Background Subtraction */}
        <div className="bg-white border-2 border-emerald-500 p-4 shadow-xs space-y-3">
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-emerald-700">
                LUỒNG B: Đã Chống Rung ({config.stabilizationMethod.toUpperCase()}) → Sau Đó Mới Tách Nền
              </h2>
              <p className="text-[11px] text-slate-500">
                Nền được cố định trước giúp mặt nạ vật thể sạch và chính xác hơn rõ rệt
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-bold tabular-nums">
              IoU:{' '}
              {flowBIoU !== null ? `${(flowBIoU * 100).toFixed(1)}%` : 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <FrameCanvas
              rgba={stabRgba}
              width={w}
              height={h}
              title="B1. Video đã chống rung"
              testId="combined-flowB-input"
            />
            <FrameCanvas
              rgba={flowBMaskRgba}
              width={w}
              height={h}
              title="B2. Mask sạch sau chống rung"
              testId="combined-flowB-mask"
            />
            <FrameCanvas
              rgba={flowBOverlay}
              width={w}
              height={h}
              title="B3. Kết quả Luồng B (Tối ưu)"
              testId="combined-flowB-overlay"
            />
          </div>
        </div>
      </div>

      {/* Comparative Discrepancy Metrics */}
      {comparisonResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Độ Chính Xác IoU (Luồng A → Luồng B)"
            value={
              flowAIoU !== null && flowBIoU !== null
                ? `${(flowAIoU * 100).toFixed(1)}% → ${(flowBIoU * 100).toFixed(1)}%`
                : 'Video thực tế (Không GT)'
            }
            deltaText={
              flowAIoU !== null && flowBIoU !== null
                ? `Tăng thêm: ${(flowBIoU - flowAIoU >= 0 ? '+' : '')}${(
                    (flowBIoU - flowAIoU) *
                    100
                  ).toFixed(2)}% IoU`
                : 'Xem độ giảm nhấp nháy bên cạnh'
            }
            deltaTone="positive"
            description="Mức cải thiện độ chính xác tách nền nhờ bước chống rung camera phía trước."
          />
          <MetricCard
            label="Sai Biệt Mặt Nạ Giữa 2 Luồng"
            value={comparisonResult.meanMaskDifferencePercent.toFixed(2)}
            unit="%"
            deltaText={`Tại frame #${safeIdx + 1}: ${(
              (comparisonResult.maskDifferenceRatioPerFrame[safeIdx] ?? 0) * 100
            ).toFixed(2)}%`}
            deltaTone="neutral"
            description="Tỷ lệ điểm ảnh thay đổi kết quả phân loại nhờ được chống rung trước."
          />
          <MetricCard
            label="Độ Nhấp Nháy Nhiễu (Flicker A → B)"
            value={`${(
              comparisonResult.flowA_OriginalToBg.meanMaskFlicker * 100
            ).toFixed(2)}% → ${(
              comparisonResult.flowB_StabilizedToBg.meanMaskFlicker * 100
            ).toFixed(2)}%`}
            deltaText="Thấp hơn = Mặt nạ ổn định hơn"
            deltaTone="positive"
            description="Giảm hiện tượng mặt nạ bị nhấp nháy do rung lắc camera."
          />
          <MetricCard
            label="Tốc Độ Xử Lý Toàn Chuỗi"
            value={(
              1000 /
              Math.max(
                0.1,
                comparisonResult.stabilizationResult.avgProcessingTimeMs +
                  comparisonResult.flowB_StabilizedToBg.avgProcessingTimeMs
              )
            ).toFixed(1)}
            unit="FPS"
            deltaText={`Chống rung: ${comparisonResult.stabilizationResult.avgProcessingTimeMs.toFixed(1)}ms + Tách nền: ${comparisonResult.flowB_StabilizedToBg.avgProcessingTimeMs.toFixed(1)}ms`}
            deltaTone="neutral"
            description="Tốc độ chạy kết hợp cả chống rung và tách nền."
          />
        </div>
      )}
    </div>
  );
};
