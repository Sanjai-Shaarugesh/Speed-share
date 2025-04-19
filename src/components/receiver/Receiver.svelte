<script lang="ts">
  import { defaultReceiveOptions } from '../../configs';
  import { addToastMessage } from '../../stores/toastStore';
  import { validateFileMetadata } from '../../utils/validator';
  import { Message, MetaData, ReceiveEvent } from '../../proto/message';
  import ReceivingFileList from './ReceivingFileList.svelte';
  import ReceiverOptions from './ReceiverOptions.svelte';
  import { FileStatus, type ReceiveOptions, type ReceivingFile } from '../../type';
  import { decryptAesGcm, decryptAesKeyWithRsaPrivateKey } from '../../utils/crypto';
  import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
  import JSZip from 'jszip';
  
  type Props = {
    dataChannel: RTCDataChannel;
    isEncrypt: boolean;
    rsa: CryptoKeyPair | undefined;
  };

  let { dataChannel, isEncrypt, rsa }: Props = $props();

  let receiveOptions: ReceiveOptions = $state(defaultReceiveOptions);
  let receivingFiles: { [key: string]: ReceivingFile } = $state({});

  export async function onMetaData(id: string, metaData: MetaData) {
    let aesKey: CryptoKey | undefined;
    if (isEncrypt && rsa) {
      aesKey = await decryptAesKeyWithRsaPrivateKey(rsa.privateKey, metaData.key);
    }

    receivingFiles[id] = {
      metaData: metaData,
      progress: 0,
      bitrate: 0,
      receivedSize: 0,
      receivedChunks: [],
      startTime: 0,
      status: FileStatus.WaitingAccept,
      aesKey: aesKey
    };

    const validateErr = validateFileMetadata(metaData, receiveOptions.maxSize);
    if (validateErr) {
      addToastMessage(`${metaData.name} ${validateErr.message}`, 'error');

      dataChannel.send(
        Message.encode({
          id: id,
          receiveEvent: ReceiveEvent.EVENT_VALIDATE_ERROR
        }).finish()
      );

      receivingFiles[id].error = validateErr;

      return;
    }

    if (receiveOptions.autoAccept) {
      dataChannel.send(
        Message.encode({
          id: id,
          receiveEvent: ReceiveEvent.EVENT_RECEIVER_ACCEPT
        }).finish()
      );

      receivingFiles[id].status = FileStatus.Processing;
      receivingFiles[id].startTime = Date.now();
    }
  }

  export async function onChunkData(id: string, chunk: Uint8Array) {
    let arrayBuffer = chunk;

    dataChannel.send(
      Message.encode({
        id: id,
        receiveEvent: ReceiveEvent.EVENT_RECEIVED_CHUNK
      }).finish()
    );

    const receivingFile = receivingFiles[id];

    if (isEncrypt && receivingFile.aesKey) {
      arrayBuffer = await decryptAesGcm(receivingFile.aesKey, arrayBuffer);
    }
    const receivingSize = arrayBuffer.byteLength;

    receivingFiles[id].receivedChunks.push(arrayBuffer);
    receivingFiles[id].receivedSize += receivingSize;

    // calculate progress
    receivingFiles[id].progress = Math.round(
      (receivingFiles[id].receivedSize / receivingFile.metaData.size) * 100
    );

    // calculate bitrate
    receivingFiles[id].bitrate = Math.round(
      receivingFiles[id].receivedSize / ((Date.now() - receivingFiles[id].startTime) / 1000)
    );

    if (receivingFiles[id].receivedSize >= receivingFile.metaData.size) {
      receivingFiles[id].status = FileStatus.Success;
      addToastMessage(`Received ${receivingFiles[id].metaData.name}`, 'success');
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.readAsDataURL(blob);
    });
  }



  
  function onRemove(key: string) {
    if (receivingFiles[key].status != FileStatus.Success) {
      dataChannel.send(
        Message.encode({
          id: key,
          receiveEvent: ReceiveEvent.EVENT_RECEIVER_REJECT
        }).finish()
      );
    }
    delete receivingFiles[key];
    receivingFiles = receivingFiles; // do this to trigger update the map
  }

  async function onDownload(key: string) {
    const receivedFile = receivingFiles[key];
    const blobFile = new Blob(receivedFile.receivedChunks, {
      type: receivedFile.metaData.type
    });
  
    const base64Data = await blobToBase64(blobFile);
  
    const folderName = './';
    const fileName = receivedFile.metaData.name;
  
    try {
      // 1. Create the 'downloads' folder if it doesn't exist
      await Filesystem.mkdir({
        path: folderName,
        directory: Directory.Documents,
        recursive: true // ensures nested folder creation
      });
    } catch (err: any) {
      if (err.message?.includes('Directory exists')) {
        // safe to ignore
      } else {
        console.error('Error creating folder:', err);
        addToastMessage(`Error creating folder: ${err.message}`, 'error');
        return;
      }
    }
  
    try {
      // 2. Now write the file
      await Filesystem.writeFile({
        path: `${folderName}/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true // ensures nested folder creation
      });
  
      addToastMessage(`Saved ${fileName}`, 'success');
    } catch (error: any) {
      console.error('Filesystem write error:', error);
      addToastMessage(`Error saving file: ${error.message}`, 'error');
    }
  }




  function onAccept(key: string) {
    dataChannel.send(
      Message.encode({
        id: key,
        receiveEvent: ReceiveEvent.EVENT_RECEIVER_ACCEPT
      }).finish()
    );

    receivingFiles[key].status = FileStatus.Processing;
    receivingFiles[key].startTime = Date.now();
  }

  function onDeny(key: string) {
    dataChannel.send(
      Message.encode({
        id: key,
        receiveEvent: ReceiveEvent.EVENT_RECEIVER_REJECT
      }).finish()
    );
    delete receivingFiles[key];
    receivingFiles = receivingFiles; // do this to trigger update the map
  }

 
  async function downloadAllFiles() {
    const zip = new JSZip();
    const folder = zip.folder('received-files');
  
    for (const key of Object.keys(receivingFiles)) {
      const file = receivingFiles[key];
      if (file.status !== FileStatus.Success || file.error) continue;
  
      const blob = new Blob(file.receivedChunks, {
        type: file.metaData.type
      });
  
      const base64 = await blobToBase64(blob);
      folder?.file(file.metaData.name, base64, { base64: true });
    }
  
    try {
      const content = await zip.generateAsync({ type: 'base64' });
  
      const zipFileName = `received_files_${Date.now()}.zip`;
      const folderName = 'downloads';
  
      // Ensure the folder exists
      try {
        await Filesystem.mkdir({
          path: "./",
          directory: Directory.Documents,
          recursive: true
        });
      } catch (err: any) {
        if (!err.message?.includes('Directory exists')) {
          console.error('Failed to create folder:', err);
          addToastMessage('Failed to create folder', 'error');
          return;
        }
      }
  
      // Write the zip file
      await Filesystem.writeFile({
        path: `${folderName}/${zipFileName}`,
        data: content,
        directory: Directory.Documents,
        recursive: true
      });
  
      addToastMessage(`Saved ZIP file as ${zipFileName}`, 'success');
    } catch (error: any) {
      console.error('Failed to save ZIP:', error);
      addToastMessage(`Error saving ZIP: ${error.message}`, 'error');
    }
  }



  function onOptionsUpdate(options: ReceiveOptions) {
    receiveOptions = options;
  }
</script>

<div class="grid gap-4">
  <ReceiverOptions onUpdate={onOptionsUpdate} />
  {#if Object.keys(receivingFiles).length > 0}
    <ReceivingFileList {receivingFiles} {onRemove} {onDownload} {onAccept} {onDeny} />
    <button class="btn btn-primary mt-2" onclick={downloadAllFiles}>Download all files (zip)</button
    >
  {:else}
    <p class="mt-4">Connected, Waiting for files...</p>
  {/if}
</div>
