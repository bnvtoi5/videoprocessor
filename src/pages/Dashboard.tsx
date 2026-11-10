import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Crosshair,
  Layers,
  GitMerge,
  BarChart3,
  ArrowRight,
  Cpu,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Download,
} from 'lucide-react';
import { OpenCvCapabilities } from '../core/openCvLoader';
import {
  DecodedVideoSession,
  SyntheticScenarioId,
  VideoInputConfig,
} from '../types/video';
import { BenchmarkExperimentRecord } from '../types/benchmark';
import { SYNTHETIC_SCENARIOS } from '../demo/syntheticSceneGenerator';
import { VideoInputPanel } from '../components/video/VideoInputPanel';
import { FrameCanvas } from '../components/video/FrameCanvas';
import { exportRgbaFramesToVideoFile } from '../core/videoEncoder';
import { LabPageId } from '../components/layout/Sidebar';

export interface DashboardProps {
  capabilities: OpenCvCapabilities;
  session: DecodedVideoSession;
  inputConfig: VideoInputConfig;
  experimentHistory: BenchmarkExperimentRecord[];
  onChangeInputConfig: (cfg: VideoInputConfig) => void;
  onSessionLoaded: (session: DecodedVideoSession) => void;
  onLoadSyntheticScenario: (scenarioId: SyntheticScenarioId) => void;
  onRunScenarioExperiment: (
    scenarioId: SyntheticScenarioId,
    targetModule: LabPageId
  ) => void;
  onNavigate: (page: LabPageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  capabilities,
  session,
  inputConfig,
  onChangeInputConfig,
  onSessionLoaded,
  onLoadSyntheticScenario,
  onRunScenarioExperiment,
  onNavigate,
}) => {
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [showSyntheticDetails, setShowSyntheticDetails] = useState(false);
  const [exportingScenario, setExportingScenario] = useState<string | null>(
    null
  );

  const totalFrames = session.frames.length;
  const safeIdx = Math.min(
    Math.max(0, previewFrameIdx),
    Math.max(0, totalFrames - 1)
  );
  const currentFrame = session.frames[safeIdx];

  useEffect(() => {
    if (!isPlayingPreview) return;
    const intervalMs = Math.max(
      33,
      Math.round(1000 / Math.max(5, session.metadata.samplingFps))
    );
    const timer = setInterval(() => {
      setPreviewFrameIdx((prev) => (prev + 1) % Math.max(1, totalFrames));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isPlayingPreview, totalFrames, session.metadata.samplingFps]);

  const handleDownloadSampleVideo = async (
    scenarioId: SyntheticScenarioId
  ) => {
    try {
      setExportingScenario(scenarioId);
      onLoadSyntheticScenario(scenarioId);
      const rgbaList = session.frames.map((f) => f.rgba);
      await exportRgbaFramesToVideoFile(
        rgbaList,
        session.metadata.processingWidth,
        session.metadata.processingHeight,
        session.metadata.samplingFps,
        `synthetic_${scenarioId}`,
        'RAW',
        'sample_input'
      );
    } finally {
      setExportingScenario(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* STEP 1: Upload Video Panel */}
      <VideoInputPanel
        session={session}
        inputConfig={inputConfig}
        onChangeInputConfig={onChangeInputConfig}
        onSessionLoaded={(newSess) => {
          setPreviewFrameIdx(0);
          setIsPlayingPreview(true);
          onSessionLoaded(newSess);
        }}
        onLoadSyntheticScenario={(sc) => {
          setPreviewFrameIdx(12);
          onLoadSyntheticScenario(sc);
        }}
      />

      {/* STEP 2: 4 Big Clear Action Cards ("Bấm nút nào để xem kết quả?") */}
      <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
        <div>
          <span className="text-xs font-mono font-bold text-cyan-400">
            BƯỚC 2 · CHỌN TÁC VỤ ĐỂ XỬ LÝ VIDEO VÀ XEM KẾT QUẢ NGAY
          </span>
          <h2 className="text-base font-bold text-slate-100 mt-0.5">
            Bạn muốn xử lý gì trên video &ldquo;{session.metadata.fileName}&rdquo;?
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chỉ cần bấm vào 1 trong 4 ô bên dưới, hệ thống sẽ tự động chạy thuật toán trên video đang chọn và mở màn hình phát video kết quả.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: Stabilization */}
          <div className="bg-[#0B0E17] border border-slate-800 hover:border-cyan-500 p-4 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400">
                  CHỨC NĂNG 1
                </span>
                <Crosshair className="w-4 h-4 text-cyan-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-2">
                1. Chống rung Video (Stabilization)
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Khử rung lắc camera bằng Optical Flow (LK + RANSAC) và ECC. Xem 3 màn hình: Video gốc, Video đã chống rung và biểu đồ quỹ đạo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stabilization')}
              className="mt-4 w-full py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Xem Kết Quả Chống Rung</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action 2: Background Subtraction */}
          <div className="bg-[#0B0E17] border border-slate-800 hover:border-emerald-500 p-4 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  CHỨC NĂNG 2
                </span>
                <Layers className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-2">
                2. Tách Nền & Vật Thể (Background)
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Tách đối tượng chuyển động khỏi nền bằng MOG2, Frame Diff, KNN. Xem đồng thời 5 màn hình: Mask trắng đen, Tô màu vật thể, Xóa nền.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('background')}
              className="mt-4 w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Xem Kết Quả Tách Nền</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action 3: Combined Pipeline */}
          <div className="bg-[#0B0E17] border border-slate-800 hover:border-amber-500 p-4 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400">
                  CHỨC NĂNG 3
                </span>
                <GitMerge className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-2">
                3. Kết Hợp Chống Rung + Tách Nền
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                So sánh kết quả tách nền khi chưa chống rung (Luồng A) và sau khi đã chống rung (Luồng B) trên cùng một video.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('combined')}
              className="mt-4 w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Xem Pipeline Kết Hợp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action 4: Benchmark */}
          <div className="bg-[#0B0E17] border border-slate-800 hover:border-sky-500 p-4 flex flex-col justify-between transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-400">
                  CHỨC NĂNG 4
                </span>
                <BarChart3 className="w-4 h-4 text-sky-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-2">
                4. Bảng Điểm & Biểu Đồ So Sánh
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Chạy toàn bộ các thuật toán trên video này để lập bảng so sánh tốc độ FPS, độ mượt, và xuất file báo cáo CSV / HTML.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('benchmark')}
              className="mt-4 w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Xem Bảng Điểm & Biểu Đồ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Video Preview Section */}
      <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Xem trước Video Đầu Vào ({session.metadata.fileName})
            </h2>
            <p className="text-xs text-slate-400">
              Kiểm tra các frame đã giải mã từ video trước khi chuyển sang tab xem kết quả.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlayingPreview((p) => !p)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {isPlayingPreview ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Phát thử Video</span>
                </>
              )}
            </button>
            <input
              id="dashboard-frame-slider"
              type="range"
              aria-label="Thanh trượt xem frame video đầu vào"
              min={0}
              max={Math.max(0, totalFrames - 1)}
              value={safeIdx}
              onChange={(e) => {
                setIsPlayingPreview(false);
                setPreviewFrameIdx(Number(e.target.value));
              }}
              className="w-44 accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-300 tabular-nums">
              Frame {safeIdx}/{Math.max(0, totalFrames - 1)}
            </span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <FrameCanvas
            rgba={currentFrame?.rgba}
            width={session.metadata.processingWidth}
            height={session.metadata.processingHeight}
            title={`Video đang nạp: ${session.metadata.fileName} (Frame #${safeIdx})`}
            subtitle={`${session.metadata.processingWidth}×${session.metadata.processingHeight} · ${session.frames.length} frames`}
            testId="dashboard-input-canvas"
          />
        </div>
      </div>

      {/* Collapsible Research Details: Synthetic Scenarios & OpenCV Status */}
      <div className="bg-[#111827] border border-slate-800 p-4">
        <button
          type="button"
          onClick={() => setShowSyntheticDetails((v) => !v)}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>
              Kịch bản Video Giả Lập (Synthetic Demo) & Trạng thái nhân OpenCV.js WASM
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-mono text-cyan-400">
            <span>{showSyntheticDetails ? 'Thu gọn' : 'Mở rộng'}</span>
            {showSyntheticDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {showSyntheticDetails && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {SYNTHETIC_SCENARIOS.map((sc) => {
                const isCurrent = session.metadata.scenarioId === sc.id;
                return (
                  <div
                    key={sc.id}
                    className={`bg-[#0B0E17] border p-4 flex flex-col justify-between ${
                      isCurrent ? 'border-cyan-600' : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono text-cyan-400">
                        {sc.id.toUpperCase()}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {sc.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {sc.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFrameIdx(12);
                          onLoadSyntheticScenario(sc.id);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                      >
                        Nạp kịch bản này
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRunScenarioExperiment(sc.id, sc.recommendedModule)
                        }
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Chạy thử nghiệm</span>
                      </button>
                      <button
                        type="button"
                        disabled={exportingScenario === sc.id}
                        onClick={() => handleDownloadSampleVideo(sc.id)}
                        className="px-2.5 py-1.5 bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Tải mẫu</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>
                  OpenCV.js Runtime: {capabilities.version} · PyrLK:{' '}
                  {capabilities.hasCalcOpticalFlowPyrLK ? 'WASM' : 'TS'} · MOG2:{' '}
                  {capabilities.hasBackgroundSubtractorMOG2 ? 'WASM' : 'TS'}
                </span>
              </div>
              <span>Đề tài: Hệ thống xử lý video không gian–thời gian</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
