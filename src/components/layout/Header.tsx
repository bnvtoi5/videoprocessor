import React, { useRef } from 'react';
import { OpenCvCapabilities } from '../../core/openCvLoader';
import { DecodedVideoSession } from '../../types/video';
import { Upload } from 'lucide-react';

export interface HeaderProps {
  capabilities: OpenCvCapabilities;
  session: DecodedVideoSession;
  processingState: {
    isRunning: boolean;
    label: string;
    progress: number;
  };
  onQuickUploadFile: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({
  capabilities,
  session,
  processingState,
  onQuickUploadFile,
}) => {
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onQuickUploadFile(file);
    }
    if (headerFileInputRef.current) {
      headerFileInputRef.current.value = '';
    }
  };

  const isUserUpload = session.metadata.sourceType === 'upload';

  return (
    <header className="h-14 bg-[#0B0E17] border-b border-slate-800 px-6 flex items-center justify-between gap-8 shrink-0">
      {/* Zone 1: Brand Title */}
      <div className="text-sm font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
        SPATIOTEMPORAL VIDEO PROCESSING LAB
      </div>

      {/* Zone 2: Unboxed Scientific Status Metadata */}
      <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-400 truncate">
        <span className={capabilities.isReady ? 'text-emerald-400' : 'text-amber-400'}>
          {capabilities.isReady ? '● OpenCV.js Sẵn sàng' : '▲ Đang nạp OpenCV'}
        </span>
        <span aria-hidden="true">·</span>
        <span
          className={`truncate max-w-[260px] ${
            isUserUpload ? 'text-emerald-300 font-semibold' : 'text-amber-300'
          }`}
        >
          {isUserUpload
            ? `Video của bạn: ${session.metadata.fileName}`
            : `Đang dùng video mẫu (${session.metadata.fileName})`}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums text-slate-300">
          {session.metadata.processingWidth}×{session.metadata.processingHeight} ({session.frames.length} frame)
        </span>
        {processingState.isRunning && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-400 tabular-nums">
              Đang xử lý: {processingState.label} ({processingState.progress}%)
            </span>
          </>
        )}
      </div>

      {/* Zone 3: Single Primary Action — Direct Video Upload From Any Screen */}
      <div className="flex items-center shrink-0">
        <input
          ref={headerFileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Tải video từ máy tính trên thanh công cụ"
        />
        <button
          type="button"
          disabled={processingState.isRunning}
          onClick={() => headerFileInputRef.current?.click()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Tải Video Của Bạn Lên (MP4 / MOV / WebM)</span>
        </button>
      </div>
    </header>
  );
};
