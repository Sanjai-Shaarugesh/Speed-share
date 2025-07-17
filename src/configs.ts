import type { ReceiveOptions, SendOptions } from './type';
import { deflate, inflate } from 'pako';

// Diverse STUN/TURN servers for better connectivity
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


export const defaultSendOptions: SendOptions = {
  chunkSize: 250 * 1024,
  isEncrypt: true,
  iceServer: stunServers[0],
  wasmBufferSize: 10 * 1024 * 1024, // Reduced for mobile efficiency
  parallelChunks: 500,
  useStreaming: true,
  compressionLevel:1, // Balanced for speed and ratio
  adaptiveChunking: true,
  retryAttempts: 3,
  priorityQueueing: true,
  retryStrategy: 'exponential',
  onProgress: (progress: number) => {},
  signal: AbortSignal.timeout(30000),
  timeout: 30000
};

// Optimized receive options
export const defaultReceiveOptions: ReceiveOptions = {
  autoAccept: true,
  maxSize: 1000 * 1024 * 1024 * 1024,
  receiverBufferSize: 10 * 1024 * 1024, // Reduced for mobile
  useStreaming: true,
  decompressInBackground: true,
  chunkTimeout: 10000,
  preallocateStorage: true,
  progressInterval: 1000,
  useBinaryMode: true,
  prioritizeDownload: true
};

export const waitIceCandidatesTimeout = 5000;

let wasmModule: WebAssembly.Module | null = null;
let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

// Load WebAssembly with Zstandard compression
async function loadWasm() {
  if (!wasmModule) {
    try {
      const cache = await caches.open('wasm-cache');
      let response = await cache.match('/wasm/zstdProcessor.wasm');

      if (!response) {
        response = await fetch('/wasm/zstdProcessor.wasm'); //  Zstandard WASM
        const clonedResponse = response.clone();
        await cache.put('/wasm/zstdProcessor.wasm', clonedResponse);
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

// Process file chunk with advanced compression
export async function processFileChunk(chunk: Uint8Array): Promise<Uint8Array> {
  try {
    const module = await loadWasm();
    if (!module) {
      return processFileChunkFallback(chunk);
    }

    if (!wasmInstance) {
      wasmMemory = new WebAssembly.Memory({ initial: 5, maximum: 50 }); // Optimized for mobile
      wasmInstance = await WebAssembly.instantiate(module, {
        env: {
          memory: wasmMemory,
          abort: () => console.error('WASM aborted')
        }
      });
    }

    const { compressChunk } = wasmInstance.exports as {
      compressChunk: (ptr: number, len: number) => number;
    };
    const memory = wasmMemory as WebAssembly.Memory;

    const requiredBytes = chunk.length + 1024;
    const currentPages = memory.buffer.byteLength / 65536;
    const requiredPages = Math.ceil(requiredBytes / 65536);

    if (currentPages < requiredPages) {
      memory.grow(requiredPages - currentPages);
    }

    const memoryBuffer = new Uint8Array(memory.buffer);
    const ptr = 1024;
    memoryBuffer.set(chunk, ptr);

    const compressedSize = compressChunk(ptr, chunk.length);
    return memoryBuffer.slice(ptr, ptr + compressedSize);
  } catch (error) {
    console.warn('WASM processing failed, using JS fallback', error);
    return processFileChunkFallback(chunk);
  }
}

/**
 * Compress a file chunk using pako (zlib deflate).
 * @param chunk Uint8Array input chunk
 * @returns Compressed Uint8Array
 */
export function processFileChunkFallback(chunk: Uint8Array): Uint8Array {
  try {
    return deflate(chunk);
  } catch (error) {
    console.error('Compression error:', error);
    return chunk; // Fallback: return uncompressed
  }
}

/**
 * Decompress a file chunk using pako (zlib inflate).
 * @param chunk Uint8Array compressed chunk
 * @returns Decompressed Uint8Array
 */
export function decompressFileChunkFallback(chunk: Uint8Array): Uint8Array {
  try {
    return inflate(chunk);
  } catch (error) {
    console.error('Decompression error:', error);
    return chunk; // Fallback
  }
}
// Detect network quality
export async function detectNetworkQuality(): Promise<{
  bandwidth: number;
  latency: number;
  reliability: number;
}> {
  try {
    const startTime = performance.now();
    const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
      method: 'GET',
      cache: 'no-store'
    });
    const endTime = performance.now();
    const latency = endTime - startTime;
    const text = await response.text();
    const bandwidth = text.length / (latency / 1000); // bytes per second

    return {
      bandwidth,
      latency,
      reliability: latency < 200 ? 1.0 : latency < 500 ? 0.7 : 0.4
    };
  } catch (error) {
    console.warn('Network quality detection failed', error);
    return {
      bandwidth: 10 * 1024, // Low default
      latency: 800,
      reliability: 0.3
    };
  }
}

// Optimize transfer settings dynamically
export async function optimizeTransferSettings(options: SendOptions): Promise<SendOptions> {
  const networkQuality = await detectNetworkQuality();
  const optimized = { ...options };
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  if (networkQuality.bandwidth < 50 * 1024) { // Very low bandwidth
    optimized.chunkSize = 4 * 1024;
    optimized.parallelChunks = isMobile ? 1 : 2;
    optimized.compressionLevel = 9; // High compression
  } else if (networkQuality.bandwidth < 200 * 1024) {
    optimized.chunkSize = 8 * 1024;
    optimized.parallelChunks = isMobile ? 2 : 3;
    optimized.compressionLevel = 8;
  } else if (networkQuality.bandwidth < 1024 * 1024) {
    optimized.chunkSize = 16 * 1024;
    optimized.parallelChunks = isMobile ? 3 : 4;
    optimized.compressionLevel = 7;
  } else { // Good bandwidth
    optimized.chunkSize = 64 * 1024;
    optimized.parallelChunks = isMobile ? 4 : 6;
    optimized.compressionLevel = 6;
  }

  if (networkQuality.latency > 300) {
    optimized.parallelChunks = Math.max(optimized.parallelChunks, 2);
  }

  return optimized;
}

// Create multiple reliable data channels for parallel transfers
export async function createReliableDataChannel(
  peerConnection: RTCPeerConnection,
  label: string,
  maxRetries = 3
): Promise<RTCDataChannel> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const dataChannel = peerConnection.createDataChannel(label, {
        ordered: true,
        maxRetransmits: 10
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        dataChannel.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        dataChannel.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });

      return dataChannel;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) throw new Error('Failed to create data channel');
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }

  throw new Error('Failed after max retries');
}

// // Utility to create multiple channels
// async function createMultipleDataChannels(peerConnection: RTCPeerConnection, count: number): Promise<RTCDataChannel[]> {
//   const channels: RTCDataChannel[] = [];
//   for (let i = 0; i < count; i++) {
//     const channel = await createReliableDataChannel(peerConnection, `channel-${i}`);
//     channels.push(channel);
//   }
//   return channels;
// }
