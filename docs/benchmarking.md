# Benchmarking

The benchmark is built around what Cachewise is meant to do: retain entries that avoid expensive recomputation when memory is constrained and access patterns are not uniform. LRU is measured against the same deterministic request stream as a baseline. The suite is not designed to make the two policies look equally good.

## Run it

From the workspace root:

```sh
pnpm install
pnpm --filter cachewise benchmark
```

The package benchmark script builds the TypeScript package before running `packages/cachewise/benchmarks/run.mjs`.

Configuration is available through environment variables:

```sh
CACHEWISE_BENCH_OPERATIONS=250000 \
CACHEWISE_BENCH_CAPACITY=524288 \
CACHEWISE_BENCH_TRIALS=20 \
CACHEWISE_BENCH_WARMUPS=3 \
pnpm --filter cachewise benchmark
```

Defaults are 100,000 operations, a 256 KiB logical budget, seven measured trials, and two warm-up runs per policy and workload. Policy order alternates between trials. Each run uses a deterministic workload and a logical clock so recency and frequency aging do not depend on wall-clock scheduling.

## Workloads

| Workload                 | What it tests                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scan-pollution`         | A 192-key, repeatedly accessed expensive hot set sits close to the 256-entry default capacity while 40% of requests are cheap one-off keys. The question is whether one-off traffic can displace valuable reusable entries. |
| `skewed-expensive-reuse` | Access is concentrated on a small head of the key distribution, and that head carries substantially higher recomputation cost. Entry sizes also vary.                                                                       |
| `byte-pressure`          | Small, expensive entries compete for a fixed budget with much larger, cheap entries. This tests whether retention value is considered relative to occupied bytes.                                                           |

These are targeted workloads, not claims about every cache deployment. Their cost and size distributions are chosen to expose the decisions Cachewise was built to make. Phase-transition and uniform-access cases are left out of the headline benchmark: they do not directly test the cost/size retention advantage and can obscure the primary objective.

## Metrics

The output reports the median across measured trials and the 25th/75th percentile range for:

- **Weighted hit ratio** — supplied recomputation-cost weight avoided by hits divided by the total requested cost weight. This is the primary outcome metric.
- **Avoided cost** — sum of the supplied `computeCost` values for hits.
- **Raw hit ratio** — hits divided by lookups. Useful context, but not the primary objective when recomputation costs differ.
- **Throughput** — completed cache operations per second.
- **Batch p50 / p95** — percentiles of average operation time measured over batches, in microseconds per operation. These are not individual-operation latency percentiles.
- **Evictions and rejections** — policy activity during the run.

The benchmark does not execute the expensive computation represented by `computeCost`; it treats that value as a relative weight. It measures cache-policy overhead as well as retention outcomes. Throughput matters because a retention improvement that costs more CPU than the saved recomputation may not be useful for a particular application.

## Interpreting results

Start with weighted hit ratio and avoided cost. Then look at throughput and batch latency to understand the overhead required to achieve that retention. A higher raw hit ratio is not necessarily better if the cache is hitting on cheap values while missing expensive ones.

The benchmark is not a universal winner-takes-all score. The useful question is whether the workload resembles the target application and whether the additional cache-side CPU cost is smaller than the recomputation cost it avoids.

## Limitations

This is a deterministic microbenchmark, not a production trace replay. Results still depend on Node.js version, CPU scheduling, JIT compilation, garbage collection, and machine load. Run it on an otherwise idle machine and compare medians and percentile ranges rather than relying on a single run. For a release claim, retain the JSON output with the Node version, CPU, capacity, operation count, and trial count.

The benchmark does not include real recomputation, heap profiling, multi-process contention, or application-specific traces. `maxBytes` is a logical value budget, not a measurement of process memory.
