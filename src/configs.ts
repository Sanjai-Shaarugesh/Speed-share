import type { ReceiveOptions, SendOptions } from './type';

// Diverse STUN and TURN servers for robust connectivity
export const stunServers: string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun.l.google.com:19305',
  'stun:stun4.l.google.com:19302',
  'stun:stun4.l.google.com:19305',
  'stun:stun.sipgate.net:3478',
  'stun:stun.sipgate.net:10000',
  'stun:stun.nextcloud.com:3478',
  'stun:stun.nextcloud.com:443',
  'stun:stun.myvoipapp.com:3478',
  'stun:stun.voipstunt.com:3478',
  'turn:numb.viagenie.ca:3478',
  'turn:turn.anyfirewall.com:443'
];

export const pageDescription =
  'A client-side secure P2P file sharing app optimized for low-bandwidth conditions.';
export const githubLink = 'https://github.com/Sanjai-Shaarugesh/Speed-share';

// Default send options optimized for large file transfers
export const defaultSendOptions: SendOptions = {
  chunkSize: 250 * 1024,
  isEncrypt: true,
  iceServer: stunServers[0],
  wasmBufferSize: 10000000 * 1024, // ~10GB buffer for large files
  parallelChunks: 20,
  useStreaming: true,
  compressionLevel: 20, // Max compression for data reduction
  adaptiveChunking: true,
  retryAttempts: 3,
  priorityQueueing: true,
  retryStrategy: 'exponential',
  onProgress: (progress: number) => {},
  signal: AbortSignal.timeout(30000),
  timeout: 30000
};

// Receive options tailored for low network conditions
export const defaultReceiveOptions: ReceiveOptions = {
  autoAccept: true,
  maxSize: 1000 * 1024 * 1024 * 1024, // 1TB max size
  receiverBufferSize: 10000000 * 1024, // Corrected to 10GB
  useStreaming: true,
  decompressInBackground: true,
  chunkTimeout: 10000,
  preallocateStorage: true,
  progressInterval: 1000,
  useBinaryMode: true,
  prioritizeDownload: true
};

export const waitIceCandidatesTimeout = 10000; // Extended for slow networks

let wasmModule: WebAssembly.Module | null = null;
let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

// Load WebAssembly module for efficient compression
async function loadWasm() {
  if (!wasmModule) {
    try {
      const cache = await caches.open('wasm-cache');
      let response = await cache.match('/wasm/fileProcessor.wasm');

      if (!response) {
        response = await fetch('/wasm/fileProcessor.wasm');
        const clonedResponse = response.clone();
        await cache.put('/wasm/fileProcessor.wasm', clonedResponse);
      }

      const buffer = await response.arrayBuffer();
      wasmModule = await WebAssembly.compile(buffer);
    } catch (error) {
      console.error('WASM loading failed, falling back to JS', error);
      return null;
    }
  }
  return wasmModule;
}

// Process file chunks with WASM for compression
export async function processFileChunk(chunk: Uint8Array): Promise<Uint8Array> {
  try {
    const module = await loadWasm();
    if (!module) return processFileChunkFallback(chunk);

    if (!wasmInstance) {
      wasmMemory = new WebAssembly.Memory({ initial: 10, maximum: 100 });
      wasmInstance = await WebAssembly.instantiate(module, {
        env: { memory: wasmMemory, abort: () => console.error('WASM aborted') }
      });
    }

    const { processChunk } = wasmInstance.exports as { processChunk: (ptr: number, len: number) => number };
    const memory = wasmMemory as WebAssembly.Memory;

    const requiredBytes = chunk.length + 1024;
    const currentPages = memory.buffer.byteLength / 65536;
    const requiredPages = Math.ceil(requiredBytes / 65536);

    if (currentPages < requiredPages) memory.grow(requiredPages - currentPages);

    const memoryBuffer = new Uint8Array(memory.buffer);
    const ptr = 1024;
    memoryBuffer.set(chunk, ptr);

    const newSize = processChunk(ptr, chunk.length);
    return memoryBuffer.slice(ptr, ptr + newSize);
  } catch (error) {
    console.warn('WASM failed, using JS fallback', error);
    return processFileChunkFallback(chunk);
  }
}

// Fallback for chunk processing
function processFileChunkFallback(chunk: Uint8Array): Uint8Array {
  return chunk; // Simplified; real impl should mimic WASM compression
}

// Detect network quality for adaptive settings
export async function detectNetworkQuality(): Promise<{ bandwidth: number; latency: number; reliability: number }> {
  try {
    const startTime = performance.now();
    const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { method: 'GET', cache: 'no-store' });
    const endTime = performance.now();
    const latency = endTime - startTime;
    const text = await response.text();
    const size = text.length;
    const bandwidth = size / (latency / 1000);

    return {
      bandwidth,
      latency,
      reliability: latency < 200 ? 1.0 : latency < 500 ? 0.7 : 0.4
    };
  } catch (error) {
    console.warn('Network detection failed', error);
    return { bandwidth: 10 * 1024, latency: 800, reliability: 0.3 };
  }
}

// Optimize transfer settings based on network
export async function optimizeTransferSettings(options: SendOptions): Promise<SendOptions> {
  const networkQuality = await detectNetworkQuality();
  const optimized = { ...options };

  if (networkQuality.bandwidth < 50 * 1024) {
    optimized.chunkSize = 4 * 1024;
    optimized.parallelChunks = 1;
    optimized.compressionLevel = 20; // Max compression for low bandwidth
  } else if (networkQuality.bandwidth < 200 * 1024) {
    optimized.chunkSize = 8 * 1024;
    optimized.parallelChunks = 2;
    optimized.compressionLevel = 15;
  } else if (networkQuality.bandwidth < 1024 * 1024) {
    optimized.chunkSize = 16 * 1024;
    optimized.parallelChunks = 3;
    optimized.compressionLevel = 10;
  } else {
    optimized.chunkSize = 64 * 1024;
    optimized.parallelChunks = 4;
    optimized.compressionLevel = 5;
  }

  if (networkQuality.latency > 300) optimized.parallelChunks = Math.max(2, optimized.parallelChunks);

  return optimized;
}

// Create reliable data channel with retries
export async function createReliableDataChannel(peerConnection: RTCPeerConnection, label: string, maxRetries = 3): Promise<RTCDataChannel> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const dataChannel = peerConnection.createDataChannel(label, { ordered: true, maxRetransmits: 10 });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Data channel timeout')), 5000);
        dataChannel.onopen = () => { clearTimeout(timeout); resolve(); };
        dataChannel.onerror = (error) => { clearTimeout(timeout); reject(error); };
      });
      return dataChannel;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
  throw new Error('Failed to create data channel');
}

// Main file transfer function
export async function sendFile(file: File, peerConnection: RTCPeerConnection) {
  const options = await optimizeTransferSettings(defaultSendOptions);
  const dataChannel = await createReliableDataChannel(peerConnection, 'fileTransfer');
  let offset = 0;
  const fileSize = file.size;
  const reader = new FileReader();

  dataChannel.onopen = async () => {
    while (offset < fileSize) {
      const chunk = file.slice(offset, offset + options.chunkSize);
      reader.readAsArrayBuffer(chunk);
      await new Promise((resolve) => (reader.onload = resolve));
      const buffer = reader.result as ArrayBuffer;
      const compressedChunk = await processFileChunk(new Uint8Array(buffer));
      dataChannel.send(compressedChunk);
      offset += options.chunkSize;
      options.onProgress(offset / fileSize * 100);
    }
    dataChannel.close();
  };
}