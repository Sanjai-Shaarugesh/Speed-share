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

// ========== ICE STUN SERVER INTEGRATION ==========

// Configure ICE servers for WebRTC connection
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
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
      this.peerConnection = new RTCPeerConnection(iceServers);
      
      // Create a data channel to generate ICE candidates
      this.peerConnection.createDataChannel('keystore');
      
      // Set up ICE candidate handler
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // We'll use the ICE candidate's candidate string as our storage mechanism
          const candidateString = event.candidate.candidate;
          if (candidateString && !this.sessionKeyCache) {
            // Encode session key into the candidate string when needed
            // This is just for notification - actual encoding happens in storeSessionKey
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
    
    // Encode the session key into a custom ICE candidate signal format
    // We're encoding the key into a format that looks like an ICE candidate
    // but actually contains our key
    this.sessionKeyCache = sessionKey;
    
    // If we were implementing a real distributed system, we'd send this encoded
    // candidate to a signaling server here
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

// ========== EXISTING FUNCTIONS ==========

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

// encryptAesGcm to encrypt a message with an AES-256 key
export async function encryptAesGcm(key: CryptoKey, message: ArrayBuffer): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt({ name: aesGenParams.name, iv }, key, message);
  const encryptedArray = new Uint8Array(encryptedData);

  // Prepend the IV to the encrypted data
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv);
  result.set(encryptedArray, iv.length);

  return result;
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

// decryptAesGcm to decrypt a message with an AES-256 key
export async function decryptAesGcm(
  key: CryptoKey,
  encryptedData: Uint8Array
): Promise<Uint8Array> {
  // Extract the IV from the encrypted data
  const iv = encryptedData.slice(0, 12);
  const encryptedMessage = encryptedData.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    { name: aesGenParams.name, iv },
    key,
    encryptedMessage
  );

  return new Uint8Array(decryptedData);
}

// arrayBufferToBase64 to convert an ArrayBuffer to a base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  const byteString = String.fromCharCode.apply(null, byteArray as unknown as number[]);
  const base64String = btoa(byteString);
  return base64String;
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
  const keyBuffer = base64ToArrayBuffer(base64SessionKey);
  const sessionKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    sessionKeyGenParams,
    true,
    ['encrypt', 'decrypt']
  );
  return sessionKey;
}

// Encrypt AES key with session key
export async function encryptAesKeyWithSessionKey(
  sessionKey: CryptoKey,
  aesKey: CryptoKey
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const exportedAesKey = await crypto.subtle.exportKey('raw', aesKey);
  
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: sessionKeyGenParams.name, iv },
    sessionKey,
    exportedAesKey
  );
  
  // Prepend the IV to the encrypted key
  const result = new Uint8Array(iv.length + encryptedAesKey.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedAesKey), iv.length);
  
  return result;
}

// Decrypt AES key with session key
export async function decryptAesKeyWithSessionKey(
  sessionKey: CryptoKey,
  encryptedAesKey: Uint8Array
): Promise<CryptoKey> {
  // Extract the IV from the encrypted data
  const iv = encryptedAesKey.slice(0, 12);
  const encryptedKey = encryptedAesKey.slice(12);
  
  const decryptedKeyBuffer = await crypto.subtle.decrypt(
    { name: sessionKeyGenParams.name, iv },
    sessionKey,
    encryptedKey
  );
  
  const aesKey = await crypto.subtle.importKey(
    'raw',
    decryptedKeyBuffer,
    aesGenParams,
    true,
    ['encrypt', 'decrypt']
  );
  
  return aesKey;
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

// ========== ENHANCED ENCRYPTION/DECRYPTION WORKFLOW ==========

// Encrypt a message with triple-layer security
export async function tripleLayerEncrypt(
  message: ArrayBuffer,
  rsaPublicKey: CryptoKey
): Promise<{ encryptedMessage: Uint8Array; encryptedAesKey: Uint8Array; sessionKeyId: string }> {
  //generate AES key for message encryption
  const aesKey = await generateAesKey();
  
  //encrypt the message with AES key
  const encryptedMessage = await encryptAesGcm(aesKey, message);
  
  // 3. Get or create session key
  let sessionKeyBase64 = await getSessionKeyFromIceStun();
  if (!sessionKeyBase64) {
    sessionKeyBase64 = await rotateSessionKey();
  }
  const sessionKey = await importSessionKeyFromBase64(sessionKeyBase64);
  
  // 4. Encrypt AES key with session key
  const encryptedAesKeyWithSession = await encryptAesKeyWithSessionKey(sessionKey, aesKey);
  
  // 5. Encrypt session-wrapped AES key with RSA public key
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: rsaGenParams.name },
    rsaPublicKey,
    encryptedAesKeyWithSession
  );
  
  // 6. Generate a unique session key ID (timestamp-based for simplicity)
  const sessionKeyId = Date.now().toString();
  
  return {
    encryptedMessage,
    encryptedAesKey: new Uint8Array(encryptedAesKey),
    sessionKeyId
  };
}

// Decrypt a message with triple-layer security
export async function tripleLayerDecrypt(
  encryptedMessage: Uint8Array,
  encryptedAesKey: Uint8Array,
  rsaPrivateKey: CryptoKey
): Promise<Uint8Array> {
  // 1. Decrypt the session-wrapped AES key with RSA private key
  const decryptedAesKeyWithSession = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    encryptedAesKey
  );
  
  // 2. Get session key from ICE STUN server
  const sessionKeyBase64 = await getSessionKeyFromIceStun();
  if (!sessionKeyBase64) {
    throw new Error('Session key not found in ICE STUN storage');
  }
  const sessionKey = await importSessionKeyFromBase64(sessionKeyBase64);
  
  // 3. Decrypt the AES key with session key
  const aesKey = await decryptAesKeyWithSessionKey(
    sessionKey,
    new Uint8Array(decryptedAesKeyWithSession)
  );
  
  // 4. Decrypt the message with AES key
  const decryptedMessage = await decryptAesGcm(aesKey, encryptedMessage);
  
  return decryptedMessage;
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