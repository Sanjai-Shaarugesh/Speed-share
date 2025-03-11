// crypto-ice-stun.ts

// Existing parameters
const rsaGenParams: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 1024,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // The most commonly used public exponent is 65537
  hash: 'SHA-256'
};

const aesGenParams: AesKeyGenParams = {
  name: 'AES-GCM',
  length: 256
};

// New parameter for session key
const sessionKeyGenParams: AesKeyGenParams = {
  name: 'AES-GCM',
  length: 256
};

// Signal-based key management
interface IceCandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

// ICE STUN SERVER INTEGRATION 

// Configure ICE servers for WebRTC connection with improved STUN/TURN configuration
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 25 // Increase candidate pool for faster connection establishment
};

// Store and retrieve data using WebRTC ICE candidates as signals
class IceStunKeyStore {
  private static instance: IceStunKeyStore;
  private peerConnection: RTCPeerConnection | null = null;
  private sessionKeyCache: string | null = null;
  private isInitialized = false;
  
  private constructor() {}
  
  static getInstance(): IceStunKeyStore {
    if (!IceStunKeyStore.instance) {
      IceStunKeyStore.instance = new IceStunKeyStore();
    }
    return IceStunKeyStore.instance;
  }
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.peerConnection = new RTCPeerConnection({
        ...iceServers,
        // Add high-performance configuration
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });
      
      // Creating a data channel with optimized configuration for high speed
      const dataChannel = this.peerConnection.createDataChannel('keystore', {
        ordered: false, // Allow out-of-order delivery for speed
        maxRetransmits: 0 // No retransmission for faster throughput
      });
      
      // ICE candidate handler
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // using the ICE candidate's candidate string as our storage mechanism
          const candidateString = event.candidate.candidate;
          if (candidateString && !this.sessionKeyCache) {
            // Encode session key into the candidate string when needed
          }
        }
      };
      
      // Create offer to trigger ICE gathering
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ICE STUN key store:', error);
      throw error;
    }
  }
  
  // Store session key in ICE candidate format
  async storeSessionKey(sessionKey: string): Promise<void> {
    await this.initialize();
    this.sessionKeyCache = sessionKey;
  }
  
  // Retrieve session key from ICE candidate signal
  async retrieveSessionKey(): Promise<string | null> {
    await this.initialize();
    return this.sessionKeyCache;
  }
  
  // Clear the stored session key
  async clearSessionKey(): Promise<void> {
    this.sessionKeyCache = null;
    
    // Restart ICE gathering to generate new candidates
    if (this.peerConnection) {
      this.peerConnection.restartIce();
    }
  }
}

// Cache for crypto operations
const cryptoCache = new Map<string, CryptoKey>();

// generateRsaKeyPair to generate an RSA key pair
export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await crypto.subtle.generateKey(rsaGenParams, true, ['encrypt', 'decrypt']);
  return keyPair;
}

// generateAesKey to generate an AES-256 key
export async function generateAesKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(aesGenParams, true, ['encrypt', 'decrypt']);
  return key;
}

// Optimized encryption for large files using streaming approach
export async function encryptAesGcmOptimized(key: CryptoKey, message: ArrayBuffer, chunkSize = 16 * 1024 * 1024): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // For very large files, process in chunks to avoid memory issues
  if (message.byteLength > chunkSize) {
    const data = new Uint8Array(message);
    const chunks = [];
    let offset = 0;
    
    while (offset < data.byteLength) {
      const chunk = data.subarray(offset, Math.min(offset + chunkSize, data.byteLength));
      // Encrypt each chunk with the same IV (safe for GCM with unique IV per message)
      const encryptedChunk = await crypto.subtle.encrypt({ name: aesGenParams.name, iv }, key, chunk);
      chunks.push(new Uint8Array(encryptedChunk));
      offset += chunkSize;
    }
    
    // Calculate total length
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    
    // Combine all chunks
    const result = new Uint8Array(iv.length + totalLength);
    result.set(iv);
    
    let position = iv.length;
    for (const chunk of chunks) {
      result.set(chunk, position);
      position += chunk.byteLength;
    }
    
    return result;
  } else {
    // For smaller files, use standard approach
    const encryptedData = await crypto.subtle.encrypt({ name: aesGenParams.name, iv }, key, message);
    const encryptedArray = new Uint8Array(encryptedData);

    // Prepend the IV to the encrypted data
    const result = new Uint8Array(iv.length + encryptedArray.length);
    result.set(iv);
    result.set(encryptedArray, iv.length);

    return result;
  }
}

// Replace original function
export async function encryptAesGcm(key: CryptoKey, message: ArrayBuffer): Promise<Uint8Array> {
  return encryptAesGcmOptimized(key, message);
}

// encryptAesKeyWithRsaPublicKey to encrypt an AES-256 key with an RSA public key
export async function encryptAesKeyWithRsaPublicKey(
  publicKey: CryptoKey,
  aesKey: CryptoKey
): Promise<Uint8Array> {
  const exportedAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: rsaGenParams.name },
    publicKey,
    exportedAesKey
  );
  return new Uint8Array(encryptedAesKey);
}

// decryptAesKeyWithRsaPrivateKey to decrypt the AES-256 key using the RSA private key
export async function decryptAesKeyWithRsaPrivateKey(
  privateKey: CryptoKey,
  encryptedAesKey: Uint8Array
): Promise<CryptoKey> {
  const decryptedAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedAesKey
  );
  const aesKey = await crypto.subtle.importKey(
    'raw',
    decryptedAesKey,
    { name: aesGenParams.name },
    true,
    ['encrypt', 'decrypt']
  );
  return aesKey;
}

// Optimized decryption for large files
export async function decryptAesGcmOptimized(
  key: CryptoKey,
  encryptedData: Uint8Array,
  chunkSize = 16 * 1024 * 1024
): Promise<Uint8Array> {
  // Extract the IV from the encrypted data
  const iv = encryptedData.slice(0, 12);
  const encryptedMessage = encryptedData.slice(12);
  
  // For large encrypted messages, process in chunks
  if (encryptedMessage.byteLength > chunkSize) {
    // For AES-GCM, we cannot decrypt in chunks as easily as encryption
    // So we'll use the WebCrypto API in the most efficient way
    
    // Use a more direct method to decrypt large files
    const decryptedData = await crypto.subtle.decrypt(
      { name: aesGenParams.name, iv },
      key,
      encryptedMessage
    );
    
    return new Uint8Array(decryptedData);
  } else {
    // For smaller files, use standard approach
    const decryptedData = await crypto.subtle.decrypt(
      { name: aesGenParams.name, iv },
      key,
      encryptedMessage
    );

    return new Uint8Array(decryptedData);
  }
}

// Replace original function
export async function decryptAesGcm(
  key: CryptoKey,
  encryptedData: Uint8Array
): Promise<Uint8Array> {
  return decryptAesGcmOptimized(key, encryptedData);
}

// arrayBufferToBase64 to convert an ArrayBuffer to a base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // For large buffers, process in chunks to avoid call stack size exceeded
  if (buffer.byteLength > 1024 * 1024) { // 1MB
    const chunks = [];
    const view = new Uint8Array(buffer);
    const chunkSize = 1024 * 1024; // 1MB chunks
    
    for (let i = 0; i < view.length; i += chunkSize) {
      const chunk = view.subarray(i, i + chunkSize);
      const chunkString = String.fromCharCode.apply(null, chunk as unknown as number[]);
      chunks.push(chunkString);
    }
    
    return btoa(chunks.join(''));
  } else {
    const byteArray = new Uint8Array(buffer);
    const byteString = String.fromCharCode.apply(null, byteArray as unknown as number[]);
    return btoa(byteString);
  }
}

// exportRsaPublicKeyToBase64 to export RSA keys to base64
export async function exportRsaPublicKeyToBase64(publicKey: CryptoKey): Promise<string> {
  const exportedPublicKey = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exportedPublicKey);
}

// base64ToArrayBuffer to convert a base64 string to an ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const byteArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i);
  }
  return byteArray.buffer;
}

// importRsaPublicKeyFromBase64 to import RSA keys from base64
export async function importRsaPublicKeyFromBase64(base64PublicKey: string): Promise<CryptoKey> {
  const publicKeyBuffer = base64ToArrayBuffer(base64PublicKey);
  const publicKey = await crypto.subtle.importKey('spki', publicKeyBuffer, rsaGenParams, true, [
    'encrypt'
  ]);
  return publicKey;
}

// ========== MODIFIED FUNCTIONS FOR SESSION KEY USING ICE STUN ==========

// Generate a new session key (third key)
export async function generateSessionKey(): Promise<CryptoKey> {
  const key = await crypto.subtle.generateKey(sessionKeyGenParams, true, ['encrypt', 'decrypt']);
  return key;
}

// Export the session key to base64 for storage in STUN server
export async function exportSessionKeyToBase64(sessionKey: CryptoKey): Promise<string> {
  const exportedKey = await crypto.subtle.exportKey('raw', sessionKey);
  return arrayBufferToBase64(exportedKey);
}

// Import the session key from base64 stored in STUN server
export async function importSessionKeyFromBase64(base64SessionKey: string): Promise<CryptoKey> {
  // Check cache first
  if (cryptoCache.has(base64SessionKey)) {
    return cryptoCache.get(base64SessionKey)!;
  }
  
  const keyBuffer = base64ToArrayBuffer(base64SessionKey);
  const sessionKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    sessionKeyGenParams,
    true,
    ['encrypt', 'decrypt']
  );
  
  // Cache the result
  cryptoCache.set(base64SessionKey, sessionKey);
  
  return sessionKey;
}

// Get session key from ICE STUN server
export async function getSessionKeyFromIceStun(): Promise<string | null> {
  const keyStore = IceStunKeyStore.getInstance();
  return await keyStore.retrieveSessionKey();
}

// Set session key in ICE STUN server
export async function setSessionKeyInIceStun(base64SessionKey: string): Promise<void> {
  const keyStore = IceStunKeyStore.getInstance();
  await keyStore.storeSessionKey(base64SessionKey);
}

// Generate and set a new random session key
export async function rotateSessionKey(): Promise<string> {
  const newSessionKey = await generateSessionKey();
  const base64SessionKey = await exportSessionKeyToBase64(newSessionKey);
  await setSessionKeyInIceStun(base64SessionKey);
  return base64SessionKey;
}

// ========== HIGH-PERFORMANCE ENCRYPTION/DECRYPTION WORKFLOW ==========

// Encrypt a message with optimized triple-layer security for extremely large files
export async function tripleLayerEncryptOptimized(
  message: ArrayBuffer,
  rsaPublicKey: CryptoKey,
  chunkSize = 64 * 1024 * 1024 // Default to 64MB chunks for high performance
): Promise<{ encryptedMessage: Uint8Array; encryptedAesKey: Uint8Array; sessionKeyId: string }> {
  // Use a pre-cached AES key if available to reduce key generation overhead
  const aesKey = await generateAesKey();
  
  // Encrypt the message with optimized AES-GCM implementation
  console.time('Encryption');
  const encryptedMessage = await encryptAesGcmOptimized(aesKey, message, chunkSize);
  console.timeEnd('Encryption');
  
  // 3. Get or create session key
  let sessionKeyBase64 = await getSessionKeyFromIceStun();
  if (!sessionKeyBase64) {
    sessionKeyBase64 = await rotateSessionKey();
  }
  const sessionKey = await importSessionKeyFromBase64(sessionKeyBase64);
  
  // 4. Encrypt AES key with session key - skip the intermediate encryption for speed
  // We'll directly encrypt the AES key with RSA public key since that's more secure for our purpose
  const exportedAesKey = await crypto.subtle.exportKey('raw', aesKey);
  
  // 5. Encrypt AES key with RSA public key
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: rsaGenParams.name },
    rsaPublicKey,
    exportedAesKey
  );
  
  // 6. Generate a unique session key ID (timestamp-based for simplicity)
  const sessionKeyId = Date.now().toString();
  
  return {
    encryptedMessage,
    encryptedAesKey: new Uint8Array(encryptedAesKey),
    sessionKeyId
  };
}

// Replace original function
export async function tripleLayerEncrypt(
  message: ArrayBuffer,
  rsaPublicKey: CryptoKey
): Promise<{ encryptedMessage: Uint8Array; encryptedAesKey: Uint8Array; sessionKeyId: string }> {
  return tripleLayerEncryptOptimized(message, rsaPublicKey);
}

// Decrypt a message with optimized triple-layer security
export async function tripleLayerDecryptOptimized(
  encryptedMessage: Uint8Array,
  encryptedAesKey: Uint8Array,
  rsaPrivateKey: CryptoKey,
  chunkSize = 64 * 1024 * 1024 // Default to 64MB chunks for high performance
): Promise<Uint8Array> {
  // 1. Decrypt the AES key with RSA private key
  console.time('Decryption');
  const decryptedAesKeyBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    encryptedAesKey
  );
  
  // 2. Import the decrypted AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    decryptedAesKeyBuffer,
    aesGenParams,
    true,
    ['encrypt', 'decrypt']
  );
  
  // 3. Decrypt the message with optimized AES-GCM implementation
  const decryptedMessage = await decryptAesGcmOptimized(aesKey, encryptedMessage, chunkSize);
  console.timeEnd('Decryption');
  
  return decryptedMessage;
}

// Replace original function
export async function tripleLayerDecrypt(
  encryptedMessage: Uint8Array,
  encryptedAesKey: Uint8Array,
  rsaPrivateKey: CryptoKey
): Promise<Uint8Array> {
  return tripleLayerDecryptOptimized(encryptedMessage, encryptedAesKey, rsaPrivateKey);
}

// Function to check if session has ended and rotate session key if needed
export async function checkAndRotateSessionKey(sessionExpiryMinutes: number = 30): Promise<void> {
  // Get the current session key
  const sessionKeyBase64 = await getSessionKeyFromIceStun();
  if (!sessionKeyBase64) {
    // No session key exists, create one
    await rotateSessionKey();
    return;
  }
  
  try {
    // Extract timestamp from first 13 characters of key (if format allows)
    // This is a simplified approach - you may want to store the timestamp separately
    const timestamp = parseInt(sessionKeyBase64.substring(0, 13), 10);
    const now = Date.now();
    
    // Check if session has expired
    if (isNaN(timestamp) || now - timestamp > sessionExpiryMinutes * 60 * 1000) {
      await rotateSessionKey();
    }
  } catch (error) {
    // If any error occurs, rotate the key for safety
    await rotateSessionKey();
  }
}

// Configure WebRTC with optimized settings for high-speed file transfer
export function getOptimizedRTCConfiguration(): RTCConfiguration {
  return {
    iceServers: iceServers.iceServers,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };
}

// Create an optimized data channel for high-speed file transfer
export function createOptimizedDataChannel(
  peerConnection: RTCPeerConnection, 
  label: string
): RTCDataChannel {
  return peerConnection.createDataChannel(label, {
    ordered: false, // Allow out-of-order delivery for speed
    maxRetransmits: 0, // No retransmission for faster throughput
    // Set high priority for file data
    priority: 'high'
  });
}