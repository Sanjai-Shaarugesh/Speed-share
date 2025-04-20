<script lang="ts">
  import { onMount } from 'svelte';
  import { addToastMessage } from '../../stores/toastStore';

  type Props = {
    onFilesPick: (files: FileList) => void;
  };
  const { onFilesPick }: Props = $props();

  let dropArea: HTMLElement;
  let fileInput: HTMLInputElement;

  // State for previews: array of { file: File, url?: string }
  let previews = $state([]);

  // Function to update previews, revoking old URLs and creating new ones for images
  function setPreviewFiles(files: FileList) {
    // Revoke previous URLs to prevent memory leaks
    previews.forEach(preview => {
      if (preview.url) URL.revokeObjectURL(preview.url);
    });
    // Create new previews
    previews = [...files].map(file => {
      if (file.type.startsWith('image/')) {
        return { file, url: URL.createObjectURL(file) };
      } else {
        return { file };
      }
    });
  }

  // Drop area event setup
  function setupDropAreaListeners() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false
      );
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
  }

  function highlight() {
    dropArea.classList.add('bg-blue-200');
  }

  function unhighlight() {
    dropArea.classList.remove('bg-blue-200');
  }

  function handleDrop(e: DragEvent) {
    unhighlight();
    const files = e.dataTransfer?.files;
    if (files) {
      onFilesPick(files);
      setPreviewFiles(files);
    }
  }

  function handleFileInputChange() {
    if (fileInput.files) {
      onFilesPick(fileInput.files);
      setPreviewFiles(fileInput.files);
      fileInput.value = '';
    }
  }

  function handlePasteEvent(event: ClipboardEvent): void {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const files: File[] = [];

    // Handle text as a file
    const text = clipboardData.getData('Text');
    if (text) {
      const textBlob = new Blob([text], { type: 'text/plain' });
      const textFile = new File([textBlob], 'clipboard.txt', { type: 'text/plain' });
      files.push(textFile);
    }

    // Handle files (e.g., images)
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) {
        files.push(file);
      }
    }

    if (files.length > 0) {
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      onFilesPick(dataTransfer.files);
      setPreviewFiles(dataTransfer.files);
    }
  }

  async function handlePastFromClipboardButton() {
    const clipboardData = navigator.clipboard;
    if (!clipboardData) return;

    try {
      const files: File[] = [];

      const text = await clipboardData.readText();
      if (text) {
        const textBlob = new Blob([text], { type: 'text/plain' });
        const textFile = new File([textBlob], 'clipboard.txt', { type: 'text/plain' });
        files.push(textFile);
      }

      const items = await clipboardData.read();
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue;
          const blob = await item.getType(type);
          const imageFile = new File([blob], `image.${type.replace('image/', '')}`, { type });
          files.push(imageFile);
        }
      }

      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        onFilesPick(dataTransfer.files);
        setPreviewFiles(dataTransfer.files);
      } else {
        addToastMessage('No data on clipboard');
      }
    } catch (e) {
      addToastMessage('Failed to read clipboard');
    }
  }

  onMount(() => {
    setupDropAreaListeners();
    document.addEventListener('paste', handlePasteEvent);

    // Cleanup URLs on component destruction
    return () => {
      document.removeEventListener('paste', handlePasteEvent);
      previews.forEach(preview => {
        if (preview.url) URL.revokeObjectURL(preview.url);
      });
    };
  });
</script>

<label
  class="relative flex flex-col border border-base-300 border-dashed cursor-pointer"
  bind:this={dropArea}
>
  <input
    accept="*"
    type="file"
    multiple
    class="absolute inset-0 z-50 w-full h-full p-0 m-0 outline-none opacity-0 cursor-pointer"
    title=""
    bind:this={fileInput}
    onchange={handleFileInputChange}
  />

  <div class="flex flex-col items-center justify-center py-10 text-center">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="w-6 h-6"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>

    <p class="m-0 hidden xl:block">
      Drop your files, paste from clipboard (ctrl+v), or click to this area
    </p>
    <p class="m-0 xl:hidden">Click to this area</p>
  </div>
</label>
<button class="btn btn-secondary xl:hidden" onclick={handlePastFromClipboardButton}>
  Paste from clipboard
</button>

<!-- Preview Section -->
{#if previews.length > 0}
  <div class="mt-4">
    <h3>Selected Files:</h3>
    <div class="flex flex-wrap gap-4">
      {#each previews as preview}
        {#if preview.url}
          <img src={preview.url} alt={preview.file.name} class="w-24 h-24 object-cover" />
        {:else}
          <div class="p-2 border border-gray-300">
            {preview.file.name}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}