<script lang="ts">
  import { FileStatus, type FileDetail } from '../type';
  import { humanFileSize } from '../utils/humanFIleSize';
  import { onDestroy } from 'svelte';

  // Props and reactive variables
  let file: File | null = null;
  let objectUrl: string | null = $state(null);
  let progress = 0;
  let error: string | null = null;

  type Props = {
    fileDetail: FileDetail;
    isSender: boolean;
    children: () => any;
  };
  const { fileDetail, isSender, children }: Props = $props();

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

  // Determine if there's a blob to preview
  const blobToPreview = $derived(
    isSender && file
      ? file
      : !isSender && fileDetail.status === FileStatus.Success && fileDetail.fileBlob
        ? fileDetail.fileBlob
        : null
  );

  // Create and clean up object URL for image previews
  $effect(() => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (blobToPreview) {
      objectUrl = URL.createObjectURL(blobToPreview);
    }
  });

  // Check if the file is an image
  const isImage = () => fileDetail.metaData.type?.startsWith('image/');

  // Map file extensions to icon URLs
  const iconMap: Record<string, string> = {
    pdf: 'https://img.icons8.com/fluency/100/pdf--v2.png',
    docx: 'https://img.icons8.com/external-others-iconmarket/64/external-docx-file-types-others-iconmarket.png',
    xlsx: 'https://img.icons8.com/arcade/64/xls.png',
    mp4: 'https://img.icons8.com/cotton/100/video-file--v1.png',
    avi: 'https://img.icons8.com/dusk/100/video.png',
    mp3: 'https://img.icons8.com/external-bearicons-blue-bearicons/100/external-MP3-file-extension-bearicons-blue-bearicons.png',
    wav: 'https://img.icons8.com/external-bearicons-outline-color-bearicons/100/external-WAV-file-extension-bearicons-outline-color-bearicons.png',
    zip: 'https://img.icons8.com/dusk/100/zip.png',
    rar: 'https://img.icons8.com/dusk/100/rar.png',
    default: 'https://img.icons8.com/arcade/100/file.png',
    gif: 'https://img.icons8.com/plasticine/100/gif.png',
    svg: 'https://img.icons8.com/external-bearicons-blue-bearicons/100/external-SVG-file-extension-bearicons-blue-bearicons.png',
    png: 'https://img.icons8.com/plasticine/100/png.png'
  };

  // Get the icon URL based on file extension
  function getIconUrl(fileName: string): string {
      const extension = fileName.split('.').pop()?.toLowerCase() ?? 'default';
      return iconMap[extension] || iconMap['default'];
  }

  // Clean up object URL on component destruction
  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

<div class="border rounded-lg bg-white [html[data-theme=dark]_&]:bg-gray-800 border-gray-200 [html[data-theme=dark]_&]:border-gray-700 shadow-sm transition-colors w-full max-w-full overflow-x-auto">
  <div class="p-3 sm:p-4 text-xs xl:text-sm">
    <div class="flex flex-col sm:flex-row sm:items-start gap-4">
      <!-- Preview image or icon -->
      {#if isImage() && fileDetail.status === FileStatus.Success && objectUrl}
        <div class="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border border-gray-200 [html[data-theme=dark]_&]:border-gray-700 mx-auto sm:mx-0">
          <img
            src={objectUrl}
            alt={fileDetail.metaData.name}
            class="w-full h-full object-cover"
          />
        </div>
      {:else}
        <div class="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-100 [html[data-theme=dark]_&]:bg-gray-700 mx-auto sm:mx-0">
          <img
            src={getIconUrl(fileDetail.metaData.name)}
            alt={fileDetail.metaData.name}
            class="w-12 h-12 object-contain"
          />
        </div>
      {/if}

      <div class="flex-1 text-gray-800 [html[data-theme=dark]_&]:text-gray-200 overflow-hidden">
        <p class="font-medium text-sm truncate break-all" title={fileDetail.metaData.name}>{fileDetail.metaData.name}</p>
        <p class="text-xs text-gray-500 [html[data-theme=dark]_&]:text-gray-400 break-all">{humanFileSize(fileDetail.metaData.size)} • {fileDetail.metaData.type || 'Unknown type'}</p>

        <!-- Status badges with glass effect -->
        <div class="mt-3 sm:mt-4">
          {#if fileDetail.status === FileStatus.Processing}
            <div class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full backdrop-blur-sm bg-blue-500/20 border border-blue-300/30 text-blue-200 text-xs sm:text-sm font-medium">
              <span class="loading loading-spinner loading-2xs sm:loading-xs"></span>
              {#if isSender}
                Sending: {humanFileSize(fileDetail.bitrate)}/sec
              {:else}
                Receiving: {humanFileSize(fileDetail.bitrate)}/sec
              {/if}
            </div>
          {:else if fileDetail.error}
            <div class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full backdrop-blur-sm bg-red-500/20 border border-red-300/30 text-red-200 text-xs sm:text-sm font-medium">
              <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              Error: {fileDetail.error.message}
            </div>
          {:else if fileDetail.status === FileStatus.WaitingAccept}
            <div class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full backdrop-blur-sm bg-yellow-500/20 border border-yellow-300/30 text-yellow-200 text-xs sm:text-sm font-medium">
              <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              Waiting Accept
            </div>
          {:else if fileDetail.status === FileStatus.Success}
            <div class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full backdrop-blur-sm bg-green-500/20 border border-green-300/30 text-green-200 text-xs sm:text-sm font-medium">
              <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Success
            </div>
          {:else}
            <div class="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full backdrop-blur-sm bg-gray-500/20 border border-gray-300/30 text-gray-200 text-xs sm:text-sm font-medium">
              Pending
            </div>
          {/if}
        </div>

        <!-- Progress bar with glass effect -->
        <div class="mt-3 sm:mt-4 w-full">
          <div class="flex justify-between text-xs sm:text-sm text-white/70 dark:text-white/70 mb-1.5 sm:mb-2">
            <span>Progress</span>
            <span>{isNaN(fileDetail.progress) ? 100 : Math.round(fileDetail.progress)}%</span>
          </div>
          <div class="w-full bg-white/10 dark:bg-black/10 backdrop-blur-sm rounded-full h-2 sm:h-2.5 border border-white/20 dark:border-white/10 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-300 ease-out rounded-full shadow-md sm:shadow-lg shadow-blue-500/30"
              style="width: {isNaN(fileDetail.progress) ? 100 : fileDetail.progress}%"
            ></div>
          </div>
        </div>

        <div class="flex justify-end mt-3 w-full">
          {@render children?.()}
        </div>
      </div>
    </div>
  </div>
</div>
