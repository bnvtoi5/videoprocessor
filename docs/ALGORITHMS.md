# ALGORITHMS SPECIFICATION (`docs/ALGORITHMS.md`)

## 1. Runtime Transparency & OpenCV.js WebAssembly Architecture

The application initializes `@techstark/opencv-js` (`5.0.0-release.1`) asynchronously in `src/core/openCvLoader.ts`. Before invoking any OpenCV routine, the runtime capability inspector verifies whether the function exists on the WASM module and ensures all `cv.Mat` buffers are deallocated inside `finally` blocks.

- **Sparse Optical Flow (`A1`):** Uses `cv.goodFeaturesToTrack` and `cv.calcOpticalFlowPyrLK` when OpenCV WASM is active, paired with our explicit TypeScript 2D Similarity RANSAC + Procrustes least-squares solver (`src/algorithms/stabilization/ransac.ts`) because `estimateAffinePartial2D` is not consistently bundled in standard OpenCV.js builds.
- **ECC Stabilization (`A2`):** Checks `typeof cv.findTransformECC === 'function'`. When available, invokes `cv.findTransformECC` with `MOTION_EUCLIDEAN`; if unavailable or if a frame fails to converge, uses our TypeScript Inverse-Compositional / Gauss-Newton Euclidean ECC solver and safely falls back to the identity transform on non-convergent frames.
- **MOG2 (`B2`):** Uses `new cv.BackgroundSubtractorMOG2(history, varThreshold, detectShadows)` when supported by the runtime, distinguishing Background (`0`), Shadow (`127`), and Foreground (`255`).
- **Sample-based KNN (`B3`):** Explicitly implemented and labeled as **Project Sample-based KNN (TypeScript)** (`src/algorithms/background/sampleKnn.ts`), as standard OpenCV.js builds omit `BackgroundSubtractorKNN`.

---

## 2. Module A: Video Stabilization Algorithms

### A1. Sparse Optical Flow (Pyramidal Lucas-Kanade) + 2D Similarity RANSAC
1. **Grayscale Conversion:** Converts RGBA frame to 8-bit ITU-R BT.601 luminance $I(x, y, t)$.
2. **Feature Detection:** Identifies strong corners where the minimum eigenvalue of the $2 \times 2$ structure tensor exceeds `qualityLevel * maxEigenvalue`, separated by at least `minDistance` pixels.
3. **Pyramidal Lucas-Kanade Tracking:** Tracks corners from $I_{t-1}$ to $I_t$ across Gaussian pyramid levels.
4. **2D Similarity RANSAC:** Estimates the 4-DOF transformation:
   $$\begin{bmatrix} x' \\ y' \end{bmatrix} = s \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix} \begin{bmatrix} x \\ y \end{bmatrix} + \begin{bmatrix} t_x \\ t_y \end{bmatrix}$$
   Randomly samples 2-point minimal subsets, counts inliers within `ransacThreshold` pixels, and refines $(t_x, t_y, \theta, s)$ over all inliers via closed-form Procrustes least squares.
5. **Trajectory Accumulation & Gaussian Smoothing:** Accumulates camera trajectory $P(t) = \sum_{k=1}^t \Delta T(k)$ and convolves with a normalized 1D Gaussian kernel $G_\sigma$ of radius $R$ (`smoothingRadius`).
6. **Corrective Affine Warp:** Warps frame $t$ by $\Delta C(t) = P_{\text{smooth}}(t) - P_{\text{raw}}(t)$ with optional border crop compensation `cropRatio`.

### A2. Enhanced Correlation Coefficient (ECC) Stabilization
1. Normalizes zero-mean intensities over the interior image region to achieve invariance to linear illumination shifts.
2. Optimizes the 3-DOF Euclidean motion parameters $(t_x, t_y, \theta)$ maximizing zero-mean normalized cross-correlation.
3. If an iteration diverges or fails to converge within `eccIterations`, records the frame in `eccFailedFrames` and applies an identity transform fallback so execution never crashes.

---

## 3. Module B: Background & Foreground Separation Algorithms

### B1. Frame Differencing
- Supports three background reference modes:
  1. **First Frame ($I_0$)**
  2. **Temporal Median of First $N$ Frames**
  3. **Exponential Running Average:** $B_t = (1 - \alpha)B_{t-1} + \alpha I_t$
- Computes $M(x,y,t) = 255 \text{ if } |I(x,y,t) - B(x,y,t)| \ge T \text{ else } 0$.

### B2. MOG2 (Adaptive Gaussian Mixture Model)
- Models each pixel's history as a mixture of adaptive Gaussians.
- When `detectShadows = true`, shadow pixels are encoded as `127` and foreground pixels as `255`. During binary foreground extraction and IoU evaluation, shadow pixels (`127`) are separated from foreground (`0`), preventing cast shadows from inflating false positives.

### B3. Project Sample-based KNN (TypeScript)
- Stores $N$ historical luminance samples $\{S_1, \dots, S_N\}$ per pixel.
- Counts how many samples satisfy $|I(x,y,t) - S_i| \le R$ (`distanceThreshold`).
- If count $\ge K$ (`kNeighbors`), the pixel is classified as Background (`0`); otherwise Foreground (`255`).
- Background samples are stochastically refreshed according to `learningRate`.

---

## 4. Morphological Processing & Connected Components

Applied sequentially when enabled in `src/algorithms/background/morphology.ts`:
1. **Gaussian Blur** ($3 \times 3$ or $5 \times 5$)
2. **Binary Re-Thresholding**
3. **Morphological Opening** ($\text{Dilation}(\text{Erosion}(M))$) — removes isolated salt noise.
4. **Morphological Closing** ($\text{Erosion}(\text{Dilation}(M))$) — closes small internal foreground apertures.
5. **Erosion / Dilation Passes**
6. **8-Connected Components Filtering:** Removes blobs with area $< \text{minComponentArea}$ and extracts bounding boxes labeled strictly as `Moving Obj #k`.
