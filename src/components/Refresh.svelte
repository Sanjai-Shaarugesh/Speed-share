<script lang='ts'>
  import { Capacitor } from '@capacitor/core';
  import { onMount , onDestroy } from 'svelte';
    import {RadioTower} from '@lucide/svelte';


  let isNative = $state(false);

  onMount(() => {

    isNative = Capacitor.isNativePlatform();
  });

  function refreshPage() {
    if (isNative) {


      setTimeout(() => {
        window.location.href = window.location.href;
      }, 300);
    } else {

      window.location.reload();
    }
  }

  onMount(()=>{
    const handleShorcuts = (e:KeyboardEvent) =>{
      if(e.ctrlKey && e.key.toLowerCase() == 'r'){
         window.location.reload();
      }
    }

    window.addEventListener('keydown', handleShorcuts);

    onDestroy(()=>{
      window.removeEventListener('keydown', handleShorcuts);
    })
  })
</script>

<main class="flex flex-col justify-between">

  <div class="fixed bottom-10 left-0 right-0 flex justify-center px-4 mb-10 mt-10 animate-bounce duration-1000">
    <button
      onclick={refreshPage}
      class="group flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition duration-200"
    >
        {#if isNative}
     New Connection <RadioTower size={20} />
      {:else}
      New Connection <RadioTower size={20} />
      {/if}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="lucide lucide-refresh-ccw-dot group-hover:animate-spin group-active:animate-spin transition-transform duration-1000"
      >
        <path d="M3 2v6h6" />
        <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
        <path d="M21 22v-6h-6" />
        <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    </button>
  </div>
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
  }

  /* Mobile Responsive Adjustments */
  @media (max-width: 640px) {
    button {
      padding: 10px 12px;
      font-size: 14px;
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }

  /* Ensure spin animation is properly defined for all contexts */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  :global(.group-active\:animate-spin:active),
  :global(.group-hover\:animate-spin:hover) {
    animation: spin 1s linear infinite;
  }
</style>