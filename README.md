# SPATIOTEMPORAL VIDEO PROCESSING LAB

**Topic:** *"Hệ thống xử lý video không gian–thời gian: Chống rung, tách lọc nền và vật thể, đánh giá sai biệt thuật toán."*  
*(Spatiotemporal Video Processing System: Video Stabilization, Background/Foreground Separation, and Algorithmic Discrepancy Evaluation)*

---

## 1. Project Overview

**SpatioTemporal Video Processing Lab** is a browser-native computer vision research and experimental workbench designed for academic experimentation, algorithm comparison, and technical demonstration. Every video frame is decoded, processed, and quantitatively evaluated directly in the browser using **OpenCV.js WebAssembly (`@techstark/opencv-js` 5.0.0-release.1)** and verified **TypeScript** numerical algorithms.

### Core Capabilities
- **Video Input & Resource Guardrails:** Upload MP4, MOV, or WebM videos with sequential frame decoding, configurable frame count limits, resolution scaling, sampling FPS, progress bar, and cancellation.
- **Module A — Video Stabilization Lab:** Compares Unstabilized Baseline (`A0`), Sparse Pyramidal Lucas-Kanade Optical Flow + 2D Similarity RANSAC (`A1`), and Enhanced Correlation Coefficient Euclidean Stabilization (`A2`).
- **Module B — Background & Foreground Separation Lab:** Compares Absolute Frame Differencing (`B1`), Adaptive Gaussian Mixture Model MOG2 (`B2`), and Project Sample-based KNN (`B3`) across 5 simultaneous views (`Original`, `Binary Mask`, `Overlay`, `Foreground Only`, `Background Only`) with configurable morphological filtering.
- **Module C — Combined Spatiotemporal Pipeline:** Executes dual-flow experiments comparing `Flow A (Original → Background Subtraction)` vs `Flow B (Stabilization → Background Subtraction)` to quantify how camera shake degrades background models and how stabilization restores segmentation accuracy.
- **Module D — Evaluation & Benchmark Lab:** Multi-trial median timing protocol, Ground Truth PNG ZIP import, 7 scientific Recharts visualizations, sortable comparison matrix, and exportable CSV, JSON, and HTML academic reports.
- **Synthetic Demo Generator:** Deterministic test sequences (`Scenario 1: Shaky Camera`, `Scenario 2: Moving Foreground Object`, `Scenario 3: Illumination Change`) with exact pixel-level Ground Truth masks and camera trajectories.

---

## 2. System Architecture

```
src/
  algorithms/
    stabilization/
      opticalFlow.ts          # Grayscale conversion, Shi-Tomasi corners & Pyramidal Lucas-Kanade (OpenCV WASM + TS)
      ransac.ts               # 2D Similarity Transform (dx, dy, dθ, s) RANSAC + Procrustes LS refinement
      ecc.ts                  # Enhanced Correlation Coefficient Euclidean solver with non-convergence fallback
      trajectory.ts           # Cumulative camera trajectory & 1D Gaussian smoothing filter
      stabilizationPipeline.ts# Affine frame warping, border loss calculation & pipeline orchestration
    background/
      frameDifference.ts      # First-frame, temporal median, and running-average Frame Differencing
      mog2.ts                 # OpenCV BackgroundSubtractorMOG2 + 3-state shadow (127) vs foreground (255)
      sampleKnn.ts            # Project TypeScript Sample-based KNN pixel history background model
      morphology.ts           # Gaussian blur, threshold, opening, closing, erosion, dilation & connected components
      foregroundExtraction.ts # 5-mode foreground synthesizer & per-frame evaluation
  core/
    openCvLoader.ts           # Asynchronous OpenCV.js WASM initializer & runtime API capability inspector
    videoDecoder.ts           # HTML5 Video metadata prober & sequential frame extractor with AbortSignal
    videoEncoder.ts           # MediaRecorder video exporter (MP4 priority, WebM fallback)
    workerBridge.ts           # Web Worker task dispatcher with transparent main-thread fallback
    pipelineManager.ts        # 8-stage Combined Spatiotemporal Pipeline manager (Flow A vs Flow B)
  workers/
    videoProcessing.worker.ts # Background Web Worker for non-blocking frame processing
  evaluation/
    stabilizationMetrics.ts   # Second-order finite difference Jitter RMS & acceleration metrics
    segmentationMetrics.ts    # Pixel-level TP, FP, FN, TN, IoU, Precision, Recall, F1 & Temporal Flicker
    performanceMetrics.ts     # Statistical median runtime & throughput breakdown
    benchmarkRunner.ts        # Standardized multi-algorithm benchmark protocol runner
    reportGenerator.ts        # CSV, JSON, and HTML Experiment Summary generators
  demo/
    groundTruthGenerator.ts   # Exact synthetic binary mask generator & Ground Truth PNG .zip loader
    syntheticSceneGenerator.ts# 3 deterministic scenarios (Shaky Camera, Moving Object, Illumination Change)
  components/
    layout/                   # Sidebar, Header
    video/                    # FrameCanvas, VideoInputPanel
    charts/                   # TrajectoryCharts, BenchmarkCharts
    common/                   # MetricCard
  pages/
    Dashboard.tsx
    StabilizationLab.tsx
    BackgroundLab.tsx
    BenchmarkLab.tsx
    CombinedPipeline.tsx
    AlgorithmGuide.tsx
tests/
  algorithms.test.ts          # Deterministic unit tests for all mathematical & CV modules
docs/
  ALGORITHMS.md
  METRICS.md
  TEST_PROTOCOL.md
  DEMO_SCRIPT.md
  REPORT_TEMPLATE.md
```

---

## 3. Dependencies

- **Runtime:** `react`, `react-dom`, `@techstark/opencv-js` (`5.0.0-release.1`), `recharts`, `lucide-react`, `jszip`
- **Build & Dev:** `typescript`, `vite`, `@tailwindcss/vite`, `tailwindcss`, `tsx`

---

## 4. Installation, Running & Building

```bash
# 1. Install dependencies
npm install

# 2. Start development server on port 3000
npm run dev

# 3. Run unit tests
npx --yes tsx --test tests/algorithms.test.ts

# 4. Type-check and build production bundle
npm run lint
npm run build
```

---

## 5. How to Use

1. **Dashboard:** Inspect OpenCV.js WASM capability status. Either upload a local video (`MP4`, `MOV`, `WebM`) or select one of the three **Synthetic Demo Scenarios**.
2. **Stabilization Lab:** Click **Run Stabilization Experiment** to compare Original, Sparse Optical Flow (`LK + RANSAC`), and `ECC`. Toggle feature points, motion vectors, and RANSAC outliers on the canvas, inspect X/Y/θ trajectories, and export stabilized video.
3. **Background Lab:** Select `Frame Differencing`, `MOG2`, or `Sample-based KNN` (or click **Compare All 3 Algorithms**). Inspect the 5 simultaneous views and tune morphological post-processing.
4. **Combined Pipeline:** Execute the 8-stage pipeline to compare `Flow A (Original → BG)` against `Flow B (Stabilized → BG)` on shaky videos.
5. **Benchmark Lab:** Run the standardized benchmark suite (1 or 3 trials), sort the comparison table, analyze the 7 Recharts graphs, and export CSV, JSON, or HTML reports.

---

## 6. Troubleshooting

- **Unsupported Video Codec:** Browsers decode H.264/AVC `.mp4` and VP8/VP9 `.webm` natively. HEVC/H.265 `.mov` files may not decode on browsers without hardware HEVC licenses; transcode to H.264 MP4 if an error banner appears.
- **High Memory Usage on Long 4K Videos:** Keep `Max Processing Width` at `480px` or `640px` and `Frame Count Limit` between `48` and `150` frames for responsive in-browser experimentation.
- **Ground Truth N/A:** Uploaded real-world videos do not have ground truth masks unless you upload a matching `.zip` of binary PNG masks (`0000.png`, `0001.png`, ...) with identical resolution.
