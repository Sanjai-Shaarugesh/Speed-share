<script lang="ts">
  import { FileStatus, type FileDetail } from '../type';
  import { humanFileSize } from '../utils/humanFIleSize';
  import { onDestroy } from 'svelte';
 
   let file: File | null = null;
   let objectUrl: string | null = null;
   let progress = 0;
   let error: string | null = null;

  type Props = {
    fileDetail: FileDetail;
    isSender: boolean;
    children: () => any;
  };
  const { fileDetail, isSender, children }: Props = $props();
  
  function handleFileChange(event: Event) {
     const input = event.target as HTMLInputElement;
     if (input.files && input.files.length > 0) {
       file = input.files[0];
       if (objectUrl) URL.revokeObjectURL(objectUrl);
       objectUrl = URL.createObjectURL(file);
       error = null;
       simulateProgress();
     }
   }
 
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
 
   const isImage = () => file?.type.startsWith('image/');
   const isVideo = () => file?.type.startsWith('video/');
   const isAudio = () => file?.type.startsWith('audio/');
   const isPDF = () => file?.type === 'application/pdf';
 
   onDestroy(() => {
     if (objectUrl) URL.revokeObjectURL(objectUrl);
   });
</script>

<div class="card bg-base-100 shadow-lg shadow-base-300">
  <div class="card-body p-4 text-xs xl:text-sm">
    <div class="grid gap-2 grid-cols-4 items-center">
      <div class="col-span-4">
        <p><strong>Name:</strong> {fileDetail.metaData.name}</p>
        <p><strong>Size:</strong> {humanFileSize(fileDetail.metaData.size)}</p>
        {#if fileDetail.metaData.type}
          <p><strong>Type:</strong> {fileDetail.metaData.type}</p>
        {/if}
      </div>
      <div class="col-span-4">
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
      </div>
      <div class="col-span-4 flex justify-end">
        {@render children?.()}
      </div>
    </div>
  </div>
</div>
