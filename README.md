# Phần Mềm Xử Lý Video Chống Rung & Tách Nền (DSP501 — FPT University)

Ứng dụng xử lý tín hiệu số không gian–thời gian (**Spatiotemporal Video Processing Lab**) chạy độc lập 100% trên trình duyệt bằng **React 19 + TypeScript + OpenCV.js WebAssembly**.

---

## 1. Hướng Dẫn Clone Từ GitHub & Cài Đặt Trên Máy Tính Cá Nhân (Windows / macOS / Linux)

Phần mềm chạy thuần phía máy khách (Client-side WebAssembly), **không cần** cài Python, **không cần** cài OpenCV C++ hệ thống hay cơ sở dữ liệu.

### Bước 1: Cài đặt Node.js
- Tải và cài đặt **Node.js (bản LTS 18.x, 20.x hoặc 22.x)** tại: [https://nodejs.org](https://nodejs.org)

### Bước 2: Tải code (Clone từ GitHub hoặc giải nén ZIP) và cài đặt thư viện
Mở **Terminal** (hoặc **Command Prompt / PowerShell** trên Windows) tại thư mục dự án và chạy:

```bash
git clone [<link-github-repo-cua-ban>](https://github.com/bnvtoi5/videoprocessor)
cd videoprocessor
npm install
```

### Bước 3: Chạy phần mềm trên máy tính
```bash
npm run dev
```
Sau đó mở trình duyệt (Chrome, Edge, Brave hoặc Firefox) tại địa chỉ:
👉 **`http://localhost:3000`**

### Bước 4: Đóng gói bản Production hoặc Chạy Unit Test (Tùy chọn)
```bash
# Kiểm tra biên dịch TypeScript & đóng gói ứng dụng
npm run lint
npm run build

# Chạy bộ kiểm thử tự động các thuật toán DSP
npm test
```

---

## 2. Hướng Dẫn Đẩy Code Lên GitHub (Push to GitHub)

Nếu bạn tải mã nguồn từ hệ thống về máy tính và muốn đẩy lên GitHub cá nhân:

```bash
git init
git add .
git commit -m "Initial commit: DSP501 Spatiotemporal Video Processing Lab"
git branch -M main
git remote add origin https://github.com/<username>/<ten-repo>.git
git push -u origin main
```

---

## 3. Sơ Đồ Thư Mục Code & Vị Trí Từng Bộ Lọc DSP (`src/`)

| Nhóm Chức Năng | Bộ Lọc / Thuật Toán Cụ Thể | Đường Dẫn File Code | Hàm Thực Thi Chính |
| :--- | :--- | :--- | :--- |
| **1. Chống rung (Stabilization)** | Chuyển ảnh xám ITU-R BT.601, Mặt nạ vùng biên trong (`Inner ROI Margin Mask`), Phát hiện góc **Shi–Tomasi** & Optical Flow **Pyramidal Lucas–Kanade (PyrLK)** | `src/algorithms/stabilization/opticalFlow.ts` | `rgbaToGrayscale()`, `detectAndTrackOpticalFlow()` |
| **1. Chống rung (Stabilization)** | Bộ lọc loại bỏ ngoại lai **2D Similarity RANSAC (4-DOF)** | `src/algorithms/stabilization/ransac.ts` | `estimateSimilarityTransformRansac()` |
| **1. Chống rung (Stabilization)** | Bộ lọc làm mượt quỹ đạo **Gaussian Kernel (D0)** & **Trung bình trượt Boxcar (D3)** | `src/algorithms/stabilization/trajectory.ts` | `gaussianSmooth1D()`, `movingAverageSmooth1D()`, `computeSmoothedTrajectory()` |
| **1. Chống rung (Stabilization)** | Căn chỉnh toàn ảnh trực tiếp **ECC (Enhanced Correlation Coefficient)** | `src/algorithms/stabilization/ecc.ts` | `estimateEccTransform()` |
| **1. Chống rung (Stabilization)** | Biến đổi hình học ngược **Affine 2×3 (Corrective Warping)** & Cắt biên | `src/algorithms/stabilization/stabilizationPipeline.ts` | `warpFrameAffineRgba()`, `runStabilizationPipeline()` |
| **2. Tách nền (Background)** | Sai khác khung hình **Frame Differencing (B1)** (First-Frame / Median / Running Avg) | `src/algorithms/background/frameDifference.ts` | `runFrameDifferencingSequence()` |
| **2. Tách nền (Background)** | Mô hình hỗn hợp Gaussian thích nghi **MOG2 (B2)** + Khử bóng đổ (Shadow Suppression) | `src/algorithms/background/mog2.ts` | `runMog2Sequence()` |
| **2. Tách nền (Background)** | Mô hình phi tham số lân cận mẫu **Sample-based KNN (B3)** | `src/algorithms/background/sampleKnn.ts` | `runSampleKnnSequence()` |
| **3. Bộ lọc hậu xử lý (Morphology)** | Lọc làm mịn không gian **Gaussian 3×3**, **Morphological Opening / Closing**, Gán nhãn thành phần liên thông 8 hướng | `src/algorithms/background/morphology.ts` | `gaussianBlur3x3()`, `morphologicalOpen()`, `morphologicalClose()`, `applyMorphologyPipeline()` |
| **4. Chỉ số đánh giá (Metrics)** | Đo độ rung đầu ra thực tế **Post-Warp Remeasured Output Jitter RMS** & **Trajectory Smoothness** | `src/evaluation/stabilizationMetrics.ts` | `computeRemeasuredOutputJitterRms()`, `computeTrajectoryJitterMetrics()` |
| **4. Chỉ số đánh giá (Metrics)** | Ma trận nhầm lẫn (**Precision, Recall, F1, IoU**), **Mask Flicker**, và **Sai khác Pixel Mask $\|M_{\text{variant}} - M_{D0}\|$** | `src/evaluation/segmentationMetrics.ts` | `computeFrameSegmentationMetrics()`, `computeMaskDifferenceVsBaseline()` |
| **5. Nghiệm thu & Ablation** | Chạy đồng thời các cấu hình **Ablation D0–D6** có chia sẻ cache chống rung và nhường luồng sự kiện (`yieldToMain`) | `src/evaluation/researchExperiments.ts` | `runCustomAblationComboBatch()` |
| **6. Giao diện Nghiệm thu Đa Video** | Nạp nhiều video + **Bảng Nghiệm Thu Số Liệu** + **Phiếu Bầu Chọn Đa Số** + **Thẻ Demo Trực Quan** | `src/components/research/MultiVideoAcceptanceStudio.tsx` | `<MultiVideoAcceptanceStudio />` |
