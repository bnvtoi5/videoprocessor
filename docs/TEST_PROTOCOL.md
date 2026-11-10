# EXPERIMENTAL TEST PROTOCOL (`docs/TEST_PROTOCOL.md`)

## 1. Fair Cross-Algorithm Benchmarking Rules

To ensure scientifically valid comparisons across Stabilization (`A0`, `A1`, `A2`), Background Separation (`B1`, `B2`, `B3`), and Combined Pipelines (`C1`), `src/evaluation/benchmarkRunner.ts` enforces the following invariants:

1. **Identical Input Tensor:** All algorithms execute on the exact same decoded `RawFrameData[]` array, identical spatial resolution (`processingWidth × processingHeight`), identical frame count, and identical sampling rate (`samplingFps`).
2. **WASM & JIT Warm-up Pass:** Prior to recording benchmark timings, a 3-frame warm-up pass is executed on both the stabilization and background subtraction pipelines to eliminate WebAssembly page-allocation and V8 JIT compilation overhead.
3. **Separation of Timings:**
   - **Algorithm Processing Time (`ms / frame`):** Measures only the pure computer vision frame processing loop (`performance.now()` around feature tracking, RANSAC/ECC, background modeling, and morphology).
   - **Total Pipeline Time (`ms`):** Cumulative algorithm time across the entire sequence.
   - **Export / Encoding Time (`ms`):** Measured separately inside `src/core/videoEncoder.ts` during `MediaRecorder` encoding and never mixed into algorithm runtime metrics.
4. **Multi-Trial Median Reporting:** Supports 3-trial execution reporting the statistical median $\text{median}(t_1, t_2, t_3)$ to suppress browser garbage-collection spikes.
5. **Strict Ground Truth Integrity:**
   - Ground Truth is never synthesized from an algorithm's own output.
   - Frame 0 (initialization reference frame) is excluded when averaging segmentation IoU/F1 across a sequence.
   - If Ground Truth is absent or has mismatched dimensions, IoU/Precision/Recall/F1 strictly report `N/A – Ground Truth Unavailable`.
