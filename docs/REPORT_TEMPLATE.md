# ACADEMIC EXPERIMENT REPORT TEMPLATE (`docs/REPORT_TEMPLATE.md`)

**Title:** Hệ thống xử lý video không gian–thời gian: Chống rung, tách lọc nền và vật thể, đánh giá sai biệt thuật toán  
*(Spatiotemporal Video Processing System: Video Stabilization, Background/Foreground Separation, and Algorithmic Discrepancy Evaluation)*

---

## 1. Introduction
- Context of spatiotemporal video processing in moving-camera surveillance, autonomous robotics, and scientific instrumentation.
- Problem statement: Camera jitter corrupts pixel-wise background models, requiring a unified framework to evaluate video stabilization, background/foreground separation, and their coupled pipeline interaction.

## 2. Theoretical Background
- **2.1 Sparse Optical Flow & Parametric RANSAC:** Shi-Tomasi structure tensor corners, Pyramidal Lucas-Kanade optical flow equation $I_x u + I_y v + I_t = 0$, and 2D Similarity Transform Procrustes estimation.
- **2.2 Direct Photometric Alignment (ECC):** Zero-mean normalized cross-correlation objective function and Euclidean warp Jacobian optimization.
- **2.3 Spatiotemporal Background Modeling:** Absolute Frame Differencing, Adaptive Gaussian Mixture Models (MOG2) with chromatic/luminance shadow separation, and Non-parametric Sample-based KNN.
- **2.4 Mathematical Morphology:** Erosion, Dilation, Opening, Closing, and 8-connected components labeling.

## 3. System Architecture
- Client-side WebAssembly (`@techstark/opencv-js 5.0.0-release.1`) + TypeScript hybrid execution engine.
- Sequential bounded-memory HTML5 Video frame decoder and `MediaRecorder` exporter.
- Web Worker asynchronous pipeline architecture.

## 4. Methodology & Evaluation Metrics
- **Stabilization Smoothness Metrics:** Second-order finite difference Jitter RMS ($\Delta^2 P_t$), RANSAC inlier ratio, ECC convergence rate, and post-warp border loss percentage.
- **Segmentation Accuracy Metrics:** Pixel-level Confusion Matrix ($TP, FP, FN, TN$), Intersection over Union ($\text{IoU}$), Precision, Recall, F1-Score, and Temporal Mask Flicker.

## 5. Experimental Setup
- **Synthetic Benchmark Scenarios:**
  1. *Scenario 1 (Shaky Camera):* Harmonic translation + roll jitter with moving foreground target.
  2. *Scenario 2 (Moving Foreground Object):* Multi-object articulated motion with pixel-exact Ground Truth.
  3. *Scenario 3 (Illumination Change):* +45 luminance ramp testing background adaptation.
- **Real Video Evaluation Protocol:** Bounded resolution ($\le 640\text{px}$), fixed frame sampling rate, 3-trial median runtime measurement.

## 6. Experimental Results
*(Insert exported CSV / HTML table from Benchmark Lab here)*

| Algorithm | Category | Median Time (ms/f) | FPS | Jitter RMS (px) | IoU | Precision | Recall | F1-Score | Border Loss (%) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A0. Original Baseline | Stabilization | — | — | — | N/A | N/A | N/A | N/A | 0.00% |
| A1. Sparse Optical Flow + RANSAC | Stabilization | — | — | — | N/A | N/A | N/A | N/A | — |
| A2. ECC Euclidean Stabilization | Stabilization | — | — | — | N/A | N/A | N/A | N/A | — |
| B1. Frame Differencing | Background Separation | — | — | N/A | — | — | — | — | N/A |
| B2. MOG2 | Background Separation | — | — | N/A | — | — | — | — | N/A |
| B3. Sample-based KNN (TS) | Background Separation | — | — | N/A | — | — | — | — | N/A |
| C1. Combined (LK+RANSAC → MOG2) | Combined Pipeline | — | — | — | — | — | — | — | — |

## 7. Discussion
- Trade-off between computational throughput (FPS) and stabilization/segmentation accuracy.
- Impact of camera stabilization prior to background subtraction (`Flow A` vs `Flow B` mask discrepancy).
- Sensitivity of static Frame Differencing vs adaptive MOG2 and Sample-based KNN under ambient lighting drift.

## 8. Practical Limitations
- 2D similarity/Euclidean stabilization assumes approximately planar background geometry and cannot remove 3D parallax under large camera translations.
- Fixed-background subtraction models degrade when the camera undergoes continuous large-angle panning where new scene regions enter the field of view.

## 9. Conclusion
- Summary of quantitative findings and recommendations for selecting stabilization and segmentation pairings under real-time constraints.
