import React, { useRef, useState } from 'react';
import {
  Upload,
  XCircle,
  Film,
  AlertTriangle,
  CheckCircle2,
  FolderArchive,
  ChevronDown,
  ChevronUp,
  Sliders,
} from 'lucide-react';
import {
  DecodedVideoSession,
  SyntheticScenarioId,
  VideoInputConfig,
} from '../../types/video';
import { decodeUploadedVideoFile } from '../../core/videoDecoder';
import {
  loadGroundTruthMasksFromVideoFile,
  loadGroundTruthMasksFromZip,
} from '../../demo/groundTruthGenerator';

export interface VideoInputPanelProps {
  session: DecodedVideoSession;
  inputConfig: VideoInputConfig;
  onChangeInputConfig: (cfg: VideoInputConfig) => void;
  onSessionLoaded: (session: DecodedVideoSession) => void;
  onLoadSyntheticScenario: (scenarioId: SyntheticScenarioId) => void;
}

export const VideoInputPanel: React.FC<VideoInputPanelProps> = ({
  session,
  inputConfig,
  onChangeInputConfig,
  onSessionLoaded,
  onLoadSyntheticScenario,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const gtVideoInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState<{
    decoded: number;
    total: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [gtStatusMsg, setGtStatusMsg] = useState<string | null>(null);

  const processVideoFile = async (file: File) => {
    setErrorMsg(null);
    setWarningMsg(null);
    setGtStatusMsg(null);
    setIsDecoding(true);
    setDecodeProgress({ decoded: 0, total: inputConfig.maxFrames });

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const { session: newSession, resourceWarning } =
        await decodeUploadedVideoFile(
          file,
          inputConfig,
          (decoded, total) => {
            setDecodeProgress({ decoded, total });
          },
          abortController.signal
        );

      if (resourceWarning) {
        setWarningMsg(resourceWarning);
      }
      onSessionLoaded(newSession);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể giải mã video này.'
      );
    } finally {
      setIsDecoding(false);
      setDecodeProgress(null);
      abortControllerRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processVideoFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processVideoFile(file);
    }
  };

  const handleCancelDecode = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleGroundTruthZipUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setGtStatusMsg('Đang đọc các ảnh mask Ground Truth từ file ZIP...');

    try {
      const res = await loadGroundTruthMasksFromZip(
        file,
        session.metadata.processingWidth,
        session.metadata.processingHeight,
        session.frames.length
      );
      setGtStatusMsg(res.summaryMessage);

      if (res.matchedCount > 0) {
        onSessionLoaded({
          ...session,
          metadata: {
            ...session.metadata,
            hasGroundTruth: true,
            cdnetLabelCompatible: true,
          },
          groundTruthMasks: res.masks,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể giải nén file Ground Truth ZIP.'
      );
      setGtStatusMsg(null);
    } finally {
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const handleGroundTruthVideoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setWarningMsg(null);
    setGtStatusMsg('Đang giải mã video Ground Truth Mask chuẩn CDnet...');

    try {
      const timestamps = session.frames.map((f) => f.timestamp);
      const res = await loadGroundTruthMasksFromVideoFile(
        file,
        session.metadata.processingWidth,
        session.metadata.processingHeight,
        timestamps
      );
      if (res.warningMessage) {
        setWarningMsg(res.warningMessage);
      }
      setGtStatusMsg(res.summaryMessage);

      if (res.matchedCount > 0) {
        onSessionLoaded({
          ...session,
          metadata: {
            ...session.metadata,
            hasGroundTruth: true,
            cdnetLabelCompatible: true,
          },
          groundTruthMasks: res.masks,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể đọc file video Ground Truth Mask.'
      );
      setGtStatusMsg(null);
    } finally {
      if (gtVideoInputRef.current) gtVideoInputRef.current.value = '';
    }
  };

  const meta = session.metadata;
  const isUserUpload = meta.sourceType === 'upload';

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="bg-[#111827] border border-slate-800 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            BƯỚC 1 · CHỌN VIDEO ĐẦU VÀO
          </span>
          <h2 className="text-base font-bold text-slate-100 mt-0.5">
            Tải video từ máy tính của bạn lên để kiểm thử thực tế
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hỗ trợ MP4, MOV, WebM. Video được giải mã trực tiếp trên trình duyệt của bạn, không tải lên máy chủ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="px-3 py-1.5 bg-[#0B0E17] hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {showAdvanced
              ? 'Ẩn tùy chỉnh độ phân giải & Ground Truth'
              : 'Tùy chỉnh độ phân giải / FPS / Nạp Ground Truth'}
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Prominent Drag & Drop / Click Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed p-6 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isDragging
            ? 'border-emerald-400 bg-emerald-950/30'
            : isUserUpload
            ? 'border-emerald-700/80 bg-[#0B0E17]'
            : 'border-cyan-700/70 bg-[#0B0E17] hover:border-cyan-500'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 flex items-center justify-center shrink-0 border ${
              isUserUpload
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400'
                : 'bg-cyan-950/60 border-cyan-500 text-cyan-400'
            }`}
          >
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">
              {isUserUpload
                ? `Đã nạp video của bạn: ${meta.fileName}`
                : 'Kéo thả file video của bạn vào đây hoặc bấm nút bên phải'}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
              {isUserUpload ? (
                <span className="text-emerald-400">
                  ● Kích thước: {formatBytes(meta.fileSize)} · Độ phân giải xử lý:{' '}
                  {meta.processingWidth}×{meta.processingHeight} · Số frame đã tách:{' '}
                  {session.frames.length} frames ({meta.duration.toFixed(1)}s)
                </span>
              ) : (
                <span>
                  Hiện đang hiển thị dữ liệu mẫu ({meta.fileName}). Hãy tải video của bạn lên để thay thế!
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload video file"
          />
          <button
            type="button"
            disabled={isDecoding}
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>
              {isUserUpload
                ? 'Đổi Video Khác Từ Máy Tính'
                : 'Chọn Video Từ Máy Tính (.MP4 / .MOV / .WebM)'}
            </span>
          </button>
        </div>
      </div>

      {/* Decoding Progress Bar & Cancel button */}
      {isDecoding && decodeProgress && (
        <div className="bg-[#0B0E17] border border-cyan-700 p-4 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-mono text-cyan-300 mb-1.5">
              <span>Đang tách từng frame từ video của bạn...</span>
              <span>
                {decodeProgress.decoded} / {decodeProgress.total} frames (
                {Math.round(
                  (decodeProgress.decoded / Math.max(1, decodeProgress.total)) *
                    100
                )}
                %)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (decodeProgress.decoded /
                      Math.max(1, decodeProgress.total)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancelDecode}
            className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Hủy (Cancel)</span>
          </button>
        </div>
      )}

      {/* Alerts */}
      {errorMsg && (
        <div className="bg-rose-950/50 border border-rose-800 px-3.5 py-2.5 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {warningMsg && (
        <div className="bg-amber-950/40 border border-amber-800 px-3.5 py-2.5 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}

      {gtStatusMsg && (
        <div className="bg-emerald-950/40 border border-emerald-800 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{gtStatusMsg}</span>
        </div>
      )}

      {/* Collapsible Advanced Settings & Ground Truth Upload Drawer */}
      {showAdvanced && (
        <div className="bg-[#0B0E17] border border-slate-800 p-4 space-y-4">
          <div className="text-xs font-semibold text-slate-200">
            Cấu hình giới hạn tài nguyên khi đọc video (Áp dụng cho lần tải video tiếp theo)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="input-max-frames"
                className="block text-xs text-slate-400 mb-1"
              >
                Số frame xử lý tối đa
              </label>
              <select
                id="input-max-frames"
                value={inputConfig.maxFrames}
                onChange={(e) =>
                  onChangeInputConfig({
                    ...inputConfig,
                    maxFrames: Number(e.target.value),
                  })
                }
                className="w-full bg-[#111827] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
              >
                <option value={30}>30 frames (Rất nhanh)</option>
                <option value={48}>48 frames (Mặc định)</option>
                <option value={90}>90 frames (~6s @ 15fps)</option>
                <option value={150}>150 frames (10s @ 15fps)</option>
                <option value={225}>225 frames (15s @ 15fps)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="input-max-width"
                className="block text-xs text-slate-400 mb-1"
              >
                Chiều rộng xử lý tối đa
              </label>
              <select
                id="input-max-width"
                value={inputConfig.maxWidth}
                onChange={(e) =>
                  onChangeInputConfig({
                    ...inputConfig,
                    maxWidth: Number(e.target.value),
                  })
                }
                className="w-full bg-[#111827] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
              >
                <option value={320}>320 px (Tốc độ cao)</option>
                <option value={480}>480 px (Cân bằng)</option>
                <option value={640}>640 px (Chuẩn HD nhỏ)</option>
                <option value={800}>800 px (Chi tiết cao)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="input-sampling-fps"
                className="block text-xs text-slate-400 mb-1"
              >
                FPS lấy mẫu
              </label>
              <select
                id="input-sampling-fps"
                value={inputConfig.targetFps}
                onChange={(e) =>
                  onChangeInputConfig({
                    ...inputConfig,
                    targetFps: Number(e.target.value),
                  })
                }
                className="w-full bg-[#111827] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
              >
                <option value={10}>10 FPS</option>
                <option value={15}>15 FPS (Khuyên dùng)</option>
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="input-max-duration"
                className="block text-xs text-slate-400 mb-1"
              >
                Giới hạn thời lượng đọc
              </label>
              <select
                id="input-max-duration"
                value={inputConfig.maxDurationSec}
                onChange={(e) =>
                  onChangeInputConfig({
                    ...inputConfig,
                    maxDurationSec: Number(e.target.value),
                  })
                }
                className="w-full bg-[#111827] border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-200"
              >
                <option value={10}>10 giây</option>
                <option value={12}>12 giây (Mặc định)</option>
                <option value={15}>15 giây</option>
                <option value={25}>25 giây</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleGroundTruthZipUpload}
                className="hidden"
                aria-label="Upload Ground Truth ZIP masks"
              />
              <button
                type="button"
                disabled={isDecoding}
                onClick={() => zipInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <FolderArchive className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nạp GT Masks (.ZIP ảnh PNG/BMP)</span>
              </button>

              <input
                ref={gtVideoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/*"
                onChange={handleGroundTruthVideoUpload}
                className="hidden"
                aria-label="Upload Ground Truth Video mask"
              />
              <button
                type="button"
                disabled={isDecoding}
                onClick={() => gtVideoInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-emerald-400" />
                <span>Nạp Video GT Mask (.MP4/.WebM chuẩn CDnet)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Film className="w-3.5 h-3.5 text-cyan-400" />
                <span>Kịch bản chuẩn:</span>
              </span>
              <button
                type="button"
                onClick={() => onLoadSyntheticScenario('shaky_camera')}
                className="px-2.5 py-1 bg-[#111827] border border-slate-700 hover:border-cyan-500 text-slate-300 font-mono cursor-pointer"
              >
                Mẫu 1: Camera Rung
              </button>
              <button
                type="button"
                onClick={() => onLoadSyntheticScenario('moving_object')}
                className="px-2.5 py-1 bg-[#111827] border border-slate-700 hover:border-cyan-500 text-slate-300 font-mono cursor-pointer"
              >
                Mẫu 2: Vật thể di chuyển
              </button>
              <button
                type="button"
                onClick={() => onLoadSyntheticScenario('illumination_change')}
                className="px-2.5 py-1 bg-[#111827] border border-slate-700 hover:border-cyan-500 text-slate-300 font-mono cursor-pointer"
              >
                Mẫu 3: Đổi ánh sáng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
