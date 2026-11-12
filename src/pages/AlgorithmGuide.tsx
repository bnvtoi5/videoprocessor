import React, { useState } from 'react';
import { BookOpen, Code2, Copy, Check, FileCode } from 'lucide-react';

// Real source files imported directly via Vite ?raw for verifiable code inspection
import opticalFlowRaw from '../algorithms/stabilization/opticalFlow.ts?raw';
import ransacRaw from '../algorithms/stabilization/ransac.ts?raw';
import trajectoryRaw from '../algorithms/stabilization/trajectory.ts?raw';
import stabilizationPipelineRaw from '../algorithms/stabilization/stabilizationPipeline.ts?raw';
import eccRaw from '../algorithms/stabilization/ecc.ts?raw';
import frameDifferenceRaw from '../algorithms/background/frameDifference.ts?raw';
import mog2Raw from '../algorithms/background/mog2.ts?raw';
import sampleKnnRaw from '../algorithms/background/sampleKnn.ts?raw';
import morphologyRaw from '../algorithms/background/morphology.ts?raw';
import foregroundExtractionRaw from '../algorithms/background/foregroundExtraction.ts?raw';
import segmentationMetricsRaw from '../evaluation/segmentationMetrics.ts?raw';
import stabilizationMetricsRaw from '../evaluation/stabilizationMetrics.ts?raw';
import researchExperimentsRaw from '../evaluation/researchExperiments.ts?raw';

interface AlgorithmSpecDoc {
  code: string;
  name: string;
  category: string;
  sourceFile: string;
  inputSpec: string;
  outputSpec: string;
  description: string;
  principle: string;
  pipelineSteps: string[];
  parameters: { name: string; desc: string }[];
  pros: string[];
  cons: string[];
  suitableCases: string;
  practicalLimitations: string;
}

interface SourceFileEntry {
  id: string;
  path: string;
  module: string;
  summary: string;
  code: string;
}

const SOURCE_FILES: SourceFileEntry[] = [
  {
    id: 'opticalFlow',
    path: 'src/algorithms/stabilization/opticalFlow.ts',
    module: 'Branch A · Stabilization',
    summary:
      'ITU-R BT.601 luminance conversion, Shi–Tomasi corner detection, and Pyramidal Lucas–Kanade optical flow tracking.',
    code: opticalFlowRaw,
  },
  {
    id: 'ransac',
    path: 'src/algorithms/stabilization/ransac.ts',
    module: 'Branch A · Stabilization',
    summary:
      '2D 4-DOF Similarity Transform estimation with Random Sample Consensus (RANSAC) outlier rejection.',
    code: ransacRaw,
  },
  {
    id: 'trajectory',
    path: 'src/algorithms/stabilization/trajectory.ts',
    module: 'Branch A · Stabilization',
    summary:
      'Cumulative camera trajectory integration, Gaussian kernel smoothing (D0), and Boxcar Moving-Average smoothing (D3).',
    code: trajectoryRaw,
  },
  {
    id: 'stabilizationPipeline',
    path: 'src/algorithms/stabilization/stabilizationPipeline.ts',
    module: 'Branch A · Stabilization',
    summary:
      'End-to-end stabilization pipeline, inverse 2×3 affine corrective geometric warping, and border zoom compensation.',
    code: stabilizationPipelineRaw,
  },
  {
    id: 'ecc',
    path: 'src/algorithms/stabilization/ecc.ts',
    module: 'Branch A · Stabilization',
    summary:
      'Enhanced Correlation Coefficient (ECC) whole-image photometric Euclidean alignment with identity fallback.',
    code: eccRaw,
  },
  {
    id: 'frameDifference',
    path: 'src/algorithms/background/frameDifference.ts',
    module: 'Branch B · Background Separation',
    summary:
      'Absolute Frame Differencing with First-Frame, Temporal Median, and Exponential Running Average reference models.',
    code: frameDifferenceRaw,
  },
  {
    id: 'mog2',
    path: 'src/algorithms/background/mog2.ts',
    module: 'Branch B · Background Separation',
    summary:
      'Adaptive Gaussian Mixture Model (MOG2) background subtraction with chromatic/luminance shadow rejection.',
    code: mog2Raw,
  },
  {
    id: 'sampleKnn',
    path: 'src/algorithms/background/sampleKnn.ts',
    module: 'Branch B · Background Separation',
    summary:
      'Project Sample-based K-Nearest Neighbor non-parametric background subtractor in TypeScript.',
    code: sampleKnnRaw,
  },
  {
    id: 'morphology',
    path: 'src/algorithms/background/morphology.ts',
    module: 'Branch B · Morphology & Components',
    summary:
      '3×3 Gaussian blur, Morphological Opening/Closing, 8-connectivity flood-fill labeling, and pre/post component counting.',
    code: morphologyRaw,
  },
  {
    id: 'foregroundExtraction',
    path: 'src/algorithms/background/foregroundExtraction.ts',
    module: 'Branch B · Pipeline Orchestration',
    summary:
      'End-to-end background separation pipeline, foreground/background compositing, and bounding box overlay.',
    code: foregroundExtractionRaw,
  },
  {
    id: 'segmentationMetrics',
    path: 'src/evaluation/segmentationMetrics.ts',
    module: 'Evaluation & Metrics',
    summary:
      'CDnet 2014 confusion matrix (TP, FP, TN, FN), IoU, Precision, Recall, F1, PWC, Mask Flicker, and Pixel Difference Masks |M_variant - M_D0|.',
    code: segmentationMetricsRaw,
  },
  {
    id: 'stabilizationMetrics',
    path: 'src/evaluation/stabilizationMetrics.ts',
    module: 'Evaluation & Metrics',
    summary:
      'Second-order finite difference Jitter RMS, Re-measured Output Residual Jitter RMS, and Ground-Truth Trajectory RMSE.',
    code: stabilizationMetricsRaw,
  },
  {
    id: 'researchExperiments',
    path: 'src/evaluation/researchExperiments.ts',
    module: 'Research Protocol Engine',
    summary:
      'Traceable execution of Groups A, B, C, D (Ablation D0–D6 with D3 Boxcar vs D4 No-Warp), and Group E Parameter Sensitivity.',
    code: researchExperimentsRaw,
  },
];

const ALGORITHM_DOCS: AlgorithmSpecDoc[] = [
  {
    code: 'A1',
    name: 'Sparse Optical Flow (Pyramidal Lucas–Kanade) + 2D Similarity RANSAC + Trajectory Filtering',
    category: 'Branch A: Video Stabilization',
    sourceFile:
      'src/algorithms/stabilization/opticalFlow.ts, ransac.ts, trajectory.ts, stabilizationPipeline.ts',
    inputSpec: 'Sequence of RGBA frames I(x, y, t) ∈ [0, 255]^{W×H×4}, t = 0..N-1',
    outputSpec:
      'Motion-compensated stabilized sequence I_stab(x, y, t), raw trajectory P(t), smoothed trajectory S(t), RANSAC inlier ratios, and re-measured output residual jitter RMS.',
    description:
      'Feature-based parametric camera stabilization that detects high-gradient Shi–Tomasi corner landmarks, tracks inter-frame displacements across Gaussian pyramids, rejects moving foreground outliers via 2D Similarity RANSAC, filters the cumulative trajectory (Gaussian D0 or Boxcar Moving-Average D3), and applies corrective affine warping.',
    principle:
      'Minimizes local photometric residual ∑[I(x+u, t) - I(x, t-1)]² over a spatial neighborhood around Shi–Tomasi corners (min(λ1, λ2) > τ_q), solves for a 4-DOF 2D Similarity Transform (dx, dy, dθ, s) via RANSAC consensus, convolves cumulative trajectory P(t) = ∑ ΔT(k) with a 1D low-pass kernel K_R, and warps via ΔM(t) = S(t) - P(t).',
    pipelineSteps: [
      'Convert RGBA frame to 8-bit ITU-R BT.601 luminance grayscale',
      'Detect Shi–Tomasi corners (cv.goodFeaturesToTrack / detectAndTrackOpticalFlow)',
      'Track corners via Pyramidal Lucas–Kanade (cv.calcOpticalFlowPyrLK)',
      'Classify background inliers vs foreground outliers via 2D Similarity RANSAC',
      'Accumulate inter-frame camera trajectory P(t) = ∑ ΔT(k)',
      'Smooth trajectory via Gaussian kernel (D0) or Moving-Average Boxcar filter (D3)',
      'Apply inverse affine corrective warp (warpFrameAffineRgba) with border cropRatio',
      'Re-measure actual residual camera motion directly on stabilized output frames',
    ],
    parameters: [
      {
        name: 'maxCorners',
        desc: 'Maximum number of Shi–Tomasi corners to track per frame (40–400).',
      },
      {
        name: 'qualityLevel',
        desc: 'Minimum eigenvalue threshold relative to strongest image corner.',
      },
      {
        name: 'minDistance',
        desc: 'Minimum Euclidean spacing (px) between detected corners.',
      },
      {
        name: 'ransacThreshold',
        desc: 'Maximum reprojection residual (px) for a flow vector to be classified as a background inlier.',
      },
      {
        name: 'smoothingRadius',
        desc: 'Temporal filter window radius R (frames, swept over 3, 6, 10, 15, 20 in Group E).',
      },
      {
        name: 'trajectoryMode',
        desc: 'Smoothing filter type: gaussian_smooth (D0) | moving_average (D3) | rigid_lock | zero_correction.',
      },
    ],
    pros: [
      'High computational throughput suitable for real-time WebAssembly execution',
      'RANSAC explicitly isolates moving foreground objects from camera motion estimation',
      'Distinguishes estimated trajectory smoothness from actual re-measured output residual motion',
    ],
    cons: [
      'Requires sufficient corner texture in the static background',
      'Can degrade under severe motion blur or scene-filling moving objects',
    ],
    suitableCases:
      'Hand-held camera shake, UAV/drone vibration, outdoor and laboratory scenes with structural corners and moving foreground targets.',
    practicalLimitations:
      'Models 2D planar similarity transformation; cannot compensate for 3D perspective parallax near close-range depth discontinuities.',
  },
  {
    code: 'A2',
    name: 'Enhanced Correlation Coefficient (ECC) Direct Photometric Stabilization',
    category: 'Branch A: Video Stabilization',
    sourceFile: 'src/algorithms/stabilization/ecc.ts',
    inputSpec: 'Consecutive grayscale frames Y(x, y, t-1) and Y(x, y, t)',
    outputSpec:
      'Euclidean warp parameters (dx, dy, dθ), convergence rate, and stabilized frames.',
    description:
      'Direct photometric whole-image alignment that maximizes the zero-mean normalized cross-correlation (ECC) between consecutive frames under a 3-DOF Euclidean motion model.',
    principle:
      'Maximizes E_ECC(p) = (i_r^T · i_w(p)) / (||i_r|| · ||i_w(p)||) using forward-additive / inverse-compositional Gauss–Newton optimization over whole-image spatial gradients.',
    pipelineSteps: [
      'Convert consecutive frames to grayscale',
      'Normalize zero-mean intensity templates over interior ROI',
      'Iteratively solve Gauss–Newton Jacobian update for Euclidean warp (dx, dy, dθ)',
      'Check convergence epsilon; fallback to Identity Matrix I if non-convergent',
      'Accumulate and Gaussian-smooth Euclidean trajectory',
      'Warp frame via inverse affine transformation',
    ],
    parameters: [
      {
        name: 'eccIterations',
        desc: 'Maximum Gauss–Newton iterations per frame pair.',
      },
      {
        name: 'eccEps',
        desc: 'Parameter step convergence threshold (1e-2 to 1e-4).',
      },
      {
        name: 'cropRatio',
        desc: 'Border zoom factor to conceal undefined warp boundaries.',
      },
    ],
    pros: [
      'Invariant to global additive and multiplicative illumination changes due to zero-mean normalization',
      'Does not depend on discrete corner detection thresholds',
    ],
    cons: [
      'Higher computational cost per frame than sparse optical flow',
      'Smaller basin of convergence; large abrupt jumps may trigger identity fallback',
    ],
    suitableCases:
      'High-precision alignment of moderate-jitter sequences with gradual lighting shifts.',
    practicalLimitations:
      'Large moving foreground objects can bias whole-image correlation if they occupy a major fraction of the frame.',
  },
  {
    code: 'B1',
    name: 'Absolute Frame Differencing (Static / Median / Adaptive Running Reference)',
    category: 'Branch B: Background & Foreground Separation',
    sourceFile: 'src/algorithms/background/frameDifference.ts',
    inputSpec: 'Grayscale luminance sequence Y(x, y, t) and reference configuration',
    outputSpec:
      'Raw binary foreground mask M_raw(x, y, t) ∈ {0, 255} and reconstructed background B(x, y, t).',
    description:
      'Baseline spatiotemporal change detector that measures pixel-wise absolute luminance deviation from a reference background image.',
    principle:
      'Computes D(x,y,t) = |I(x,y,t) - B(x,y,t)| and classifies pixel (x,y) as Foreground (255) if D(x,y,t) ≥ T, where B is initialized from I_0, temporal median of first N frames, or exponential running average.',
    pipelineSteps: [
      'Construct reference background B(x,y) via First Frame, Temporal Median, or Running Average',
      'Convert incoming frame I(x,y,t) to grayscale',
      'Compute absolute difference |I(x,y,t) - B(x,y,t)|',
      'Apply binary threshold T → {0, 255}',
      'Pass raw mask to Morphological & Connected-Component pipeline',
    ],
    parameters: [
      { name: 'threshold', desc: 'Luminance difference cutoff T (1–254).' },
      {
        name: 'referenceMode',
        desc: 'First frame, temporal median of first N frames, or running average.',
      },
      { name: 'adaptiveAlpha', desc: 'Running average adaptation rate α.' },
    ],
    pros: [
      'Fastest O(W·H) execution with minimal memory footprint',
      'Zero warm-up delay when using first-frame reference on static scenes',
    ],
    cons: [
      'Fails under global or local illumination changes',
      'Sensitive to dynamic background textures and camera jitter',
    ],
    suitableCases:
      'Controlled indoor laboratory lighting with strictly fixed camera and static background.',
    practicalLimitations:
      'Cannot separate cast shadows from true foreground objects.',
  },
  {
    code: 'B2',
    name: 'MOG2 (Adaptive Gaussian Mixture Model) + Morphological Component Pipeline',
    category: 'Branch B: Background & Foreground Separation',
    sourceFile: 'src/algorithms/background/mog2.ts, morphology.ts',
    inputSpec:
      'RGBA / Luminance frame sequence I(x, y, t) and Mog2Params + MorphologyConfig',
    outputSpec:
      'Raw mask M_raw, cleaned mask M_clean, pre/post morphology component counts (rawComponentCount vs componentCount), and object bounding boxes.',
    description:
      'Parametric probabilistic background model representing each pixel as a mixture of K adaptive Gaussian distributions (Zivkovic 2004), followed by 3×3 Gaussian smoothing, Morphological Opening/Closing, and 8-connectivity area filtering.',
    principle:
      'Models P(I(x,y,t)) = ∑_{k=1..K} w_k · N(μ_k, σ_k²). Incoming pixel values within varThreshold of a dominant Gaussian update its parameters via learning rate α; unmatched values are classified as Foreground (255) or Shadow (127 → 0).',
    pipelineSteps: [
      'Initialize per-pixel Gaussian mixture distributions',
      'Evaluate Mahalanobis squared distance against active Gaussians (swept over 8, 16, 25, 36, 50 in Group E)',
      'Update matched Gaussian weights, means, and variances',
      'Count pre-morphology connected components (rawComponentCount)',
      'Apply 3×3 Gaussian blur + Opening + Closing + minComponentArea filter',
      'Extract validated connected components (componentCount) and bounding boxes',
    ],
    parameters: [
      {
        name: 'history',
        desc: 'Number of trailing frames governing auto learning rate α ≈ 1/History.',
      },
      {
        name: 'varThreshold',
        desc: 'Squared Mahalanobis distance threshold for Gaussian match (8, 16, 25, 36, 50).',
      },
      {
        name: 'learningRate',
        desc: 'Explicit adaptation speed α for background drift.',
      },
      {
        name: 'detectShadows',
        desc: 'Enables 3-state output (0 = BG, 127 = Shadow, 255 = FG).',
      },
      {
        name: 'minComponentArea',
        desc: 'Minimum connected component pixel area retained after morphology.',
      },
    ],
    pros: [
      'Handles multi-modal backgrounds and gradual illumination changes',
      'Explicitly identifies and separates cast shadows from moving objects',
    ],
    cons: [
      'Slow-moving objects that pause may be absorbed into the background model',
      'Requires stabilization (Flow B / D0) when camera is non-stationary',
    ],
    suitableCases:
      'Outdoor surveillance, variable lighting scenes, and sequences with cast shadows.',
    practicalLimitations:
      'Sensitive to uncompensated camera shake unless preceded by stabilization warping.',
  },
  {
    code: 'B3',
    name: 'Project Sample-based KNN Background Subtractor (TypeScript)',
    category: 'Branch B: Background & Foreground Separation',
    sourceFile: 'src/algorithms/background/sampleKnn.ts',
    inputSpec: 'Luminance sequence Y(x, y, t) and SampleKnnParams (N, K, R, α)',
    outputSpec:
      'Binary foreground mask M_raw(x, y, t) and reconstructed sample median background.',
    description:
      'Non-parametric sample consensus background model implemented in TypeScript that stores a historical bank of N observed intensity samples per pixel.',
    principle:
      'Classifies pixel I(x,y,t) as Background if at least K samples in {S_1, ..., S_N} satisfy |I(x,y,t) - S_i| ≤ R. Background pixels stochastically replace historical sample slots according to learningRate.',
    pipelineSteps: [
      'Populate per-pixel N-sample history bank from initial frames',
      'Count number of historical samples within distance threshold R',
      'If count ≥ K → Background (0); else → Foreground (255)',
      'Update sample bank ring buffer using stochastic learning rate',
      'Apply morphological noise removal and component labeling',
    ],
    parameters: [
      {
        name: 'numSamples',
        desc: 'Number of historical samples N stored per pixel.',
      },
      {
        name: 'kNeighbors',
        desc: 'Minimum number of close samples K required for background classification.',
      },
      {
        name: 'distanceThreshold',
        desc: 'Maximum intensity difference R for a sample match.',
      },
      {
        name: 'learningRate',
        desc: 'Update probability for refreshing historical samples.',
      },
    ],
    pros: [
      'Non-parametric: makes no Gaussian bell-curve assumption on pixel noise',
      'Fast adaptation to dynamic textures and illumination ramps',
    ],
    cons: [
      'Memory scales linearly with N × W × H',
      'Operates on luminance channel for browser RAM efficiency',
    ],
    suitableCases:
      'Scenes with non-Gaussian sensor noise or gradual ambient lighting transitions.',
    practicalLimitations:
      'Explicitly documented as this project’s TypeScript Sample-based KNN implementation, distinct from OpenCV C++ native BackgroundSubtractorKNN.',
  },
];

export const AlgorithmGuide: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>(SOURCE_FILES[0].id);
  const [copied, setCopied] = useState<boolean>(false);

  const activeSourceFile =
    SOURCE_FILES.find((f) => f.id === selectedFileId) ?? SOURCE_FILES[0];

  const handleCopySource = () => {
    navigator.clipboard?.writeText(activeSourceFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div data-testid="methodology-source-page" className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700">
          <BookOpen className="w-4 h-4" />
          <span>SƠ ĐỒ THƯ MỤC CODE, ÁNH XẠ BỘ LỌC DSP & HƯỚNG DẪN CÀI ĐẶT MÁY TÍNH</span>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mt-1">
          Thư Mục Chứa Bộ Lọc Thuật Toán & Hướng Dẫn Cài Đặt Chạy Offline Trên Máy Tính
        </h1>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
          Tra cứu nhanh từng bộ lọc xử lý tín hiệu số (DSP) nằm ở file nào, hàm nào trong thư mục <code className="font-mono font-bold text-blue-700">src/</code> và cách cài đặt chạy trực tiếp trên máy tính cá nhân.
        </p>
      </div>

      {/* SECTION A: Easy Local PC Installation Guide + Folder-to-Filter Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 5 Cols: Step-by-Step PC Setup Guide */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            1. Hướng Dẫn Cài Đặt & Chạy Trên Máy Tính (Windows / macOS / Linux)
          </h2>
          <p className="text-xs text-slate-600">
            Phần mềm hoạt động độc lập 100% trên trình duyệt bằng WebAssembly (không cần cài Python, không cần GPU hay máy chủ backend).
          </p>

          <div className="space-y-2.5 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3">
              <div className="font-bold text-slate-900">
                Bước 1: Cài đặt Node.js (chỉ cần cài 1 lần)
              </div>
              <div className="text-slate-600 mt-0.5">
                Tải và cài <strong>Node.js (bản LTS 18 trở lên)</strong> tại{' '}
                <code className="font-mono text-blue-700">https://nodejs.org</code>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3">
              <div className="font-bold text-slate-900">
                Bước 2: Cài đặt thư viện của dự án
              </div>
              <div className="text-slate-600 mt-0.5">
                Mở Terminal / Command Prompt tại thư mục chứa code và chạy:
              </div>
              <pre className="mt-1.5 bg-white border border-slate-300 px-3 py-2 font-mono text-xs text-blue-800 font-bold">
                npm install
              </pre>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3">
              <div className="font-bold text-slate-900">
                Bước 3: Khởi động phần mềm
              </div>
              <pre className="mt-1.5 bg-white border border-slate-300 px-3 py-2 font-mono text-xs text-emerald-800 font-bold">
                npm run dev
              </pre>
              <div className="text-slate-600 mt-1">
                Sau đó mở trình duyệt tại địa chỉ{' '}
                <code className="font-mono font-bold text-slate-900">
                  http://localhost:3000
                </code>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3">
              <div className="font-bold text-slate-900">
                Kiểm tra Unit Test các bộ lọc DSP (Tùy chọn)
              </div>
              <pre className="mt-1.5 bg-white border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800">
                npx tsx --test tests/algorithms.test.ts
              </pre>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Explicit Directory & Filter Mapping Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            2. Bảng Tra Cứu Thư Mục Code Chứa Từng Bộ Lọc & Thuật Toán
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-300 text-slate-800 font-bold">
                  <th className="py-2 px-2.5">Nhóm Bộ Lọc / Thuật Toán</th>
                  <th className="py-2 px-2.5">Đường Dẫn File Code</th>
                  <th className="py-2 px-2.5">Hàm Chính (Function)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Chuyển ảnh xám ITU-R BT.601 & Phát hiện góc Shi–Tomasi + PyrLK Optical Flow
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/stabilization/opticalFlow.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    rgbaToGrayscale(), detectAndTrackOpticalFlow()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Bộ lọc loại bỏ ngoại lai 2D Similarity RANSAC (4-DOF)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/stabilization/ransac.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    estimateSimilarityRansac()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Bộ lọc làm mượt quỹ đạo Gaussian (D0) & Trung bình trượt Boxcar (D3)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/stabilization/trajectory.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    gaussianSmooth1D(), movingAverageSmooth1D()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Bù chuyển động hình học Affine 2×3 (Corrective Warp)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/stabilization/stabilizationPipeline.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    warpFrameAffineRgba(), runStabilizationPipeline()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Căn chỉnh trực tiếp cường độ sáng ECC (Euclidean)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/stabilization/ecc.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    estimateEccTransform()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Tách nền Sai khác khung hình (Frame Differencing B1)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/background/frameDifference.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    computeFrameDifferenceMasks()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Tách nền Hỗn hợp Gaussian thích nghi + Khử bóng (MOG2 B2)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/background/mog2.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    computeMog2Masks()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Tách nền Phi tham số lân cận mẫu (Sample-based KNN B3)
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/background/sampleKnn.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    computeSampleKnnMasks()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Bộ lọc Gaussian 3×3, Hình thái học (Opening/Closing) & Đếm vùng nhiễu
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/algorithms/background/morphology.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    gaussianBlur3x3(), morphologicalOpen(), morphologicalClose(), postProcessForegroundMask()
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    Chạy Nghiệm Thu Đa Video & Ablation D0–D6
                  </td>
                  <td className="py-2 px-2.5 font-mono text-blue-700">
                    src/evaluation/researchExperiments.ts
                  </td>
                  <td className="py-2 px-2.5 font-mono text-slate-700">
                    runAblationComboSlot(), runExperimentGroupD_Ablation()
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Real Source Code Explorer */}
      <div
        data-testid="real-source-code-explorer"
        className="bg-white border border-slate-200 p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-700">
              <Code2 className="w-4 h-4" />
              <span>TRÌNH XEM MÃ NGUỒN TRỰC TIẾP TRONG DỰ ÁN ({SOURCE_FILES.length} FILE CỐT LÕI)</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Bấm vào từng file bên trái để xem nội dung code thật
            </h2>
          </div>

          <button
            type="button"
            onClick={handleCopySource}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã sao chép code</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy File Code</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* File Tree List */}
          <div className="lg:col-span-4 space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {SOURCE_FILES.map((file) => {
              const isSelected = file.id === activeSourceFile.id;
              return (
                <button
                  key={file.id}
                  type="button"
                  data-testid={`source-file-btn-${file.id}`}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`w-full text-left p-2.5 border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span
                      className={
                        isSelected ? 'text-blue-100' : 'text-blue-700 font-bold'
                      }
                    >
                      {file.module}
                    </span>
                    <FileCode className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <div className="text-xs font-mono font-bold truncate mt-0.5">
                    {file.path}
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 line-clamp-2 ${
                      isSelected ? 'text-blue-50' : 'text-slate-600'
                    }`}
                  >
                    {file.summary}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Light-Themed Code Viewer */}
          <div className="lg:col-span-8 bg-slate-50 border border-slate-200 text-slate-900 overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-blue-800 font-bold">
                {activeSourceFile.path}
              </span>
              <span className="text-slate-600">
                {activeSourceFile.code.split('\n').length} dòng · TypeScript
              </span>
            </div>
            <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-[460px] overflow-y-auto text-slate-800 bg-white">
              <code>
                {activeSourceFile.code
                  .split('\n')
                  .map(
                    (line, idx) =>
                      `${String(idx + 1).padStart(3, ' ')} | ${line}`
                  )
                  .join('\n')}
              </code>
            </pre>
          </div>
        </div>
      </div>

      {/* Detailed Algorithm Cards */}
      <div className="space-y-4">
        {ALGORITHM_DOCS.map((alg) => (
          <div
            key={alg.code}
            className="bg-white border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-blue-700">
                  {alg.code} · {alg.category}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  {alg.name}
                </h2>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 text-xs font-mono text-slate-800">
                Source: {alg.sourceFile}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2.5">
                <div>
                  <div className="font-bold text-slate-800">Overview</div>
                  <p className="text-slate-600 leading-relaxed mt-0.5">
                    {alg.description}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 p-2.5">
                    <div className="font-bold text-slate-800">Input Tensor</div>
                    <p className="font-mono text-[11px] text-slate-700 mt-0.5">
                      {alg.inputSpec}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2.5">
                    <div className="font-bold text-slate-800">Output Artifacts</div>
                    <p className="font-mono text-[11px] text-slate-700 mt-0.5">
                      {alg.outputSpec}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">
                    Mathematical Formulation
                  </div>
                  <p className="text-blue-950 font-mono text-[11px] bg-blue-50/60 border border-blue-200 p-2.5 mt-1 leading-relaxed">
                    {alg.principle}
                  </p>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-800 mb-1.5">
                  Step-by-Step DSP Execution Flowchart
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {alg.pipelineSteps.map((step, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200 px-2.5 py-2 text-[11px] text-slate-800 flex items-center gap-2"
                    >
                      <span className="font-mono font-bold text-blue-700 shrink-0">
                        0{i + 1}.
                      </span>
                      <span className="truncate" title={step}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Parameters, Pros/Cons, and Practical Limitations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-200 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="font-bold text-slate-800 mb-2">
                  Key Tunable Parameters
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-700">
                  {alg.parameters.map((p) => (
                    <li key={p.name}>
                      <code className="text-blue-700 font-mono font-bold">
                        {p.name}
                      </code>
                      : {p.desc}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div>
                  <div className="font-bold text-emerald-700 mb-1">
                    Advantages
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                    {alg.pros.map((pr, idx) => (
                      <li key={idx}>{pr}</li>
                    ))}
                  </ul>
                </div>
                <div className="pt-1 border-t border-slate-200">
                  <div className="font-bold text-amber-700 mb-1">
                    Disadvantages
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                    {alg.cons.map((cn, idx) => (
                      <li key={idx}>{cn}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div>
                  <div className="font-bold text-slate-800 mb-1">
                    Recommended Use Cases
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    {alg.suitableCases}
                  </p>
                </div>
                <div className="pt-1 border-t border-slate-200">
                  <div className="font-bold text-rose-700 mb-1">
                    Practical Limitations
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    {alg.practicalLimitations}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
