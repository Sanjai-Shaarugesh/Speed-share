// utils/uniqueCode.ts

/**
 * Generates a 5-digit unique code from SDP information and other parameters
 * @param sdp The SDP string to encode
 * @param options Additional options to include in the code
 * @returns A 5-digit unique code that can be shared
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
  // Create a data object with all necessary information
  const data = {
    s: sdp,
    i: options.iceServer || '',
    c: options.chunkSize ? options.chunkSize.toString() : '67108864',
    p: options.publicKey || '',
    h: options.highPerformance ? '1' : '0'
  };

  // Convert to JSON string
  const jsonData = JSON.stringify(data);
  
  // Create a simple hash to generate 5-digit code
  let hash = 0;
  for (let i = 0; i < jsonData.length; i++) {
    const char = jsonData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive 5-digit number (10000-99999)
  const code = Math.abs(hash) % 90000 + 10000;
  
  // Store the mapping temporarily (in a real app, this would be in a database)
  if (typeof window !== 'undefined') {
    const storage = window.localStorage || {};
    storage[`code_${code}`] = jsonData;
  }
  
  return code.toString();
}

/**
 * Parses a 5-digit unique code back into SDP and options
 * @param code The 5-digit unique code to parse
 * @returns The decoded SDP and options
 */
export function parseUniqueCode(code: string): {
  sdp: string;
  iceServer?: string;
  chunkSize?: number;
  publicKey?: string;
  highPerformance?: boolean;
} {
  try {
    // Validate 5-digit format
    if (!/^\d{5}$/.test(code)) {
      throw new Error('Code must be exactly 5 digits');
    }

    // Retrieve the stored data (in a real app, this would be from a database)
    let jsonData: string;
    if (typeof window !== 'undefined') {
      const storage = window.localStorage || {};
      jsonData = storage[`code_${code}`];
    } else {
      // Fallback for server-side or when localStorage is not available
      throw new Error('Code not found');
    }

    if (!jsonData) {
      throw new Error('Code not found or expired');
    }

    const data = JSON.parse(jsonData);
    
    // Default to high performance for large files
    const highPerformance = data.h === '1' || parseInt(data.c) > 16777216;

    return {
      sdp: data.s,
      iceServer: data.i || undefined,
      chunkSize: data.c ? parseInt(data.c) : 67108864,
      publicKey: data.p || undefined,
      highPerformance
    };
  } catch (error) {
    console.error('Failed to parse unique code:', error);
    throw new Error('Invalid or expired code');
  }
}

/**
 * Enhanced 5-digit code generator optimized for ultra-high-speed transfers
 */
export function generateHighPerformanceCode(
  sdp: string,
  options: {
    iceServer?: string;
    publicKey?: string;
  }
): string {
  return generateUniqueCode(sdp, {
    ...options,
    chunkSize: 134217728, // 128MB chunks
    highPerformance: true
  });
}

/**
 * Determines if a file is large enough to warrant high-performance mode
 */
export function shouldUseHighPerformanceMode(fileSize: number): boolean {
  return fileSize > 1024 * 1024 * 1024; // > 1GB
}

/**
 * Calculates optimal chunk size based on file size
 */
export function calculateOptimalChunkSize(fileSize: number): number {
  if (fileSize > 10 * 1024 * 1024 * 1024) {
    return 134217728; // 128MB for > 10GB
  } else if (fileSize > 1024 * 1024 * 1024) {
    return 67108864; // 64MB for > 1GB
  } else if (fileSize > 100 * 1024 * 1024) {
    return 16777216; // 16MB for > 100MB
  } else {
    return 4194304; // 4MB for smaller files
  }
}