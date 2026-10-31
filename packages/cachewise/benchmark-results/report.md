# Cachewise benchmark report

- Generated: 2026-10-31T17:06:23.957Z
- Commit: local run
- Runtime: v26.13.0 (darwin/arm64)
- CPU: Apple M4 Max (14 logical cores)
- Operations per trial: 100,000
- Capacity: 262,144 bytes
- Measured trials per workload/policy: 7
- Warm-up trials per workload/policy: 2

| Workload               | Policy     | Weighted hit | Avoided cost | Raw hit | Ops/sec | Batch p50 (µs) | Batch p95 (µs) | Rejections |
| ---------------------- | ---------- | -----------: | -----------: | ------: | ------: | -------------: | -------------: | ---------: |
| scan-pollution         | lru        |       63.84% |      3847000 |  38.47% | 1027011 |          0.959 |          1.113 |          0 |
| scan-pollution         | cost-aware |       99.02% |      5967000 |  59.67% |  965913 |          1.024 |          1.187 |          0 |
| skewed-expensive-reuse | lru        |       58.93% |      1980278 |  29.61% |  872136 |          1.140 |          1.232 |          0 |
| skewed-expensive-reuse | cost-aware |       91.69% |      3081131 |  40.42% |  804940 |          1.241 |          1.336 |      49192 |
| byte-pressure          | lru        |       80.94% |      4688653 |  61.78% | 1087057 |          0.917 |          1.030 |          0 |
| byte-pressure          | cost-aware |       99.44% |      5760436 |  75.20% | 1874774 |          0.531 |          0.584 |      16406 |

Values are medians across measured trials. Raw per-trial observations are in `report.json` and `samples.csv`.

p50/p95 are percentiles of per-batch average operation time, not individual-operation latency.
