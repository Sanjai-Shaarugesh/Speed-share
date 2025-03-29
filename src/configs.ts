import type { ReceiveOptions, SendOptions } from './type';

// Added more diverse STUN servers for better connectivity
export const stunServers: string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun.l.google.com:19305',
  'stun:stun4.l.google.com:19302',
  'stun:stun4.l.google.com:19305',
  'stun:stun.sipgate.net:3478',
  'stun:stun.sipgate.net:10000',
  'stun:stun.nextcloud.com:3478',
  'stun:stun.nextcloud.com:443', // Added TURN servers for fallback when STUN fails in restrictive networks
  'stun:stun.myvoipapp.com:3478',
  'stun:stun.voipstunt.com:3478',
  'turn:numb.viagenie.ca:3478',
  'turn:turn.anyfirewall.com:443'
];

export const pageDescription = 'A client-side secure P2P file sharing app optimized for low-bandwidth conditions.';
export const githubLink = 'https://github.com/Sanjai-Shaarugesh/Speed-share';

export const defaultSendOptions: SendOptions = {
  chunkSize: 250 * 1024, 
  isEncrypt: true,
  iceServer: stunServers[0],
  wasmBufferSize: 100000 * 1024, 
  parallelChunks: 20, // Fewer parallel chunks for lower bandwidth environments
  useStreaming: true,
  compressionLevel: 20, 
  adaptiveChunking: true, 
  retryAttempts: 3, // Auto-retry failed chunks
  priorityQueueing: true, // Prioritize metadata and small files
  retryStrategy: 'exponential',
  onProgress: (progress: number) => {
    console.log(`Progress: ${progress.toFixed(2)}%`);
  },
  signal: AbortSignal.timeout(30000),
  timeout: 30000
};

// Optimized receive options for low network conditions
export const defaultReceiveOptions: ReceiveOptions = {
  autoAccept: true,
  maxSize: 20 * 1024 * 1024 * 1024, 
  receiverBufferSize: 1000 * 1024 * 1024, 
  useStreaming: true,
  decompressInBackground: true,
  chunkTimeout: 10000, // Longer timeout for slow networks
  preallocateStorage: true, // Preallocate storage for better performance
  progressInterval: 1000, // Progress update interval in ms
  useBinaryMode: true, 
  prioritizeDownload: true 
};

export const waitIceCandidatesTimeout = 5000; // Increased timeout for slow network discovery

let wasmModule: WebAssembly.Module | null = null;
let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

async function loadWasm() {
  if (!wasmModule) {
    try {
      // Try to load from cache first
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
      console.error('WASM loading failed, falling back to JS implementation', error);
      return null;
    }
  }
  return wasmModule;
}

export async function processFileChunk(chunk: Uint8Array): Promise<Uint8Array> {
  try {
    const module = await loadWasm();
    if (!module) {
      return processFileChunkFallback(chunk);
    }
    
    if (!wasmInstance) {
      wasmMemory = new WebAssembly.Memory({ initial: 10, maximum: 100 });
      wasmInstance = await WebAssembly.instantiate(module, {
        env: {
          memory: wasmMemory,
          abort: () => console.error('WASM aborted')
        }
      });
    }
    
    const { processChunk } = wasmInstance.exports as { processChunk: (ptr: number, len: number) => number };
    const memory = wasmMemory as WebAssembly.Memory;
    
    // Check if we need to grow memory
    const requiredBytes = chunk.length + 1024; // Add some padding
    const currentPages = memory.buffer.byteLength / 65536;
    const requiredPages = Math.ceil(requiredBytes / 65536);
    
    if (currentPages < requiredPages) {
      memory.grow(requiredPages - currentPages);
    }
    
    // Process the chunk
    const memoryBuffer = new Uint8Array(memory.buffer);
    const ptr = 1024; // Start at offset to avoid any header data
    memoryBuffer.set(chunk, ptr);
    
    const newSize = processChunk(ptr, chunk.length);
    return memoryBuffer.slice(ptr, ptr + newSize);
  } catch (error) {
    console.warn('WASM processing failed, using JS fallback', error);
    return processFileChunkFallback(chunk);
  }
}

// JavaScript fallback implementation when WebAssembly fails
function processFileChunkFallback(chunk: Uint8Array): Uint8Array {
  // Simple processing for fallback - in real implementation,
  // this would mirror the WASM functionality
  return chunk;
}

// New adaptive network quality detection by sanjai own method 😆
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
    const size = text.length;
    const bandwidth = size / (latency / 1000); // bytes per second
    
    return {
      bandwidth,
      latency,
      reliability: latency < 200 ? 1.0 : latency < 500 ? 0.7 : 0.4
    };
  } catch (error) {
    console.warn('Network quality detection failed', error);
    return {
      bandwidth: 10 * 1024, // Assume very low bandwidth (10 KB/s) 😆  eg:india with low network connection 
      latency: 800, // Assume high latency
      reliability: 0.3 // Assume poor reliability
    };
  }
}

// New function to optimize transfer parameters based on network conditions
// (This function is extended below via a wrapper to “force” high throughput for our target)
export async function optimizeTransferSettings(
  options: SendOptions
): Promise<SendOptions> {
  const networkQuality = await detectNetworkQuality();
  
  const optimized = { ...options };
  
  if (networkQuality.bandwidth < 50 * 1024) { 
    optimized.chunkSize = 4 * 1024; 
    optimized.parallelChunks = 1; 
    optimized.compressionLevel = 9; // Max compression
  } else if (networkQuality.bandwidth < 200 * 1024) { 
    optimized.chunkSize = 8 * 1024;
    optimized.parallelChunks = 2;
    optimized.compressionLevel = 9;
  } else if (networkQuality.bandwidth < 1024 * 1024) { 
    optimized.chunkSize = 16 * 1024;
    optimized.parallelChunks = 3;
    optimized.compressionLevel = 7;
  } else {
    // Good bandwidth, use original settings or even higher
    optimized.chunkSize = 64 * 1024;
    optimized.parallelChunks = 4;
    optimized.compressionLevel = 6;
  }
  
  // Adjust for latency
  if (networkQuality.latency > 300) {
    optimized.parallelChunks = Math.max(2, optimized.parallelChunks); // Increase parallel chunks to overcome latency
  }
  
  return optimized;
}

// Connection retry mechanism
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
      
      // Wait for channel to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Data channel open timeout'));
        }, 5000);
        
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
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
    }
  }
  
  throw new Error('Failed to create data channel after max retries');
}

/*
 * =============================================================================
 * ADDITIONAL FUNCTIONALITY FOR HIGH-THROUGHPUT FILE TRANSFER
 * =============================================================================
 *
 * This new section wraps the file sending logic. It leverages the existing
 * functions but “forces” the transfer settings to extreme values so that, in
 * theory, a 10GB file could be sent in 10 seconds (i.e. ~1GB/s throughput).
 *
 * Note: Achieving such performance on low‑latency or mobile devices is highly
 * theoretical and will depend on the actual network/hardware.
 */

// Wrapper to override optimized settings for high throughput
async function forceHighThroughputSettings(options: SendOptions): Promise<SendOptions> {
  const forced: SendOptions = { ...options };
  // Force a much larger chunk size and higher parallelism:
  forced.chunkSize = 10 * 1024 * 1024; // 10 MB chunks
  forced.parallelChunks = 16;         // Increase parallel chunks
  // Optionally lower compression to reduce CPU overhead:
  forced.compressionLevel = 3;
  return forced;
}

// New function to send a file using the (forced) high-throughput settings
export async function sendFile(file: File, peerConnection: RTCPeerConnection): Promise<void> {
  // Get default optimized settings then force high-throughput overrides
  const optimizedOptions = await optimizeTransferSettings(defaultSendOptions);
  const highThroughputOptions = await forceHighThroughputSettings(optimizedOptions);

  // Create the reliable data channel
  const dataChannel = await createReliableDataChannel(peerConnection, 'fileTransfer');
  
  const fileSize = file.size;
  const totalChunks = Math.ceil(fileSize / highThroughputOptions.chunkSize);
  
  console.log(`Starting transfer: ${fileSize} bytes in ${totalChunks} chunks`);
  
  let sentChunks = 0;
  const startTime = performance.now();

  // Function to process and send one chunk
  async function sendChunk(chunkIndex: number): Promise<void> {
    const start = chunkIndex * highThroughputOptions.chunkSize;
    const end = Math.min(start + highThroughputOptions.chunkSize, fileSize);
    const blobChunk = file.slice(start, end);
    const arrayBuffer = await blobChunk.arrayBuffer();
    let chunk = new Uint8Array(arrayBuffer);
    // Process chunk using WASM or JS fallback
    chunk = await processFileChunk(chunk);
    // Send the processed chunk over the data channel
    dataChannel.send(chunk);
    sentChunks++;
    const progress = (sentChunks / totalChunks) * 100;
    highThroughputOptions.onProgress(progress);
  }

  // Limit concurrency using the forced parallelChunks setting
  let currentIndex = 0;
  async function runQueue() {
    while (currentIndex < totalChunks) {
      const batch: Promise<void>[] = [];
      for (let i = 0; i < highThroughputOptions.parallelChunks && currentIndex < totalChunks; i++) {
        batch.push(sendChunk(currentIndex));
        currentIndex++;
      }
      await Promise.all(batch);
    }
  }
  
  await runQueue();

  const endTime = performance.now();
  const durationSec = (endTime - startTime) / 1000;
  console.log(`File transfer completed in ${durationSec.toFixed(2)} seconds`);

  if (durationSec > 10) {
    console.warn('Transfer did not complete within 10 seconds. This may be due to network or hardware limitations.');
  } else {
    console.log('Transfer achieved the 10-second target (theoretical performance).');
  }
}

/*
 * =============================================================================
 * USAGE EXAMPLE:
 *
 * Assume you have an established RTCPeerConnection (peerConnection) and a File
 * object (e.g. from an input element or drag-and-drop). You could call:
 *
 *    sendFile(selectedFile, peerConnection)
 *      .then(() => console.log('File sent successfully'))
 *      .catch(err => console.error('File transfer failed', err));
 *
 * =============================================================================
 */
