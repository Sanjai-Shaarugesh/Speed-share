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
    'pdf': 'https://img.icons8.com/fluency/100/pdf--v2.png',
    'docx': 'https://img.icons8.com/external-others-iconmarket/64/external-docx-file-types-others-iconmarket.png',
    'xlsx': 'https://img.icons8.com/arcade/64/xls.png',
    'mp4': 'https://img.icons8.com/cotton/100/video-file--v1.png',
    'avi': 'https://img.icons8.com/dusk/100/video.png',
    'mp3': 'https://img.icons8.com/external-bearicons-blue-bearicons/100/external-MP3-file-extension-bearicons-blue-bearicons.png',
    'wav': 'https://img.icons8.com/external-bearicons-outline-color-bearicons/100/external-WAV-file-extension-bearicons-outline-color-bearicons.png',
    'zip': 'https://img.icons8.com/dusk/100/zip.png',
    'rar': "https://img.icons8.com/dusk/100/rar.png" ,
    'default': "https://img.icons8.com/arcade/100/file.png",
    'gif':'https://img.icons8.com/plasticine/100/gif.png',
    'svg':'https://img.icons8.com/external-bearicons-blue-bearicons/100/external-SVG-file-extension-bearicons-blue-bearicons.png',
    'png':'https://img.icons8.com/plasticine/100/png.png'
  };

  // Get the icon URL based on file extension
  function getIconUrl(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return iconMap[extension] || iconMap['default'];
  }

  // Clean up object URL on component destruction
  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

<div class="card bg-base-100 shadow-lg shadow-base-300">
  <div class="card-body p-4 text-xs xl:text-sm">
    <div class="flex gap-4">
      <!-- Preview image or icon -->
      {#if isImage() && fileDetail.status === FileStatus.Success && objectUrl}
        <img src={objectUrl} alt={fileDetail.metaData.name} class="w-20 h-20 object-cover rounded-md" />
      {:else}
        <img src={getIconUrl(fileDetail.metaData.name)} alt={fileDetail.metaData.name} class="w-20 h-20 object-cover rounded-md" />
      {/if}
      <div class="flex-1">
        <p><strong>Name:</strong> {fileDetail.metaData.name}</p>
        <p><strong>Size:</strong> {humanFileSize(fileDetail.metaData.size)}</p>
        {#if fileDetail.metaData.type}
          <p><strong>Type:</strong> {fileDetail.metaData.type}</p>
        {/if}
        <div class="text-center">
          {#if fileDetail.status === FileStatus.Processing}
            {#if isSender}
              Sending: {humanFileSize(fileDetail.bitrate)}/sec
            {:else}
              Receiving: {humanFileSize(fileDetail.bitrate)}/sec
            {/if}
          {:else if fileDetail.error}
            <div class="text-error">
              Error: {fileDetail.error.message}
            </div>
          {:else if fileDetail.status === FileStatus.WaitingAccept}
            Waiting Accept
          {:else if fileDetail.status === FileStatus.Success}
            Success
          {:else}
            Pending
          {/if}
        </div>
        <progress
          value={isNaN(fileDetail.progress) ? 100 : fileDetail.progress}
          max="100"
          class="progress progress-accent"
        ></progress>
        <div class="flex justify-end">
          {@render children?.()}
        </div>
      </div>
    </div>
  </div>
</div>