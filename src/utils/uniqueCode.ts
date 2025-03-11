// utils/uniqueCode.ts
import { base64url } from './base64';

/**
 * Generates a unique code from SDP information and other parameters
 * with optimization for large file transfers
 * @param sdp The SDP string to encode
 * @param options Additional options to include in the code
 * @returns A unique code that can be shared
 */
export function generateUniqueCode(
  sdp: string, 
  options: {
    iceServer?: string,
    chunkSize?: number,
    publicKey?: string,
    highPerformance?: boolean
  }
): string {
  // Create a data object with all necessary information
  const data = {
    s: sdp,
    i: options.iceServer || '',
    // Use much larger chunk size for 10GB+ files
    c: options.chunkSize ? options.chunkSize.toString() : '67108864', // Default to 64MB chunks
    p: options.publicKey || '',
    h: options.highPerformance ? '1' : '0' // Flag for high-performance mode
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
  publicKey?: string,
  highPerformance?: boolean
} {
  try {
    const jsonData = base64url.decode(code);
    const data = JSON.parse(jsonData);
    
    // Default to high performance for large files
    const highPerformance = data.h === '1' || data.c > 16777216; // > 16MB chunks means high performance
    
    return {
      sdp: data.s,
      iceServer: data.i || undefined,
      chunkSize: data.c ? parseInt(data.c) : 67108864, // Default to 64MB chunks for high performance
      publicKey: data.p || undefined,
      highPerformance
    };
  } catch (error) {
    console.error('Failed to parse unique code:', error);
    throw new Error('Invalid code format');
  }
}

/**
 * Enhanced unique code generator optimized for ultra-high-speed transfers
 * This is specifically designed for 10GB+ files
 */
export function generateHighPerformanceCode(
  sdp: string,
  options: {
    iceServer?: string,
    publicKey?: string
  }
): string {
  return generateUniqueCode(sdp, {
    ...options,
    // Use 128MB chunks for maximum throughput on 10GB+ files
    chunkSize: 134217728,
    highPerformance: true
  });
}

/**
 * Determines if a file is large enough to warrant high-performance mode
 * @param fileSize Size of the file in bytes
 * @returns Boolean indicating if high-performance mode should be used
 */
export function shouldUseHighPerformanceMode(fileSize: number): boolean {
  // For files over 1GB, use high-performance mode
  return fileSize > 1024 * 1024 * 1024;
}

/**
 * Calculates optimal chunk size based on file size
 * @param fileSize Size of the file in bytes
 * @returns Optimal chunk size in bytes
 */
export function calculateOptimalChunkSize(fileSize: number): number {
  if (fileSize > 10 * 1024 * 1024 * 1024) { // > 10GB
    return 134217728; // 128MB
  } else if (fileSize > 1024 * 1024 * 1024) { // > 1GB
    return 67108864; // 64MB
  } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
    return 16777216; // 16MB
  } else {
    return 4194304; // 4MB for smaller files
  }
}