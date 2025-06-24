<script>
  import { Capacitor } from '@capacitor/core';
   import { onMount } from 'svelte';
 
   let isMobile = false;
 
   onMount(() => {
     isMobile = Capacitor.isNativePlatform();
   });
    </script>

{#if !isMobile}
<!-- Keyboard shortcuts reference - responsive positioning -->
<div class="hidden sm:block fixed bottom-4 right-4 z-10 md:bottom-10 md:right-6 py-4">
  <div class="relative group">
    <!-- Button -->
    <button 
      id="toggleShortcutsBtn"
      aria-label="Toggle keyboard shortcuts" 
      class="btn btn-circle btn-ghost shadow-lg"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    </button>

    <!-- Popover -->
    <div
      id="popover-default"
      role="tooltip"
      class="absolute bottom-12 right-0 z-20 w-96 text-sm transition-opacity duration-200 card bg-base-100 shadow-xl border border-base-300 opacity-0 invisible group-hover:visible group-hover:opacity-100"
    >
      <!-- Title -->
      <div class="card-body p-0">
        <div class="px-3 py-2 bg-base-200 border-b border-base-300 rounded-t-lg">
          <h3 class="font-semibold text-base-content">Keyboard Shortcuts</h3>
        </div>

        <!-- Content with scroll if too large -->
        <div class="px-4 py-3 max-h-96 overflow-y-auto">
          <div class="overflow-x-auto">
            <table class="table table-sm w-full">
              <thead class="sticky top-0 z-10">
                <tr>
                  <th class="bg-base-200">Key</th>
                  <th class="bg-base-200">Description</th>
                </tr>
              </thead>
              <tbody>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">ctrl</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">c</kbd>
                  </td>
                  <td>Copy the offer code</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">ctrl</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">p</kbd>
                  </td>
                  <td>Paste code</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">ctrl</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">o</kbd>
                  </td>
                  <td>generate offer code</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">ctrl</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">a</kbd>
                  </td>
                  <td>accept offer code</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">alt</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">s</kbd>
                  </td>
                  <td>open settings</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">alt</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">s</kbd>
                  </td>
                  <td>open QR scanner</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">ctrl</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">Q</kbd>
                  </td>
                  <td>show QR code</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">ctrl</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">r</kbd>
                  </td>
                  <td>refresh Page</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">g</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">o</kbd>
                  </td>
                  <td>go to offer page</td>
                </tr>
                
                <tr class="hover">
                  <td class="font-medium whitespace-nowrap">
                    <kbd class="kbd kbd-sm">g</kbd>
                    <span class="mx-1">+</span>
                    <kbd class="kbd kbd-sm">a</kbd>
                  </td>
                  <td>go to answer page</td>
                </tr>
                
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div data-popper-arrow></div>
    </div>
  </div>
</div>
{/if}