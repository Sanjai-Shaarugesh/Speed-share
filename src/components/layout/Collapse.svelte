<script lang="ts">
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  type Props = {
    title: string;
    isOpen?: boolean;
    children: () => any;
    toggleable?: boolean;
  };

  let { title, isOpen = $bindable(false), children, toggleable = true }: Props = $props();

  function toggle() {
    if (toggleable) {
      isOpen = !isOpen;
    }
  }
</script>

<div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow duration-200 border border-base-300">
  <button
    type="button"
    onclick={toggle}
    disabled={!toggleable}
    class="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset touch-manipulation rounded-t-2xl
           {isOpen ? 'bg-primary/10 hover:bg-primary/20' : 'bg-base-200 hover:bg-base-300'}
           {!toggleable ? 'cursor-default opacity-75' : 'cursor-pointer'}
           disabled:cursor-not-allowed disabled:opacity-50"
  >
    <div class="flex items-center justify-between gap-2 sm:gap-4">
      <h3 class="text-sm sm:text-base md:text-lg font-medium transition-colors duration-200 flex-1 min-w-0
               {isOpen ? 'text-primary' : 'text-base-content'}">
        <span class="truncate block">{title}</span>
      </h3>
      
      {#if toggleable}
        <div class="transform transition-transform duration-300 ease-out flex-shrink-0
                   {isOpen ? 'rotate-180' : 'rotate-0'}">
          <svg class="w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-200
                     {isOpen ? 'text-primary' : 'text-base-content/60'}"
               fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      {/if}
    </div>
  </button>

  {#if isOpen}
    <div 
      transition:slide={{ duration: 400, easing: quintOut }} 
      class="border-t border-base-300 bg-base-100"
    >
      <div class="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-sm sm:text-base text-base-content/80 leading-relaxed">
        <div class="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          {@render children?.()}
        </div>
      </div>
    </div>
  {/if}
</div>