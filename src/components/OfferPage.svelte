<script lang="ts">
  import { addToastMessage } from '../stores/toastStore';
  import { defaultSendOptions, githubLink, waitIceCandidatesTimeout } from '../configs';
  import Eye from '../components/icons/Eye.svelte';
  import { Message } from '../proto/message';
  import Collapse from '../components/layout/Collapse.svelte';
  import OfferOptions from '../components/OfferOptions.svelte';
  import {
    exportRsaPublicKeyToBase64,
    generateRsaKeyPair,
    importRsaPublicKeyFromBase64
  } from '../utils/crypto';
  import { sdpDecode, sdpEncode } from '../utils/sdpEncode';
  import { generateUniqueCode, parseUniqueCode } from '../utils/uniqueCode';
  import type { SendOptions } from '../type';
  import Sender from '../components/sender/Sender.svelte';
  import Receiver from '../components/receiver/Receiver.svelte';
  import QrModal from '../components/qr/QrModal.svelte';
  import ScanQrModal from '../components/qr/ScanQrModal.svelte';
  import Toast from '../components/Toast.svelte';

  // options
  let sendOptions = $state(defaultSendOptions);
  let rsa: CryptoKeyPair | undefined = $state(undefined); // private key
  let rsaPub: CryptoKey | undefined = $state(undefined); // public key from other peer

  // webRTC
  let connection: RTCPeerConnection;
  let dataChannel: RTCDataChannel | undefined = $state(undefined);
  let isConnecting = $state(false);
  let generating = $state(false);
  let offerCode = $state('');
  let showOfferCode = $state(false);
  let answerCode = $state('');

  // components
  let receiver: Receiver | undefined = $state(undefined);
  let sender: Sender | undefined = $state(undefined);
  let sendMode = $state(true);
  let showNewFile = $state(false);
  let showOfferOptions = $state(false);
  let qrModal: QrModal | undefined = $state(undefined);

  async function createOfferCode(offer: RTCSessionDescription) {
    let publicKeyBase64 = '';
    if (sendOptions.isEncrypt) {
      rsa = await generateRsaKeyPair();
      publicKeyBase64 = await exportRsaPublicKeyToBase64(rsa.publicKey);
    }

    const sdp = sdpEncode(offer.sdp);
    offerCode = generateUniqueCode(sdp, {
      iceServer: defaultSendOptions.iceServer === sendOptions.iceServer ? undefined : sendOptions.iceServer,
      chunkSize: defaultSendOptions.chunkSize === sendOptions.chunkSize ? undefined : sendOptions.chunkSize,
      publicKey: publicKeyBase64
    });
  }

  async function createPeerAndDataCannel() {
      connection = new RTCPeerConnection({
        iceServers: [{ urls: sendOptions.iceServer }],
        bundlePolicy: 'balanced',
        iceCandidatePoolSize: 4
      });

      connection.onicecandidateerror = () => {
        addToastMessage('ICE Candidate error', 'error'); 
      };

      dataChannel = connection.createDataChannel('data', {
        ordered: false // we handle the order by response status
      });
      dataChannel.onopen = () => {
        addToastMessage('Connected', 'success');
        isConnecting = true;
        qrModal?.close();
      };
      dataChannel.onmessage = (event) => {
        const message = Message.decode(new Uint8Array(event.data));

        if (message.metaData !== undefined && receiver) {
          receiver.onMetaData(message.id, message.metaData);
          showNewFile = true;
        } else if (message.chunk !== undefined && receiver) {
          receiver.onChunkData(message.id, message.chunk);
        } else if (message.receiveEvent !== undefined && sender) {
          sender.onReceiveEvent(message.id, message.receiveEvent);
        }
      };
      dataChannel.onerror = () => {
        addToastMessage('WebRTC error', 'error');
        isConnecting = false;
        offerCode = '';
      };
      dataChannel.onclose = () => {
        addToastMessage('Disconnected', 'error');
        isConnecting = false;
        offerCode = '';
      };
    }

  async function generateOfferCode() {
    generating = true;
    await createPeerAndDataCannel();

    connection.onicecandidate = async (event) => {
      if (!event.candidate && connection.localDescription) {
        await createOfferCode(connection.localDescription);
        generating = false;
      }
    };

    const offer = await connection.createOffer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false
    });
    await connection.setLocalDescription(offer);

    // stop waiting for ice candidates if longer than timeout
    setTimeout(async () => {
      if (!connection.localDescription || !generating) return;
      addToastMessage('timeout waiting ICE candidates');
      await createOfferCode(connection.localDescription);
      generating = false;
    }, waitIceCandidatesTimeout);
  }

  async function copyOfferCode() {
    await navigator.clipboard.writeText(offerCode);
    addToastMessage('Copied to clipboard', 'info');
  }

  async function acceptAnswer() {
    try {
      const { sdp, publicKey } = parseUniqueCode(answerCode);

      if (sendOptions.isEncrypt && publicKey) {
        rsaPub = await importRsaPublicKeyFromBase64(publicKey);
      }

      const remoteDesc: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: sdpDecode(sdp, false)
      };
      await connection.setRemoteDescription(remoteDesc);
    } catch (error) {
      addToastMessage('Invalid answer code', 'error');
      console.error('Failed to parse answer code:', error);
    }
  }

  function onOptionsUpdate(options: SendOptions) {
    sendOptions = options;
  }

  function navigateToAnswerPage() {
    window.location.href = `${window.location.origin}/answer`;
  }
</script>

<div class="container mx-auto p-4 max-w-3xl">
  <h1 class="text-2xl font-bold mb-4">File Transfer - Offer Page</h1>
  
  <Collapse title="1. Generate Offer" isOpen={!offerCode}>
    {#if generating}
      <div class="flex flex-col items-center justify-center gap-2">
        <span class="loading loading-spinner loading-lg"></span>
        <div>Generating Offer</div>
      </div>
      
      
    {:else}
      <p>
        Generate a unique offer code to establish a connection. See
        <a
          class="link"
          href={githubLink + '#how-does-it-work'}
          target="_blank"
          rel="noopener noreferrer">How does it work?</a
        >
      </p>
      <div class="mt-4">
        {#if showOfferOptions}
          <OfferOptions onUpdate={onOptionsUpdate} />
        {/if}
        <div class="">
          
          
            
            
            <button class="btn btn-soft btn-secondary"  onclick={generateOfferCode}>Generate Offer Code</button>
          
          {#if !showOfferOptions}
            
            
             
              
              <button class="btn btn-secondary" onclick={() => {
   showOfferOptions = true;
 }}>Settings</button>
            
          {/if}
          
          <button class="btn btn-dash btn-warning" onclick={navigateToAnswerPage}>Go to Answer Page</button>
        </div>
      </div>
    {/if}
  </Collapse>

  <Collapse title="2. Accept Answer" isOpen={offerCode !== '' && !isConnecting}>
    {#if offerCode}
      <p class="">Share this unique offer code with your peer. They will need to enter it on the Answer page.</p>
      <div class="mt-2 relative">
        <input
          type={showOfferCode ? 'text' : 'password'}
          class="input input-bordered w-full"
          value={offerCode}
          readonly
        />
        <div class="absolute top-0 right-0 p-1">
          <Eye
            onChange={(show) => {
              showOfferCode = show;
            }}
          />
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary gap-2" onclick={copyOfferCode}>Copy Code</button>
        <QrModal bind:this={qrModal} qrData={offerCode} title="Offer QR Code" />
      </div>
      <p class="mt-4">Enter the Answer Code from your peer to establish connection.</p>
      <div class="relative mt-4">
        <input type="password" class="input input-bordered w-full" bind:value={answerCode} />
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-primary" onclick={acceptAnswer}>Accept Answer</button>
        <ScanQrModal
          onScanSuccess={(data) => {
            answerCode = data;
            acceptAnswer();
          }}
        />
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
        <Sender
          bind:this={sender}
          {dataChannel}
          {rsaPub}
          isEncrypt={sendOptions.isEncrypt}
          chunkSize={sendOptions.chunkSize}
        />
      </div>
      <div hidden={sendMode}>
        <Receiver bind:this={receiver} {dataChannel} isEncrypt={sendOptions.isEncrypt} {rsa} />
      </div>
    {/if}
  </Collapse>

  <Toast />
</div>