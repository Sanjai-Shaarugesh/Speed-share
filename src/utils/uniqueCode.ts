// utils/uniqueCode.ts

const CODE_LENGTH = 5;
const MAX_TRIES = 1000;

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
 * Generates a unique, secure 5-character code and stores data in localStorage
 */
export function generateUniqueCode(
  sdp: string,
  options: {
    iceServer?: string;
    chunkSize?: number;
    publicKey?: string;
    highPerformance?: boolean;
  }
): string {
  const payload = {
    s: sdp,
    i: options.iceServer || '',
    c: options.chunkSize?.toString() || '67108864',
    p: options.publicKey || '',
    h: options.highPerformance ? '1' : '0'
  };

  const json = JSON.stringify(payload);

  let code = '';
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    code = generateSecureCode();
    if (typeof window === 'undefined') break;

    const key = `code_${code}`;
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, json);
      return code;
    }
  }

  // Fallback if collisions somehow persist
  code = generateSecureCode();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`code_${code}`, json);
  }

  return code;
}

/**
 * Parses a secure 5-character code and retrieves stored info
 */
export function parseUniqueCode(code: string): {
  sdp: string;
  iceServer?: string;
  chunkSize?: number;
  publicKey?: string;
  highPerformance?: boolean;
} {
  try {
    if (!/^[A-Za-z0-9]{5}$/.test(code)) {
      throw new Error('Invalid code format');
    }

    if (typeof window === 'undefined') {
      throw new Error('localStorage not available');
    }

    const json = window.localStorage.getItem(`code_${code}`);
    if (!json) throw new Error('Code not found');

    const data = JSON.parse(json);
    return {
      sdp: data.s,
      iceServer: data.i || undefined,
      chunkSize: parseInt(data.c) || 67108864,
      publicKey: data.p || undefined,
      highPerformance: data.h === '1' || parseInt(data.c) > 16777216
    };
  } catch (err) {
    console.error('Failed to parse unique code:', err);
    throw new Error('Invalid or expired code');
  }
}
