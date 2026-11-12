import React, { useEffect, useRef } from 'react';
import { MovingComponentBox, TrackedFeaturePoint } from '../../types/algorithm';

export interface FrameCanvasProps {
  rgba: Uint8ClampedArray | undefined;
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  trackedFeatures?: TrackedFeaturePoint[];
  showInliers?: boolean;
  showOutliers?: boolean;
  showMotionVectors?: boolean;
  boundingBoxes?: MovingComponentBox[];
  showBoundingBoxes?: boolean;
  testId?: string;
}

export const FrameCanvas: React.FC<FrameCanvasProps> = ({
  rgba,
  width,
  height,
  title,
  subtitle,
  trackedFeatures,
  showInliers = false,
  showOutliers = false,
  showMotionVectors = false,
  boundingBoxes,
  showBoundingBoxes = false,
  testId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!rgba || rgba.length !== width * height * 4) {
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#64748B';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('Chưa có khung hình', 16, height / 2);
      return;
    }

    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imgData, 0, 0);

    // Draw optical flow feature points & RANSAC classification if enabled
    if (trackedFeatures && trackedFeatures.length > 0) {
      for (const pt of trackedFeatures) {
        if (pt.isInlier && !showInliers && !showMotionVectors) continue;
        if (!pt.isInlier && !showOutliers) continue;

        if (showMotionVectors) {
          ctx.beginPath();
          ctx.strokeStyle = pt.isInlier ? '#06B6D4' : '#F59E0B';
          ctx.lineWidth = 1.25;
          ctx.moveTo(pt.prevX, pt.prevY);
          ctx.lineTo(pt.currX, pt.currY);
          ctx.stroke();
        }

        if ((pt.isInlier && showInliers) || (!pt.isInlier && showOutliers)) {
          ctx.beginPath();
          ctx.fillStyle = pt.isInlier ? '#10B981' : '#F97316';
          ctx.arc(pt.currX, pt.currY, pt.isInlier ? 2.2 : 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw connected component bounding boxes
    if (showBoundingBoxes && boundingBoxes && boundingBoxes.length > 0) {
      ctx.font = '10px "JetBrains Mono", monospace';
      for (const box of boundingBoxes) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.25;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const tag = `Obj #${box.id} (${box.area}px)`;
        const labelY = Math.max(11, box.y - 3);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(box.x, labelY - 10, Math.min(width - box.x, tag.length * 6.2 + 6), 12);
        ctx.fillStyle = '#FBBF24';
        ctx.fillText(tag, box.x + 3, labelY - 1);
      }
    }
  }, [
    rgba,
    width,
    height,
    trackedFeatures,
    showInliers,
    showOutliers,
    showMotionVectors,
    boundingBoxes,
    showBoundingBoxes,
  ]);

  return (
    <div className="bg-white border border-slate-200 flex flex-col">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800 truncate">
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] font-mono text-slate-500 tabular-nums whitespace-nowrap">
            {subtitle}
          </span>
        )}
      </div>
      <div className="relative bg-slate-100 aspect-video w-full flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          data-testid={testId}
          className="w-full h-full object-contain cursor-crosshair"
        />
      </div>
    </div>
  );
};
