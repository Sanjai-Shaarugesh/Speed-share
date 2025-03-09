<script lang="ts">
  import { defaultSendOptions, githubLink, waitIceCandidatesTimeout } from '../configs';
  import { addToastMessage } from '../stores/toastStore';
  import Eye from '../components/icons/Eye.svelte';
  import { Message } from '../proto/message';
  import Collapse from '../components/layout/Collapse.svelte';
  import {
    exportRsaPublicKeyToBase64,
    generateRsaKeyPair,
    importRsaPublicKeyFromBase64
  } from '../utils/crypto';
  import { sdpDecode, sdpEncode } from '../utils/sdpEncode';
  import { generateUniqueCode, parseUniqueCode } from '../utils/uniqueCode';
  import Receiver from '../components/receiver/Receiver.svelte';
  import Sender from '../components/sender/Sender.svelte';
  import QrModal from '../components/qr/QrModal.svelte';
  import ScanQrModal from '../components/qr/ScanQrModal.svelte';
  import Toast from '../components/Toast.svelte';

  // state
  let offerCode = $state('');
  let isProcessingOffer = $state(false);
  let answerCode = $state('');
  let showAnswerCode = $state(false);
  let isConnecting = $state(false);
  let dataChannel: RTCDataChannel | undefined = $state(undefined);
  let rsa: CryptoKeyPair | undefined = $state(undefined); // private key
  let rsaPub: CryptoKey | undefined = $state(undefined); // public key from other peer

  // components
  let receiver: Receiver | undefined = $state(undefined);
  let sender: Sender | undefined = $state(undefined);
  let sendMode = $state(false);
  let showNewFile = $state(false);
  let qrModal: QrModal | undefined = $state(undefined);

  // connection object - will be initialized when processing offer
  let connection: RTCPeerConnection;

  async function processOfferCode() {
    if (!offerCode) {
      addToastMessage('Please enter an offer code', 'error');
      return;
    }

    isProcessingOffer = true;
    
    try {
      const { sdp, iceServer, chunkSize, publicKey } = parseUniqueCode(offerCode);
      
      // Initialize WebRTC connection
      connection = new RTCPeerConnection({
        iceServers: [{ urls: iceServer || defaultSendOptions.iceServer }]
      });

      connection.ondatachannel = (event) => {
        dataChannel = event.channel;

        dataChannel.onopen = () => {
          addToastMessage('Connected', 'success');
          isConnecting = true;
          qrModal?.close();
        };
        dataChannel.onmessage = (event) => {
          const message = Message.decode(new Uint8Array(event.data));

          if (message.metaData !== undefined) {
            receiver.onMetaData(message.id, message.metaData);
            showNewFile = true;
          } else if (message.chunk !== undefined) {
            receiver.onChunkData(message.id, message.chunk);
          } else if (message.receiveEvent !== undefined) {
            sender.onReceiveEvent(message.id, message.receiveEvent);
          }
        };
        dataChannel.onerror = () => {
          addToastMessage('WebRTC error', 'error');
          isConnecting = false;
        };
        dataChannel.onclose = () => {
          addToastMessage('Disconnected', 'error');
          isConnecting = false;
        };
      };

      // Set the remote description (offer)
      const sessionDesc: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: sdpDecode(sdp, true)
      };

      await connection.setRemoteDescription(sessionDesc);
      
      // If encryption is enabled, import the public key
      const isEncrypt = !!publicKey;
      if (isEncrypt) {
        rsaPub = await importRsaPublicKeyFromBase64(publicKey);
      }

      // Generate answer
      await generateAnswerCode(isEncrypt, chunkSize);
    } catch (error) {
      console.error('Error processing offer:', error);
      addToastMessage('Invalid offer code', 'error');
      isProcessingOffer = false;
    }
  }

  async function generateAnswerCode(isEncrypt: boolean, chunkSize?: number) {
    let publicKeyBase64 = '';
    if (isEncrypt) {
      rsa = await generateRsaKeyPair();
      publicKeyBase64 = await exportRsaPublicKeyToBase64(rsa.publicKey);
    }

    connection.onicecandidate = (event) => {
      if (!event.candidate && connection.localDescription) {
        const sdp = sdpEncode(connection.localDescription.sdp);
        answerCode = generateUniqueCode(sdp, { publicKey: publicKeyBase64 });
        isProcessingOffer = false;
      }
    };

    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    // stop waiting for ice candidates if longer than timeout
    setTimeout(async () => {
      if (!connection.localDescription || answerCode) return;
      addToastMessage('Timeout waiting ICE candidates');
      const sdp = sdpEncode(connection.localDescription.sdp);
      answerCode = generateUniqueCode(sdp, { publicKey: publicKeyBase64 });
      isProcessingOffer = false;
    }, waitIceCandidatesTimeout);
  }

  async function copyAnswerCode() {
    await navigator.clipboard.writeText(answerCode);
    addToastMessage('Copied to clipboard', 'info');
  }

  function navigateToOfferPage() {
    window.location.href = `${window.location.origin}/offer`;
  }

  function scanOfferCode(data: string) {
    offerCode = data;
    processOfferCode();
  }
</script>

<div class="container mx-auto p-4 max-w-3xl">
  <h1 class="text-2xl font-bold mb-4">WebRTC File Transfer - Answer Page</h1>

  <Collapse title="1. Enter Offer Code" isOpen={!answerCode && !isConnecting}>
    <p>
      Enter the offer code provided by your peer to establish a connection. See
      <a
        class="link"
        href={githubLink + '#how-does-it-work'}
        target="_blank"
        rel="noopener noreferrer">How does it work?</a
      >
    </p>
    <div class="mt-4">
      <input 
        type="text" 
        class="input input-bordered w-full" 
        placeholder="Enter offer code" 
        bind:value={offerCode}
        disabled={isProcessingOffer}
      />
      <div class="mt-4 flex gap-2">
        <button 
          class="btn btn-primary" 
          onclick={processOfferCode}
          disabled={isProcessingOffer}
        >
          {#if isProcessingOffer}
            <span class="loading loading-spinner loading-sm"></span>
            Processing
          {:else}
            Process Offer
          {/if}
        </button>
        <ScanQrModal onScanSuccess={scanOfferCode} />
        <button class="btn btn-outline" onclick={navigateToOfferPage}>Go to Offer Page</button>
      </div>
    </div>
  </Collapse>

  <Collapse title="2. Share Answer Code" isOpen={answerCode !== '' && !isConnecting}>
    {#if answerCode}
      <p>
        Share this answer code with your peer to complete the connection.
      </p>
      <div class="relative mt-4">
        <input
          type={showAnswerCode ? 'text' : 'password'}
          class="input input-bordered w-full"
          value={answerCode}
          readonly
        />
        <div class="absolute top-0 right-0 p-1">
          <Eye
            onChange={(show) => {
              showAnswerCode = show;
            }}
          />
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary gap-2" onclick={copyAnswerCode}>Copy Answer</button>
        <QrModal bind:this={qrModal} qrData={answerCode} title="Answer QR Code" />
      </div>
    {/if}
  </Collapse>

  <Collapse title="3. Transfer Files" isOpen={isConnecting}>
    {#if dataChannel}
      <div class="flex w-full mb-4 mt-2">
        <button
          class="btn {sendMode ? 'btn-primary' : 'btn-ghost'} flex-grow border-black border-dotted"
          onclick={() => {
            sendMode = true;
          }}
        >
          <span class="btm-nav-label">Send</span>
        </button>
        <div class="indicator flex-grow">
          <span
            class="indicator-item badge badge-accent animate-bounce {showNewFile
              ? 'block'
              : 'hidden'}">New files</span
          >
          <button
            class="btn {sendMode ? 'btn-ghost' : 'btn-primary'} w-full border-black border-dotted"
            onclick={() => {
              showNewFile = false;
              sendMode = false;
            }}
          >
            <span class="btm-nav-label">Receive</span>
          </button>
        </div>
      </div>
      <div hidden={!sendMode}>
        <Sender bind:this={sender} {dataChannel} {rsaPub} isEncrypt={!!rsa} chunkSize={defaultSendOptions.chunkSize} />
      </div>
      <div hidden={sendMode}>
        <Receiver bind:this={receiver} {dataChannel} isEncrypt={!!rsa} {rsa} />
      </div>
    {/if}
  </Collapse>

  <Toast />
</div>