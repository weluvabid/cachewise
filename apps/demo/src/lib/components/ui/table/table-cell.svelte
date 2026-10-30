<script lang="ts">
  import { cn, type WithElementRef } from '$lib/utils.js';
  import type { HTMLAttributes } from 'svelte/elements';

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableCellElement>> = $props();
</script>

<td bind:this={ref} class={cn('p-3 align-middle whitespace-nowrap', className)} {...restProps}>
  {@render children?.()}
</td>
