# Benchmarking

The benchmark compares the cost-aware policy with LRU under deterministic request streams that vary reuse, recomputation-cost weights, and entry sizes. Both policies receive the same stream and logical capacity. The workloads are deliberately targeted at the retention decisions the cost-aware policy makes; they are not intended to represent all cache workloads.

## Run it

From the workspace root:

```sh
pnpm install
pnpm --filter @weluvabid/cachewise benchmark
```

The package benchmark script builds the TypeScript package before running `packages/cachewise/benchmarks/run.mjs`.

To save a local machine-readable report as well:

```sh
CACHEWISE_BENCH_OUTPUT=benchmark-results/report.json \
  pnpm --filter @weluvabid/cachewise benchmark
```

This writes `report.json` (including every trial and environment metadata), `report.csv` (one row per measured trial), and `report.md` (a compact summary).

Configuration is available through environment variables:

```sh
CACHEWISE_BENCH_OPERATIONS=250000 \
CACHEWISE_BENCH_CAPACITY=524288 \
CACHEWISE_BENCH_TRIALS=20 \
CACHEWISE_BENCH_WARMUPS=3 \
pnpm --filter @weluvabid/cachewise benchmark
```

Defaults are 100,000 operations, a 256 KiB logical budget, seven measured trials, and two warm-up runs per policy and workload. Policy order alternates between trials. Each run uses a deterministic workload and a logical clock so recency and frequency aging do not depend on wall-clock scheduling.

## Workloads

| Workload                 | What it tests                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scan-pollution`         | A 192-key, repeatedly accessed expensive hot set sits close to the 256-entry default capacity while 40% of requests are cheap one-off keys. The question is whether one-off traffic can displace valuable reusable entries. |
| `skewed-expensive-reuse` | Access is concentrated on a small head of the key distribution, and that head carries substantially higher recomputation cost. Entry sizes also vary.                                                                       |
| `byte-pressure`          | Small, expensive entries compete for a fixed budget with much larger, cheap entries. This tests whether retention value is considered relative to occupied bytes.                                                           |

These workloads isolate specific access-pattern and size/cost combinations. They should be treated as controlled comparisons, not representative traces. Uniform access and phase-transition workloads are not included in this benchmark set, so the results do not establish how either policy behaves across those patterns.

## Metrics

The output reports the median across measured trials and the 25th/75th percentile range for:

- **Weighted hit ratio** — supplied recomputation-cost weight avoided by hits divided by the total requested cost weight. This is the primary outcome metric.
- **Avoided cost** — sum of the supplied `computeCost` values for hits.
- **Raw hit ratio** — hits divided by lookups. Useful context, but not the primary objective when recomputation costs differ.
- **Throughput** — completed cache operations per second.
- **Batch p50 / p95** — percentiles of average operation time measured over batches, in microseconds per operation. These are not individual-operation latency percentiles.
- **Evictions and rejections** — policy activity during the run.

The benchmark does not execute the expensive computation represented by `computeCost`; it treats that value as a relative weight. It measures cache-policy overhead as well as retention outcomes. Throughput matters because a retention improvement that costs more CPU than the saved recomputation may not be useful for a particular application.

## Recorded results

The checked-in report records one run on Node.js 26.13.0 and an Apple M4 Max, using 100,000 operations per trial, a 256 KiB logical budget, seven measured trials, and two warm-ups. The table reports medians across measured trials.

| Workload                 | Policy     | Weighted hit ratio | Raw hit ratio | Operations/sec | Batch p95 (µs) |
| ------------------------ | ---------- | -----------------: | ------------: | -------------: | -------------: |
| `scan-pollution`         | LRU        |             63.84% |        38.47% |      1,027,011 |          1.113 |
| `scan-pollution`         | Cost-aware |             99.02% |        59.67% |        965,913 |          1.187 |
| `skewed-expensive-reuse` | LRU        |             58.93% |        29.61% |        872,136 |          1.232 |
| `skewed-expensive-reuse` | Cost-aware |             91.69% |        40.42% |        804,940 |          1.336 |
| `byte-pressure`          | LRU        |             80.94% |        61.78% |      1,087,057 |          1.030 |
| `byte-pressure`          | Cost-aware |             99.44% |        75.20% |      1,874,774 |          0.584 |

In this run, cost-aware retention increased weighted hit ratio in all three selected workloads. It also had lower measured throughput in the first two workloads and higher throughput in `byte-pressure`. These are results from this specific benchmark run, not a general performance guarantee. The benchmark does not execute the recomputation represented by the weights, so a higher weighted hit ratio cannot be translated directly into application latency or CPU savings. The raw observations and environment metadata are in [`report.json`](../packages/cachewise/benchmark-results/report.json), with a compact version in [`report.md`](../packages/cachewise/benchmark-results/report.md).

## Interpreting results

Start with weighted hit ratio and avoided cost. Then look at throughput and batch latency to understand the overhead required to achieve that retention. A higher raw hit ratio is not necessarily better if the cache is hitting on cheap values while missing expensive ones.

The benchmark is not a universal winner-takes-all score. The relevant question is whether the workload resembles the target application and whether the cache-side CPU cost is justified by the recomputation it avoids. Because the benchmark does not run the underlying computation, that final trade-off must be measured in the application.

## Limitations

This is a deterministic microbenchmark, not a production trace replay. Results still depend on Node.js version, CPU scheduling, JIT compilation, garbage collection, and machine load. Run it on an otherwise idle machine and compare medians and percentile ranges rather than relying on a single run. For a release claim, retain the JSON output with the Node version, CPU, capacity, operation count, and trial count.

The benchmark does not include real recomputation, heap profiling, multi-process contention, or application-specific traces. `maxBytes` is a logical value budget, not a measurement of process memory.

## Run on GitHub Actions

The repository includes a manually triggered workflow at **Actions → Cachewise benchmark → Run workflow**. It runs on a GitHub-hosted Ubuntu runner with Node.js 26 and pnpm 12.

The default run uses:

- 100,000 operations per workload and policy trial.
- 256 KiB logical cache capacity.
- 100 measured trials per workload and policy.
- 10 warm-up trials per workload and policy.

The workflow runs the policies sequentially and alternates their order between measured trials. It uploads a `benchmark-results` artifact containing:

- `report.json` — environment metadata, configuration, summary statistics, and every raw trial.
- `samples.csv` — one row per measured workload/policy/trial, suitable for further analysis.
- `report.md` — a compact summary also copied into the GitHub Actions run summary.

Artifacts are retained for 90 days. You can change the operation count, capacity, measured trials, and warm-ups when manually dispatching the workflow. The benchmark runner validates that these values are positive safe integers.

GitHub-hosted runners are convenient for repeatable automated runs, but they are not dedicated hardware. CPU models and host load can vary between workflow runs. Compare policies within the same run first; use repeated workflow runs before making claims about changes across commits. The report records the runtime, operating system, CPU model, logical CPU count, memory, and commit SHA to make those comparisons easier to interpret.
