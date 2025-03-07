<script lang="ts">
  import QrScanner from 'qr-scanner';
  import { onMount, onDestroy } from 'svelte';

  // Define component props
  const { onScanSuccess } = $props<{
    onScanSuccess: (data: string) => void;
  }>();
  
  // State management with Svelte 5 runes
  let isModalOpen = $state(false);
  let qrScanner: QrScanner | null = $state(null);
  let videoElement: HTMLVideoElement;
  let hasError = $state(false);
  let errorMessage = $state('');

  // Reactive effect to handle modal state changes
  $effect(() => {
    if (isModalOpen) {
      startScanner();
    } else if (qrScanner) {
      stopScanner();
    }
  });

  // Clean up resources when component is destroyed
  onDestroy(() => {
    if (qrScanner) {
      qrScanner.destroy();
      qrScanner = null;
    }
  });

  // Initialize the scanner with the video element
  function initializeScanner() {
    if (!videoElement || qrScanner) return;
    
    try {
      qrScanner = new QrScanner(
        videoElement,
        (result) => {
          isModalOpen = false;
          onScanSuccess(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
          maxScansPerSecond: 5,
          returnDetailedScanResult: true,
        }
      );
      
      hasError = false;
      errorMessage = '';
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : 'Failed to initialize scanner';
      console.error("QR Scanner initialization error:", error);
    }
  }

  // Start the scanner
  async function startScanner() {
    if (!qrScanner) {
      initializeScanner();
    }
    
    try {
      await qrScanner?.start();
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : 'Camera access failed';
      console.error("QR Scanner error:", error);
    }
  }

  // Stop the scanner
  async function stopScanner() {
    try {
      await qrScanner?.stop();
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }
  }

  // Reset error state and retry scanner
  function retryScanner() {
    hasError = false;
    errorMessage = '';
    
    if (qrScanner) {
      qrScanner.destroy();
      qrScanner = null;
    }
    
    setTimeout(() => {
      startScanner();
    }, 100);
  }
</script>

<label for="scan-qr-modal" class="btn gap-2">Scan QR Code</label>

<input
  type="checkbox"
  id="scan-qr-modal"
  class="modal-toggle"
  bind:checked={isModalOpen}
/>

<label for="scan-qr-modal" class="modal cursor-pointer">
  <label
    class="modal-box relative flex flex-col justify-center items-center p-4 w-fit max-w-none"
    for=""
  >
    <h3 class="text-lg font-bold mb-4">Scan QR Code</h3>
    
    {#if hasError}
      <div class="text-error mb-4">
        <p>Error: {errorMessage}</p>
        <button class="btn btn-sm btn-primary mt-2" onclick={retryScanner}>
          Retry
        </button>
      </div>
    {/if}
    
    <video 
      class="w-96 max-w-full h-auto rounded-lg" 
      id="reader" 
      bind:this={videoElement}
    >
      <track kind="captions" />
    </video>
    
    <p class="text-sm mt-4 text-center">
      Position your QR code in the camera view
    </p>
  </label>
</label>