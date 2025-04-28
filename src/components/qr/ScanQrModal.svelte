<script lang="ts">
  import QrScanner from 'qr-scanner';
  import { onMount, onDestroy } from 'svelte';
  import { ScanLine } from '@lucide/svelte';
  import { ScanQrCode } from '@lucide/svelte';

  type Props = {
    onScanSuccess: (data: string) => void;
    buttonText?: string;
    modalTitle?: string;
  };

  // Destructure props with defaults
  const {
    onScanSuccess,
    buttonText = 'Scan QR Code',
    modalTitle = 'Scan QR Code'
  }: Props = $props();

  // Reactive states
  let isModalOpen = $state(false);
  let qrScanner: QrScanner | null = $state(null);
  let videoElement = $state<HTMLVideoElement | null>(null);
  let isCameraActive = $state(false);
  let errorMessage = $state('');
  let permissionRequested = $state(false);

  // Initialize scanner on mount
  onMount(() => {
    // Clean up function for when component is destroyed
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  });

  onDestroy(() => {
    stopScanner();
  });

  // Request camera permission explicitly
  async function requestCameraPermission(): Promise<boolean> {
    errorMessage = '';
    permissionRequested = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      errorMessage = 'Your browser does not support camera access.';
      return false;
    }

    try {
      // Attempt to get camera stream to trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment' // Prefer back camera
        }
      });

      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach((track) => track.stop());

      return true;
    } catch (err) {
      const error = err as Error;

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera access was denied. Please grant permission and try again.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Could not find a suitable camera.';
      } else {
        errorMessage = `Camera error: ${error.message || 'Unknown error'}`;
      }

      return false;
    }
  }

  // Start the scanner with error handling
  async function startScanner() {
    errorMessage = '';

    if (!videoElement) {
      errorMessage = 'Video element not found.';
      return;
    }

    // First ensure we have camera permission if not already requested
    if (!permissionRequested) {
      const permissionGranted = await requestCameraPermission();
      if (!permissionGranted) return;
    }

    try {
      qrScanner = new QrScanner(
        videoElement,
        (result) => {
          handleScanSuccess(result);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment'
        }
      );

      qrScanner
        .start()
        .then(() => {
          isCameraActive = true;
        })
        .catch((err) => {
          errorMessage = `Camera error: ${err.message}`;
          isCameraActive = false;

          // If camera failed after permission was supposedly granted,
          // we might need to request again
          if (permissionRequested) {
            permissionRequested = false;
          }
        });
    } catch (err) {
      errorMessage = `Scanner initialization error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Stop the scanner
  function stopScanner() {
    if (qrScanner) {
      qrScanner.stop();
      isCameraActive = false;
    }
  }

  // Handle successful scan
  function handleScanSuccess(result: QrScanner.ScanResult) {
    // Stop scanner to save resources
    stopScanner();
    // Close modal
    isModalOpen = false;
    // Call the success callback with the data
    onScanSuccess(result.data);
  }

  // Toggle modal and scanner state
  function toggleModal(open: boolean) {
    isModalOpen = open;
    if (open) {
      // Request permission immediately when modal opens
      setTimeout(() => {
        if (!permissionRequested) {
          requestCameraPermission().then((granted) => {
            if (granted) {
              startScanner();
            }
          });
        } else {
          startScanner();
        }
      }, 100);
    } else {
      stopScanner();
    }
  }

  onMount(() => {
    function handleShortcut(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleModal(true); // 🛠️ OPEN the scanner modal
      }
    }

    window.addEventListener('keydown', handleShortcut);

    // Clean-up function
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  });
</script>

<!-- Styled button to open the modal -->
<button
  class="btn btn-soft btn-secondary"
  onclick={() => toggleModal(true)}
  aria-label="Open QR Scanner"
>
  <ScanLine />
  {buttonText}</button
>

<!-- Modal implementation with backdrop -->
{#if isModalOpen}
  <div class="fixed inset-0 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-transparent rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
      <!-- Modal header -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-white-900">{modalTitle}</h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          onclick={() => toggleModal(false)}
          aria-label="Close QR Scanner"
        >
          <ScanQrCode />
        </button>
      </div>

      <!-- Scanner content -->
      <div class="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
        <video bind:this={videoElement} class="w-full h-full object-cover" playsinline>
          <track kind="captions" />
        </video>

        <!-- Scanner overlay with targeting frame -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div></div>
        </div>

        <!-- Loading or error states -->
        {#if !isCameraActive && !errorMessage}
          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div class="text-white text-lg">Initializing camera...</div>
          </div>
        {/if}

        {#if errorMessage}
          <div
            class="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 p-4"
          >
            <div class="text-white text-center mb-4">{errorMessage}</div>
            <button
              class="btn btn-sm btn-primary"
              onclick={() => {
                permissionRequested = false;
                requestCameraPermission().then((granted) => {
                  if (granted) {
                    startScanner();
                  }
                });
              }}
            >
              Request Permission Again
            </button>
          </div>
        {/if}
      </div>

      <!-- Instructions -->
      <p class="mt-4 text-sm text-gray-600">
        Position the QR code within the frame to scan. Make sure it's well-lit and clearly visible.
      </p>

      <!-- Action buttons -->
      <div class="mt-4 flex justify-end gap-2">
        <button class="btn btn-error" onclick={() => toggleModal(false)}> Cancel </button>

        {#if !isCameraActive && errorMessage}
          <button
            class="btn btn-primary"
            onclick={() => {
              permissionRequested = false;
              requestCameraPermission().then((granted) => {
                if (granted) {
                  startScanner();
                }
              });
            }}
          >
            Retry
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
