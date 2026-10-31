# Eviction and admission

Cachewise tries to keep entries that are likely to avoid more recomputation relative to the logical space they occupy.

## Cost-aware score

For an entry, the default policy computes:

```text
age     = max(0, now - lastAccessedAt)
recency = 0.5 ^ (age / recencyHalfLife)
reuse   = log2(1 + frequency)
cost    = log2(1 + computeCost)
score   = (recency × reuse × cost) / max(1, size)
```

The implementation currently uses a 60,000 ms recency half-life. It is not exposed as a `Cache` constructor option.

What each factor does:

- **Recency** — recent access raises the score. The value halves every recency half-life.
- **Reuse** — repeated reads raise the score. Growth is logarithmic so a very hot key does not dominate forever.
- **Compute cost** — expensive-to-recompute entries get more protection, also with logarithmic growth.
- **Size** — larger entries must justify occupying more of the budget.

`computeCost` is a relative weight supplied by the application. It is not measured in milliseconds, CPU cycles, or dollars. Use a consistent scale inside one cache instance.

## Victim selection

The cost-aware policy orders retained entries by ascending score and selects the lowest-scoring ones until enough logical bytes are free. Equal scores keep stable map-iteration order.

The LRU baseline selects the entry with the oldest `lastAccessedAt`. Timestamp ties fall back to map iteration order.

## Admission

Finding a victim is not enough. The cost-aware policy admits a candidate only when:

```text
candidateScore > 0
candidateScore >= victimScore
```

If the candidate cannot beat the victim, `set` returns `false` and leaves the existing entries alone.

When a candidate needs multiple victims to fit, it must pass the admission comparison against every selected victim. Planning finishes before any resident entry is removed, so rejection leaves the cache unchanged. This is greedy score ordering, not a global optimization over every possible subset of entries.

The LRU policy always admits after space has been made, which makes it a useful baseline for the same storage budget.

## What the score does not claim

This is a heuristic, not an optimal cache policy. It does not know the real future request stream, the actual CPU cost of a computation, object-graph size, GC pressure, or the downstream value of a cached result.

The logarithms damp high frequency and high compute-cost inputs. Division by size rewards compact entries. The half-life makes stale reuse matter less over time. Those are design choices, not a proof of universally optimal retention.

The benchmark suite focuses on the cases Cachewise is meant to handle: expensive reuse under scan pollution, skewed expensive workloads, and byte pressure. LRU is kept as a baseline so the size of the improvement can be measured, not as a target the cost-aware policy is expected to imitate.
