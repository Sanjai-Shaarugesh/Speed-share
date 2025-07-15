import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { ReceiveOptions, SendOptions } from './type';

// Mobile-optimized STUN servers (prefer Google's reliable ones)
export const stunServers: string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun.l.google.com:19305',
  'stun:stun4.l.google.com:19302',
  'stun:stun.sipgate.net:3478',
  'stun:stun.nextcloud.com:3478'
];

export const pageDescription =
  'A client-side secure P2P file sharing app optimized for mobile devices.';
export const githubLink = 'https://github.com/Sanjai-Shaarugesh/Speed-share';

// Mobile-optimized send options with reduced memory usage
export const defaultSendOptions: SendOptions = {
  chunkSize: 32 * 1024, // Smaller chunks for mobile
  isEncrypt: true,
  iceServer: stunServers[0],
  wasmBufferSize: 50 * 1024 * 1024, // 50MB buffer for mobile
  parallelChunks: 2, // Reduced for mobile CPU
  useStreaming: true,
  compressionLevel: 15, // Balanced compression for mobile
  adaptiveChunking: true,
  retryAttempts: 5, // More retries for unstable mobile networks
  priorityQueueing: true,
  retryStrategy: 'exponential',
  onProgress: (progress: number) => {},
  signal: AbortSignal.timeout(60000), // Longer timeout for mobile
  timeout: 60000
};

// Mobile-optimized receive options
export const defaultReceiveOptions: ReceiveOptions = {
  autoAccept: false, // Manual accept for mobile UX
  maxSize: 500 * 1024 * 1024, // 500MB max for mobile storage
  receiverBufferSize: 50 * 1024 * 1024, // 50MB buffer
  useStreaming: true,
  decompressInBackground: true,
  chunkTimeout: 15000, // Longer timeout for mobile
  preallocateStorage: false, // Don't preallocate on mobile
  progressInterval: 2000, // Less frequent updates to save battery
  useBinaryMode: true,
  prioritizeDownload: true
};

export const waitIceCandidatesTimeout = 15000; // Extended for mobile networks

// Mobile-specific utilities
class MobileOptimizer {
  private static instance: MobileOptimizer;
  private deviceInfo: any = null;
  private networkStatus: any = null;
  private isLowMemoryDevice = false;

  static getInstance(): MobileOptimizer {
    if (!MobileOptimizer.instance) {
      MobileOptimizer.instance = new MobileOptimizer();
    }
    return MobileOptimizer.instance;
  }

  async initialize(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        this.deviceInfo = await Device.getInfo();
        this.networkStatus = await Network.getStatus();

        // Detect low memory devices
        this.isLowMemoryDevice = this.deviceInfo.memUsed
          ? (this.deviceInfo.memUsed / this.deviceInfo.memAvailable) > 0.8
          : false;

        // Listen for network changes
        Network.addListener('networkStatusChange', (status) => {
          this.networkStatus = status;
          this.onNetworkChange(status);
        });
      } catch (error) {
        console.warn('Mobile initialization failed:', error);
      }
    }
  }

  private onNetworkChange(status: any): void {
    console.log('Network changed:', status);
    // Adjust transfer settings based on network type
    if (status.connectionType === 'cellular') {
      // Reduce chunk size and parallel transfers for cellular
      defaultSendOptions.chunkSize = 16 * 1024;
      defaultSendOptions.parallelChunks = 1;
    } else if (status.connectionType === 'wifi') {
      // Restore normal settings for WiFi
      defaultSendOptions.chunkSize = 32 * 1024;
      defaultSendOptions.parallelChunks = 2;
    }
  }

  getOptimalChunkSize(): number {
    if (this.isLowMemoryDevice) return 16 * 1024;
    if (this.networkStatus?.connectionType === 'cellular') return 8 * 1024;
    return 32 * 1024;
  }

  getMaxParallelChunks(): number {
    if (this.isLowMemoryDevice) return 1;
    if (this.networkStatus?.connectionType === 'cellular') return 1;
    return 2;
  }
}

// Mobile-safe WebAssembly loading (fallback for unsupported devices)
let wasmSupported = false;
let wasmModule: WebAssembly.Module | null = null;
let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

async function loadWasm(): Promise<WebAssembly.Module | null> {
  if (!wasmSupported) {
    try {
      // Test WASM support
      await WebAssembly.compile(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
      wasmSupported = true;
    } catch {
      console.log('WASM not supported on this device');
      return null;
    }
  }

  if (!wasmModule && wasmSupported) {
    try {
      let response: Response;

      if (Capacitor.isNativePlatform()) {
        // Load from app bundle on mobile
        const wasmFile = await Filesystem.readFile({
          path: 'wasm/fileProcessor.wasm',
          directory: Directory.Data
        });
        const buffer = Uint8Array.from(atob(wasmFile.data), c => c.charCodeAt(0)).buffer;
        wasmModule = await WebAssembly.compile(buffer);
      } else {
        // Web fallback
        response = await fetch('/wasm/fileProcessor.wasm');
        const buffer = await response.arrayBuffer();
        wasmModule = await WebAssembly.compile(buffer);
      }
    } catch (error) {
      console.error('WASM loading failed:', error);
      wasmSupported = false;
      return null;
    }
  }
  return wasmModule;
}

// Mobile-optimized chunk processing
export async function processFileChunk(chunk: Uint8Array): Promise<Uint8Array> {
  const optimizer = MobileOptimizer.getInstance();

  // Skip WASM on low memory devices
  if (optimizer['isLowMemoryDevice']) {
    return processFileChunkFallback(chunk);
  }

  try {
    const module = await loadWasm();
    if (!module) return processFileChunkFallback(chunk);

    if (!wasmInstance) {
      wasmMemory = new WebAssembly.Memory({ initial: 2, maximum: 10 }); // Smaller for mobile
      wasmInstance = await WebAssembly.instantiate(module, {
        env: {
          memory: wasmMemory,
          abort: () => console.error('WASM aborted')
        }
      });
    }

    const { processChunk } = wasmInstance.exports as { processChunk: (ptr: number, len: number) => number };
    const memory = wasmMemory as WebAssembly.Memory;

    const requiredBytes = chunk.length + 1024;
    const currentPages = memory.buffer.byteLength / 65536;
    const requiredPages = Math.ceil(requiredBytes / 65536);

    if (currentPages < requiredPages) {
      const maxPages = 10; // Limit memory growth on mobile
      if (requiredPages > maxPages) {
        throw new Error('Memory limit exceeded');
      }
      memory.grow(requiredPages - currentPages);
    }

    const memoryBuffer = new Uint8Array(memory.buffer);
    const ptr = 1024;
    memoryBuffer.set(chunk, ptr);

    const newSize = processChunk(ptr, chunk.length);
    return memoryBuffer.slice(ptr, ptr + newSize);
  } catch (error) {
    console.warn('WASM failed, using JS fallback:', error);
    return processFileChunkFallback(chunk);
  }
}

// Enhanced fallback with basic compression
function processFileChunkFallback(chunk: Uint8Array): Uint8Array {
  // Simple run-length encoding for basic compression
  const compressed = [];
  let i = 0;

  while (i < chunk.length) {
    let count = 1;
    const current = chunk[i];

    while (i + count < chunk.length && chunk[i + count] === current && count < 255) {
      count++;
    }

    if (count > 3) {
      compressed.push(255, count, current); // Compression marker
    } else {
      for (let j = 0; j < count; j++) {
        compressed.push(current);
      }
    }

    i += count;
  }

  return new Uint8Array(compressed);
}

// Mobile-aware network quality detection
export async function detectNetworkQuality(): Promise<{ bandwidth: number; latency: number; reliability: number }> {
  const optimizer = MobileOptimizer.getInstance();

  try {
    if (Capacitor.isNativePlatform()) {
      const networkStatus = await Network.getStatus();

      // Estimate based on connection type
      let estimatedBandwidth = 50 * 1024; // Default to low bandwidth
      let estimatedLatency = 500;
      let reliability = 0.5;

      switch (networkStatus.connectionType) {
        case 'wifi':
          estimatedBandwidth = 1024 * 1024; // 1MB/s
          estimatedLatency = 100;
          reliability = 0.9;
          break;
        case 'cellular':
          estimatedBandwidth = 200 * 1024; // 200KB/s
          estimatedLatency = 300;
          reliability = 0.6;
          break;
        case '2g':
          estimatedBandwidth = 10 * 1024; // 10KB/s
          estimatedLatency = 1000;
          reliability = 0.3;
          break;
        case '3g':
          estimatedBandwidth = 100 * 1024; // 100KB/s
          estimatedLatency = 400;
          reliability = 0.5;
          break;
        case '4g':
          estimatedBandwidth = 500 * 1024; // 500KB/s
          estimatedLatency = 200;
          reliability = 0.7;
          break;
        case '5g':
          estimatedBandwidth = 2048 * 1024; // 2MB/s
          estimatedLatency = 50;
          reliability = 0.9;
          break;
      }

      return {
        bandwidth: estimatedBandwidth,
        latency: estimatedLatency,
        reliability: reliability
      };
    } else {
      // Web fallback - simplified network test
      const startTime = performance.now();
      const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        method: 'GET',
        cache: 'no-store'
      });
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
    }
  } catch (error) {
    console.warn('Network detection failed:', error);
    return { bandwidth: 50 * 1024, latency: 800, reliability: 0.3 };
  }
}

// Mobile-optimized transfer settings
export async function optimizeTransferSettings(options: SendOptions): Promise<SendOptions> {
  const optimizer = MobileOptimizer.getInstance();
  const networkQuality = await detectNetworkQuality();
  const optimized = { ...options };

  // Mobile-specific optimizations
  optimized.chunkSize = optimizer.getOptimalChunkSize();
  optimized.parallelChunks = optimizer.getMaxParallelChunks();

  // Adjust based on network quality
  if (networkQuality.bandwidth < 20 * 1024) {
    optimized.chunkSize = 4 * 1024;
    optimized.parallelChunks = 1;
    optimized.compressionLevel = 20;
  } else if (networkQuality.bandwidth < 100 * 1024) {
    optimized.chunkSize = 8 * 1024;
    optimized.parallelChunks = 1;
    optimized.compressionLevel = 18;
  } else if (networkQuality.bandwidth < 500 * 1024) {
    optimized.chunkSize = 16 * 1024;
    optimized.parallelChunks = 2;
    optimized.compressionLevel = 15;
  }

  // Increase timeouts for mobile
  optimized.timeout = optimized.timeout * 2;
  optimized.retryAttempts = Math.min(optimized.retryAttempts + 2, 8);

  return optimized;
}

// Mobile-safe data channel creation
export async function createReliableDataChannel(
  peerConnection: RTCPeerConnection,
  label: string,
  maxRetries = 5
): Promise<RTCDataChannel> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const dataChannel = peerConnection.createDataChannel(label, {
        ordered: true,
        maxRetransmits: 5, // Reduced for mobile
        maxPacketLifeTime: 10000 // 10 second lifetime
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Data channel timeout'));
        }, 10000); // Longer timeout for mobile

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
      if (retries >= maxRetries) throw error;

      // Exponential backoff with jitter
      const delay = (1000 * Math.pow(2, retries)) + (Math.random() * 1000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to create data channel after retries');
}

// Mobile-optimized file transfer with memory management
export async function sendFile(
  file: File,
  peerConnection: RTCPeerConnection,
  onProgress?: (progress: number) => void
): Promise<void> {
  const optimizer = MobileOptimizer.getInstance();
  const options = await optimizeTransferSettings(defaultSendOptions);
  const dataChannel = await createReliableDataChannel(peerConnection, 'fileTransfer');

  let offset = 0;
  const fileSize = file.size;
  const chunkQueue: ArrayBuffer[] = [];
  let isTransferring = false;

  // Memory management for mobile
  const maxQueueSize = optimizer['isLowMemoryDevice'] ? 2 : 5;

  const processQueue = async () => {
    if (isTransferring || chunkQueue.length === 0) return;

    isTransferring = true;

    while (chunkQueue.length > 0 && dataChannel.readyState === 'open') {
      const buffer = chunkQueue.shift()!;
      const compressedChunk = await processFileChunk(new Uint8Array(buffer));

      // Wait for buffer to be available
      while (dataChannel.bufferedAmount > 16 * 1024) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      dataChannel.send(compressedChunk);
    }

    isTransferring = false;
  };

  return new Promise((resolve, reject) => {
    dataChannel.onopen = async () => {
      const reader = new FileReader();

      const readNextChunk = () => {
        if (offset >= fileSize) {
          // Wait for queue to empty
          const checkEmpty = () => {
            if (chunkQueue.length === 0 && dataChannel.bufferedAmount === 0) {
              dataChannel.close();
              resolve();
            } else {
              setTimeout(checkEmpty, 100);
            }
          };
          checkEmpty();
          return;
        }

        const chunk = file.slice(offset, offset + options.chunkSize);
        offset += options.chunkSize;

        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          chunkQueue.push(buffer);

          // Progress callback
          if (onProgress) {
            onProgress((offset / fileSize) * 100);
          }

          // Process queue when it has items
          if (chunkQueue.length <= maxQueueSize) {
            setTimeout(readNextChunk, 0);
          }

          processQueue();
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(chunk);
      };

      readNextChunk();
    };

    dataChannel.onerror = reject;
    dataChannel.onclose = () => {
      if (offset < fileSize) {
        reject(new Error('Transfer interrupted'));
      }
    };
  });
}

// Initialize mobile optimizer
export async function initializeMobileP2P(): Promise<void> {
  const optimizer = MobileOptimizer.getInstance();
  await optimizer.initialize();
  console.log('Mobile P2P initialized');
}

// Example usage for mobile
export async function mobileExample(): Promise<void> {
  try {
    // Initialize mobile optimizations
    await initializeMobileP2P();

    // Create peer connection with mobile-optimized settings
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: stunServers }],
      iceCandidatePoolSize: 10 // Larger pool for mobile
    });

    // Example file transfer
    const file = new File([new ArrayBuffer(10 * 1024 * 1024)], 'example.bin'); // 10MB test file

    await sendFile(file, peerConnection, (progress) => {
      console.log(`Transfer progress: ${progress.toFixed(1)}%`);
    });

    console.log('File transfer completed');
  } catch (error) {
    console.error('Mobile P2P error:', error);
  }
}