const CODE_LENGTH = 5;
const MAX_TRIES = 1000;

/**
 * Storage interface for abstracting storage operations
 */
interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/**
 * Returns the appropriate storage mechanism based on the environment
 */
function getStorage(): Storage {
  if (typeof window !== 'undefined' && window.electron && window.electron.ipcRenderer) {
    return {
      getItem: async (key: string) => {
        return await window.electron.ipcRenderer.invoke('get-storage', key);
      },
      setItem: async (key: string, value: string) => {
        await window.electron.ipcRenderer.invoke('set-storage', key, value);
      },
    };
  } else if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: async (key: string) => window.localStorage.getItem(key),
      setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
    };
  } else {
    throw new Error('No storage available');
  }
}

/**
 * Generates a secure random alphanumeric character (A–Z, a–z, 0–9)
 */
function getRandomAlphanumericChar(): string {
  while (true) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    const charCode = byte % 75 + 48; // Covers '0'–'z'

    if (
      (charCode >= 48 && charCode <= 57) ||   // 0–9
      (charCode >= 65 && charCode <= 90) ||   // A–Z
      (charCode >= 97 && charCode <= 122)     // a–z
    ) {
      return String.fromCharCode(charCode);
    }
  }
}

/**
 * Generates a secure random 5-character code
 */
function generateSecureCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += getRandomAlphanumericChar();
  }
  return code;
}

/**
 * Generates a unique, secure 5-character code and stores data using the storage mechanism
 */
export async function generateUniqueCode(
  sdp: string,
  options: {
    iceServer?: string;
    chunkSize?: number;
    publicKey?: string;
    highPerformance?: boolean;
  }
): Promise<string> {
  const storage = getStorage();
  const payload = {
    s: sdp,
    i: options.iceServer || '',
    c: options.chunkSize?.toString() || '67108864',
    p: options.publicKey || '',
    h: options.highPerformance ? '1' : '0'
  };

  const json = JSON.stringify(payload);

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const code = generateSecureCode();
    const key = `code_${code}`;
    const existing = await storage.getItem(key);
    if (!existing) {
      await storage.setItem(key, json);
      return code;
    }
  }

  // Fallback if collisions persist
  const code = generateSecureCode();
  await storage.setItem(`code_${code}`, json);
  return code;
}

/**
 * Parses a secure 5-character code and retrieves stored info
 */
export async function parseUniqueCode(code: string): Promise<{
  sdp: string;
  iceServer?: string;
  chunkSize?: number;
  publicKey?: string;
  highPerformance?: boolean;
}> {
  const storage = getStorage();

  if (!/^[A-Za-z0-9]{5}$/.test(code)) {
    throw new Error('Invalid code format');
  }

  const key = `code_${code}`;
  const json = await storage.getItem(key);
  if (!json) throw new Error('Code not found');

  const data = JSON.parse(json);
  return {
    sdp: data.s,
    iceServer: data.i || undefined,
    chunkSize: parseInt(data.c) || 67108864,
    publicKey: data.p || undefined,
    highPerformance: data.h === '1' || (parseInt(data.c || '0') > 16777216)
  };
}