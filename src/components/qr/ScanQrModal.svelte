<script lang="ts">
  import QrScanner from 'qr-scanner';
  import { onMount, onDestroy } from 'svelte';

  // Import Capacitor plugins dynamically to avoid Vite bundling issues
  let Camera: any;
  let Capacitor: any;
  let isNative = false;

  type Props = {
    onScanSuccess: (data: string) => void;
  };

  const { onScanSuccess }: Props = $props();

  let isModalOpen = $state(false);
  let qrScanner: QrScanner | undefined = $state(undefined);
  let hasCameraPermission = $state(false);
  let isCapacitorLoaded = $state(false);

  onMount(async () => {
    // Dynamically import Capacitor modules only when needed
    try {
      const capacitorCore = await import('@capacitor/core');
      Capacitor = capacitorCore.Capacitor;
      isNative = Capacitor.isNativePlatform();
      
      if (isNative) {
        const capacitorCamera = await import('@capacitor/camera');
        Camera = capacitorCamera.Camera;
        
        // Request camera permissions for mobile
        try {
          const permissionStatus = await Camera.requestPermissions({
            permissions: ['camera']
          });
          hasCameraPermission = permissionStatus.camera === 'granted';
        } catch (error) {
          console.error('Error requesting camera permission:', error);
        }
      } else {
        // For web, we'll check permissions when starting the scanner
        hasCameraPermission = true;
      }
      isCapacitorLoaded = true;
    } catch (error) {
      console.error('Capacitor not available, falling back to web-only mode:', error);
      // Fall back to web-only mode if Capacitor fails to load
      isNative = false;
      hasCameraPermission = true;
      isCapacitorLoaded = true;
    }

    // Initialize QR scanner
    const videoElement = document.getElementById('reader') as HTMLVideoElement;
    if (videoElement) {
      qrScanner = new QrScanner(
        videoElement,
        (result: QrScanner.ScanResult) => {
          isModalOpen = false;
          onScanSuccess(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true
        }
      );
    }
  });

  onDestroy(() => {
    // Clean up resources when component is destroyed
    if (qrScanner) {
      qrScanner.destroy();
    }
  });

  async function start() {
    if (!qrScanner) return;

    try {
      // For web, this will trigger permission request if not already granted
      await qrScanner.start();
    } catch (error) {
      console.error('Failed to start scanner:', error);
      hasCameraPermission = false;
    }
  }

  async function stop() {
    if (qrScanner) {
      await qrScanner.stop();
    }
  }

  // Handle camera permission errors
  async function requestCameraPermission() {
    if (isNative && Camera) {
      try {
        const result = await Camera.requestPermissions({
          permissions: ['camera']
        });
        hasCameraPermission = result.camera === 'granted';
        if (hasCameraPermission && isModalOpen) {
          start();
        }
      } catch (error) {
        console.error('Error requesting camera permission:', error);
      }
    } else {
      // For web, attempt to start scanner which will trigger permission dialog
      start();
    }
  }
</script>

<label for="scan-qr-modal" class="btn gap-2"> Scan QR Code </label>

<input
  type="checkbox"
  id="scan-qr-modal"
  class="modal-toggle"
  bind:checked={isModalOpen}
  onchange={() => {
    if (isModalOpen) {
      if (!isCapacitorLoaded) {
        return; // Wait for Capacitor to finish loading
      }
      if (hasCameraPermission) {
        start();
      } else {
        requestCameraPermission();
      }
      return;
    }
    stop();
  }}
/>
<label for="scan-qr-modal" class="modal cursor-pointer">
  <label
    class="modal-box relative flex flex-col justify-center items-center p-2 w-fit max-w-none"
    for=""
  >
    <h3 class="text-lg font-bold">Scan QR Code</h3>
    {#if !isCapacitorLoaded}
      <div class="p-4 text-center">
        <p>Loading camera...</p>
      </div>
    {:else if !hasCameraPermission}
      <div class="p-4 text-center">
        <p class="mb-4">Camera permission is required to scan QR codes.</p>
        <button class="btn btn-primary" onclick={requestCameraPermission}>
          Grant Camera Access
        </button>
      </div>
    {:else}
      <video class="w-96 max-w-full h-auto" id="reader">
        <track kind="captions" />
      </video>
    {/if}
  </label>
</label>