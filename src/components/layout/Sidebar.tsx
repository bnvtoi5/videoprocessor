import React from 'react';
import {
  UploadCloud,
  Crosshair,
  Layers,
  BarChart3,
  GitMerge,
  BookOpen,
  Microscope,
  FlaskConical,
} from 'lucide-react';

export type LabPageId =
  | 'dashboard'
  | 'stabilization'
  | 'background'
  | 'benchmark'
  | 'combined'
  | 'research'
  | 'guide';

export interface SidebarProps {
  activePage: LabPageId;
  onSelectPage: (page: LabPageId) => void;
  hasCustomVideo?: boolean;
}

const MAIN_NAV_ITEMS: {
  id: LabPageId;
  step: string;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'dashboard',
    step: 'BƯỚC 1',
    label: 'Tải Video & Bắt đầu',
    subtitle: 'Chọn video từ máy tính',
    icon: UploadCloud,
  },
  {
    id: 'stabilization',
    step: 'KQ 1',
    label: 'Chống rung Video',
    subtitle: 'Gốc vs LK+RANSAC vs ECC',
    icon: Crosshair,
  },
  {
    id: 'background',
    step: 'KQ 2',
    label: 'Tách nền & Vật thể',
    subtitle: 'Frame Diff · MOG2 · KNN',
    icon: Layers,
  },
  {
    id: 'combined',
    step: 'KQ 3',
    label: 'Kết hợp Chống rung + Tách nền',
    subtitle: 'So sánh trước & sau chống rung',
    icon: GitMerge,
  },
  {
    id: 'benchmark',
    step: 'KQ 4',
    label: 'Bảng điểm & Biểu đồ',
    subtitle: 'So sánh tốc độ & Xuất báo cáo',
    icon: BarChart3,
  },
];

const RESEARCH_NAV_ITEMS: {
  id: LabPageId;
  step: string;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'research',
    step: 'NC KHOA HỌC',
    label: 'Research & Academic Report Lab',
    subtitle: 'RQ1–5 · Ablation · APA 7 · 18 Mục',
    icon: FlaskConical,
  },
  {
    id: 'guide',
    step: 'TÀI LIỆU',
    label: 'Giải thích Thuật toán',
    subtitle: 'Công thức & Nguyên lý DSP',
    icon: BookOpen,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
}) => {
  return (
    <aside className="w-64 shrink-0 bg-[#0B0E17] border-r border-slate-800 flex flex-col justify-between select-none">
      <div>
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-950 border border-cyan-600 flex items-center justify-center shrink-0">
            <Microscope className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-wider text-slate-100 truncate">
              SPATIOTEMPORAL LAB
            </div>
            <div className="text-[11px] font-mono text-slate-400 truncate">
              Xử lý Video Không gian–Thời gian
            </div>
          </div>
        </div>

        <div className="p-2.5 space-y-4">
          {/* Standard 3-Step User Workflow */}
          <nav className="space-y-1" aria-label="Main Video Processing Workflow">
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
              XỬ LÝ VIDEO NHANH (3 BƯỚC)
            </div>
            {MAIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => onSelectPage(item.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-600/80'
                      : 'text-slate-300 hover:bg-[#111827] hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate">
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400/90 shrink-0">
                        {item.step}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Independent Research & Academic Report Section */}
          <nav
            className="pt-3 border-t border-slate-800 space-y-1"
            aria-label="Research and Academic Report Lab"
          >
            <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400">
              RESEARCH & ACADEMIC REPORT LAB
            </div>
            {RESEARCH_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => onSelectPage(item.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-600/80'
                      : 'text-slate-300 hover:bg-[#111827] hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate">
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400/90 shrink-0">
                        {item.step}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
        <div className="font-semibold text-slate-200">
          Hướng dẫn nhanh 3 bước:
        </div>
        <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
          <li>Bấm <strong>Tải Video Từ Máy Tính</strong></li>
          <li>Chọn <strong>Chống rung</strong> hoặc <strong>Tách nền</strong></li>
          <li>Bấm <strong>Phát Video (Play)</strong> hoặc <strong>Tải về</strong></li>
        </ol>
      </div>
    </aside>
  );
};
