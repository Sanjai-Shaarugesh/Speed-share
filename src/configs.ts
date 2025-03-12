import type { ReceiveOptions, SendOptions } from './type';

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
  'stun:stun.voipstunt.com:3478'
];

export const pageDescription = 'A client-side secure P2P file sharing app.';
export const githubLink = 'https://github.com/Sanjai-Shaarugesh/Speed-share';

export const defaultSendOptions: SendOptions = {
  chunkSize: 64 * 1024, // Increased chunk size for faster transfers
  isEncrypt: true,
  iceServer: stunServers[0],
  wasmBufferSize: 1024 * 1024, // 1MB buffer size
  parallelChunks: 4,
  useStreaming: true,
  compressionLevel: 6
};

export const defaultReceiveOptions: ReceiveOptions = {
  autoAccept: true,
  maxSize: 10 * 1024 * 1024 * 1024, // 10GB max size support
  receiverBufferSize: 1024 * 1024, // 1MB buffer
  useStreaming: true,
  decompressInBackground: true
};

export const waitIceCandidatesTimeout = 2000; // Reduced timeout for faster connection setup

// WebAssembly integration for fast file chunk processing
let wasmModule: WebAssembly.Module | null = null;

async function loadWasm() {
  if (!wasmModule) {
    const response = await fetch('/wasm/fileProcessor.wasm');
    const buffer = await response.arrayBuffer();
    wasmModule = await WebAssembly.compile(buffer);
  }
  return wasmModule;
}

export async function processFileChunk(chunk: Uint8Array): Promise<Uint8Array> {
  const module = await loadWasm();
  const instance = await WebAssembly.instantiate(module, {});
  const { processChunk } = instance.exports as { processChunk: (ptr: number, len: number) => number };
  const { memory } = instance.exports as { memory: WebAssembly.Memory };

  // Allocate memory and process the chunk
  const memoryBuffer = new Uint8Array(memory.buffer);
  const ptr = memoryBuffer.length;
  memoryBuffer.set(chunk, ptr);

  const newSize = processChunk(ptr, chunk.length);
  return memoryBuffer.slice(ptr, ptr + newSize);
}
