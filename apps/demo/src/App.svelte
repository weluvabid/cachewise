<script lang="ts">
  import { onMount } from 'svelte';
  import Simulation from '$lib/components/demo/Simulation.svelte';
  import SiteFooter from '$lib/components/site/SiteFooter.svelte';
  import SiteHeader from '$lib/components/site/SiteHeader.svelte';
  import { Badge } from '$lib/components/ui/badge';

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
  <title>Cachewise — Computation-aware caching</title>
  <meta name="description" content="An interactive comparison of LRU and computation-aware caching." />
</svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-20 sm:px-6">
  <SiteHeader {darkMode} onToggleTheme={toggleTheme} />
  <main class="flex-1 py-8 sm:py-10">
    <Simulation />
  </main>
  <SiteFooter />
</div>

<Badge
  variant="outline"
  class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border-border/80 bg-background/95 px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur"
>
  COMPUTATION-AWARE CACHING
</Badge>
