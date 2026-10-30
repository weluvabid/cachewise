<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Cache } from 'cachewise';
  import { Code2, ArrowUpRight, Play, Pause, SkipForward, RotateCcw, Zap, Database, Activity, Cpu, ChevronDown } from '@lucide/svelte';
  import * as Select from "$lib/components/ui/select";
  import { Sun, Moon } from '@lucide/svelte';

  type ScenarioId = 'balanced' | 'expensive' | 'pressure';
  type Operation = { kind: 'get'; key: string } | { kind: 'set'; key: string; size: number; cost: number };
  type EntryView = { key: string; size: number; cost: number; frequency: number; last: number };
  type Snapshot = {
    operation: string; detail: string; lru: EntryView[]; smart: EntryView[];
    lruStats: ReturnType<Cache<string, string>['getStats']>; smartStats: ReturnType<Cache<string, string>['getStats']>;
    lruEvicted: string[]; smartEvicted: string[]; lruRejected: boolean; smartRejected: boolean;
    lruComputeCost: number; smartComputeCost: number;
  };
  type Scenario = { label: string; description: string; seed: number; operations: Operation[] };
  const budgets = [64, 100, 128, 256];
  const scenarioMeta: Record<ScenarioId, { label: string; description: string; seed: number }> = {
    balanced: { label: 'Mixed workload', description: 'A seeded mix of hot expensive results, inexpensive reads and cold writes.', seed: 7319 },
    expensive: { label: 'Expensive misses', description: 'Repeatedly reused high-cost results compete with cheaper, newer entries.', seed: 19427 },
    pressure: { label: 'Memory pressure', description: 'Large cold values compete for a constrained working set.', seed: 88031 }
  };

  function makeWorkload(id: ScenarioId, capacity: number): Scenario {
    // Seeded workload generation keeps each scenario reproducible and both policies see identical operations.
    let state = scenarioMeta[id].seed;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    const definitions = id === 'expensive'
      ? [{key:'model',size:24,cost:90,w:0.30},{key:'report',size:22,cost:72,w:0.27},{key:'index',size:18,cost:48,w:0.18},{key:'profile',size:12,cost:3,w:0.12},{key:'feed',size:20,cost:4,w:0.08},{key:'lookup',size:10,cost:2,w:0.05}]
      : id === 'pressure'
        ? [{key:'hot-key',size:16,cost:65,w:0.34},{key:'transform',size:24,cost:80,w:0.27},{key:'config',size:12,cost:18,w:0.16},{key:'lookup',size:10,cost:3,w:0.10},{key:'image',size:30,cost:2,w:0.08},{key:'payload',size:28,cost:5,w:0.05}]
        : [{key:'report',size:22,cost:52,w:0.25},{key:'schema',size:14,cost:26,w:0.18},{key:'catalog',size:20,cost:5,w:0.18},{key:'profile',size:12,cost:3,w:0.16},{key:'search',size:24,cost:34,w:0.14},{key:'session',size:12,cost:2,w:0.09}];
    const operations: Operation[] = definitions.map(({key,size,cost}) => ({kind:'set',key,size,cost}));
    const weighted = () => {
      const roll = random(); let sum = 0;
      for (const item of definitions) { sum += item.w; if (roll <= sum) return item; }
      return definitions[0]!;
    };
    const rounds = id === 'pressure' ? 32 : 38;
    for (let i = 0; i < rounds; i++) {
      // Regular cold arrivals create eviction pressure; weighted reads preserve a realistic skew.
      if (i % 7 === 6) {
        const size = id === 'pressure' ? 18 + Math.floor(random() * 16) : 8 + Math.floor(random() * 12);
        operations.push({kind:'set',key:`cold-${i + 1}`,size,cost:1 + Math.floor(random() * 4)});
      } else {
        const item = weighted();
        operations.push({kind:'get',key:item.key});
      }
    }
    // Scale the workload pressure to the selected budget without changing the random seed.
    if (capacity <= 64) {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        if (op?.kind === 'set' && !op.key.startsWith('cold-')) operations[i] = {...op,size:Math.max(8,Math.round(op.size * 0.82))};
      }
    }
    return { ...scenarioMeta[id], operations };
  }

  type RunState = { snapshots: Snapshot[]; step: number };
  let scenario: ScenarioId = 'balanced';
  let capacity = 100;
  let runs: Record<ScenarioId, RunState> = { balanced:{snapshots:[],step:0}, expensive:{snapshots:[],step:0}, pressure:{snapshots:[],step:0} };
  let playing = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let showDetails = false;
  let darkMode = false;
  const ids: ScenarioId[] = ['balanced','expensive','pressure'];
  $: activeRun = runs[scenario];
  $: current = activeRun.snapshots[Math.max(0, activeRun.step - 1)];
  $: progress = activeRun.snapshots.length ? (activeRun.step / activeRun.snapshots.length) * 100 : 0;
  $: finished = ids.every((id) => runs[id].step >= runs[id].snapshots.length && runs[id].snapshots.length > 0);
  $: scenarioProgress = ids.map((id) => ({id,label:scenarioMeta[id].label,step:runs[id].step,total:runs[id].snapshots.length}));

  function buildSnapshots(id: ScenarioId, maxBytes: number): Snapshot[] {
    let now = 1_000;
    const lruEvents: string[] = [], smartEvents: string[] = [];
    const lru = new Cache<string,string>({maxBytes,policy:'lru',now:()=>now,estimateSize:(value)=>Number(value.split('|')[0]),onEvent:(event)=>{if(event.type==='evict')lruEvents.push(event.key);}});
    const smart = new Cache<string,string>({maxBytes,policy:'cost-aware',now:()=>now,frequencyHalfLife:100_000,estimateSize:(value)=>Number(value.split('|')[0]),onEvent:(event)=>{if(event.type==='evict')smartEvents.push(event.key);}});
    const result: Snapshot[] = []; let lruComputeCost = 0, smartComputeCost = 0;
    const ops = makeWorkload(id,maxBytes).operations;
    const view = (cache: Cache<string,string>): EntryView[] => [...cache.entries()].map(([key]) => {
      const meta = cache.getEntryMetadata(key)!;
      return {key,size:meta.size,cost:meta.computeCost,frequency:meta.frequency,last:meta.lastAccessedAt};
    });
    for (let i=0;i<ops.length;i++) {
      now += 1_000; const op = ops[i]; if (!op) continue;
      const beforeLru=lruEvents.length,beforeSmart=smartEvents.length; let lruRejected=false,smartRejected=false;
      if(op.kind==='get') {
        const lruBefore=lru.getStats().misses,smartBefore=smart.getStats().misses;
        lru.get(op.key); smart.get(op.key);
        const known=ops.find((candidate)=>candidate.kind==='set'&&candidate.key===op.key);
        const cost=known?.kind==='set'?known.cost:1;
        if(lru.getStats().misses>lruBefore)lruComputeCost+=cost;
        if(smart.getStats().misses>smartBefore)smartComputeCost+=cost;
      } else {
        const value=`${op.size}|${op.key}`;
        lruRejected=!lru.set(op.key,value,{size:op.size,computeCost:op.cost});
        smartRejected=!smart.set(op.key,value,{size:op.size,computeCost:op.cost});
      }
      const label=op.kind==='get'?`Read ${op.key}`:`Computed ${op.key}`;
      result.push({operation:`${String(i+1).padStart(2,'0')} · ${label}`,detail:op.kind==='get'?'Both caches receive the same lookup.':`${op.size} logical KB · estimated recomputation cost ${op.cost}.`,lru:view(lru),smart:view(smart),lruStats:lru.getStats(),smartStats:smart.getStats(),lruEvicted:lruEvents.slice(beforeLru),smartEvicted:smartEvents.slice(beforeSmart),lruRejected,smartRejected,lruComputeCost,smartComputeCost});
    }
    return result;
  }
  function rebuildAll() {
    stop();
    const next = {} as Record<ScenarioId,RunState>;
    for(const id of ids) next[id]={snapshots:buildSnapshots(id,capacity),step:0};
    runs=next;
  }
  function chooseScenario(id:ScenarioId){scenario=id;}
  function setBudget(value:string){const parsed=Number(value);if(budgets.includes(parsed)){capacity=parsed;rebuildAll();}}
  function nextAll(){
    let allDone=true;
    for(const id of ids){const run=runs[id];if(run.step<run.snapshots.length){run.step+=1;allDone=false;}}
    runs={...runs};
    if(allDone||ids.every((id)=>runs[id].step>=runs[id].snapshots.length))stop();
  }
  function play(){if(finished)rebuildAll();playing=true;timer=setInterval(nextAll,700);}
  function stop(){playing=false;if(timer)clearInterval(timer);timer=undefined;}
  function togglePlay(){if(playing)stop();else play();}
  function reset(){rebuildAll();}
  function toggleTheme(){darkMode=!darkMode;document.documentElement.classList.toggle('dark',darkMode);document.documentElement.style.colorScheme=darkMode?'dark':'light';try{localStorage.setItem('cachewise-theme',darkMode?'dark':'light');}catch{/* storage may be unavailable */}}
  function formatCost(n:number){return n.toLocaleString('en-US',{maximumFractionDigits:0});}
  function width(n:number){return `${Math.min(100,(n/capacity)*100)}%`;}
  function evictionText(names:string[],rejected:boolean){if(rejected)return 'Admission declined — keeping the current working set.';if(!names.length)return 'No eviction required.';return `Evicted ${names.join(', ')}.`;}
  function costReduction(lru:number,smart:number){return lru>0?Math.round(((lru-smart)/lru)*100):0;}
  if(typeof window!=='undefined'){
    let stored:string|null=null;try{stored=localStorage.getItem('cachewise-theme');}catch{/* ignore */}
    darkMode=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark',darkMode);document.documentElement.style.colorScheme=darkMode?'dark':'light';
  }
  rebuildAll();
  onDestroy(stop);
</script>

<svelte:head>
  <title>Cachewise — Recompute less. Remember smarter.</title>
  <meta name="description" content="An interactive comparison of LRU and computation-aware caching." />
  <meta name="theme-color" content={darkMode?'#111110':'#fdfbf7'} />
</svelte:head>

<div class="site-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Cachewise home"><span class="brand-mark"><span></span><span></span><span></span></span><span>cachewise</span></a>
    <div class="header-actions">
      <button class="theme-toggle" onclick={toggleTheme} aria-label={darkMode?'Switch to light mode':'Switch to dark mode'} title={darkMode?'Light mode':'Dark mode'}>{#if darkMode}<Sun size={17}/>{:else}<Moon size={17}/>{/if}</button>
      <a class="github-link" href="https://github.com/weluvabid/cachewise" target="_blank" rel="noreferrer" aria-label="Cachewise on GitHub"><Code2 size={18} strokeWidth={1.8}/><span>Source</span><ArrowUpRight size={14}/></a>
    </div>
  </header>
  <main>
    <section class="intro"><div class="eyebrow"><span class="live-dot"></span> COMPUTATION-AWARE CACHING</div><h1>Recompute less.<br/><span>Remember smarter.</span></h1><p>LRU remembers what you touched last. Cachewise weighs what it would cost to compute again.</p></section>
    <section class="demo" aria-label="Interactive cache comparison">
      <div class="demo-heading"><div><div class="section-kicker">INTERACTIVE SIMULATION</div><h2>Same workload. Different decisions.</h2></div>
        <div class="budget"><Database size={15}/><span>Memory budget</span>
          <Select.Root type="single" value={String(capacity)} onValueChange={setBudget}>
            <Select.Trigger class="budget-select"><Select.Value placeholder="Select budget"/></Select.Trigger>
            <Select.Content>{#each budgets as budget (budget)}<Select.Item value={String(budget)}>{budget} KB</Select.Item>{/each}</Select.Content>
          </Select.Root>
        </div>
      </div>
      <div class="scenario-row">
        <div class="scenario-pills" role="group" aria-label="Choose workload">
          {#each ids as id (id)}<button class:chosen={scenario===id} class="scenario-pill" onclick={()=>chooseScenario(id)}>{scenarioMeta[id].label}<span class="tab-progress">{runs[id].step}/{runs[id].snapshots.length}</span></button>{/each}
        </div>
        <p class="scenario-description">{scenarioMeta[scenario].description} <span>Seeded · reproducible</span></p>
      </div>
      <div class="comparison-grid">
        <article class="cache-card"><div class="cache-card-head"><div><div class="cache-label">BASELINE</div><h3>LRU</h3><p>Least recently used</p></div><span class="policy-tag">Recency only</span></div>
          <div class="memory-line"><span>Memory used</span><strong>{current?.lruStats.bytesUsed??0} <small>/ {capacity} KB</small></strong></div><div class="memory-track"><div class="memory-fill" style={`width:${width(current?.lruStats.bytesUsed??0)}`}></div></div>
          <div class="entries-label"><span>RESIDENT ENTRIES</span><span>{current?.lru.length??0}</span></div><div class="entry-list">{#if current?.lru.length}{#each current.lru as entry (entry.key)}<div class="entry"><span class="entry-dot"></span><strong>{entry.key}</strong><span class="entry-meta">{entry.size} KB</span><span class="entry-cost">cost {formatCost(entry.cost)}</span></div>{/each}{:else}<div class="empty-state">Run the workload to populate the cache.</div>{/if}</div>
          <div class="decision"><span class="decision-icon"><Activity size={14}/></span><span>{current?evictionText(current.lruEvicted,current.lruRejected):'Waiting for workload.'}</span></div>
        </article>
        <article class="cache-card smart-card"><div class="cache-card-head"><div><div class="cache-label">COMPUTATION-AWARE</div><h3>Cachewise</h3><p>Value of avoided computation</p></div><span class="policy-tag accent-tag"><Zap size={12}/> Cost-aware</span></div>
          <div class="memory-line"><span>Memory used</span><strong>{current?.smartStats.bytesUsed??0} <small>/ {capacity} KB</small></strong></div><div class="memory-track"><div class="memory-fill smart-fill" style={`width:${width(current?.smartStats.bytesUsed??0)}`}></div></div>
          <div class="entries-label"><span>RESIDENT ENTRIES</span><span>{current?.smart.length??0}</span></div><div class="entry-list">{#if current?.smart.length}{#each current.smart as entry (entry.key)}<div class="entry"><span class="entry-dot smart-dot"></span><strong>{entry.key}</strong><span class="entry-meta">{entry.size} KB</span><span class="entry-cost">cost {formatCost(entry.cost)}</span></div>{/each}{:else}<div class="empty-state">Run the workload to populate the cache.</div>{/if}</div>
          <div class="decision smart-decision"><span class="decision-icon"><Zap size={14}/></span><span>{current?evictionText(current.smartEvicted,current.smartRejected):'Waiting for workload.'}</span></div>
        </article>
      </div>
      <div class="operation-bar"><div class="operation-current"><span class="operation-index">{activeRun.step?String(activeRun.step).padStart(2,'0'):'—'}<i>/{activeRun.snapshots.length}</i></span><div><span class="cache-label">CURRENT OPERATION · {scenarioMeta[scenario].label.toUpperCase()}</span><strong>{current?.operation??'Ready to simulate'}</strong><small>{current?.detail??'Choose a workload, then run or step through all scenarios.'}</small></div></div>
        <div class="controls"><button class="control-button primary-control" onclick={togglePlay} aria-label={playing?'Pause all simulations':'Run all simulations'}>{#if playing}<Pause size={15}/><span>Pause all</span>{:else}<Play size={15}/><span>{finished?'Replay all':'Run all'}</span>{/if}</button><button class="control-button" onclick={()=>{stop();nextAll();}} disabled={finished||playing}><SkipForward size={15}/><span>Step all</span></button><button class="icon-control" onclick={reset} aria-label="Reset all simulations"><RotateCcw size={15}/></button></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style={`width:${progress}%`}></div></div>
      <div class="all-progress">{#each scenarioProgress as item (item.id)}<div class="progress-item"><span>{item.label}</span><div><i style={`width:${item.total?item.step/item.total*100:0}%`}></i></div><small>{item.step}/{item.total}</small></div>{/each}</div>
      <div class="metrics"><div class="metric-title"><span>RUN SUMMARY · {scenarioMeta[scenario].label.toUpperCase()}</span><span>{activeRun.step>=activeRun.snapshots.length?'COMPLETE':activeRun.step?'IN PROGRESS':'NOT STARTED'}</span></div>
        {#each [{label:'Hit rate',l:current?(current.lruStats.hits/Math.max(1,current.lruStats.hits+current.lruStats.misses))*100:0,s:current?(current.smartStats.hits/Math.max(1,current.smartStats.hits+current.smartStats.misses))*100:0,suffix:'%'},{label:'Misses',l:current?.lruStats.misses??0,s:current?.smartStats.misses??0,suffix:''},{label:'Recompute cost',l:current?.lruComputeCost??0,s:current?.smartComputeCost??0,suffix:''},{label:'Cost reduction',l:0,s:current?costReduction(current.lruComputeCost,current.smartComputeCost):0,suffix:'%'}] as metric (metric.label)}<div class="metric-cell"><span>{metric.label}</span><div><strong>{metric.l.toFixed(metric.suffix==='%'?1:0)}{metric.suffix}</strong><i>LRU</i><strong class="smart-number">{metric.s.toFixed(metric.suffix==='%'?1:0)}{metric.suffix}</strong><i>CW</i></div></div>{/each}
      </div>
      <div class="result-note">All figures come from the same deterministic operation stream executed by both cache policies. Cost reduction compares accumulated miss cost; negative values mean Cachewise incurred more cost in this run.</div>
      <button class="details-toggle" onclick={()=>showDetails=!showDetails} aria-expanded={showDetails}><span>How to read this comparison</span><ChevronDown size={15} class={showDetails?'rotated':''}/></button>
      {#if showDetails}<div class="details-copy"><p><strong>LRU</strong> selects the entry that has gone longest without an access.</p><p><strong>Cachewise</strong> scores entries using recency, observed reuse, recomputation cost and logical size. It can decline an incoming entry when its estimated value does not justify displacing a resident one.</p><p>Workloads use fixed seeds and weighted access distributions. Both policies receive identical operations and the selected memory budget. Results are generated by the actual Cachewise implementation.</p></div>{/if}
    </section>
    <section class="principle"><div class="principle-icon"><Cpu size={18}/></div><div><span class="section-kicker">THE IDEA</span><p>A cache miss has a cost. Cachewise treats that cost as part of the eviction decision — not just how recently an entry was used.</p></div></section>
  </main>
  <footer><div class="footer-brand"><span class="brand-mark small-mark"><span></span><span></span><span></span></span> cachewise <span class="footer-note">Recompute less. Remember smarter.</span></div><nav aria-label="Project resources"><a href="https://github.com/weluvabid/cachewise" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12}/></a><a href="https://github.com/weluvabid/cachewise/tree/main/docs" target="_blank" rel="noreferrer">Docs <ArrowUpRight size={12}/></a><a href="https://github.com/weluvabid/cachewise/issues" target="_blank" rel="noreferrer">Issues <ArrowUpRight size={12}/></a></nav></footer>
</div>
