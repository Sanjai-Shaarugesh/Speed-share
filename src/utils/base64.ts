// utils/base64.ts

/**
 * Utility for base64url encoding and decoding
 * (URL-safe base64 without padding)
 */
export const base64url = {
    /**
     * Encodes a string to base64url
     */
    encode: (str: string): string => {
      // Standard base64 encoding
      const base64 = btoa(str);
      // Make base64 URL-safe: replace '+' with '-', '/' with '_', and remove padding '='
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
  
    /**
     * Decodes a base64url string
     */
    decode: (str: string): string => {
      // Restore base64 standard format: replace '-' with '+' and '_' with '/'
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      while (base64.length % 4) {
        base64 += '=';
      }
      
      return atob(base64);
    }
  };