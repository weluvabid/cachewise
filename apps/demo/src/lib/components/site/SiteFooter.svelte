<script lang="ts">
  import { SiGithub } from '@icons-pack/svelte-simple-icons';
  import { BookOpenText } from '@lucide/svelte';
</script>

<footer
  class="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 py-6 text-sm text-muted-foreground"
>
  <span class="inline-flex items-center gap-2 font-semibold text-foreground">
    <img
      src={`${import.meta.env.BASE_URL}signature.svg`}
      alt=""
      width="20"
      height="20"
      class="size-5 dark:invert"
    />
  </span>
  <nav class="flex items-center gap-1" aria-label="Project resources">
    <a
      class="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground surface-transition active:scale-95 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href="https://github.com/weluvabid/cachewise"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Cachewise source code on GitHub (opens in a new tab)"
      title="Source code"
    >
      <SiGithub size={19} aria-hidden="true" />
    </a>
    <a
      class="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground surface-transition active:scale-95 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href="https://github.com/weluvabid/cachewise/tree/main/docs"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Cachewise documentation (opens in a new tab)"
      title="Documentation"
    >
      <BookOpenText size={19} aria-hidden="true" />
    </a>
  </nav>
</footer>
