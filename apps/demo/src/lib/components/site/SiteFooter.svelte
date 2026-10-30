<script lang="ts">
  import { SiGithub } from '@icons-pack/svelte-simple-icons';
  import { FileText, BookX } from '@lucide/svelte';
</script>

<footer
  class="flex flex-wrap items-center justify-between gap-4 border-t py-6 text-sm text-muted-foreground"
>
  <span class="font-semibold text-foreground">cachewise</span>
  <nav class="flex gap-4" aria-label="Project resources">
    <a href="https://github.com/weluvabid/cachewise" target="_blank" rel="noreferrer">
      <SiGithub size={20} />
    </a>
    <a
      href="https://github.com/weluvabid/cachewise/tree/main/docs"
      target="_blank"
      rel="noreferrer"
    >
      <FileText size={20} />
    </a>
    <a href="https://github.com/weluvabid/cachewise/issues" target="_blank" rel="noreferrer">
      <BookX size={20} />
    </a>
  </nav>
</footer>
