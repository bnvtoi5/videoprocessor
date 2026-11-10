# EVALUATION METRICS SPECIFICATION (`docs/METRICS.md`)

## 1. Stabilization Metrics

### 1.1. Second-Order Trajectory Jitter RMS
To separate intentional smooth camera panning from unwanted high-frequency hand shake without requiring external motion-capture hardware, we compute the Root Mean Square (RMS) of the second-order finite difference (discrete acceleration) of the cumulative camera trajectory $P(t) \in \{X(t), Y(t), \theta(t)\}$:

$$\Delta^2 P(t) = P(t+1) - 2P(t) + P(t-1), \quad t \in [1, N-2]$$

$$\text{Jitter RMS}(P) = \sqrt{\frac{1}{N-2} \sum_{t=1}^{N-2} \left(\Delta^2 P(t)\right)^2}$$

- **Translation Jitter RMS (px):** $\sqrt{\text{Jitter RMS}(X)^2 + \text{Jitter RMS}(Y)^2}$
- **Rotation Jitter RMS (deg):** $\text{Jitter RMS}(\theta_{\text{deg}})$
- **Methodological Note:** On real-world uploaded videos, Jitter RMS is explicitly reported as a **trajectory smoothness proxy metric**, not ground-truth 3D camera pose error.

### 1.2. RANSAC Inlier Ratio & ECC Convergence Rate
- **RANSAC Inlier Ratio (%):** $\frac{1}{N-1}\sum_{t=1}^{N-1} \frac{N_{\text{inliers}}(t)}{N_{\text{tracked}}(t)} \times 100\%$
- **ECC Convergence Rate (%):** Percentage of inter-frame pairs where the ECC optimizer converged within `eccIterations` without falling back to the identity matrix.

### 1.3. Valid Image Area & Border Loss Percentage
When warping a frame by corrective transform $\Delta C(t)$, pixels mapped from outside $[0, W-1] \times [0, H-1]$ become undefined border pixels:
- $\text{Valid Area (\%)} = \frac{N_{\text{in-bounds}}}{W \times H} \times 100\%$
- $\text{Border Loss (\%)} = 100\% - \text{Valid Area (\%)}$

---

## 2. Foreground Segmentation Metrics

Evaluated strictly when pixel-aligned Ground Truth binary masks $G_t \in \{0, 255\}$ are available (either from the Synthetic Demo Generator or user-uploaded Ground Truth PNG `.zip` archives). When Ground Truth is absent, all accuracy metrics return `null` and display `"N/A – Ground Truth Unavailable"`.

For each frame $t$:
- $TP = |\{p : \hat{M}_t(p) = 255 \land G_t(p) = 255\}|$
- $FP = |\{p : \hat{M}_t(p) = 255 \land G_t(p) = 0\}|$
- $FN = |\{p : \hat{M}_t(p) = 0 \land G_t(p) = 255\}|$
- $TN = |\{p : \hat{M}_t(p) = 0 \land G_t(p) = 0\}|$

### Exact Formulas & Zero-Division Safeguards
$$\text{IoU} = \begin{cases} \dfrac{TP}{TP + FP + FN} & \text{if } TP + FP + FN > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$\text{Precision} = \begin{cases} \dfrac{TP}{TP + FP} & \text{if } TP + FP > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$\text{Recall} = \begin{cases} \dfrac{TP}{TP + FN} & \text{if } TP + FN > 0 \\ 0 & \text{otherwise} \end{cases}$$

$$\text{F1-Score} = \begin{cases} \dfrac{2 \times \text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}} & \text{if } \text{Precision} + \text{Recall} > 0 \\ 0 & \text{otherwise} \end{cases}$$

### Unsupervised Proxy Metrics (Available on All Videos)
- **Foreground Ratio (%):** $\frac{1}{W \cdot H} \sum_p \mathbb{I}(\hat{M}_t(p) = 255) \times 100\%$
- **Temporal Mask Flicker (%):** $\frac{1}{W \cdot H} \sum_p \mathbb{I}(\hat{M}_t(p) \neq \hat{M}_{t-1}(p)) \times 100\%$
