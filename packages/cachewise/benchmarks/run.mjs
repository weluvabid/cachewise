import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, release, totalmem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { Cache } from '../dist/index.js';

const OPERATIONS = Number(process.env.CACHEWISE_BENCH_OPERATIONS ?? 100_000);
const CAPACITY = Number(process.env.CACHEWISE_BENCH_CAPACITY ?? 256 * 1024);
const TRIALS = Number(process.env.CACHEWISE_BENCH_TRIALS ?? 7);
const WARMUPS = Number(process.env.CACHEWISE_BENCH_WARMUPS ?? 2);
const BATCH_SIZE = 1_000;

for (const [name, value] of Object.entries({ OPERATIONS, CAPACITY, TRIALS, WARMUPS })) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
}

function hash32(value) {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);

  return (hash ^ (hash >>> 16)) >>> 0;
}

function skewed(index, keyCount) {
  const sample = hash32(index) / 0x1_0000_0000;

  return Math.min(keyCount - 1, Math.floor(sample * sample * keyCount));
}

const workloads = [
  {
    name: 'scan-pollution',
    purpose:
      'Protect an expensive hot set near the cache capacity from a high-volume stream of cheap one-off entries.',
    operation(index) {
      if (hash32(index) % 100 < 60) {
        const id = hash32(index + 0x1234) % 192;

        return { key: `hot:${id}`, size: 1_024, computeCost: 100 };
      }

      return { key: `scan:${index}`, size: 1_024, computeCost: 1 };
    },
  },
  {
    name: 'skewed-expensive-reuse',
    purpose:
      'Concentrate expensive recomputation in the frequently reused head of a skewed key distribution.',
    operation(index) {
      const id = skewed(index, 1_024);

      return {
        key: `skew:${id}`,
        size: id < 64 ? 768 : 1_536,
        computeCost: id < 64 ? 120 : 2 + (id % 7),
      };
    },
  },
  {
    name: 'byte-pressure',
    purpose:
      'Prefer compact, expensive-to-recompute entries over large, cheap entries under the same byte budget.',
    operation(index) {
      if (hash32(index) % 100 < 72) {
        const id = hash32(index + 0x2345) % 96;

        return { key: `compact:${id}`, size: 256, computeCost: 80 };
      }

      const id = hash32(index + 0x3456) % 512;

      return { key: `large:${id}`, size: 4_096, computeCost: 1 };
    },
  },
];

function percentile(values, fraction) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);

  return sorted[index];
}

function median(values) {
  return percentile(values, 0.5);
}

function run(workload, policy) {
  let logicalNow = 0;
  const cache = new Cache({
    maxBytes: CAPACITY,
    policy,
    frequencyHalfLife: 50_000,
    maxTrackedKeys: 8_192,
    now: () => logicalNow,
  });
  let avoidedCost = 0;
  let requestedCost = 0;
  let batchStartedAt = performance.now();
  const batchLatencies = [];
  const startedAt = batchStartedAt;

  for (let index = 0; index < OPERATIONS; index += 1) {
    logicalNow = index * 10;
    const operation = workload.operation(index);
    requestedCost += operation.computeCost;

    const value = cache.get(operation.key);

    if (value === undefined) {
      cache.set(operation.key, operation.key, {
        size: operation.size,
        computeCost: operation.computeCost,
      });
    } else {
      avoidedCost += operation.computeCost;
    }

    if ((index + 1) % BATCH_SIZE === 0 || index === OPERATIONS - 1) {
      const now = performance.now();
      const batchOperations = (index % BATCH_SIZE) + 1;
      batchLatencies.push(((now - batchStartedAt) * 1_000) / batchOperations);
      batchStartedAt = now;
    }
  }

  const elapsedMs = performance.now() - startedAt;
  const stats = cache.getStats();

  return {
    workload: workload.name,
    policy,
    hitRatio: stats.hitRate,
    weightedHitRatio: requestedCost === 0 ? 0 : avoidedCost / requestedCost,
    avoidedCost,
    requestedCost,
    evictions: stats.evictions,
    rejections: stats.rejections,
    throughputOpsPerSecond: elapsedMs === 0 ? 0 : (OPERATIONS / elapsedMs) * 1_000,
    batchLatencyP50Us: percentile(batchLatencies, 0.5),
    batchLatencyP95Us: percentile(batchLatencies, 0.95),
    bytesUsed: stats.bytesUsed,
    bytesAvailable: stats.bytesAvailable,
  };
}

function summarize(samples) {
  const fields = [
    'hitRatio',
    'weightedHitRatio',
    'avoidedCost',
    'throughputOpsPerSecond',
    'batchLatencyP50Us',
    'batchLatencyP95Us',
    'evictions',
    'rejections',
    'bytesUsed',
  ];
  const summary = {};

  for (const field of fields) {
    const values = samples.map((sample) => sample[field]);
    summary[field] = {
      median: median(values),
      p25: percentile(values, 0.25),
      p75: percentile(values, 0.75),
    };
  }

  return summary;
}

// Warm both policies before collecting measurements. Alternate policy order
// across measured trials to reduce systematic ordering and thermal bias.
for (const workload of workloads) {
  for (let index = 0; index < WARMUPS; index += 1) {
    run(workload, 'lru');
    run(workload, 'cost-aware');
  }
}

const samples = [];

for (const workload of workloads) {
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const policies = trial % 2 === 0 ? ['lru', 'cost-aware'] : ['cost-aware', 'lru'];

    for (const policy of policies) {
      samples.push({ trial, ...run(workload, policy) });
    }
  }
}

const results = workloads.flatMap((workload) =>
  ['lru', 'cost-aware'].map((policy) => {
    const policySamples = samples.filter(
      (sample) => sample.workload === workload.name && sample.policy === policy,
    );

    return {
      workload: workload.name,
      purpose: workload.purpose,
      policy,
      trials: policySamples.length,
      ...summarize(policySamples),
    };
  }),
);

const table = results.map((result) => ({
  workload: result.workload,
  policy: result.policy,
  weightedHit: `${(result.weightedHitRatio.median * 100).toFixed(1)}%`,
  avoidedCost: result.avoidedCost.median.toFixed(0),
  hit: `${(result.hitRatio.median * 100).toFixed(1)}%`,
  opsPerSec: result.throughputOpsPerSecond.median.toFixed(0),
  p50Us: result.batchLatencyP50Us.median.toFixed(2),
  p95Us: result.batchLatencyP95Us.median.toFixed(2),
  rejections: result.rejections.median.toFixed(0),
}));

const cpu = cpus()[0];
const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    osRelease: release(),
    cpuModel: cpu?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    commit: process.env.GITHUB_SHA ?? null,
    workflowRun: process.env.GITHUB_RUN_ID ?? null,
  },
  configuration: {
    operations: OPERATIONS,
    capacityBytes: CAPACITY,
    trials: TRIALS,
    warmups: WARMUPS,
    workloads: workloads.map(({ name, purpose }) => ({ name, purpose })),
    metricsNote:
      'p50/p95 are percentiles of per-batch average operation time, not individual-operation latency.',
  },
  results,
  samples,
};

const csvFields = [
  'trial',
  'workload',
  'policy',
  'hitRatio',
  'weightedHitRatio',
  'avoidedCost',
  'requestedCost',
  'throughputOpsPerSecond',
  'batchLatencyP50Us',
  'batchLatencyP95Us',
  'evictions',
  'rejections',
  'bytesUsed',
  'bytesAvailable',
];
const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = [
  csvFields.join(','),
  ...samples.map((sample) => csvFields.map((field) => csvEscape(sample[field])).join(',')),
].join('\n');

const markdown = [
  '# Cachewise benchmark report',
  '',
  `- Generated: ${report.metadata.generatedAt}`,
  `- Commit: ${report.metadata.commit ?? 'local run'}`,
  `- Runtime: ${report.metadata.node} (${report.metadata.platform}/${report.metadata.architecture})`,
  `- CPU: ${report.metadata.cpuModel} (${report.metadata.logicalCpuCount} logical cores)`,
  `- Operations per trial: ${OPERATIONS.toLocaleString('en-US')}`,
  `- Capacity: ${CAPACITY.toLocaleString('en-US')} bytes`,
  `- Measured trials per workload/policy: ${TRIALS}`,
  `- Warm-up trials per workload/policy: ${WARMUPS}`,
  '',
  '| Workload | Policy | Weighted hit | Avoided cost | Raw hit | Ops/sec | Batch p50 (µs) | Batch p95 (µs) | Rejections |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...results
    .map((result) =>
      [
        result.workload,
        result.policy,
        `${(result.weightedHitRatio.median * 100).toFixed(2)}%`,
        result.avoidedCost.median.toFixed(0),
        `${(result.hitRatio.median * 100).toFixed(2)}%`,
        result.throughputOpsPerSecond.median.toFixed(0),
        result.batchLatencyP50Us.median.toFixed(3),
        result.batchLatencyP95Us.median.toFixed(3),
        result.rejections.median.toFixed(0),
      ].join(' | '),
    )
    .map((row) => `| ${row} |`),
  '',
  'Values are medians across measured trials. Raw per-trial observations are in `report.json` and `samples.csv`.',
  '',
  report.configuration.metricsNote,
  '',
].join('\n');

const outputPath = process.env.CACHEWISE_BENCH_OUTPUT;

if (outputPath) {
  const absolutePath = resolve(outputPath);
  const outputDirectory = dirname(absolutePath);
  mkdirSync(outputDirectory, { recursive: true });
  const outputBase = absolutePath.replace(/\.json$/i, '');
  writeFileSync(`${outputBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${outputBase}.csv`, `${csv}\n`);
  writeFileSync(`${outputBase}.md`, markdown);
}

// eslint-disable-next-line no-console
console.table(table);
// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      metadata: report.metadata,
      configuration: report.configuration,
      output: outputPath ? resolve(outputPath) : null,
    },
    null,
    2,
  ),
);
