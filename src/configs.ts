// types.ts - Type definitions
export interface SendOptions {
  chunkSize: number;
  isEncrypt: boolean;
  iceServer: string;
  wasmBufferSize: number;
  parallelChunks: number;
  useStreaming: boolean;
  compressionLevel: number;
  adaptiveChunking: boolean;
  retryAttempts: number;
  priorityQueueing: boolean;
  retryStrategy: 'linear' | 'exponential';
  onProgress: (progress: number) => void;
  signal: AbortSignal;
  timeout: number;
}

export interface ReceiveOptions {
  autoAccept: boolean;
  maxSize: number;
  receiverBufferSize: number;
  useStreaming: boolean;
  decompressInBackground: boolean;
  chunkTimeout: number;
  preallocateStorage: boolean;
  progressInterval: number;
  useBinaryMode: boolean;
  prioritizeDownload: boolean;
}

export interface NetworkQuality {
  bandwidth: number;
  latency: number;
  reliability: number;
}

export interface FileTransferMessage {
  type: 'file-info' | 'chunk' | 'chunk-request' | 'complete' | 'error';
  fileName?: string;
  fileSize?: number;
  chunkIndex?: number;
  totalChunks?: number;
  data?: ArrayBuffer;
  error?: string;
}

// Enhanced configuration with your existing code
import type { ReceiveOptions, SendOptions } from './types';

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

// Fallback for chunk processing with basic compression
function processFileChunkFallback(chunk: Uint8Array): Uint8Array {
  // Simple run-length encoding for basic compression
  const compressed: number[] = [];
  let i = 0;

  while (i < chunk.length) {
    let count = 1;
    const current = chunk[i];

    while (i + count < chunk.length && chunk[i + count] === current && count < 255) {
      count++;
    }

    if (count > 3) {
      compressed.push(255, count, current); // Marker for compressed sequence
    } else {
      for (let j = 0; j < count; j++) {
        compressed.push(current);
      }
    }

    i += count;
  }

  return new Uint8Array(compressed);
}

// Detect network quality for adaptive settings
export async function detectNetworkQuality(): Promise<NetworkQuality> {
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

  if (networkQuality.latency > 300) {
    optimized.parallelChunks = Math.max(2, optimized.parallelChunks);
  }

  return optimized;
}

// Create reliable data channel with retries
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

// WebRTC P2P Connection Manager
export class P2PFileTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isInitiator: boolean = false;
  private signalingSocket: WebSocket | null = null;
  private roomId: string = '';
  private fileBuffer: Uint8Array[] = [];
  private fileInfo: { name: string; size: number; totalChunks: number } | null = null;
  private receivedChunks = new Set<number>();

  constructor(private signalingServerUrl = 'wss://your-signaling-server.com') {}

  // Initialize peer connection with multiple ICE servers for reliability
  private createPeerConnection(): RTCPeerConnection {
    const configuration: RTCConfiguration = {
      iceServers: stunServers.map(server => ({ urls: server })),
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    const pc = new RTCPeerConnection(configuration);

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        this.handleConnectionFailure();
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel);
    };

    return pc;
  }

  // Setup data channel handlers
  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };
  }

  // Handle incoming data channel messages
  private handleDataChannelMessage(data: ArrayBuffer | string) {
    try {
      const message: FileTransferMessage = JSON.parse(data as string);

      switch (message.type) {
        case 'file-info':
          this.handleFileInfo(message);
          break;
        case 'chunk':
          this.handleChunk(message);
          break;
        case 'complete':
          this.handleTransferComplete();
          break;
        case 'error':
          console.error('Transfer error:', message.error);
          break;
      }
    } catch (error) {
      // Handle binary data (file chunks)
      if (data instanceof ArrayBuffer) {
        this.handleBinaryChunk(new Uint8Array(data));
      }
    }
  }

  // Handle file information
  private handleFileInfo(message: FileTransferMessage) {
    if (message.fileName && message.fileSize && message.totalChunks) {
      this.fileInfo = {
        name: message.fileName,
        size: message.fileSize,
        totalChunks: message.totalChunks
      };
      this.fileBuffer = new Array(message.totalChunks);
      console.log(`Receiving file: ${message.fileName} (${message.fileSize} bytes)`);
    }
  }

  // Handle file chunk
  private handleChunk(message: FileTransferMessage) {
    if (message.chunkIndex !== undefined && message.data) {
      this.fileBuffer[message.chunkIndex] = new Uint8Array(message.data);
      this.receivedChunks.add(message.chunkIndex);

      if (this.fileInfo) {
        const progress = (this.receivedChunks.size / this.fileInfo.totalChunks) * 100;
        console.log(`Received chunk ${message.chunkIndex}/${this.fileInfo.totalChunks} (${progress.toFixed(1)}%)`);
      }
    }
  }

  // Handle binary chunk (for high-performance transfers)
  private handleBinaryChunk(chunk: Uint8Array) {
    // Implementation depends on your chunk format
    console.log('Received binary chunk:', chunk.length, 'bytes');
  }

  // Handle transfer completion
  private handleTransferComplete() {
    if (this.fileInfo && this.fileBuffer.length === this.fileInfo.totalChunks) {
      const completeFile = this.reconstructFile();
      this.downloadFile(completeFile, this.fileInfo.name);
    }
  }

  // Reconstruct file from chunks
  private reconstructFile(): Uint8Array {
    const totalSize = this.fileBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of this.fileBuffer) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  // Download reconstructed file
  private downloadFile(data: Uint8Array, filename: string) {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Connect to signaling server
  async connectToSignalingServer(roomId: string) {
    this.roomId = roomId;
    this.signalingSocket = new WebSocket(this.signalingServerUrl);

    return new Promise<void>((resolve, reject) => {
      this.signalingSocket!.onopen = () => {
        this.signalingSocket!.send(JSON.stringify({ type: 'join-room', roomId }));
        resolve();
      };

      this.signalingSocket!.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.signalingSocket!.onerror = reject;
    });
  }

  // Handle signaling messages
  private async handleSignalingMessage(message: any) {
    if (!this.peerConnection) {
      this.peerConnection = this.createPeerConnection();
    }

    switch (message.type) {
      case 'offer':
        await this.peerConnection.setRemoteDescription(message.offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.signalingSocket!.send(JSON.stringify({ type: 'answer', answer }));
        break;

      case 'answer':
        await this.peerConnection.setRemoteDescription(message.answer);
        break;

      case 'ice-candidate':
        await this.peerConnection.addIceCandidate(message.candidate);
        break;

      case 'peer-joined':
        this.isInitiator = true;
        await this.createOffer();
        break;
    }
  }

  // Create and send offer
  private async createOffer() {
    if (!this.peerConnection) return;

    this.dataChannel = await createReliableDataChannel(this.peerConnection, 'fileTransfer');
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingSocket!.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    this.signalingSocket!.send(JSON.stringify({ type: 'offer', offer }));
  }

  // Handle connection failure with reconnection
  private async handleConnectionFailure() {
    console.log('Connection failed, attempting to reconnect...');

    // Try different STUN servers
    for (let i = 1; i < stunServers.length; i++) {
      try {
        const newConfig: RTCConfiguration = {
          iceServers: [{ urls: stunServers[i] }]
        };

        if (this.peerConnection) {
          this.peerConnection.close();
        }

        this.peerConnection = new RTCPeerConnection(newConfig);
        await this.createOffer();
        break;
      } catch (error) {
        console.warn(`Failed to reconnect with server ${stunServers[i]}:`, error);
      }
    }
  }

  // Send file with optimized settings
  async sendFile(file: File, onProgress?: (progress: number) => void) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const options = await optimizeTransferSettings(defaultSendOptions);
    if (onProgress) options.onProgress = onProgress;

    const totalChunks = Math.ceil(file.size / options.chunkSize);

    // Send file info
    const fileInfoMessage: FileTransferMessage = {
      type: 'file-info',
      fileName: file.name,
      fileSize: file.size,
      totalChunks
    };

    this.dataChannel.send(JSON.stringify(fileInfoMessage));

    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * options.chunkSize;
      const end = Math.min(start + options.chunkSize, file.size);
      const chunk = file.slice(start, end);

      const buffer = await chunk.arrayBuffer();
      const compressedChunk = await processFileChunk(new Uint8Array(buffer));

      const chunkMessage: FileTransferMessage = {
        type: 'chunk',
        chunkIndex: i,
        totalChunks,
        data: compressedChunk.buffer
      };

      // Wait for buffer to be available
      while (this.dataChannel.bufferedAmount > options.wasmBufferSize) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.dataChannel.send(JSON.stringify(chunkMessage));
      options.onProgress((i + 1) / totalChunks * 100);
    }

    // Send completion message
    this.dataChannel.send(JSON.stringify({ type: 'complete' }));
  }

  // Clean up resources
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.signalingSocket) {
      this.signalingSocket.close();
      this.signalingSocket = null;
    }

    this.fileBuffer = [];
    this.fileInfo = null;
    this.receivedChunks.clear();
  }
}

// Usage Example
export async function initializeFileSharing() {
  const fileTransfer = new P2PFileTransfer('wss://your-signaling-server.com');

  try {
    // Connect to room
    const roomId = prompt('Enter room ID:') || Math.random().toString(36).substr(2, 9);
    await fileTransfer.connectToSignalingServer(roomId);
    console.log(`Connected to room: ${roomId}`);

    // Setup file input handler
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log(`Sending file: ${file.name}`);
        await fileTransfer.sendFile(file, (progress) => {
          console.log(`Upload progress: ${progress.toFixed(1)}%`);
        });
      }
    };

    document.body.appendChild(fileInput);

    return fileTransfer;
  } catch (error) {
    console.error('Failed to initialize file sharing:', error);
    throw error;
  }
}

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log('WebRTC File Sharing ready. Call initializeFileSharing() to start.');
  });
}