<script lang="ts">
  import { onMount } from 'svelte';
  import Simulation from '$lib/components/demo/Simulation.svelte';
  import SiteFooter from '$lib/components/site/SiteFooter.svelte';
  import SiteHeader from '$lib/components/site/SiteHeader.svelte';

  let darkMode = $state(document.documentElement.classList.contains('dark'));

  function applyTheme(value: boolean): void {
    darkMode = value;
    document.documentElement.classList.toggle('dark', value);
    document.documentElement.style.colorScheme = value ? 'dark' : 'light';
    document.documentElement.style.backgroundColor = value ? '#0b0b0b' : '#ffffff';
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', value ? '#0b0b0b' : '#ffffff');
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
    // index.html applies the theme before the first paint. Hydration adopts it
    // instead of briefly rendering the opposite theme.
    darkMode = document.documentElement.classList.contains('dark');
  });
</script>

<svelte:head>
  <title>Cachewise — Computation-aware caching</title>
  <meta
    name="description"
    content="An interactive comparison of LRU and computation-aware caching."
  />
</svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-28 sm:px-6">
  <SiteHeader {darkMode} onToggleTheme={toggleTheme} />
  <main class="flex-1 py-8 sm:py-10">
    <Simulation />
  </main>
  <SiteFooter />
</div>
