<script>
  import { Capacitor } from '@capacitor/core';

  function refreshPage() {
    location.reload(); // Works for both native and web
  }
</script>

<main class="flex flex-col justify-between min-h-screen ">
  

  <div class="fixed bottom-6 left-0 right-0 flex justify-center px-4">
    <button
      onclick={refreshPage}
      class="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition duration-200"
    >
      Refresh Page
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-ccw-dot">
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
</style>
