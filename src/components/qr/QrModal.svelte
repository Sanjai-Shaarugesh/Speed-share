<script lang="ts">
  import { onMount } from 'svelte';
  import { QRByte, Encoder, ErrorCorrectionLevel } from '@nuintun/qrcode';
  import { QrCode } from '@lucide/svelte';

  type Props = {
    title: string;
    qrData: string;
  };

  const { title, qrData }: Props = $props();

  export function close() {
    isModalOpen = false;
  }

  let isModalOpen = $state(false);

  const qrcode: Encoder = new Encoder({
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

  // === Shift+Q shortcut ===
  function handleShortcut(event: KeyboardEvent) {
    if (event.shiftKey && event.key.toLowerCase() === 'q') {
      event.preventDefault();
      isModalOpen = true; // ✅ Just set it to true
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  });
</script>

<!-- your modal stuff -->
<label for="qr-modal" class="btn btn-outline btn-warning">
  <QrCode /> QR Code
</label>


<input type="checkbox" id="qr-modal" class="modal-toggle" bind:checked={isModalOpen} />

<label for="qr-modal" class="modal cursor-pointer  bg-opacity-40 backdrop-blur-md">
  <label class="modal-box relative flex flex-col justify-center items-center w-auto " for="">
    <button
    class="btn btn-sm btn-circle absolute right-2 top-2 bg-pink-500 text-black "
    onclick={() => (isModalOpen = false)}
    aria-label="Close"
  >
    ✕
  </button>
    <h3 class="text-lg font-bold">{title}</h3>
    <img class="w-full max-w-96 rounded-xl border-4 border-dashed bg-origin-content p-1 " src={qrcode.toDataURL()} alt="qr" />
  </label>
</label>
