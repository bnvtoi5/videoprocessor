# ACADEMIC PRESENTATION DEMO SCRIPT (`docs/DEMO_SCRIPT.md`)

## 5-Minute Live Defense & Demonstration Walkthrough

### Part 1: Dashboard & Runtime Verification (1 min)
1. Open the **Dashboard** and point out the **OpenCV.js WebAssembly Runtime Capability Matrix** (`@techstark/opencv-js 5.0.0-release.1`).
2. Highlight the 3 deterministic **Synthetic Demo Scenarios** and scrub the **Loaded Video Sequence & Ground Truth Inspector** slider to show the pixel-aligned binary Ground Truth mask alongside the input frames.

### Part 2: Video Stabilization Lab — LK+RANSAC vs ECC (1 min)
1. Click **Scenario 1: Shaky Camera** -> **Run Experiment** (or navigate to **Stabilization Lab**).
2. Click **Play Sync** to observe `A0. Original` (shaking with overlaid green RANSAC inliers, orange rejected moving-object outliers, and cyan optical flow vectors) synchronized with `A1. Sparse Optical Flow + RANSAC` and `A2. ECC Euclidean Stabilization`.
3. Inspect the **Camera Trajectory Line Charts (X, Y, Roll Angle θ)** and point out the **Translation Jitter RMS** reduction (typically >65% jitter reduction).

### Part 3: Background & Foreground Separation Lab (1 min)
1. Switch to **Scenario 2: Moving Object** or **Scenario 3: Illumination Change** and open **Background Lab**.
2. Click **Compare All 3 Algorithms** to run `B1. Frame Differencing`, `B2. MOG2`, and `B3. Sample-based KNN` on the exact same frames.
3. On Scenario 3 (Illumination Change), show how static `Frame Differencing` suffers severe false positives as ambient lighting drifts, whereas adaptive `MOG2` and `Sample-based KNN` maintain high IoU and F1-Score.
4. Toggle **Before/After: Show Raw Mask Alongside Cleaned** to demonstrate how Morphological Opening/Closing and Connected Components Area filtering eliminate salt noise and isolate moving objects.

### Part 4: Combined Spatiotemporal Pipeline (1 min)
1. Load **Scenario 1: Shaky Camera** and open **Combined Pipeline**.
2. Compare **Flow A (Original Unstabilized Video → Background Subtraction)** against **Flow B (Stabilized Video → Background Subtraction)**.
3. Point out how camera shake in Flow A causes background grid edges to appear as false-positive foreground masks, whereas Flow B stabilizes the frame first and recovers clean foreground extraction.

### Part 5: Benchmark Lab & Academic Report Export (1 min)
1. Open **Benchmark Lab**, select **3 Trial Runs (Median Protocol)**, and click **Run Benchmark Suite**.
2. Sort the Comparison Table by **Highest IoU**, **Lowest Jitter**, and **Fastest (FPS)**, review the 7 Recharts graphs, and click **Export Report HTML** and **Export CSV**.
