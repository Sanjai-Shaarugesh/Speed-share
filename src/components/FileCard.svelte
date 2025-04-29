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
        
        <div class="mt-3">
          {#if fileDetail.status === FileStatus.Processing}
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 [html[data-theme=dark]_&]:bg-blue-900 [html[data-theme=dark]_&]:text-blue-300">
              {#if isSender}
                Sending: {humanFileSize(fileDetail.bitrate)}/sec
              {:else}
                Receiving: {humanFileSize(fileDetail.bitrate)}/sec
              {/if}
            </span>
          {:else if fileDetail.error}
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 [html[data-theme=dark]_&]:bg-red-900 [html[data-theme=dark]_&]:text-red-300">
              Error: {fileDetail.error.message}
            </span>
          {:else if fileDetail.status === FileStatus.WaitingAccept}
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700 [html[data-theme=dark]_&]:bg-yellow-900 [html[data-theme=dark]_&]:text-yellow-300">
              Waiting Accept
            </span>
          {:else if fileDetail.status === FileStatus.Success}
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 [html[data-theme=dark]_&]:bg-green-900 [html[data-theme=dark]_&]:text-green-300">
              Success
            </span>
          {:else}
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 [html[data-theme=dark]_&]:bg-gray-800 [html[data-theme=dark]_&]:text-gray-300">
              Pending
            </span>
          {/if}
        </div>
        
        <div class="relative mt-3 w-full max-w-full">
          <div class="overflow-hidden h-2 text-xs flex rounded bg-gray-200 [html[data-theme=dark]_&]:bg-gray-700 w-full">
            <div
              style="width: {isNaN(fileDetail.progress) ? 100 : fileDetail.progress}%"
              class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 [html[data-theme=dark]_&]:bg-blue-600 transition-all duration-300 ease-in-out"
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
