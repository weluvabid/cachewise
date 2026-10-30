<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Cache } from 'cachewise';
  import { Code2, ArrowUpRight, Play, Pause, SkipForward, RotateCcw, Zap, Database, Activity, Cpu, ChevronDown } from '@lucide/svelte';

  type ScenarioId = 'balanced' | 'expensive' | 'pressure';
  type Operation = { kind: 'get'; key: string } | { kind: 'set'; key: string; size: number; cost: number };
  type EntryView = { key: string; size: number; cost: number; frequency: number; last: number };
  type Snapshot = {
    operation: string;
    detail: string;
    lru: EntryView[];
    smart: EntryView[];
    lruStats: ReturnType<Cache<string, string>['getStats']>;
    smartStats: ReturnType<Cache<string, string>['getStats']>;
    lruEvicted: string[];
    smartEvicted: string[];
    lruRejected: boolean;
    smartRejected: boolean;
    lruComputeCost: number;
    smartComputeCost: number;
  };

  const scenarios: Record<ScenarioId, { label: string; description: string; capacity: number; operations: Operation[] }> = {
    balanced: {
      label: 'Mixed workload',
      description: 'A realistic mix of repeated reads, cold keys and new results.',
      capacity: 100,
      operations: [
        {kind:'set',key:'profile',size:24,cost:2},{kind:'set',key:'catalog',size:30,cost:3},
        {kind:'set',key:'report',size:28,cost:24},{kind:'set',key:'schema',size:18,cost:12},
        {kind:'get',key:'profile'},{kind:'get',key:'report'},{kind:'get',key:'report'},
        {kind:'set',key:'search',size:34,cost:18},{kind:'get',key:'catalog'},
        {kind:'get',key:'report'},
        {kind:'get',key:'schema'},{kind:'get',key:'report'},{kind:'get',key:'session'},{kind:'set',key:'session',size:22,cost:4},{kind:'get',key:'search'}
      ]
    },
    expensive: {
      label: 'Expensive misses',
      description: 'A few costly results deserve to stay, even when they are not the newest.',
      capacity: 100,
      operations: [
        {kind:'set',key:'thumbnail',size:22,cost:2},{kind:'set',key:'query',size:26,cost:3},
        {kind:'set',key:'model',size:32,cost:40},{kind:'set',key:'report',size:28,cost:32},
        {kind:'get',key:'model'},{kind:'get',key:'report'},{kind:'set',key:'feed',size:38,cost:5},
        {kind:'get',key:'model'},{kind:'get',key:'report'},{kind:'set',key:'export',size:34,cost:28},
        {kind:'get',key:'model'},{kind:'get',key:'report'},{kind:'get',key:'export'}
      ]
    },
    pressure: {
      label: 'Memory pressure',
      description: 'Large incoming values force each policy to make harder trade-offs.',
      capacity: 100,
      operations: [
        {kind:'set',key:'hot-key',size:24,cost:30},{kind:'set',key:'lookup',size:24,cost:4},
        {kind:'set',key:'config',size:22,cost:8},{kind:'set',key:'image',size:30,cost:3},
        {kind:'get',key:'hot-key'},{kind:'get',key:'hot-key'},{kind:'get',key:'config'},
        {kind:'set',key:'transform',size:46,cost:36},{kind:'get',key:'hot-key'},
        {kind:'set',key:'payload',size:40,cost:12},{kind:'get',key:'transform'},
        {kind:'get',key:'hot-key'},{kind:'get',key:'payload'}
      ]
    }
  };

  let scenario: ScenarioId = 'balanced';
  let capacity = scenarios[scenario].capacity;
  let snapshots: Snapshot[] = [];
  let step = 0;
  let playing = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let showDetails = false;

  const currentScenario = () => scenarios[scenario];
  $: current = snapshots[Math.max(0, step - 1)];
  $: progress = snapshots.length ? (step / snapshots.length) * 100 : 0;
  $: finished = snapshots.length > 0 && step >= snapshots.length;

  function buildSnapshots(id: ScenarioId, maxBytes: number): Snapshot[] {
    let now = 1_000;
    const lruEvents: string[] = [];
    const smartEvents: string[] = [];
    const lru = new Cache<string, string>({
      maxBytes, policy: 'lru', now: () => now,
      estimateSize: (value) => Number(value.split('|')[0]),
      onEvent: (event) => { if (event.type === 'evict') lruEvents.push(event.key); }
    });
    const smart = new Cache<string, string>({
      maxBytes, policy: 'cost-aware', now: () => now, frequencyHalfLife: 100_000,
      estimateSize: (value) => Number(value.split('|')[0]),
      onEvent: (event) => { if (event.type === 'evict') smartEvents.push(event.key); }
    });
    const result: Snapshot[] = [];
    let lruComputeCost = 0;
    let smartComputeCost = 0;
    const ops = scenarios[id].operations;
    const view = (cache: Cache<string,string>): EntryView[] => [...cache.entries()].map(([key]) => {
      const meta = cache.getEntryMetadata(key)!;
      return {key,size:meta.size,cost:meta.computeCost,frequency:meta.frequency,last:meta.lastAccessedAt};
    });
    for (let i = 0; i < ops.length; i++) {
      now += 1_000;
      const op = ops[i];
      if (!op) continue;

      const beforeLru = lruEvents.length, beforeSmart = smartEvents.length;
      let lruRejected = false, smartRejected = false;
      if (op.kind === 'get') {
        const lruBefore = lru.getStats().misses;
        const smartBefore = smart.getStats().misses;
        lru.get(op.key); smart.get(op.key);
        const knownCost = ops.find((candidate) => candidate.kind === 'set' && candidate.key === op.key);
        const cost = knownCost?.kind === 'set' ? knownCost.cost : 1;
        if (lru.getStats().misses > lruBefore) lruComputeCost += cost;
        if (smart.getStats().misses > smartBefore) smartComputeCost += cost;
      } else {
        const value = `${op.size}|${op.key}`;
        lruRejected = !lru.set(op.key,value,{size:op.size,computeCost:op.cost});
        smartRejected = !smart.set(op.key,value,{size:op.size,computeCost:op.cost});
      }
      const describe = op.kind === 'get' ? `Read ${op.key}` : `Computed ${op.key}`;
      result.push({
        operation: `${String(i+1).padStart(2,'0')} · ${describe}`,
        detail: op.kind === 'get' ? 'Both caches receive the same lookup.' : `${op.size} logical bytes · estimated recomputation cost ${op.cost}.`,
        lru:view(lru), smart:view(smart), lruStats:lru.getStats(), smartStats:smart.getStats(),
        lruEvicted:lruEvents.slice(beforeLru), smartEvicted:smartEvents.slice(beforeSmart),
        lruRejected, smartRejected, lruComputeCost, smartComputeCost
      });
    }
    return result;
  }

  function reset() {
    stop();
    snapshots = buildSnapshots(scenario, capacity);
    step = 0;
  }
  function chooseScenario(id: ScenarioId) {
    scenario = id;
    capacity = scenarios[id].capacity;
    reset();
  }
  function next() {
    if (step < snapshots.length) step += 1;
    if (step >= snapshots.length) stop();
  }
  function play() {
    if (finished) step = 0;
    playing = true;
    timer = setInterval(() => next(), 850);
  }
  function stop() {
    playing = false;
    if (timer) clearInterval(timer);
    timer = undefined;
  }
  function togglePlay() { if (playing) stop(); else play(); }
  function formatCost(n: number) { return n.toFixed(0); }
  function width(n: number) { return `${Math.min(100, (n / capacity) * 100)}%`; }
  function evictionText(names: string[], rejected: boolean) {
    if (rejected) return 'Admission declined — keeping the current working set.';
    if (!names.length) return 'No eviction required.';
    return `Evicted ${names.join(', ')}.`;
  }
  onDestroy(stop);
  reset();
</script>

<svelte:head>
  <title>Cachewise — Recompute less. Remember smarter.</title>
  <meta name="description" content="An interactive comparison of LRU and computation-aware caching." />
  <meta name="theme-color" content="#fdfbf7" />
</svelte:head>

<div class="site-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Cachewise home">
      <span class="brand-mark"><span></span><span></span><span></span></span>
      <span>cachewise</span>
    </a>
    <a class="github-link" href="https://github.com/weluvabid/cachewise" target="_blank" rel="noreferrer" aria-label="Cachewise on GitHub">
      <Code2 size={18} strokeWidth={1.8} />
      <span>Source</span>
      <ArrowUpRight size={14} />
    </a>
  </header>

  <main>
    <section class="intro">
      <div class="eyebrow"><span class="live-dot"></span> COMPUTATION-AWARE CACHING</div>
      <h1>Recompute less.<br /><span>Remember smarter.</span></h1>
      <p>LRU remembers what you touched last. Cachewise weighs what it would cost to compute again.</p>
    </section>

    <section class="demo" aria-label="Interactive cache comparison">
      <div class="demo-heading">
        <div>
          <div class="section-kicker">INTERACTIVE SIMULATION</div>
          <h2>Same workload. Different decisions.</h2>
        </div>
        <div class="budget"><Database size={15}/><span>Memory budget</span><strong>{capacity} KB</strong></div>
      </div>

      <div class="scenario-row">
        <div class="scenario-pills" role="group" aria-label="Choose workload">
          {#each Object.entries(scenarios) as [id, item]}
            <button class:chosen={scenario === id} class="scenario-pill" onclick={() => chooseScenario(id as ScenarioId)}>{item.label}</button>
          {/each}
        </div>
        <p class="scenario-description">{currentScenario().description}</p>
      </div>

      <div class="comparison-grid">
        <article class="cache-card">
          <div class="cache-card-head">
            <div><div class="cache-label">BASELINE</div><h3>LRU</h3><p>Least recently used</p></div>
            <span class="policy-tag">Recency only</span>
          </div>
          <div class="memory-line"><span>Memory used</span><strong>{current?.lruStats.bytesUsed ?? 0} <small>/ {capacity} KB</small></strong></div>
          <div class="memory-track"><div class="memory-fill" style={`width:${width(current?.lruStats.bytesUsed ?? 0)}`}></div></div>
          <div class="entries-label"><span>RESIDENT ENTRIES</span><span>{current?.lru.length ?? 0}</span></div>
          <div class="entry-list">
            {#if current?.lru.length}
              {#each current.lru as entry (entry.key)}
                <div class="entry" class:recent={current.lruEvicted.includes(entry.key)}>
                  <span class="entry-dot"></span><strong>{entry.key}</strong><span class="entry-meta">{entry.size} KB</span>
                  <span class="entry-cost">cost {formatCost(entry.cost)}</span>
                </div>
              {/each}
            {:else}<div class="empty-state">Run the workload to populate the cache.</div>{/if}
          </div>
          <div class="decision"><span class="decision-icon"><Activity size={14}/></span><span>{current ? evictionText(current.lruEvicted,current.lruRejected) : 'Waiting for workload.'}</span></div>
        </article>

        <article class="cache-card smart-card">
          <div class="cache-card-head">
            <div><div class="cache-label">COMPUTATION-AWARE</div><h3>Cachewise</h3><p>Value of avoided computation</p></div>
            <span class="policy-tag accent-tag"><Zap size={12}/> Cost-aware</span>
          </div>
          <div class="memory-line"><span>Memory used</span><strong>{current?.smartStats.bytesUsed ?? 0} <small>/ {capacity} KB</small></strong></div>
          <div class="memory-track"><div class="memory-fill smart-fill" style={`width:${width(current?.smartStats.bytesUsed ?? 0)}`}></div></div>
          <div class="entries-label"><span>RESIDENT ENTRIES</span><span>{current?.smart.length ?? 0}</span></div>
          <div class="entry-list">
            {#if current?.smart.length}
              {#each current.smart as entry (entry.key)}
                <div class="entry">
                  <span class="entry-dot smart-dot"></span><strong>{entry.key}</strong><span class="entry-meta">{entry.size} KB</span>
                  <span class="entry-cost">cost {formatCost(entry.cost)}</span>
                </div>
              {/each}
            {:else}<div class="empty-state">Run the workload to populate the cache.</div>{/if}
          </div>
          <div class="decision smart-decision"><span class="decision-icon"><Zap size={14}/></span><span>{current ? evictionText(current.smartEvicted,current.smartRejected) : 'Waiting for workload.'}</span></div>
        </article>
      </div>

      <div class="operation-bar">
        <div class="operation-current">
          <span class="operation-index">{step ? String(step).padStart(2,'0') : '—'}<i>/{snapshots.length}</i></span>
          <div><span class="cache-label">CURRENT OPERATION</span><strong>{current?.operation ?? 'Ready to simulate'}</strong><small>{current?.detail ?? 'Choose a workload, then step through each operation.'}</small></div>
        </div>
        <div class="controls">
          <button class="control-button primary-control" onclick={togglePlay} aria-label={playing ? 'Pause simulation' : 'Run simulation'}>{#if playing}<Pause size={15}/><span>Pause</span>{:else}<Play size={15}/><span>{finished ? 'Replay' : 'Run'}</span>{/if}</button>
          <button class="control-button" onclick={() => {stop();next();}} disabled={finished || playing}><SkipForward size={15}/><span>Step</span></button>
          <button class="icon-control" onclick={reset} aria-label="Reset simulation"><RotateCcw size={15}/></button>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" style={`width:${progress}%`}></div></div>

      <div class="metrics">
        <div class="metric-title"><span>RUN SUMMARY</span><span>{finished ? 'COMPLETE' : step ? 'IN PROGRESS' : 'NOT STARTED'}</span></div>
        {#each [{label:'Hits',l:current?.lruStats.hits??0,s:current?.smartStats.hits??0},{label:'Misses',l:current?.lruStats.misses??0,s:current?.smartStats.misses??0},{label:'Evictions',l:current?.lruStats.evictions??0,s:current?.smartStats.evictions??0},{label:'Recompute cost',l:current?.lruComputeCost??0,s:current?.smartComputeCost??0}] as metric}
          <div class="metric-cell"><span>{metric.label}</span><div><strong>{metric.l}</strong><i>LRU</i><strong class="smart-number">{metric.s}</strong><i>CW</i></div></div>
        {/each}
      </div>
      <button class="details-toggle" onclick={() => showDetails = !showDetails} aria-expanded={showDetails}>
        <span>How to read this comparison</span><ChevronDown size={15} class={showDetails ? 'rotated' : ''}/>
      </button>
      {#if showDetails}
        <div class="details-copy">
          <p><strong>LRU</strong> selects the entry that has gone the longest without an access.</p>
          <p><strong>Cachewise</strong> scores entries using recency, observed reuse, recomputation cost and logical size. It can also decline an incoming entry when its estimated value does not justify displacing a resident one.</p>
          <p>Both panels run the same operations against the actual Cachewise cache implementation with the policy selected independently. Values and memory sizes are illustrative workload inputs.</p>
        </div>
      {/if}
    </section>

    <section class="principle">
      <div class="principle-icon"><Cpu size={18}/></div>
      <div><span class="section-kicker">THE IDEA</span><p>A cache miss has a cost. Cachewise treats that cost as part of the eviction decision — not just how recently an entry was used.</p></div>
    </section>
  </main>

  <footer>
    <div class="footer-brand"><span class="brand-mark small-mark"><span></span><span></span><span></span></span> cachewise <span class="footer-note">Recompute less. Remember smarter.</span></div>
    <nav aria-label="Project resources">
      <a href="https://github.com/weluvabid/cachewise" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12}/></a>
      <a href="https://github.com/weluvabid/cachewise/tree/main/docs" target="_blank" rel="noreferrer">Docs <ArrowUpRight size={12}/></a>
      <a href="https://github.com/weluvabid/cachewise/issues" target="_blank" rel="noreferrer">Issues <ArrowUpRight size={12}/></a>
    </nav>
  </footer>
</div>
