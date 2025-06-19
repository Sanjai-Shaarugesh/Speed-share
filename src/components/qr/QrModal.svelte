<script lang="ts">
  import { onMount } from 'svelte';
  import { QRByte, Encoder, ErrorCorrectionLevel } from '@nuintun/qrcode';
  import { QrCode } from '@lucide/svelte';
  import { parseUniqueCode } from 'src/utils/uniqueCode.ts';

  export let title: string;
  export let qrData: string;

  let isModalOpen = false;
  let parsedData:
    | {
        sdp: string;
        iceServer?: string;
        chunkSize?: number;
        publicKey?: string;
        highPerformance?: boolean;
      }
    | null = null;
  let qrcode: Encoder | null = null;

  function generateQrCode(data: string): Encoder | null {
    try {
      const encoder = new Encoder({
        encodingHint: true,
        errorCorrectionLevel: ErrorCorrectionLevel.M,
        version: 0
      });

      encoder.write(
        new QRByte(data, (d: string) => {
          const bytes = d.split('').map((char) => char.charCodeAt(0));
          return { bytes, encoding: 27 };
        })
      );

      return encoder.make();
    } catch (err) {
      console.error('QR Code generation failed:', err);
      return null;
    }
  }

  function handleShortcut(event: KeyboardEvent) {
    if (event.shiftKey && event.key.toLowerCase() === 'q') {
      event.preventDefault();
      isModalOpen = true;
    }
  }

  onMount(() => {
      window.addEventListener('keydown', handleShortcut);
  
      // ✅ Ensure qrData is a resolved string
      if (typeof qrData !== 'string') {
        console.error('qrData is not a string:', qrData);
        return;
      }
  
      (async () => {
        try {
          parsedData = await parseUniqueCode(qrData);
        } catch (err) {
          console.warn('Failed to parse unique code:', err);
        }
  
        qrcode = generateQrCode(qrData);
      })();
  
      return () => {
        window.removeEventListener('keydown', handleShortcut);
      };
    });
</script>

<!-- Trigger Button -->
<label for="qr-modal" class="btn btn-outline btn-warning">
  <QrCode class="mr-2" /> QR Code
</label>

<!-- Modal -->
<input type="checkbox" id="qr-modal" class="modal-toggle" bind:checked={isModalOpen} />

<label for="qr-modal" class="modal cursor-pointer bg-opacity-40 backdrop-blur-md">
  <label class="modal-box relative flex flex-col justify-center items-center w-auto">
    <button
      class="btn btn-sm btn-circle absolute right-2 top-2 bg-pink-500 text-black"
      on:click={() => (isModalOpen = false)}
      aria-label="Close"
    >
      ✕
    </button>

    <h3 class="text-lg font-bold">{title}</h3>

    {#if qrcode}
      <img
        class="w-full max-w-96 rounded-xl border-4 border-dashed bg-origin-content p-1"
        src={qrcode.toDataURL()}
        alt="QR"
      />
    {:else}
      <p class="text-red-500">QR code could not be generated.</p>
    {/if}

    {#if parsedData}
      <div class="text-xs mt-4 text-left max-w-full break-all px-4">
        <p><strong>SDP:</strong> {parsedData.sdp.slice(0, 100)}...</p>
        <p><strong>ICE Server:</strong> {parsedData.iceServer}</p>
        <p><strong>Chunk Size:</strong> {parsedData.chunkSize}</p>
        <p><strong>High Performance:</strong> {parsedData.highPerformance ? 'Yes' : 'No'}</p>
      </div>
    {/if}
  </label>
</label>
