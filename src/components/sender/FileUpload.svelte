<script lang="ts">
  let files: File[] = [];
  let dragging = false;

  let { handleFiles2, fileInput2 } = $props();

  // Handle file selection or drag-and-drop
  function handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      files = [...files, ...Array.from(input.files)];  // Append new files to the existing list
    }
  }

  // Handle drag-and-drop event
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles) {
      files = [...files, ...Array.from(droppedFiles)];  // Append new files to the existing list
    }
  }

  // Handle dragover event
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!dragging) {
      dragging = true;
    }
  }

  // Handle dragleave event
  function handleDragLeave() {
    dragging = false;
  }

  // Function to check if the file is an image
  function isImage(file: File) {
    return file.type.startsWith('image/');
  }

  // Function to check if the file is a video
  function isVideo(file: File) {
    return file.type.startsWith('video/');
  }

  // Function to check if the file is audio
  function isAudio(file: File) {
    return file.type.startsWith('audio/');
  }

  // Function to check if the file is a PDF
  function isPDF(file: File) {
    return file.type === 'application/pdf';
  }

  // Function to check if the file is a text file
  function isText(file: File) {
    return file.type === 'text/plain';
  }

  // Function to check if the file is unsupported
  function isUnsupported(file: File) {
    return !(
      isImage(file) || isVideo(file) || isAudio(file) || isPDF(file) || isText(file)
    );
  }

  // A fallback for unsupported files (e.g., a generic file icon)
  const unsupportedIcon = "https://imgs.search.brave.com/AehGQc1Es9BFnZkVCAlz4ge9JXFeFWhVDXEcQ-T_6EI/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly93d3cu/aW1nMmdvLmNvbS9h/c3NldHMvaW1nL2Jh/Y2tkb2MucG5n";

  // Function to read the content of a text file
  async function readTextFile(file: File) {
    const text = await file.text();
    return text.slice(0, 1024); // Limit preview to first 1024 characters
  }

  // Function to remove a file from the list
  function removeFile(fileToRemove: File) {
    files = files.filter(file => file !== fileToRemove);
  }
</script>

<div class="max-w-2xl mx-auto p-4">
  <label class="block mb-4">
    <span class="text-lg font-semibold text-gray-700">Upload Files</span>
    <div
      class="mt-2 block w-full text-sm text-gray-500 border-2 border-dashed p-6 rounded-lg cursor-pointer hover:border-blue-500"
      on:drop={handleDrop}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
    >
      <p class="text-center text-gray-600">
        Drag & Drop your files here or{' '}
        <span class="font-semibold text-blue-600">click to browse</span>
      </p>
      <input
        type="file"
        multiple
        on:change={handleFiles2}
        class="hidden"
        bind:this={fileInput2}
      />
    </div>
  </label>

  <!-- Display the uploaded files with preview -->
  {#if files.length > 0}
    <div class="space-y-6 mt-6">
      {#each files as file (file.name)}
        <div class="p-4 border rounded-md shadow-sm">
          <h3 class="text-xl font-semibold text-gray-800 flex justify-between items-center">
            <span>{file.name}</span>
            <button
              on:click={() => removeFile(file)}
              class="text-red-500 hover:text-red-700"
              aria-label="Remove file"
            >
              &times;
            </button>
          </h3>

          <!-- Image File Preview -->
          {#if isImage(file)}
            <img src={URL.createObjectURL(file)} alt={file.name} class="w-full h-auto mt-4 rounded-md" />
          <!-- Video File Preview -->
          {:else if isVideo(file)}
            <video controls class="w-full mt-4 rounded-md">
              <source src={URL.createObjectURL(file)} type={file.type} />
            </video>
          <!-- Audio File Preview -->
          {:else if isAudio(file)}
            <audio controls class="w-full mt-4 rounded-md">
              <source src={URL.createObjectURL(file)} type={file.type} />
            </audio>
          <!-- PDF File Preview -->
          {:else if isPDF(file)}
            <embed src={URL.createObjectURL(file)} type="application/pdf" width="100%" height="500px" class="mt-4 rounded-md" />
          <!-- Text File Preview -->
          {:else if isText(file)}
            {#await readTextFile(file) then content}
              <pre class="bg-gray-100 p-4 rounded-md mt-4 text-sm">{content}</pre>
            {:catch error}
              <p class="mt-4 text-gray-500">Error reading file content</p>
            {/await}
          <!-- Unsupported File Preview -->
          {:else if isUnsupported(file)}
            <img src={unsupportedIcon} alt="Unsupported File" class="w-full h-auto mt-4 rounded-md" />
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
