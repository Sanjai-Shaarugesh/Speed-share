<script lang="ts">
  import { addToastMessage } from '../stores/toastStore';
  import { defaultSendOptions, githubLink, waitIceCandidatesTimeout } from '../configs';
  import Eye from '../components/icons/Eye.svelte';
  import { Message } from '../proto/message';
  import Collapse from '../components/layout/Collapse.svelte';
  import OfferOptions from '../components/OfferOptions.svelte';
  import {
    Asterisk,
    Cog,
    ChevronsLeftRightEllipsis,
    Clipboard,
    LandPlot,
    Send,
    HeartHandshake,
    FilePlus
  } from '@lucide/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { Capacitor } from '@capacitor/core';

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
  import { navigate } from '../stores/navigationStore';

  // options
  let sendOptions = $state(defaultSendOptions);
  let rsa: CryptoKeyPair | undefined = $state(undefined); // private key
  let rsaPub: CryptoKey | undefined = $state(undefined); // public key from other peer

  let showPassword = $state(false); // State to control password visibility
  let showOfferCode = $state(false);

  // webRTC
  let connection: RTCPeerConnection | undefined = $state(undefined);
  let dataChannel: RTCDataChannel | undefined = $state(undefined);
  let isConnecting = $state(false);
  let generating = $state(false);
  let offerCode = $state('');
  let answerCode = $state('');

  // components
  let receiver: Receiver | undefined = $state(undefined);
  let sender: Sender | undefined = $state(undefined);
  let sendMode = $state(true);
  let showNewFile = $state(false);
  let showOfferOptions = $state(false);
  let qrModal: QrModal | undefined = $state(undefined);

  // Input references for auto-focus
  let offerInputs: HTMLInputElement[] = [];
  let answerInputs: HTMLInputElement[] = [];

  // Debug logging functions
  function logWebRTCState() {
    if (!connection) {
      console.error('WebRTC Connection: Not initialized');
      return;
    }
  }

  function debugAcceptAnswer() {
    logWebRTCState();
  }

  async function createOfferCode(offer: RTCSessionDescription) {
    let publicKeyBase64 = '';
    if (sendOptions.isEncrypt) {
      rsa = await generateRsaKeyPair();
      publicKeyBase64 = await exportRsaPublicKeyToBase64(rsa.publicKey);
    }

    const sdp = sdpEncode(offer.sdp);
    offerCode = generateUniqueCode(sdp, {
      iceServer:
        defaultSendOptions.iceServer === sendOptions.iceServer ? undefined : sendOptions.iceServer,
      chunkSize:
        defaultSendOptions.chunkSize === sendOptions.chunkSize ? undefined : sendOptions.chunkSize,
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

    if (!connection) {
      addToastMessage('Failed to create WebRTC connection', 'error');
      generating = false;
      return;
    }

    connection.onicecandidate = async (event) => {
      if (!event.candidate && connection!.localDescription) {
        await createOfferCode(connection!.localDescription);
        generating = false;
      }
    };

    try {
      const offer = await connection.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });
      await connection.setLocalDescription(offer);

      // stop waiting for ice candidates if longer than timeout
      setTimeout(async () => {
        if (!connection?.localDescription || !generating) return;
        addToastMessage('timeout waiting ICE candidates');
        await createOfferCode(connection.localDescription);
        generating = false;
      }, waitIceCandidatesTimeout);
    } catch (error) {
      console.error('Error generating offer:', error);
      addToastMessage('Failed to generate offer', 'error');
      generating = false;
    }
  }

  async function copyOfferCode() {
    try {
      await navigator.clipboard.writeText(offerCode);
      addToastMessage('Copied to clipboard', 'info');
    } catch (error) {
      console.error('Failed to copy offer code:', error);
      addToastMessage('Failed to copy offer code', 'error');
    }
  }

  async function acceptAnswer() {
    debugAcceptAnswer();

    if (!answerCode.trim()) {
      addToastMessage('Please enter an answer code', 'error');
      return;
    }

    try {
      let parsedCode;
      try {
        parsedCode = parseUniqueCode(answerCode);
      } catch (parseError) {
        addToastMessage('Invalid answer code format', 'error');
        console.error('Parse error:', parseError);
        return;
      }

      const { sdp, publicKey } = parsedCode;

      if (!connection) {
        addToastMessage('WebRTC connection not established', 'error');
        return;
      }

      if (sendOptions.isEncrypt && publicKey) {
        try {
          rsaPub = await importRsaPublicKeyFromBase64(publicKey);
        } catch (cryptoError) {
          addToastMessage('Failed to import public key', 'error');
          console.error('Crypto import error:', cryptoError);
          return;
        }
      }

      const remoteDesc: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: sdpDecode(sdp, false)
      };

      try {
        await connection.setRemoteDescription(remoteDesc);
        addToastMessage('Answer code accepted', 'success');
      } catch (setDescError) {
        addToastMessage('Failed to set remote description', 'error');
        console.error('Set remote description error:', setDescError);
      }
    } catch (error) {
      addToastMessage('Unexpected error processing answer code', 'error');
      console.error('Unexpected error:', error);
    }
  }

  function onOptionsUpdate(options: SendOptions) {
    sendOptions = options;
  }

  function navigateToAnswerPage() {
    window.location.href = `${window.location.origin}/answer.html`;
  }

  // Enhanced input handlers
  function handleAnswerInput(index: number, event: Event) {
    const input = (event.target as HTMLInputElement).value.slice(-1); // only last char
    if (!input) return;

    answerCode = answerCode.padEnd(5, ' ').split('').map((c, i) => (i === index ? input : c)).join('');

    // Auto-focus next input if available
    if (index < 4 && input && answerInputs[index + 1]) {
      setTimeout(() => {
        answerInputs[index + 1].focus();
        answerInputs[index + 1].select();
      }, 10);
    }
  }

  function handleAnswerKeyDown(index: number, event: KeyboardEvent) {
    const currentInput = event.target as HTMLInputElement;

    if (event.key === 'Backspace') {
      if (!currentInput.value && index > 0) {
        setTimeout(() => {
          answerInputs[index - 1].focus();
          answerInputs[index - 1].select();
        }, 10);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      setTimeout(() => {
        answerInputs[index - 1].focus();
        answerInputs[index - 1].select();
      }, 10);
    } else if (event.key === 'ArrowRight' && index < 4) {
      event.preventDefault();
      setTimeout(() => {
        answerInputs[index + 1].focus();
        answerInputs[index + 1].select();
      }, 10);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); // Prevent cursor movement
    } else if (event.key === 'Enter') {
      event.preventDefault();
      acceptAnswer();
    }
  }

  function handleAnswerPaste(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData('text')?.trim().slice(0, 5) ?? '';
    if (pasted) {
      event.preventDefault();
      answerCode = pasted.padEnd(5, ' ');

      // Focus the last input after paste
      setTimeout(() => {
        const lastFilledIndex = Math.min(pasted.length - 1, 4);
        if (answerInputs[lastFilledIndex]) {
          answerInputs[lastFilledIndex].focus();
          answerInputs[lastFilledIndex].select();
        }
      }, 10);
    }
  }

  function togglePasswordVisibility() {
    showPassword = !showPassword;
    // After toggling, refocus the first empty input or last filled input
    setTimeout(() => {
      const firstEmptyIndex = answerCode.split('').findIndex(c => !c.trim());
      const indexToFocus = firstEmptyIndex === -1 ? 4 : firstEmptyIndex;
      if (answerInputs[indexToFocus]) {
        answerInputs[indexToFocus].focus();
      }
    }, 10);
  }

  function toggleOfferVisibility() {
    showOfferCode = !showOfferCode;
  }

  const isMobile = Capacitor.isNativePlatform();
  let gPressed = false;

  onMount(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() == 'o') {
        event.preventDefault();
        generateOfferCode();
      } else if (isMobile) {
        if (event.key == 'Enter') {
          event.preventDefault();
          acceptAnswer();
        }
      } else if (event.ctrlKey && event.key.toLowerCase() == 'a') {
        event.preventDefault();
        acceptAnswer();
      } else if (event.key.toLowerCase() == 'g') {
        gPressed = true;
      } else if (gPressed && event.key.toLowerCase() == 'a') {
        event.preventDefault();
        window.location.href = '/answer.html';
      } else if (event.altKey && event.key == 's') {
        event.preventDefault();
        showOfferOptions = true;
      } else if (event.ctrlKey && event.key.toLowerCase() == 'c') {
        event.preventDefault();
        copyOfferCode();
      } else if (event.ctrlKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        navigator.clipboard
          .readText()
          .then((text) => {
            const cleanText = text.replace(/\s/g, '').slice(0, 5);
            answerCode = cleanText.padEnd(5, ' ');
            // Focus on first input after paste
            if (answerInputs[0]) {
              answerInputs[0].focus();
            }
          })
          .catch((error) => {
            console.error('Failed to read clipboard contents: ', error);
          });
      } else {
        gPressed = false;
      }
    };

    window.addEventListener('keydown', handleShortcut);

    onDestroy(() => {
      window.removeEventListener('keydown', handleShortcut);
    });
  });
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
          href={'https://speed-share-web.vercel.app/' + '#how-does-it-work'}
          target="_blank"
          rel="noopener noreferrer">How does it work?</a
        >
      </p>
      <div class="mt-4">
        {#if showOfferOptions}
          <OfferOptions onUpdate={onOptionsUpdate} />
        {/if}
        <div class="">
          <button class="btn btn-soft btn-secondary" onclick={generateOfferCode}
            >Generate Offer Code <Asterisk /></button
          >

          {#if !showOfferOptions}
            <button
              class="btn btn-secondary"
              onclick={() => {
                showOfferOptions = true;
              }}>Settings <Cog /></button
            >
          {/if}
          <button class="btn btn-dash btn-warning" onclick={navigateToAnswerPage}>
            Go to Answer Page <ChevronsLeftRightEllipsis />
          </button>
        </div>
      </div>
    {/if}
  </Collapse>

  <Collapse title="2. Accept Answer" isOpen={offerCode !== '' && !isConnecting}>
    {#if offerCode}
      <p class="">
        Share this unique offer code with your peer. They will need to enter it on the Answer page.
      </p>
      <div class="mt-2 flex items-center justify-center gap-2 relative">
        {#each offerCode.padEnd(5, ' ').split('').slice(0, 5) as char, i}
          <div class="flex items-center">
            <input
              type={showOfferCode ? 'text' : 'password'}
              class="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-center text-sm sm:text-base md:text-xl border rounded-md shadow-sm transition-colors duration-200 input input-bordered focus:input-primary disabled:input-disabled"
              value={char}
              readonly
            />
            {#if i < 4}
              <span class="mx-1 sm:mx-2 opacity-60 select-none text-sm sm:text-base md:text-lg">‒</span>
            {/if}
          </div>
        {/each}

        <!-- Eye icon -->
        <div class="absolute top-1/2 right-1 sm:right-2 transform -translate-y-1/2 p-0.5 sm:p-1">
          <Eye
            onChange={(show) => {
              showOfferCode = show;
            }}
          />
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <button class="btn btn-dash btn-success" onclick={copyOfferCode}
          >Copy Code <Clipboard /> </button
        >
        <QrModal bind:this={qrModal} qrData={offerCode} title="Offer QR Code" />
      </div>

      <p class="mt-4">Enter the Answer Code from your peer to establish connection.</p>

      <div class="relative mt-4 flex items-center justify-center gap-2">
        {#each Array(5) as _, i}
          <div class="flex items-center">
            <input
              bind:this={answerInputs[i]}
              type={showPassword ? 'text' : 'password'}
              maxlength="1"
              class="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-center text-sm sm:text-base md:text-xl border rounded-md shadow-sm transition-colors duration-200 input input-bordered focus:input-primary"
              value={answerCode[i] || ''}
              oninput={(e) => handleAnswerInput(i, e)}
              onkeydown={(e) => handleAnswerKeyDown(i, e)}
              onpaste={handleAnswerPaste}
              autocomplete="off"
              spellcheck="false"
              placeholder=""
              inputmode="text"
            />
            {#if i < 4}
              <span class="mx-1 sm:mx-2 opacity-60 select-none text-sm sm:text-base md:text-lg">‒</span>
            {/if}
          </div>
        {/each}

        <!-- Toggle eye icon -->
        <button
          type="button"
          class="absolute top-1/2 transform -translate-y-1/2 right-1 sm:right-2 p-1 sm:p-1.5 rounded-md transition-colors duration-200 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 active:bg-gray-200 dark:hover:bg-gray-700 dark:focus:bg-gray-700 dark:focus:ring-blue-800 dark:active:bg-gray-600 touch-manipulation"
          onclick={togglePasswordVisibility}
          aria-label="Toggle password visibility"
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              togglePasswordVisibility();
            }
          }}
        >
          {#if showPassword}
            <!-- Eye Open -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.724 7.732 5 12 5c4.268 0 8.268 2.724 9.542 7-1.274 4.276-5.274 7-9.542 7-4.268 0-8.268-2.724-9.542-7z" />
            </svg>
          {:else}
            <!-- Eye Closed -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M17.94 17.94A10.944 10.944 0 0 1 12 19c-4.418 0-8.268-2.724-9.542-7a10.947 10.947 0 0 1 4.138-5.21" />
              <path d="M1 1l22 22" />
              <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
              <path d="M21.54 12.53A10.944 10.944 0 0 0 12 5c-.706 0-1.394.07-2.053.203" />
            </svg>
          {/if}
        </button>
      </div>

      <div class="mt-4 flex gap-2">
        <button class="btn btn-soft btn-warning" onclick={acceptAnswer}
          >Accept Answer <LandPlot /></button
        >
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
      <div class="flex w-full mb-4 mt-2 justify-center">
        <div class="join w-full">
          <!-- Send Button -->
          <button
            class="btn btn-dash btn-secondary join-item w-1/2 text-xl py-4 min-h-[3.5rem] inline-flex items-center justify-center gap-x-2"
            onclick={() => {
              sendMode = true;
            }}
          >
            <Send />
            <span class="btm-nav-label">Send</span>
          </button>

          <!-- Receive Button with Badge -->
          <div class="relative w-1/2">
            <span
              class="indicator-item badge badge-success text-xs animate-bounce absolute"
              class:hidden={!showNewFile}
              style="top: -8px; right: 12px; z-index: 10;"
            >
              New files
            </span>
            <button
              class="btn btn-dash btn-warning join-item w-full text-xl py-4 min-h-[3.5rem] inline-flex items-center justify-center gap-x-2"
              class:btn-ghost={sendMode}
              class:btn-primary={!sendMode}
              onclick={() => {
                showNewFile = false;
                sendMode = false;
              }}
            >
              <HeartHandshake />
              <span class="btm-nav-label">Receive</span>
            </button>
          </div>
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