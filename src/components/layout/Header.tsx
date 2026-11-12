import React, { useRef } from 'react';
import { OpenCvCapabilities } from '../../core/openCvLoader';
import { DecodedVideoSession, PlaylistVideoItem } from '../../types/video';
import { Upload, Download } from 'lucide-react';
import { LabPageId } from './Sidebar';

export interface HeaderProps {
  capabilities: OpenCvCapabilities;
  session: DecodedVideoSession;
  processingState: {
    isRunning: boolean;
    label: string;
    progress: number;
  };
  experimentRunCount: number;
  playlist: PlaylistVideoItem[];
  activeVideoId: string;
  onSelectActiveVideo: (id: string) => void;
  onQuickUploadMultipleFiles: (files: FileList | File[]) => void;
  onNavigate: (page: LabPageId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  capabilities,
  session,
  processingState,
  experimentRunCount,
  playlist,
  activeVideoId,
  onSelectActiveVideo,
  onQuickUploadMultipleFiles,
  onNavigate,
}) => {
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onQuickUploadMultipleFiles(files);
    }
    if (headerFileInputRef.current) {
      headerFileInputRef.current.value = '';
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-sm font-bold tracking-tight text-slate-900">
          Phần Mềm Xử Lý Video Chống Rung & Tách Nền
        </div>
        <span className="hidden sm:inline-block text-[11px] font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5">
          DSP501
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-600 truncate">
        <span
          className={
            capabilities.isReady
              ? 'text-emerald-700 font-semibold'
              : 'text-amber-700'
          }
        >
          {capabilities.isReady ? '● OpenCV.js Sẵn sàng' : '▲ Đang nạp...'}
        </span>
        <span aria-hidden="true" className="text-slate-300">
          |
        </span>

        {/* Video selector dropdown if videos loaded */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Video:</span>
          {playlist.length === 0 ? (
            <span className="text-slate-400 italic">Chưa nạp video</span>
          ) : (
            <select
              value={activeVideoId}
              onChange={(e) => onSelectActiveVideo(e.target.value)}
              className="bg-slate-50 border border-slate-300 px-2 py-0.5 text-xs font-semibold text-slate-800 max-w-[200px] truncate"
              title="Đổi video đang xử lý"
            >
              {playlist.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <span aria-hidden="true" className="text-slate-300">
          |
        </span>
        <span className="tabular-nums text-slate-600">
          {session.metadata.processingWidth}×{session.metadata.processingHeight}{' '}
          · {session.frames.length} frames
        </span>
        {processingState.isRunning && (
          <>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <span className="text-blue-700 font-semibold tabular-nums">
              {processingState.label} ({processingState.progress}%)
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('export_center')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-blue-700" />
          <span>Xuất File ({experimentRunCount})</span>
        </button>

        <input
          ref={headerFileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Tải video từ máy tính"
        />
        <button
          type="button"
          disabled={processingState.isRunning}
          onClick={() => headerFileInputRef.current?.click()}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>+ Tải Thêm Video (.MP4 / .MOV)</span>
        </button>
      </div>
    </header>
  );
};
