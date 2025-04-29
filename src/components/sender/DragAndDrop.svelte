<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { addToastMessage } from '../../stores/toastStore';
  import { Paperclip, Trash2 } from '@lucide/svelte';

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
  let isDragging = $state(false);

  function setPreviewFiles(files: FileList) {
      const existingKeys = new Set(fileItems.map((p) => p.file.name + p.file.lastModified));

      const newItems: FileItem[] = [...files]
        .filter((file) => !existingKeys.has(file.name + file.lastModified))
        .map((file) => ({
          file,
          url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          status: 'pending' as const
        }));

      fileItems = [...fileItems, ...newItems];
  }

  function setupDropAreaListeners() {
    const events = ['dragenter', 'dragover', 'dragleave', 'drop'];
    
    events.forEach((eventName) => {
      dropArea.addEventListener(
        eventName,
        (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false
      );
    });

    dropArea.addEventListener('dragenter', () => { isDragging = true; }, false);
    dropArea.addEventListener('dragover', () => { isDragging = true; }, false);
    dropArea.addEventListener('dragleave', () => { isDragging = false; }, false);
    dropArea.addEventListener('drop', (e) => {
      isDragging = false;
      handleDrop(e as DragEvent);
    }, false);
  }

  function handleDrop(e: DragEvent) {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFilesPick(files);
      setPreviewFiles(files);
    }
  }

  function handleFileInputChange() {
    if (fileInput.files && fileInput.files.length > 0) {
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
      files.forEach((file) => dataTransfer.items.add(file));
      onFilesPick(dataTransfer.files);
      setPreviewFiles(dataTransfer.files);
    }
  }

  async function handlePasteFromClipboardButton() {
    try {
      const clipboardData = navigator.clipboard;
      if (!clipboardData) {
        addToastMessage('Clipboard API not available');
        return;
      }

      const files: File[] = [];

      try {
        const text = await clipboardData.readText();
        if (text && text.trim()) {
          const textBlob = new Blob([text], { type: 'text/plain' });
          const textFile = new File([textBlob], 'clipboard.txt', { type: 'text/plain' });
          files.push(textFile);
        }
      } catch (e) {
        // Silently ignore if reading text fails, continue with images
      }

      try {
        const items = await clipboardData.read();
        for (const item of items) {
          for (const type of item.types) {
            if (!type.startsWith('image/')) continue;
            const blob = await item.getType(type);
            const imageFile = new File([blob], `image.${type.replace('image/', '')}`, { type });
            files.push(imageFile);
          }
        }
      } catch (e) {
        // Modern clipboard API might not be supported, continue with what we have
      }

      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        files.forEach((file) => dataTransfer.items.add(file));
        onFilesPick(dataTransfer.files);
        setPreviewFiles(dataTransfer.files);
      } else {
        addToastMessage('No supported data on clipboard');
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

  // Helper function to format file size
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
  }

  // Get file icon based on MIME type
  function getFileIcon(file: File): string {
    const type = file.type;
    
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('text/')) return 'text';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('word') || type.includes('document')) return 'word';
    if (type.includes('excel') || type.includes('sheet')) return 'excel';
    if (type.includes('zip') || type.includes('compressed')) return 'archive';
    
    return 'file';
  }

  // Get background color for file type icon based on theme
  function getFileIconBg(fileType: string): string {
    switch (fileType) {
      case 'image': return 'bg-purple-100 text-purple-500 [html[data-theme=dark]_&]:bg-purple-900 [html[data-theme=dark]_&]:text-purple-300';
      case 'audio': return 'bg-blue-100 text-blue-500 [html[data-theme=dark]_&]:bg-blue-900 [html[data-theme=dark]_&]:text-blue-300';
      case 'video': return 'bg-pink-100 text-pink-500 [html[data-theme=dark]_&]:bg-pink-900 [html[data-theme=dark]_&]:text-pink-300';
      case 'text': return 'bg-gray-100 text-gray-500 [html[data-theme=dark]_&]:bg-gray-800 [html[data-theme=dark]_&]:text-gray-300';
      case 'pdf': return 'bg-red-100 text-red-500 [html[data-theme=dark]_&]:bg-red-900 [html[data-theme=dark]_&]:text-red-300';
      case 'word': return 'bg-blue-100 text-blue-500 [html[data-theme=dark]_&]:bg-blue-900 [html[data-theme=dark]_&]:text-blue-300';
      case 'excel': return 'bg-green-100 text-green-500 [html[data-theme=dark]_&]:bg-green-900 [html[data-theme=dark]_&]:text-green-300';
      case 'archive': return 'bg-yellow-100 text-yellow-500 [html[data-theme=dark]_&]:bg-yellow-900 [html[data-theme=dark]_&]:text-yellow-300';
      default: return 'bg-gray-100 text-gray-500 [html[data-theme=dark]_&]:bg-gray-800 [html[data-theme=dark]_&]:text-gray-300';
    }
  }

  onMount(() => {
    setupDropAreaListeners();
    document.addEventListener('paste', handlePasteEvent);
  });

  onDestroy(() => {
    document.removeEventListener('paste', handlePasteEvent);
    fileItems.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  });
</script>

<!-- Upload Area -->
<div class="w-full">
  <label
    class="relative flex flex-col border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200
    border-gray-300 [html[data-theme=dark]_&]:border-gray-700 hover:border-blue-400 [html[data-theme=dark]_&]:hover:border-blue-500
    {isDragging ? 'bg-blue-50 [html[data-theme=dark]_&]:bg-blue-900/20 border-blue-400 [html[data-theme=dark]_&]:border-blue-500' : 'bg-white [html[data-theme=dark]_&]:bg-gray-800'}"
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

    <div class="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div class="p-3 mb-2 rounded-full bg-blue-50 [html[data-theme=dark]_&]:bg-blue-900/30 text-blue-500 [html[data-theme=dark]_&]:text-blue-300">
        <Paperclip class="w-6 h-6" />
      </div>

      <p class="mb-1 font-medium text-gray-700 [html[data-theme=dark]_&]:text-gray-300">
        Drop files here or click to upload
      </p>
      <p class="text-xs text-gray-500 [html[data-theme=dark]_&]:text-gray-400 hidden md:block">
        You can also paste from clipboard (Ctrl+V)
      </p>
    </div>
  </label>

  <!-- Paste button for mobile -->
  <button 
    class="mt-3 w-full py-2 px-4 md:hidden font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 [html[data-theme=dark]_&]:bg-blue-600 [html[data-theme=dark]_&]:hover:bg-blue-700 transition-colors" 
    onclick={handlePasteFromClipboardButton}
  >
    Paste from clipboard
  </button>

  <!-- File Preview Section -->
  {#if fileItems.length > 0}
    <div class="mt-6">
      <h3 class="text-lg font-medium mb-3 text-gray-800 [html[data-theme=dark]_&]:text-gray-200">
        Selected {fileItems.length} {fileItems.length === 1 ? 'File' : 'Files'}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each fileItems as item, index}
          <div class="p-4 border rounded-lg bg-white [html[data-theme=dark]_&]:bg-gray-800 border-gray-200 [html[data-theme=dark]_&]:border-gray-700 shadow-sm transition-colors">
            <div class="flex gap-4 items-start">
              {#if item.url}
                <div class="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border border-gray-200 [html[data-theme=dark]_&]:border-gray-700">
                  <img src={item.url} alt={item.file.name} class="w-full h-full object-cover" />
                </div>
              {:else}
                <div class="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center {getFileIconBg(getFileIcon(item.file))}">
                  <span class="text-2xl">{getFileIcon(item.file).charAt(0).toUpperCase()}</span>
                </div>
              {/if}

              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 [html[data-theme=dark]_&]:text-gray-100 truncate" title={item.file.name}>
                  {item.file.name}
                </p>
                <p class="text-xs text-gray-500 [html[data-theme=dark]_&]:text-gray-400 mt-1">
                  {formatFileSize(item.file.size)} • {item.file.type || 'Unknown type'}
                </p>
                <div class="flex items-center mt-2">
                  
                  <button
                    class="ml-auto inline-flex items-center p-1 rounded-full text-red-500 hover:text-red-700 [html[data-theme=dark]_&]:text-red-400 [html[data-theme=dark]_&]:hover:text-red-300 hover:bg-red-100 [html[data-theme=dark]_&]:hover:bg-red-900/30 transition-colors"
                    onclick={() => removeFile(index)}
                    aria-label="Remove file"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>