import { buildExportFileName, triggerBrowserDownload } from '../evaluation/reportGenerator';

/**
 * Detects the best supported MediaRecorder MIME type, prioritizing MP4 when
 * genuinely supported by the browser runtime, falling back to WebM.
 */
export function getPreferredVideoExportMime(): {
  mimeType: string;
  extension: 'mp4' | 'webm';
} {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', extension: 'webm' };
  }

  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  for (const c of mp4Candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return { mimeType: c, extension: 'mp4' };
    }
  }

  const webmCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of webmCandidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return { mimeType: c, extension: 'webm' };
    }
  }

  return { mimeType: '', extension: 'webm' };
}

/**
 * Encodes an array of RGBA frames into a playable video file (MP4 or WebM)
 * using HTML5 Canvas + MediaRecorder and triggers browser download.
 */
export async function exportRgbaFramesToVideoFile(
  rgbaFrames: Uint8ClampedArray[],
  width: number,
  height: number,
  fps: number,
  sourceVideoFileName: string,
  algorithmTag: string,
  resultTypeTag: string,
  onProgress?: (percent: number) => void
): Promise<{ fileName: string; encodingTimeMs: number; format: string }> {
  if (rgbaFrames.length === 0) {
    throw new Error('No processed frames available to export.');
  }

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser does not support MediaRecorder video encoding.');
  }

  const tStart = performance.now();
  const { mimeType, extension } = getPreferredVideoExportMime();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create 2D Canvas context for video export.');
  }

  const stream = canvas.captureStream(Math.max(5, Math.min(60, fps)));
  const recorderOptions = mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : undefined;
  const recorder = new MediaRecorder(stream, recorderOptions);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  const stopPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      resolve(blob);
    };
    recorder.onerror = () => {
      reject(new Error('MediaRecorder encountered an error during encoding.'));
    };
  });

  recorder.start();

  const frameDelayMs = Math.max(16, Math.round(1000 / Math.max(5, Math.min(30, fps))));
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < rgbaFrames.length; i++) {
    imageData.data.set(rgbaFrames[i]);
    ctx.putImageData(imageData, 0, 0);
    onProgress?.(Math.round(((i + 1) / rgbaFrames.length) * 100));
    await new Promise((r) => setTimeout(r, frameDelayMs));
  }

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  const videoBlob = await stopPromise;
  const encodingTimeMs = performance.now() - tStart;

  const fileName = buildExportFileName(
    sourceVideoFileName,
    algorithmTag,
    resultTypeTag,
    extension
  );

  triggerBrowserDownload(videoBlob, fileName, mimeType || 'video/webm');

  return {
    fileName,
    encodingTimeMs,
    format: extension.toUpperCase(),
  };
}
