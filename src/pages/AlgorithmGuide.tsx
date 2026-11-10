import React from 'react';
import { BookOpen } from 'lucide-react';

interface AlgorithmSpecDoc {
  code: string;
  name: string;
  category: string;
  description: string;
  principle: string;
  pipelineSteps: string[];
  parameters: { name: string; desc: string }[];
  pros: string[];
  cons: string[];
  suitableCases: string;
  practicalLimitations: string;
}

const ALGORITHM_DOCS: AlgorithmSpecDoc[] = [
  {
    code: 'A1',
    name: 'Sparse Optical Flow (Pyramidal Lucas-Kanade) + 2D Similarity RANSAC',
    category: 'Module A: Video Stabilization',
    description:
      'Feature-based parametric camera stabilization that detects high-gradient corner landmarks, tracks their inter-frame displacements across Gaussian pyramids, rejects moving foreground outliers via RANSAC, and filters the cumulative trajectory.',
    principle:
      'Minimizes local photometric residual ∑[I(x+u, t+1) - I(x, t)]² over a spatial neighborhood around Shi-Tomasi corners (min(λ1, λ2) > τ), then solves for a 4-DOF 2D Similarity Transform (dx, dy, dθ, scale) via random sample consensus and Procrustes least-squares refinement.',
    pipelineSteps: [
      'Convert RGBA frame to 8-bit luminance grayscale',
      'Detect Shi-Tomasi corners (cv.goodFeaturesToTrack)',
      'Track corners via Pyramidal Lucas-Kanade (cv.calcOpticalFlowPyrLK)',
      'Reject out-of-bounds or excessive displacement vectors',
      'Estimate 2D Similarity Transform + RANSAC inlier mask',
      'Accumulate inter-frame camera trajectory P(t) = ∑ ΔT(k)',
      'Convolve trajectory with 1D Gaussian low-pass filter',
      'Apply corrective affine warp (warpAffine) with crop ratio',
    ],
    parameters: [
      { name: 'maxCorners', desc: 'Maximum number of Shi-Tomasi corners to track per frame (40–400).' },
      { name: 'qualityLevel', desc: 'Minimum eigenvalue threshold relative to strongest image corner.' },
      { name: 'minDistance', desc: 'Minimum Euclidean spacing (px) between detected corners.' },
      { name: 'ransacThreshold', desc: 'Maximum reprojection residual (px) for an optical flow vector to be classified as a background inlier.' },
      { name: 'smoothingRadius', desc: 'Temporal Gaussian window radius R (frames) separating intentional panning from high-frequency hand jitter.' },
    ],
    pros: [
      'High computational throughput suitable for real-time browser execution',
      'RANSAC explicitly isolates moving foreground objects from camera motion estimation',
      'Handles simultaneous translation, in-plane roll rotation, and slight zoom',
    ],
    cons: [
      'Requires sufficient corner texture in the static background',
      'Can degrade under severe motion blur or scene-filling moving objects',
    ],
    suitableCases:
      'Hand-held camera shake, UAV/drone vibration, outdoor and laboratory scenes with structural corners and moderate foreground activity.',
    practicalLimitations:
      'Models 2D planar similarity transformation; cannot compensate for 3D perspective parallax when camera translates near close-range depth discontinuities.',
  },
  {
    code: 'A2',
    name: 'Enhanced Correlation Coefficient (ECC) Euclidean Stabilization',
    category: 'Module A: Video Stabilization',
    description:
      'Direct photometric whole-image alignment that maximizes the zero-mean normalized cross-correlation (ECC) between consecutive frames under a 3-DOF Euclidean motion model.',
    principle:
      'Maximizes E_ECC(p) = (i_r^T · i_w(p)) / (||i_r|| · ||i_w(p)||) using forward-additive / inverse-compositional Gauss-Newton optimization over whole-image spatial gradients.',
    pipelineSteps: [
      'Convert consecutive frames to grayscale',
      'Normalize zero-mean intensity templates over interior ROI',
      'Iteratively solve Gauss-Newton Jacobian update for Euclidean warp (dx, dy, dθ)',
      'Check convergence epsilon; fallback to Identity Matrix I if non-convergent',
      'Accumulate and Gaussian-smooth Euclidean trajectory',
      'Warp frame via inverse affine transformation',
    ],
    parameters: [
      { name: 'eccIterations', desc: 'Maximum Gauss-Newton / ICM iterations per frame pair.' },
      { name: 'eccEps', desc: 'Parameter step convergence threshold (1e-2 to 1e-4).' },
      { name: 'cropRatio', desc: 'Border zoom factor to conceal black undefined warp boundaries.' },
    ],
    pros: [
      'Invariant to global additive and multiplicative illumination changes due to zero-mean normalization',
      'Does not depend on discrete corner detection thresholds',
    ],
    cons: [
      'Significantly higher computational cost per frame than sparse optical flow',
      'Smaller basin of convergence; large abrupt jumps may fail to converge and trigger identity fallback',
    ],
    suitableCases:
      'High-precision alignment of moderate-jitter sequences with gradual lighting shifts or low corner counts.',
    practicalLimitations:
      'Large moving foreground objects can bias whole-image correlation if they occupy a major fraction of the frame.',
  },
  {
    code: 'B1',
    name: 'Absolute Frame Differencing (Static / Median / Running Reference)',
    category: 'Module B: Background & Foreground Separation',
    description:
      'Baseline spatiotemporal change detector that measures pixel-wise absolute luminance deviation from a reference background image.',
    principle:
      'Computes D(x,y,t) = |I(x,y,t) - B(x,y,t)| and classifies pixel (x,y) as Foreground (255) if D(x,y,t) ≥ T, where B is initialized from I_0, temporal median of first N frames, or exponential running average.',
    pipelineSteps: [
      'Construct reference background B(x,y) via First Frame or Temporal Median',
      'Convert incoming frame I(x,y,t) to grayscale',
      'Compute absolute difference |I(x,y,t) - B(x,y)|',
      'Apply binary threshold T -> {0, 255}',
      'Execute morphological Opening/Closing and minimum component area filter',
    ],
    parameters: [
      { name: 'threshold', desc: 'Luminance difference cutoff T (1–254).' },
      { name: 'referenceMode', desc: 'First frame, temporal median of first N frames, or running average.' },
      { name: 'adaptiveAlpha', desc: 'Running average adaptation rate α.' },
    ],
    pros: [
      'Extremely fast O(W·H) execution with minimal memory footprint',
      'Zero warm-up delay when using first-frame reference on static scenes',
    ],
    cons: [
      'Fails severely under global or local illumination changes (Scenario 3)',
      'Sensitive to bimodal backgrounds (e.g., swaying foliage, monitor flicker)',
      'Interior of uniform-colored moving objects may exhibit aperture holes',
    ],
    suitableCases:
      'Controlled indoor laboratory lighting with strictly fixed camera and static background.',
    practicalLimitations:
      'Cannot separate cast shadows from true foreground objects.',
  },
  {
    code: 'B2',
    name: 'MOG2 (Adaptive Gaussian Mixture Model)',
    category: 'Module B: Background & Foreground Separation',
    description:
      'Parametric probabilistic background model representing each pixel as a mixture of K adaptive Gaussian distributions (Zivkovic 2004), with explicit chromatic/luminance shadow detection.',
    principle:
      'Models P(I(x,y,t)) = ∑_{k=1..K} w_k · N(μ_k, σ_k²). Incoming pixel values within varThreshold of a dominant Gaussian update its parameters via learning rate α; unmatched values spawn or replace the weakest component.',
    pipelineSteps: [
      'Initialize per-pixel Gaussian mixture distributions',
      'Evaluate Mahalanobis squared distance against active Gaussians',
      'Update matched Gaussian weights, means, and variances',
      'Classify unmatched pixels as Foreground (255) or Shadow (127)',
      'Exclude shadow value (127 -> 0) before binary morphological post-processing',
    ],
    parameters: [
      { name: 'history', desc: 'Number of trailing frames governing auto learning rate α ≈ 1/History.' },
      { name: 'varThreshold', desc: 'Squared Mahalanobis distance threshold for Gaussian match.' },
      { name: 'learningRate', desc: 'Explicit adaptation speed α for background drift.' },
      { name: 'detectShadows', desc: 'Enables 3-state output (0 = BG, 127 = Shadow, 255 = FG).' },
    ],
    pros: [
      'Handles multi-modal backgrounds and gradual illumination changes',
      'Explicitly identifies and separates cast shadows from moving objects',
    ],
    cons: [
      'Slow-moving objects that pause may be absorbed into the background model',
      'Sudden global lighting switches cause temporary full-frame false positives until history adapts',
    ],
    suitableCases:
      'Outdoor surveillance, variable lighting scenes, and sequences with cast shadows.',
    practicalLimitations:
      'Requires a stationary camera (or pre-stabilized video via Module C) to maintain pixel-coordinate correspondence.',
  },
  {
    code: 'B3',
    name: 'Project Sample-based KNN Background Subtractor (TypeScript)',
    category: 'Module B: Background & Foreground Separation',
    description:
      'Non-parametric sample consensus background model implemented in TypeScript that stores a historical bank of N observed intensity samples per pixel.',
    principle:
      'Classifies pixel I(x,y,t) as Background if at least K samples in {S_1, ..., S_N} satisfy |I(x,y,t) - S_i| ≤ R. Background pixels stochastically replace historical sample slots according to learningRate.',
    pipelineSteps: [
      'Populate per-pixel N-sample history bank from initial frames',
      'Count number of historical samples within distance threshold R',
      'If count ≥ K -> Background (0); else -> Foreground (255)',
      'Update sample bank ring buffer using stochastic learning rate',
      'Apply morphological noise removal and component labeling',
    ],
    parameters: [
      { name: 'numSamples', desc: 'Number of historical samples N stored per pixel.' },
      { name: 'kNeighbors', desc: 'Minimum number of close samples K required for background classification.' },
      { name: 'distanceThreshold', desc: 'Maximum intensity difference R for a sample match.' },
      { name: 'learningRate', desc: 'Update probability for refreshing historical samples.' },
    ],
    pros: [
      'Non-parametric: makes no Gaussian bell-curve assumption on pixel noise',
      'Fast adaptation to dynamic textures and illumination ramps',
    ],
    cons: [
      'Memory scales linearly with N × W × H',
      'Project TypeScript implementation operates on luminance channel for browser RAM efficiency',
    ],
    suitableCases:
      'Scenes with non-Gaussian sensor noise or gradual ambient lighting transitions.',
    practicalLimitations:
      'Explicitly documented as this project’s TypeScript Sample-based KNN implementation, distinct from OpenCV C++ native BackgroundSubtractorKNN.',
  },
];

export const AlgorithmGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-[#111827] border border-slate-800 p-5">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <BookOpen className="w-4 h-4" />
          <span>THEORETICAL & METHODOLOGICAL SPECIFICATION</span>
        </div>
        <h1 className="text-lg font-bold text-slate-100 mt-1">
          Algorithm Guide, Mathematical Formulations & Experimental Protocol
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-4xl leading-relaxed">
          Comprehensive reference for every computer vision algorithm, morphological operator, and evaluation metric implemented in the SpatioTemporal Video Processing Lab.
        </p>
      </div>

      {/* Detailed Algorithm Cards */}
      <div className="space-y-4">
        {ALGORITHM_DOCS.map((alg) => (
          <div
            key={alg.code}
            className="bg-[#111827] border border-slate-800 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono text-cyan-400">
                  {alg.code} · {alg.category}
                </span>
                <h2 className="text-base font-bold text-slate-100 mt-0.5">
                  {alg.name}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div>
                  <div className="font-semibold text-slate-200">Overview</div>
                  <p className="text-slate-400 leading-relaxed mt-0.5">
                    {alg.description}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">
                    Mathematical Principle
                  </div>
                  <p className="text-slate-300 font-mono text-[11px] bg-[#0B0E17] border border-slate-800 p-2.5 mt-1 leading-relaxed">
                    {alg.principle}
                  </p>
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-200 mb-1.5">
                  Step-by-Step Execution Flowchart
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {alg.pipelineSteps.map((step, i) => (
                    <div
                      key={i}
                      className="bg-[#0B0E17] border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300 flex items-center gap-2"
                    >
                      <span className="font-mono text-cyan-400 shrink-0">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs">
              <div className="bg-[#0B0E17] border border-slate-800 p-3">
                <div className="font-semibold text-slate-200 mb-2">
                  Key Tunable Parameters
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
                  {alg.parameters.map((p) => (
                    <li key={p.name}>
                      <code className="text-cyan-300 font-mono">{p.name}</code>:{' '}
                      {p.desc}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#0B0E17] border border-slate-800 p-3 space-y-2">
                <div>
                  <div className="font-semibold text-emerald-400 mb-1">
                    Advantages
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                    {alg.pros.map((pr, idx) => (
                      <li key={idx}>{pr}</li>
                    ))}
                  </ul>
                </div>
                <div className="pt-1 border-t border-slate-800/80">
                  <div className="font-semibold text-amber-400 mb-1">
                    Disadvantages
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                    {alg.cons.map((cn, idx) => (
                      <li key={idx}>{cn}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-[#0B0E17] border border-slate-800 p-3 space-y-2">
                <div>
                  <div className="font-semibold text-slate-200 mb-1">
                    Recommended Use Cases
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {alg.suitableCases}
                  </p>
                </div>
                <div className="pt-1 border-t border-slate-800/80">
                  <div className="font-semibold text-rose-400 mb-1">
                    Practical Limitations
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {alg.practicalLimitations}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quantitative Evaluation Metrics Reference */}
      <div className="bg-[#111827] border border-slate-800 p-5 space-y-3 text-xs">
        <h2 className="text-sm font-bold text-slate-100">
          Quantitative Evaluation Metrics & Mathematical Definitions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
          <div className="bg-[#0B0E17] border border-slate-800 p-3">
            <div className="text-cyan-400 font-semibold">
              Intersection over Union (IoU)
            </div>
            <div className="text-slate-200 mt-1">IoU = TP / (TP + FP + FN)</div>
            <p className="font-sans text-[11px] text-slate-400 mt-1">
              Measures exact spatial overlap between predicted foreground and Ground Truth.
            </p>
          </div>
          <div className="bg-[#0B0E17] border border-slate-800 p-3">
            <div className="text-emerald-400 font-semibold">
              Precision & Recall
            </div>
            <div className="text-slate-200 mt-1">
              P = TP/(TP+FP) · R = TP/(TP+FN)
            </div>
            <p className="font-sans text-[11px] text-slate-400 mt-1">
              Quantifies background noise rejection (P) vs object detection completeness (R).
            </p>
          </div>
          <div className="bg-[#0B0E17] border border-slate-800 p-3">
            <div className="text-cyan-400 font-semibold">F1-Score (Dice)</div>
            <div className="text-slate-200 mt-1">
              F1 = 2 · P · R / (P + R)
            </div>
            <p className="font-sans text-[11px] text-slate-400 mt-1">
              Balanced harmonic mean of Precision and Recall; safe against zero-division.
            </p>
          </div>
          <div className="bg-[#0B0E17] border border-slate-800 p-3">
            <div className="text-amber-400 font-semibold">
              Trajectory Jitter RMS
            </div>
            <div className="text-slate-200 mt-1">
              RMS(P(t+1) - 2P(t) + P(t-1))
            </div>
            <p className="font-sans text-[11px] text-slate-400 mt-1">
              Second-order finite difference proxy for high-frequency camera shake roughness.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
