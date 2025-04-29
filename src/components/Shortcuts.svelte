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
      class="flex items-center justify-center p-2 bg-gray-100 dark:bg-gray-700 rounded-full shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-800 dark:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    </button>

    <!-- Popover -->
    <div
      id="popover-default"
      role="tooltip"
      class="absolute bottom-12 right-0 z-20 w-96 text-sm text-gray-500 transition-opacity duration-200 bg-white border border-gray-200 rounded-lg shadow-xl dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800 opacity-0 invisible group-hover:visible group-hover:opacity-100"
    >
      <!-- Title -->
      <div class="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-lg dark:border-gray-600 dark:bg-gray-700">
        <h3 class="font-semibold text-gray-900 dark:text-white">Keyboard Shortcuts</h3>
      </div>

      <!-- Content with scroll if too large -->
      <div class="px-4 py-3 max-h-96 overflow-y-auto">
        <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400 sticky top-0 z-10">
            <tr>
              <th scope="col" class="px-4 py-3">Key</th>
              <th scope="col" class="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            
            <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
              <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">ctrl</kbd>
                <span class="mx-1">+</span>
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">c</kbd>
              </td>
              <td class="px-4 py-3">Copy the offer code</td>
            </tr>
            
            <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
              <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">ctrl</kbd>
                <span class="mx-1">+</span>
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">p</kbd>
              </td>
              <td class="px-4 py-3">Paste code</td>
            </tr>
            
            <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
              <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">ctrl</kbd>
                <span class="mx-1">+</span>
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">o</kbd>
              </td>
              <td class="px-4 py-3">generate offer code</td>
            </tr>
            
            <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
              <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">ctrl</kbd>
                <span class="mx-1">+</span>
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">a</kbd>
              </td>
              <td class="px-4 py-3">accept offer code</td>
            </tr>
            
            <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
              <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">alt</kbd>
                <span class="mx-1">+</span>
                <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">s</kbd>
              </td>
              <td class="px-4 py-3">open settings</td>
            </tr>
            
            <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
                                <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">g</kbd>
                                  <span class="mx-1">+</span>
                                  <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">o</kbd>
                                </td>
                                
                                <td class="px-4 py-3">go to offer page</td>
                              </tr>
                              <tr class="bg-white border-b dark:bg-gray-900 dark:border-gray-700">
                                                  <td class="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">g</kbd>
                                                    <span class="mx-1">+</span>
                                                    <kbd class="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">a</kbd>
                                                  </td>
                                                  
                                                  <td class="px-4 py-3">go to answer page</td>
                                                </tr>             
          </tbody>
          
          
        </table>
      </div>
      <div data-popper-arrow></div>
    </div>
  </div>
</div>
{/if}