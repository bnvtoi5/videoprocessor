import React, { useRef, useState } from 'react';
import {
  DecodedVideoSession,
  PlaylistVideoItem,
  SyntheticScenarioId,
  VideoInputConfig,
} from '../../types/video';
import { SYNTHETIC_SCENARIOS } from '../../demo/syntheticSceneGenerator';
import { decodeUploadedVideoFile } from '../../core/videoDecoder';
import {
  Upload,
  Film,
  CheckCircle2,
  AlertTriangle,
  Play,
  Trash2,
  ListVideo,
  PlusCircle,
} from 'lucide-react';

export interface VideoInputPanelProps {
  session: DecodedVideoSession;
  inputConfig: VideoInputConfig;
  playlist: PlaylistVideoItem[];
  activeVideoId: string;
  onChangeInputConfig: (cfg: VideoInputConfig) => void;
  onSessionLoaded: (session: DecodedVideoSession) => void;
  onLoadSyntheticScenario: (scenarioId: SyntheticScenarioId) => void;
  onAddMultipleFiles: (files: FileList | File[]) => Promise<void>;
  onSelectActiveVideo: (id: string) => void;
  onToggleVideoSelection: (id: string) => void;
  onRemoveVideo: (id: string) => void;
  onNavigateAblationStudio: () => void;
}

export const VideoInputPanel: React.FC<VideoInputPanelProps> = ({
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
  onNavigateAblationStudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState<{
    fileIdx: number;
    totalFiles: number;
    fileName: string;
    decoded: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsDecoding(true);
    setErrorMessage(null);

    try {
      if (files.length === 1) {
        // Single file quick load
        const file = files[0];
        setDecodeProgress({
          fileIdx: 1,
          totalFiles: 1,
          fileName: file.name,
          decoded: 0,
          total: inputConfig.maxFrames,
        });

        const result = await decodeUploadedVideoFile(
          file,
          inputConfig,
          (pct) => {
            setDecodeProgress((prev) =>
              prev ? { ...prev, decoded: pct } : null
            );
          }
        );
        onSessionLoaded(result.session);
        await onAddMultipleFiles([file]);
      } else {
        // Multiple files loaded simultaneously right at Step 1
        await onAddMultipleFiles(files);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể giải mã một hoặc nhiều file video đã chọn'
      );
    } finally {
      setIsDecoding(false);
      setDecodeProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const selectedCount = playlist.filter((v) => v.selected).length;

  return (
    <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
      {/* Top Action Bar: Upload Multiple, Active Info & Quick Settings */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="multi-video-file-input"
          />
          <button
            type="button"
            data-testid="upload-multiple-videos-step1-btn"
            disabled={isDecoding}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>
              {isDecoding
                ? `Đang nạp ${decodeProgress?.fileName ?? ''} (${decodeProgress?.decoded ?? 0}/${decodeProgress?.total ?? 0})...`
                : '+ Nạp Nhiều Video Cùng Lúc (.MP4 / .MOV / .WebM)'}
            </span>
          </button>

          <div className="text-xs text-slate-700 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đang xem preview: <strong>{session.metadata.fileName}</strong> (
              {session.metadata.processingWidth}×
              {session.metadata.processingHeight} · {session.frames.length}{' '}
              frames)
            </span>
          </div>
        </div>

        {/* Quick Resolution & Fast Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Độ phân giải xử lý"
            value={String(inputConfig.maxWidth)}
            onChange={(e) => {
              onChangeInputConfig({
                ...inputConfig,
                maxWidth: Number(e.target.value),
              });
            }}
            className="bg-slate-50 border border-slate-300 px-2.5 py-1 text-xs font-mono text-slate-700"
          >
            <option value="320">320px (Nhanh)</option>
            <option value="400">400px (Chuẩn)</option>
            <option value="480">480px (Nét cao)</option>
          </select>

          {/* Quick jump to Step 3 Acceptance & Voting Studio */}
          <button
            type="button"
            data-testid="step1-jump-to-acceptance-btn"
            disabled={selectedCount === 0}
            onClick={onNavigateAblationStudio}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>
              {selectedCount === 0
                ? 'Chưa Chọn Video'
                : `Chạy Nghiệm Thu (${selectedCount} video) ▶`}
            </span>
          </button>
        </div>
      </div>

      {/* Interactive Multi-Video Playlist Tray directly in Step 1 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <ListVideo className="w-4 h-4 text-blue-600" />
            <span>
              Danh Sách Video Thực Tế Đã Nạp ({playlist.length} video ·{' '}
              {selectedCount} video chọn để nghiệm thu)
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Hệ thống chỉ xử lý các video do bạn tải lên. Chọn video xem trước hoặc tick chọn để nghiệm thu.
          </div>
        </div>

        {playlist.length === 0 ? (
          <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-800">
                Chưa có video nào được nạp vào hệ thống
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Bấm vào nút bên dưới để chọn một hoặc nhiều file video (.MP4, .MOV, .WebM) từ máy tính của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>+ Chọn File Video Từ Máy Ngay</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {playlist.map((item) => {
            const isActive = item.id === activeVideoId;
            return (
              <div
                key={item.id}
                onClick={() => onSelectActiveVideo(item.id)}
                className={`p-2.5 border transition-all text-left flex flex-col justify-between cursor-pointer relative ${
                  isActive
                    ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/30'
                    : item.selected
                    ? 'bg-white border-slate-300 hover:border-blue-400'
                    : 'bg-slate-50/80 border-slate-200 text-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <label
                      className="flex items-center gap-1.5 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => onToggleVideoSelection(item.id)}
                        className="accent-blue-600 w-3.5 h-3.5 cursor-pointer"
                        title="Chọn video này để chạy nghiệm thu đồng thời"
                      />
                      <span
                        className={`text-[10px] font-mono px-1 py-0.2 border ${
                          item.sourceType === 'upload'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {item.sourceType === 'upload' ? 'FILE MÁY' : 'CHUẨN'}
                      </span>
                    </label>

                    {item.sourceType === 'upload' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveVideo(item.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Xóa video tải lên này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.subtitle}
                  </div>
                </div>

                <div className="mt-2.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                  <span
                    className={
                      isActive
                        ? 'text-blue-700 font-bold'
                        : 'text-slate-500 font-medium'
                    }
                  >
                    {isActive ? '● Đang xem' : '○ Nhấp để xem'}
                  </span>
                  <span className="font-mono text-slate-500">
                    {item.session
                      ? `${item.session.frames.length} frames`
                      : 'Đã sẵn sàng'}
                  </span>
                </div>
              </div>
            );
          })}

            {/* Quick upload card slot */}
            <button
              type="button"
              disabled={isDecoding}
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer transition-colors min-h-[90px]"
            >
              <PlusCircle className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-semibold text-slate-700">
                + Thêm Video Nữa
              </span>
              <span className="text-[10px] text-slate-500">
                Nạp bao nhiêu file tùy thích
              </span>
            </button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
