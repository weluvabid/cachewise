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

<th
  bind:this={ref}
  class={cn(
    'text-muted-foreground h-10 px-3 text-left align-middle font-medium whitespace-nowrap',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</th>
