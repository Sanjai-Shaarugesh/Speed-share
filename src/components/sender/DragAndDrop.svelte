<script lang="ts">
  import { onMount } from 'svelte';
  import { addToastMessage } from '../../stores/toastStore';
  import {Paperclip , Shredder } from '@lucide/svelte';

  type FileItem = {
    file: File;
    url?: string;
    status?: 'pending' | 'sent';
  };

  let fileItems: FileItem[] = $state([]);

  type Props = {
    onFilesPick: (files: FileList) => void;
  };
  const { onFilesPick }: Props = $props();

  let dropArea: HTMLElement;
  let fileInput: HTMLInputElement;

  function setPreviewFiles(files: FileList) {
    const existingKeys = new Set(fileItems.map(p => p.file.name + p.file.lastModified));

    const newItems = [...files]
      .filter(file => !existingKeys.has(file.name + file.lastModified))
      .map(file => ({
        file,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        status: 'pending',
      }));

    fileItems = [...fileItems, ...newItems];
  }

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

    ['dragenter', 'dragover'].forEach(event => {
      dropArea.addEventListener(event, () => dropArea.classList.add('bg-blue-200'), false);
    });

    ['dragleave', 'drop'].forEach(event => {
      dropArea.addEventListener(event, () => dropArea.classList.remove('bg-blue-200'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
  }

  function handleDrop(e: DragEvent) {
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

  function handlePasteEvent(event: ClipboardEvent) {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const files: File[] = [];

    const text = clipboardData.getData('Text');
    if (text) {
      const textBlob = new Blob([text], { type: 'text/plain' });
      const textFile = new File([textBlob], 'clipboard.txt', { type: 'text/plain' });
      files.push(textFile);
    }

    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) files.push(file);
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

  function removeFile(index: number) {
    const removed = fileItems[index];
    if (removed.url) URL.revokeObjectURL(removed.url);
    fileItems = fileItems.filter((_, i) => i !== index);
    addToastMessage(`Removed ${removed.file.name}`);
  }

  onMount(() => {
    setupDropAreaListeners();
    document.addEventListener('paste', handlePasteEvent);

    return () => {
      document.removeEventListener('paste', handlePasteEvent);
      fileItems.forEach(item => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  });
</script>

<!-- Upload Area -->
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
    <Paperclip />

    <p class="m-0 hidden xl:block">
      Drop your files, paste from clipboard (ctrl+v), or click this area
    </p>
    <p class="m-0 xl:hidden">Click this area</p>
  </div>
</label>

<!-- Paste button for mobile -->
<button class="btn btn-secondary xl:hidden" onclick={handlePastFromClipboardButton}>
  Paste from clipboard
</button>

<!-- File Preview Section -->
{#if fileItems.length > 0}
  <div class="mt-4">
    <h3>Selected {fileItems.length === 1 ? 'File' : 'Files'}:</h3>
    <div class="flex flex-wrap gap-4">
      {#each fileItems as item, index}
        <div class="p-4 mb-4 border rounded-md bg-gray-800 flex gap-4 items-center w-full xl:w-[calc(50%-0.5rem)]">
          {#if item.url}
            <img src={item.url} alt={item.file.name} class="w-20 h-20 object-cover rounded-md" />
          {/if}

          <div class="flex-1">
            <p><strong>Name:</strong> {item.file.name}</p>
            <p><strong>Size:</strong> {(item.file.size / 1024).toFixed(2)} KB</p>
            <p><strong>Type:</strong> {item.file.type}</p>
            <p><strong>Status:</strong> {item.status}</p>

            

            <div class="flex gap-2">
             
                
                <button
                  class="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded flex items-center space-x-2"
                  onclick={() => removeFile(index)}
                >
                  <span>Remove</span>
                  <Shredder class="w-5 h-5" /> 
                </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
