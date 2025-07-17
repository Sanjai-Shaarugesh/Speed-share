<script lang="ts">
  import { FileStatus, type FileDetail } from '../type';
   import { humanFileSize } from '../utils/humanFIleSize';
   import { onDestroy } from 'svelte';

  // Props and reactive variables
  let file: File | null = null;
  let objectUrl: string | null = $state(null);
  let imageDataUrl: string | null = $state(null);
  let progress = 0;
  let error: string | null = null;

  type Props = {
    fileDetail: FileDetail;
    isSender: boolean;
    children: () => any;
    onRemove?: () => void;
  };
  const { fileDetail, isSender, children, onRemove }: Props = $props();



  // Handle file input for sender
  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      file = input.files[0];
      error = null;
      simulateProgress();
    }
  }

  // Simulate file transfer progress
  function simulateProgress() {
    progress = 0;
    const interval = setInterval(() => {
      if (progress >= 100) {
        clearInterval(interval);
      } else {
        progress += 10;
      }
    }, 150);
  }

  // Download file function
  function downloadFile() {
    if (fileDetail.status === FileStatus.Success && fileDetail.fileBlob) {
      const url = URL.createObjectURL(fileDetail.fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileDetail.metaData.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Remove file function
  function removeFile() {
    if (onRemove) {
      onRemove();
    }
  }

  // Determine if there's a blob to preview
  const blobToPreview = $derived(
    isSender && file
      ? file
      : !isSender && fileDetail.status === FileStatus.Success && fileDetail.fileBlob
        ? fileDetail.fileBlob
        : null
  );

  // Convert blob to data URL for CSP compliance
  $effect(() => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (imageDataUrl) {
      imageDataUrl = null;
    }

    if (blobToPreview && isImage()) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imageDataUrl = e.target?.result as string;
      };
      reader.readAsDataURL(blobToPreview);
    }
  });

  // Check if the file is an image
  const isImage = () => fileDetail.metaData.type?.startsWith('image/');

  // Get file extension
  function getFileExtension(fileName: string): string {
    return fileName.split('.').pop()?.toLowerCase() ?? '';
  }

  // Generate SVG icon as data URL for different file types
  function getFileIconSvg(fileName: string): string {
    const extension = getFileExtension(fileName);
    const isDark = typeof window !== 'undefined' &&
      (document.documentElement.getAttribute('data-theme') === 'dark' ||
       document.documentElement.classList.contains('dark'));

    const iconColor = isDark ? '#e5e7eb' : '#374151';
    const bgColor = isDark ? '#374151' : '#f3f4f6';

    let iconPath = '';
    let bgColorOverride = bgColor;

    switch (extension) {
      case 'pdf':
        bgColorOverride = '#dc2626';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <text x="12" y="16" text-anchor="middle" fill="white" font-size="6" font-weight="bold">PDF</text>`;
        break;
      case 'docx':
      case 'doc':
        bgColorOverride = '#2563eb';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <text x="12" y="16" text-anchor="middle" fill="white" font-size="5" font-weight="bold">DOC</text>`;
        break;
      case 'xlsx':
      case 'xls':
        bgColorOverride = '#16a34a';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <text x="12" y="16" text-anchor="middle" fill="white" font-size="5" font-weight="bold">XLS</text>`;
        break;
      case 'mp4':
      case 'avi':
      case 'mov':
        bgColorOverride = '#7c3aed';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <polygon points="10,10 10,16 16,13" fill="white"/>`;
        break;
      case 'mp3':
      case 'wav':
      case 'flac':
        bgColorOverride = '#ea580c';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <path d="M8 14c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="white"/>
                   <path d="M12 12v-2l4-1v3" fill="none" stroke="white" stroke-width="1"/>`;
        break;
      case 'zip':
      case 'rar':
      case '7z':
        bgColorOverride = '#ca8a04';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <text x="12" y="16" text-anchor="middle" fill="white" font-size="5" font-weight="bold">ZIP</text>`;
        break;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        bgColorOverride = '#059669';
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/>
                   <path d="M14 2v6h6" fill="none" stroke="white" stroke-width="2"/>
                   <circle cx="9" cy="11" r="1" fill="white"/>
                   <path d="M4 18l4-4 3 3 5-5" fill="none" stroke="white" stroke-width="1"/>`;
        break;
      default:
        iconPath = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="${iconColor}"/>
                   <path d="M14 2v6h6" fill="none" stroke="${iconColor}" stroke-width="2"/>`;
    }

    return `data:image/svg+xml;base64,${btoa(`
      <svg width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="2" fill="${bgColorOverride}"/>
        ${iconPath}
      </svg>
    `)}`;
  }

  // Clean up on component destruction
  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

<!-- Frosted Glass File Preview Card -->
<div class="relative backdrop-blur-xl bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 w-full max-w-full overflow-hidden">
  <!-- Subtle gradient overlay -->
  <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

  <!-- Remove button (top-right corner) -->
  {#if isSender && onRemove}
    <button
      onclick={removeFile}
      class="absolute top-3 right-3 z-10 btn btn-sm btn-circle btn-ghost bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-300/30 text-red-200 hover:text-white transition-all duration-200"
      title="Remove file"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  {/if}

  <div class="relative p-4 sm:p-6">
    <div class="flex flex-col sm:flex-row sm:items-start gap-4">
      <!-- Preview image or icon with glass effect -->
      <div class="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 mx-auto sm:mx-0 backdrop-blur-sm bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10 shadow-lg">
        {#if isImage() && fileDetail.status === FileStatus.Success && imageDataUrl}
          <img
            src={imageDataUrl}
            alt={fileDetail.metaData.name}
            class="w-full h-full object-cover"
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center">
            <img
              src={getFileIconSvg(fileDetail.metaData.name)}
              alt={fileDetail.metaData.name}
              class="w-14 h-14 object-contain drop-shadow-lg"
            />
          </div>
        {/if}
      </div>

      <div class="flex-1 overflow-hidden">
        <h3 class="font-semibold text-base truncate text-white/90 dark:text-white/90 drop-shadow-sm" title={fileDetail.metaData.name}>
          {fileDetail.metaData.name}
        </h3>
        <p class="text-sm text-white/70 dark:text-white/70 mt-1 drop-shadow-sm">
          {humanFileSize(fileDetail.metaData.size)} • {fileDetail.metaData.type || 'Unknown type'}
        </p>

        <!-- Status badges with glass effect -->
        <div class="mt-4">
          {#if fileDetail.status === FileStatus.Processing}
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-blue-500/20 border border-blue-300/30 text-blue-200 text-sm font-medium">
              <span class="loading loading-spinner loading-xs"></span>
              {#if isSender}
                Sending: {humanFileSize(fileDetail.bitrate)}/sec
              {:else}
                Receiving: {humanFileSize(fileDetail.bitrate)}/sec
              {/if}
            </div>
          {:else if fileDetail.error}
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-red-500/20 border border-red-300/30 text-red-200 text-sm font-medium">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              Error: {fileDetail.error.message}
            </div>
          {:else if fileDetail.status === FileStatus.WaitingAccept}
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-yellow-500/20 border border-yellow-300/30 text-yellow-200 text-sm font-medium">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              Waiting Accept
            </div>
          {:else if fileDetail.status === FileStatus.Success}
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-green-500/20 border border-green-300/30 text-green-200 text-sm font-medium">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Success
            </div>
          {:else}
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm bg-gray-500/20 border border-gray-300/30 text-gray-200 text-sm font-medium">
              Pending
            </div>
          {/if}
        </div>

        <!-- Progress bar with glass effect -->
        <div class="mt-4 w-full">
          <div class="flex justify-between text-sm text-white/70 dark:text-white/70 mb-2">
            <span>Progress</span>
            <span>{isNaN(fileDetail.progress) ? 100 : Math.round(fileDetail.progress)}%</span>
          </div>
          <div class="w-full bg-white/10 dark:bg-black/10 backdrop-blur-sm rounded-full h-2.5 border border-white/20 dark:border-white/10 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-300 ease-out rounded-full shadow-lg shadow-blue-500/30"
              style="width: {isNaN(fileDetail.progress) ? 100 : fileDetail.progress}%"
            ></div>
          </div>
        </div>

        <!-- Action buttons area with glass effect -->
        <div class="flex justify-end gap-2 mt-4 w-full">

          {@render children?.()}
        </div>
      </div>
    </div>
  </div>
</div>