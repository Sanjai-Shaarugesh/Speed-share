// utils/uniqueCode.ts
import { base64url } from './base64';

/**
 * Generates a unique code from SDP information and other parameters
 * @param sdp The SDP string to encode
 * @param options Additional options to include in the code
 * @returns A unique code that can be shared
 */
export function generateUniqueCode(
  sdp: string, 
  options: {
    iceServer?: string,
    chunkSize?: number,
    publicKey?: string
  }
): string {
  // Create a data object with all necessary information
  const data = {
    s: sdp,
    i: options.iceServer || '',
    c: options.chunkSize?.toString() || '',
    p: options.publicKey || ''
  };
  
  // Convert to JSON and encode as base64url
  const jsonData = JSON.stringify(data);
  return base64url.encode(jsonData);
}

/**
 * Parses a unique code back into SDP and options
 * @param code The unique code to parse
 * @returns The decoded SDP and options
 */
export function parseUniqueCode(code: string): {
  sdp: string,
  iceServer?: string,
  chunkSize?: number,
  publicKey?: string
} {
  try {
    const jsonData = base64url.decode(code);
    const data = JSON.parse(jsonData);
    
    return {
      sdp: data.s,
      iceServer: data.i || undefined,
      chunkSize: data.c ? parseInt(data.c) : undefined,
      publicKey: data.p || undefined
    };
  } catch (error) {
    console.error('Failed to parse unique code:', error);
    throw new Error('Invalid code format');
  }
}