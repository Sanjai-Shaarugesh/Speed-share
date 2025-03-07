<script lang="ts">
  import QrScanner from 'qr-scanner';
  import { onMount, onDestroy } from 'svelte';

  type Props = {
    onScanSuccess: (data: string) => void;
  };

  const { onScanSuccess }: Props = $props();

  let isModalOpen = $state(false);
  let qrScanner: QrScanner | undefined = $state(undefined);
  let videoElement: HTMLVideoElement;

  // Configuration for better performance
  const qrScannerOptions = {
    highlightScanRegion: true,
    highlightCodeOutline: true,
    preferredCamera: 'environment', // Use back camera for better scanning
    maxScansPerSecond: 5, // Limit scanning frequency to reduce CPU usage
  };

  onMount(() => {
    qrScanner = new QrScanner(
      document.getElementById('reader') as any,
      (decodedText: QrScanner.ScanResult) => {
        isModalOpen = false;
        onScanSuccess(decodedText.data);
      },
      {}
    );
  });

  onDestroy(() => {
    // Ensure scanner is properly destroyed to free resources
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
    }
  });

  function initializeScanner() {
    if (!qrScanner && videoElement) {
      qrScanner = new QrScanner(
        videoElement,
        (result) => {
          isModalOpen = false;
          onScanSuccess(result.data);
        },
        qrScannerOptions
      );
      start();
    }
  }

  function start() {
    qrScanner?.start().catch(error => {
      console.error('Failed to start QR scanner:', error);
    });
  }

  function stop() {
    if (qrScanner) {
      qrScanner.stop();
    }
  }

  function handleModalToggle(isOpen: boolean) {
    if (isOpen) {
      // Initialize scanner when modal opens
      setTimeout(() => initializeScanner(), 100);
    } else {
      // Stop scanner when modal closes
      stop();
    }
  }
</script>

<label for="scan-qr-modal" class="btn gap-2"> Scan QR Code </label>

<input
  type="checkbox"
  id="scan-qr-modal"
  class="modal-toggle"
  bind:checked={isModalOpen}
  onchange={() => handleModalToggle(isModalOpen)}
/>
<label for="scan-qr-modal" class="modal cursor-pointer">
  <label
    class="modal-box relative flex flex-col justify-center items-center p-2 w-fit max-w-none"
    for=""
  >
    <h3 class="text-lg font-bold">Scan QR Code</h3>
    <video 
      bind:this={videoElement} 
      class="w-96 max-w-full h-auto" 
      id="reader"
    >
      <track kind="captions" />
    </video>
  </label>
</label>