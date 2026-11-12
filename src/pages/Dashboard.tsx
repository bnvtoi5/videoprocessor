import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Crosshair,
  Layers,
  GitMerge,
  FlaskConical,
  ArrowRight,
} from 'lucide-react';
import { OpenCvCapabilities } from '../core/openCvLoader';
import {
  DecodedVideoSession,
  PlaylistVideoItem,
  SyntheticScenarioId,
  VideoInputConfig,
} from '../types/video';
import { BenchmarkExperimentRecord } from '../types/benchmark';
import { VideoInputPanel } from '../components/video/VideoInputPanel';
import { FrameCanvas } from '../components/video/FrameCanvas';
import { LabPageId } from '../components/layout/Sidebar';

export interface DashboardProps {
  capabilities: OpenCvCapabilities;
  session: DecodedVideoSession;
  inputConfig: VideoInputConfig;
  experimentHistory: BenchmarkExperimentRecord[];
  playlist: PlaylistVideoItem[];
  activeVideoId: string;
  onChangeInputConfig: (cfg: VideoInputConfig) => void;
  onSessionLoaded: (session: DecodedVideoSession) => void;
  onLoadSyntheticScenario: (scenarioId: SyntheticScenarioId) => void;
  onRunScenarioExperiment: (
    scenarioId: SyntheticScenarioId,
    targetModule: 'stabilization' | 'background' | 'benchmark' | LabPageId
  ) => void;
  onAddMultipleFiles: (files: FileList | File[]) => Promise<void>;
  onSelectActiveVideo: (id: string) => void;
  onToggleVideoSelection: (id: string) => void;
  onRemoveVideo: (id: string) => void;
  onNavigate: (page: LabPageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  session,
  inputConfig,
  playlist,
  activeVideoId,
  onChangeInputConfig,
  onSessionLoaded,
  onLoadSyntheticScenario,
  onAddMultipleFiles,
  onSelectActiveVideo,
  onToggleVideoSelection,
  onRemoveVideo,
  onNavigate,
}) => {
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const totalFrames = session.frames.length;
  const safeIdx = Math.min(
    Math.max(0, previewFrameIdx),
    Math.max(0, totalFrames - 1)
  );
  const currentFrame = session.frames[safeIdx];

  // Reset or adjust preview index whenever active session changes
  useEffect(() => {
    setPreviewFrameIdx(0);
  }, [session.id]);

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

  const selectedCount = playlist.filter((v) => v.selected).length;

  return (
    <div className="space-y-5">
      {/* Step 1 Multi-Video Loader & Playlist Tray */}
      <VideoInputPanel
        session={session}
        inputConfig={inputConfig}
        playlist={playlist}
        activeVideoId={activeVideoId}
        onChangeInputConfig={onChangeInputConfig}
        onSessionLoaded={(newSess) => {
          setPreviewFrameIdx(0);
          setIsPlayingPreview(true);
          onSessionLoaded(newSess);
        }}
        onLoadSyntheticScenario={(sc) => {
          setPreviewFrameIdx(0);
          onLoadSyntheticScenario(sc);
        }}
        onAddMultipleFiles={onAddMultipleFiles}
        onSelectActiveVideo={onSelectActiveVideo}
        onToggleVideoSelection={onToggleVideoSelection}
        onRemoveVideo={onRemoveVideo}
        onNavigateAblationStudio={() => onNavigate('experiment_lab')}
      />

      {/* Quick Action Cards & Active Video Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: 4 Clear Function Action Cards */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              Chọn chức năng xử lý trên video đang xem hoặc chạy nghiệm thu đa video
            </span>
            <span className="text-xs font-mono text-blue-700 font-semibold">
              {playlist.length} video đã nạp · {selectedCount} video nghiệm thu
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
                  <Crosshair className="w-4 h-4" />
                  <span>1. Chống Rung Video</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Khử rung camera bằng Optical Flow (LK + RANSAC) hoặc ECC và xem quỹ đạo.
                </p>
              </div>
              <button
                type="button"
                disabled={playlist.length === 0}
                onClick={() => onNavigate('algorithm_lab')}
                className="mt-3 w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{playlist.length === 0 ? 'Cần nạp video trước' : 'Mở Chống Rung'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <Layers className="w-4 h-4" />
                  <span>2. Tách Nền & Vật Thể</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Tách đối tượng chuyển động bằng MOG2, Frame Diff, KNN và lọc Morphology.
                </p>
              </div>
              <button
                type="button"
                disabled={playlist.length === 0}
                onClick={() => onNavigate('algorithm_lab')}
                className="mt-3 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{playlist.length === 0 ? 'Cần nạp video trước' : 'Mở Tách Nền'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                  <GitMerge className="w-4 h-4" />
                  <span>3. So Sánh Luồng A & Luồng B</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Đối chiếu kết quả tách nền khi chưa chống rung (A) và sau khi chống rung (B).
                </p>
              </div>
              <button
                type="button"
                disabled={playlist.length === 0}
                onClick={() => onNavigate('algorithm_lab')}
                className="mt-3 w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{playlist.length === 0 ? 'Cần nạp video trước' : 'Mở So Sánh Luồng A/B'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-blue-50/70 border border-blue-300 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-800">
                  <FlaskConical className="w-4 h-4" />
                  <span>4. Nghiệm Thu & Phiếu Bầu ({selectedCount} Video)</span>
                </div>
                <p className="text-xs text-slate-700 mt-1">
                  Chạy cùng lúc các video đã nạp ở Bước 1 để tạo Bảng Nghiệm Thu Số Liệu và Phiếu Bầu đa số.
                </p>
              </div>
              <button
                type="button"
                data-testid="dashboard-open-ablation-studio-btn"
                disabled={selectedCount === 0}
                onClick={() => onNavigate('experiment_lab')}
                className="mt-3 w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{selectedCount === 0 ? 'Cần nạp video để chạy' : '▶ Chạy Nghiệm Thu Ngay'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Active Video Preview */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 truncate">
              Xem trước: {session.metadata.fileName}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsPlayingPreview((p) => !p)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                {isPlayingPreview ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Phát</span>
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
                className="w-24 accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                #{safeIdx}/{Math.max(0, totalFrames - 1)}
              </span>
            </div>
          </div>

          <FrameCanvas
            rgba={currentFrame?.rgba}
            width={session.metadata.processingWidth}
            height={session.metadata.processingHeight}
            title={`Frame #${safeIdx}`}
            subtitle={`${session.metadata.processingWidth}×${session.metadata.processingHeight}`}
            testId="dashboard-input-canvas"
          />
        </div>
      </div>
    </div>
  );
};
