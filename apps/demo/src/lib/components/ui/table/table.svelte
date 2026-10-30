<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js';
  import type { HTMLAttributes } from 'svelte/elements';

  let { ref = $bindable(null), class: className, children, ...restProps }: WithElementRef<HTMLAttributes<HTMLTableElement>> = $props();
</script>

<div class="relative w-full overflow-x-auto">
  <table bind:this={ref} class={cn('w-full caption-bottom text-sm', className)} {...restProps}>
    {@render children?.()}
  </table>
</div>
