<script lang="ts">
  import { Cpu } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import Simulation from '$lib/components/demo/Simulation.svelte';
  import SiteFooter from '$lib/components/site/SiteFooter.svelte';
  import SiteHeader from '$lib/components/site/SiteHeader.svelte';

  let darkMode = $state(false);

  function applyTheme(value: boolean): void {
    darkMode = value;
    document.documentElement.classList.toggle('dark', value);
    document.documentElement.style.colorScheme = value ? 'dark' : 'light';
    try {
      localStorage.setItem('cachewise-theme', value ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }

  function toggleTheme(): void {
    applyTheme(!darkMode);
  }

  onMount(() => {
    let preference: string | null = null;
    try {
      preference = localStorage.getItem('cachewise-theme');
    } catch {
      // Fall back to the operating-system preference.
    }
    applyTheme(preference ? preference === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
</script>

<svelte:head>
  <title>Cachewise — Recompute less. Remember smarter.</title>
  <meta name="description" content="An interactive comparison of LRU and computation-aware caching."/>
</svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
  <SiteHeader {darkMode} onToggleTheme={toggleTheme}/>
  <main class="flex-1">
    <section class="mx-auto max-w-3xl space-y-5 py-16 sm:py-20">
      <p class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="size-2 rounded-full bg-primary"></span>
        COMPUTATION-AWARE CACHING
      </p>
      <h1 class="text-5xl font-semibold tracking-tight sm:text-7xl">
        Recompute less.<br/><span class="text-muted-foreground">Remember smarter.</span>
      </h1>
      <p class="max-w-xl text-base text-muted-foreground">
        LRU remembers what you touched last. Cachewise weighs what it would cost to compute again.
      </p>
    </section>

    <Simulation/>

    <section class="mx-auto flex max-w-2xl items-start gap-4 py-12">
      <div class="rounded-md border p-2"><Cpu size={18}/></div>
      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">THE IDEA</p>
        <p class="text-sm text-muted-foreground">
          A cache miss has a cost. Cachewise treats that cost as part of the eviction decision — not just how recently an entry was used.
        </p>
      </div>
    </section>
  </main>
  <SiteFooter/>
</div>
