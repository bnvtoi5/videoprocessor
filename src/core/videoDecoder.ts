import {
  DecodedVideoSession,
  GroundTruthMask,
  RawFrameData,
  VideoInputConfig,
  VideoMetadata,
} from '../types/video';

export const DEFAULT_VIDEO_INPUT_CONFIG: VideoInputConfig = {
  maxFrames: 90,
  maxWidth: 480,
  targetFps: 15,
  maxDurationSec: 12,
};

/**
 * Inspects a video File via an HTMLVideoElement without decoding all frames yet.
 */
export async function probeVideoFileMetadata(
  file: File,
  config: VideoInputConfig
): Promise<{
  metadata: VideoMetadata;
  resourceWarning: string | null;
}> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            'Timed out reading video metadata. The file may be corrupted or use an unsupported codec.'
          )
        );
      }, 10000);

      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Browser cannot decode "${file.name}". Please upload an H.264 MP4, WebM, or MOV video.`
          )
        );
      };
      video.src = url;
    });

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const duration =
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5.0;

    // Estimate native FPS (standard 30 if browser does not expose media track framerate)
    const nativeFps = 30;
    const samplingFps = Math.max(1, Math.min(30, config.targetFps));
    const effectiveDuration = Math.min(duration, config.maxDurationSec);
    const estimatedTotalFrames = Math.max(1, Math.round(duration * nativeFps));
    const sampledFramesCount = Math.min(
      config.maxFrames,
      Math.max(1, Math.round(effectiveDuration * samplingFps))
    );

    const scale = width > config.maxWidth ? config.maxWidth / width : 1.0;
    const processingWidth = Math.max(64, Math.round((width * scale) / 2) * 2);
    const processingHeight = Math.max(64, Math.round((height * scale) / 2) * 2);

    const ext = file.name.split('.').pop()?.toUpperCase() || 'VIDEO';
    const codec = `${ext} (${file.type || 'video/mp4'})`;

    const warnings: string[] = [];
    if (duration > config.maxDurationSec) {
      warnings.push(
        `Video duration (${duration.toFixed(1)}s) exceeds experiment limit (${config.maxDurationSec}s); sampling first ${effectiveDuration.toFixed(1)}s.`
      );
    }
    if (width > config.maxWidth) {
      warnings.push(
        `Native resolution (${width}x${height}) downscaled to ${processingWidth}x${processingHeight} to prevent browser RAM exhaustion.`
      );
    }

    return {
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        width,
        height,
        processingWidth,
        processingHeight,
        fps: nativeFps,
        samplingFps,
        duration,
        totalFrameCount: estimatedTotalFrames,
        processedFrameLimit: sampledFramesCount,
        codec,
        sourceType: 'upload',
        hasGroundTruth: false,
      },
      resourceWarning: warnings.length > 0 ? warnings.join(' ') : null,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sequentially seeks and decodes video frames up to the configured frame limit,
 * emitting progress and honoring user cancellation via AbortSignal.
 */
export async function decodeUploadedVideoFile(
  file: File,
  config: VideoInputConfig,
  onProgress?: (decodedFrames: number, totalFrames: number) => void,
  signal?: AbortSignal
): Promise<{
  session: DecodedVideoSession;
  resourceWarning: string | null;
}> {
  const { metadata, resourceWarning } = await probeVideoFileMetadata(file, config);
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () =>
        reject(new Error(`Failed to decode video stream from "${file.name}".`));
      video.src = url;
    });

    const procW = metadata.processingWidth;
    const procH = metadata.processingHeight;
    const totalToDecode = metadata.processedFrameLimit;
    const dt = 1.0 / metadata.samplingFps;

    const canvas = document.createElement('canvas');
    canvas.width = procW;
    canvas.height = procH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not create 2D Canvas context for video frame extraction.');
    }

    const frames: RawFrameData[] = [];

    for (let i = 0; i < totalToDecode; i++) {
      if (signal?.aborted) {
        throw new Error('Video decoding cancelled by user.');
      }

      const targetTime = Math.min(
        Math.max(0, metadata.duration - 0.01),
        i * dt
      );

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          reject(new Error(`Frame seek error at ${targetTime.toFixed(2)}s.`));
        };
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('error', onError);
        video.currentTime = targetTime;
      });

      ctx.drawImage(video, 0, 0, procW, procH);
      const imageData = ctx.getImageData(0, 0, procW, procH);

      frames.push({
        index: i,
        timestamp: targetTime,
        width: procW,
        height: procH,
        rgba: new Uint8ClampedArray(imageData.data),
      });

      onProgress?.(i + 1, totalToDecode);
      // Yield to browser event loop
      await new Promise((r) => setTimeout(r, 0));
    }

    if (frames.length === 0) {
      throw new Error('Video contains 0 decodable frames.');
    }

    return {
      session: {
        id: `VID-${Date.now().toString(36).toUpperCase()}`,
        metadata: {
          ...metadata,
          processedFrameLimit: frames.length,
        },
        frames,
        groundTruthMasks: new Map<number, GroundTruthMask>(),
        createdAt: new Date().toISOString(),
      },
      resourceWarning,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
