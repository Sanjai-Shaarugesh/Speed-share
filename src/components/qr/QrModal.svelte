<script lang="ts">
  import { onMount } from 'svelte';
  import { QRByte, Encoder, ErrorCorrectionLevel } from '@nuintun/qrcode';
  import { QrCode, X } from '@lucide/svelte';

  type Props = {
    title: string;
    qrData: string;
  };

  const { title, qrData }: Props = $props();

  let isModalOpen = $state(false);
  let qrcode = $state<Encoder | null>(null);
  let isClosing = $state(false);

  // Export function to close modal
  export function close() {
    isClosing = true;
    setTimeout(() => {
      isModalOpen = false;
      isClosing = false;
    }, 300);
  }

  // Generate QR code when qrData changes
  $effect(() => {
    if (qrData) {
      qrcode = new Encoder({
        encodingHint: true,
        errorCorrectionLevel: ErrorCorrectionLevel.M,
        version: 0
      })
        .write(
          new QRByte(qrData, (data: string) => {
            const bytes = data.split('').map((char) => char.charCodeAt(0));
            return { bytes: bytes, encoding: 27 };
          })
        )
        .make();
    }
  });

  function openModal() {
    isModalOpen = true;
  }

  function closeModal() {
    isClosing = true;
    setTimeout(() => {
      isModalOpen = false;
      isClosing = false;
    }, 300);
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.shiftKey && event.key.toLowerCase() === 'q') {
      event.preventDefault();
      openModal();
    }
    if (event.key === 'Escape' && isModalOpen) {
      event.preventDefault();
      closeModal();
    }
  }

  function handleBackdropClick() {
    closeModal();
  }

  onMount(() => {
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });
</script>

<style>
  /* Responsive 3D animations - reduced intensity for mobile */
  @keyframes modalEnter {
    0% {
      opacity: 0;
      transform: scale(0.8) translateY(50px);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.02) translateY(-5px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0px);
    }
  }

  @keyframes modalEnterDesktop {
    0% {
      opacity: 0;
      transform: scale(0.7) rotateX(-15deg) rotateY(10deg) translateZ(-100px);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.05) rotateX(5deg) rotateY(-2deg) translateZ(20px);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotateX(0deg) rotateY(0deg) translateZ(0px);
    }
  }

  @keyframes modalExit {
    0% {
      opacity: 1;
      transform: scale(1) translateY(0px);
    }
    100% {
      opacity: 0;
      transform: scale(0.9) translateY(30px);
    }
  }

  @keyframes modalExitDesktop {
    0% {
      opacity: 1;
      transform: scale(1) rotateX(0deg) rotateY(0deg) translateZ(0px);
    }
    50% {
      opacity: 0.6;
      transform: scale(0.95) rotateX(10deg) rotateY(-5deg) translateZ(-20px);
    }
    100% {
      opacity: 0;
      transform: scale(0.8) rotateX(20deg) rotateY(-15deg) translateZ(-150px);
    }
  }

  @keyframes backdropEnter {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes backdropExit {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes qrFloat {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-2px);
    }
  }

  @keyframes qrFloatDesktop {
    0%, 100% {
      transform: translateY(0px) rotateX(0deg) rotateY(0deg);
    }
    33% {
      transform: translateY(-3px) rotateX(2deg) rotateY(1deg);
    }
    66% {
      transform: translateY(-1px) rotateX(-1deg) rotateY(-2deg);
    }
  }

  @keyframes pulseGlow {
    0%, 100% {
      box-shadow: 0 0 15px rgba(234, 179, 8, 0.2);
    }
    50% {
      box-shadow: 0 0 25px rgba(234, 179, 8, 0.4);
    }
  }

  @keyframes pulseGlowDark {
    0%, 100% {
      box-shadow: 0 0 15px rgba(250, 204, 21, 0.3);
    }
    50% {
      box-shadow: 0 0 25px rgba(250, 204, 21, 0.5);
    }
  }

  @keyframes loadingSpinner {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Base styles for all devices */
  .modal-enter {
    animation: modalEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .modal-exit {
    animation: modalExit 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
  }

  .backdrop-enter {
    animation: backdropEnter 0.3s ease-out forwards;
  }

  .backdrop-exit {
    animation: backdropExit 0.3s ease-in forwards;
  }

  .button-hover {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .exit-button {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .qr-container {
    animation: qrFloat 4s ease-in-out infinite;
  }

  /* Enhanced 3D effects for desktop */
  @media (min-width: 768px) and (hover: hover) {
    .modal-enter {
      animation: modalEnterDesktop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      transform-style: preserve-3d;
      perspective: 1000px;
    }

    .modal-exit {
      animation: modalExitDesktop 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
      transform-style: preserve-3d;
      perspective: 1000px;
    }

    .backdrop-enter {
      animation: backdropEnter 0.3s ease-out forwards;
      backdrop-filter: blur(8px);
    }

    .backdrop-exit {
      animation: backdropExit 0.3s ease-in forwards;
      backdrop-filter: blur(0px);
    }

    .button-hover {
      transform-style: preserve-3d;
    }

    .button-hover:hover {
      transform: translateY(-2px) scale(1.05) rotateX(5deg);
      animation: pulseGlow 2s ease-in-out infinite;
    }

    .dark .button-hover:hover {
      animation: pulseGlowDark 2s ease-in-out infinite;
    }

    .exit-button {
      transform-style: preserve-3d;
    }

    .exit-button:hover {
      transform: scale(1.1) rotate(90deg) translateZ(10px);
    }

    .qr-container {
      animation: qrFloatDesktop 6s ease-in-out infinite;
      transform-style: preserve-3d;
    }

    .qr-container:hover {
      animation-play-state: paused;
      transform: scale(1.02) rotateX(5deg) rotateY(5deg) translateZ(10px);
    }

    .modal-content {
      transform-style: preserve-3d;
      perspective: 1000px;
    }
  }

  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .modal-enter,
    .modal-exit,
    .qr-container,
    .button-hover,
    .exit-button {
      animation: none !important;
      transition: opacity 0.2s ease !important;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .modal-content {
      border-width: 2px;
      border-color: currentColor;
    }

    .exit-button {
      border-width: 2px;
      border-color: currentColor;
    }
  }
</style>

<!-- Open Modal Button -->
<button
  onclick={openModal}
  class="button-hover inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold bg-transparent border-2 border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400 rounded-lg hover:bg-yellow-500 hover:dark:bg-yellow-400 hover:text-white hover:dark:text-gray-900 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
  aria-label="Show QR Code"
>
  <QrCode class="w-3 h-3 sm:w-4 sm:h-4" />
  <span class="hidden xs:inline">Show QR</span>
  <span class="xs:hidden">QR</span>
</button>

<!-- Modal Content -->
{#if isModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/40 dark:bg-black/60 {isClosing ? 'backdrop-exit' : 'backdrop-enter'}"
      onclick={handleBackdropClick}
    ></div>

    <!-- Modal Box -->
    <div
      class="modal-content relative z-10 w-full max-w-sm sm:max-w-md lg:max-w-xl
             bg-white/95 dark:bg-gray-900/95
             text-gray-900 dark:text-gray-100
             shadow-2xl backdrop-blur-xl
             border border-gray-200/80 dark:border-gray-700/80
             rounded-2xl sm:rounded-3xl
             p-4 sm:p-6 lg:p-8
             {isClosing ? 'modal-exit' : 'modal-enter'}
             max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Exit Button - Round -->
      <button
        onclick={closeModal}
        class="exit-button absolute top-3 right-3 sm:top-4 sm:right-4
               w-8 h-8 sm:w-10 sm:h-10
               rounded-full
               bg-gradient-to-br from-gray-100 to-gray-200
               dark:from-gray-700 dark:to-gray-800
               hover:from-red-100 hover:to-red-200
               dark:hover:from-red-800 dark:hover:to-red-900
               text-gray-600 dark:text-gray-300
               hover:text-red-600 dark:hover:text-red-300
               flex items-center justify-center
               shadow-lg border border-gray-300 dark:border-gray-600
               hover:border-red-300 dark:hover:border-red-600
               focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2
               focus:ring-offset-white dark:focus:ring-offset-gray-900"
        aria-label="Close modal"
      >
        <X class="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <!-- Title with 3D effect -->
      <h3 class="text-lg sm:text-xl lg:text-2xl font-bold mb-4 sm:mb-6 text-center
                 bg-gradient-to-r from-gray-800 to-gray-600
                 dark:from-gray-100 dark:to-gray-300
                 bg-clip-text text-transparent pr-12">
        {title}
      </h3>

      <!-- QR Code Image with 3D animations -->
      {#if qrcode}
        <div class="flex justify-center items-center mb-4 sm:mb-6">
          <div class="qr-container rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden
                      border-2 sm:border-4 border-yellow-400/60 dark:border-yellow-500/60
                      p-1 sm:p-2
                      bg-gradient-to-br from-yellow-50 to-yellow-100
                      dark:from-yellow-900/20 dark:to-yellow-800/20
                      hover:border-yellow-500/80 dark:hover:border-yellow-400/80
                      transition-colors duration-300">
            <img
              src={qrcode.toDataURL(8)}
              alt="QR Code for {title}"
              class="rounded-lg sm:rounded-xl w-full h-auto block max-w-[240px] sm:max-w-[280px] lg:max-w-[320px]"
              loading="lazy"
            />
          </div>
        </div>

        <!-- Floating instruction text -->
        <div class="text-center space-y-2">
          <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Scan with your device camera or QR reader
          </p>
          <div class="flex flex-wrap justify-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-500">
            <span>Press</span>
            <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Esc</kbd>
            <span class="hidden sm:inline">or</span>
            <kbd class="hidden sm:inline px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Shift+Q</kbd>
            <span>to close</span>
          </div>
        </div>
      {:else}
        <div class="flex justify-center items-center h-48 sm:h-64 lg:h-80">
          <div class="flex flex-col items-center space-y-3 sm:space-y-4">
            <div class="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12
                        border-2 sm:border-4 border-yellow-400 dark:border-yellow-500
                        border-t-transparent"></div>
            <div class="text-sm sm:text-base text-gray-500 dark:text-gray-400">
              Generating QR code...
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}