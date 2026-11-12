import React from 'react';
import {
  FlaskConical,
  Video,
  Download,
  BookOpen,
  Sliders,
} from 'lucide-react';

export type LabPageId =
  | 'experiment_lab'
  | 'video_lab'
  | 'algorithm_lab'
  | 'result_analysis'
  | 'export_center'
  | 'methodology_code';

export interface SidebarProps {
  activePage: LabPageId;
  onSelectPage: (page: LabPageId) => void;
  experimentRunCount?: number;
}

const WORKBENCH_NAV_ITEMS: {
  id: LabPageId;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'experiment_lab',
    label: '1. Nghiệm Thu Đa Video & Bầu Chọn',
    subtitle: 'Chạy hàng loạt video · Bảng số · Phiếu Vote',
    icon: FlaskConical,
  },
  {
    id: 'video_lab',
    label: '2. Kiểm Tra Đơn Video (Chi Tiết)',
    subtitle: 'Soi frame · Optical Flow · MOG2 · Luồng A/B',
    icon: Video,
  },
  {
    id: 'export_center',
    label: '3. Xuất Số Liệu & Biểu Đồ',
    subtitle: 'Excel (.xlsx) · Biểu Đồ (PNG 300 DPI)',
    icon: Download,
  },
  {
    id: 'methodology_code',
    label: '4. Cấu Trúc Code & Cài Đặt Máy Tính',
    subtitle: 'Vị trí file bộ lọc · Cài chạy offline',
    icon: BookOpen,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
}) => {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between select-none">
      <div>
        <div className="p-4 border-b border-slate-200">
          <div className="text-xs font-bold text-slate-900 tracking-wide">
            HỆ THỐNG XỬ LÝ VIDEO
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Đồ án DSP501 · FPT University
          </div>
        </div>

        <div className="p-2">
          <nav
            className="space-y-1"
            aria-label="Điều hướng chính"
          >
            {WORKBENCH_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              // Group active state cleanly if user is in an advanced single-video mode
              const isActive =
                activePage === item.id ||
                (item.id === 'video_lab' &&
                  (activePage === 'algorithm_lab' || activePage === 'result_analysis'));

              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => onSelectPage(item.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 text-blue-900 border border-blue-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-blue-700' : 'text-slate-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1">
        <div className="font-semibold text-slate-700">OpenCV.js WebAssembly</div>
        <div>Xử lý thuần phía máy khách, không gửi video ra ngoài.</div>
      </div>
    </aside>
  );
};
