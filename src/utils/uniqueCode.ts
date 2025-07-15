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
      (charCode >= 48 && charCode <= 57) || // 0–9
      (charCode >= 65 && charCode <= 90) || // A–Z
      (charCode >= 97 && charCode <= 122)   // a–z
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
 * Checks if a code exists on the server
 */
async function doesCodeExist(code: string): Promise<boolean> {
  try {
    const response = await fetch(`/retrieve/${code}`, { method: 'GET' });
    return response.ok; // True if code exists (200 OK), false if not (e.g., 404)
  } catch {
    return false; // Assume non-existent if request fails
  }
}

/**
 * Generates a unique, secure 5-character code and stores data on the server
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
    if (!(await doesCodeExist(code))) {
      // Code is unique; store it
      await fetch('/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, data: json })
      });
      return code;
    }
  }

  // Fallback: generate one more code and store it (risking overwrite)
  code = generateSecureCode();
  await fetch('/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, data: json })
  });
  return code;
}

/**
 * Parses a secure 5-character code and retrieves stored info from the server
 */
export async function parseUniqueCode(code: string): Promise<{
  sdp: string;
  iceServer?: string;
  chunkSize?: number;
  publicKey?: string;
  highPerformance?: boolean;
}> {
  if (!/^[A-Za-z0-9]{5}$/.test(code)) {
    throw new Error('Invalid code format');
  }

  const response = await fetch(`/retrieve/${code}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Code not found or server error');
  }

  const json = await response.text();
  const data = JSON.parse(json);
  return {
    sdp: data.s,
    iceServer: data.i || undefined,
    chunkSize: parseInt(data.c) || 67108864,
    publicKey: data.p || undefined,
    highPerformance: data.h === '1' || parseInt(data.c) > 16777216
  };
}