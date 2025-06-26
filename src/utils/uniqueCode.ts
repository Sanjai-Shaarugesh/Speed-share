// utils/uniqueCode.ts

const CODE_LENGTH = 5;
const MAX_TRIES = 1000;
const STORAGE_PREFIX = 'unique_code_';
const CODE_EXPIRY_HOURS = 24;

interface CodePayload {
  s: string; // SDP
  i?: string; // iceServer
  c?: string; // chunkSize
  p?: string; // publicKey
  h?: string; // highPerformance
  t: number; // timestamp for expiry
}

interface CodeOptions {
  iceServer?: string;
  chunkSize?: number;
  publicKey?: string;
  highPerformance?: boolean;
  expiryHours?: number;
}

interface ParsedCode {
  sdp: string;
  iceServer?: string;
  chunkSize?: number;
  publicKey?: string;
  highPerformance?: boolean;
  timestamp: number;
  isExpired: boolean;
}

interface ProcessingResult {
  success: boolean;
  code?: string;
  data?: ParsedCode;
  error?: string;
}

/**
 * Enhanced storage interface for cross-platform compatibility
 */
interface CodeStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem?(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
  getAllKeys?(): Promise<string[]> | string[];
}

/**
 * Environment detection utilities
 */
class EnvironmentDetector {
  static isElectronMain(): boolean {
    return typeof window === 'undefined' && 
           typeof process !== 'undefined' && 
           process.versions?.electron !== undefined;
  }

  static isElectronRenderer(): boolean {
    return typeof window !== 'undefined' && 
           (window as any).electronAPI !== undefined;
  }

  static isWebBrowser(): boolean {
    return typeof window !== 'undefined' && 
           typeof document !== 'undefined' && 
           !this.isElectronRenderer();
  }

  static isNodeJS(): boolean {
    return typeof process !== 'undefined' && 
           process.versions?.node !== undefined;
  }
}

/**
 * Web storage implementation
 */
class WebStorage implements CodeStorage {
  private isAvailable(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (!this.isAvailable()) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('LocalStorage setItem failed:', error);
    }
  }

  removeItem(key: string): void {
    if (!this.isAvailable()) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('LocalStorage removeItem failed:', error);
    }
  }

  clear(): void {
    if (!this.isAvailable()) return;
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('LocalStorage clear failed:', error);
    }
  }

  getAllKeys(): string[] {
    if (!this.isAvailable()) return [];
    try {
      return Object.keys(localStorage).filter(key => key.startsWith(STORAGE_PREFIX));
    } catch {
      return [];
    }
  }
}

/**
 * Electron renderer storage (communicates with main process)
 */
class ElectronRendererStorage implements CodeStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      if ((window as any).electronAPI?.getStorageItem) {
        return await (window as any).electronAPI.getStorageItem(key);
      }
      return null;
    } catch (error) {
      console.error('Electron renderer getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if ((window as any).electronAPI?.setStorageItem) {
        await (window as any).electronAPI.setStorageItem(key, value);
      }
    } catch (error) {
      console.error('Electron renderer setItem failed:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if ((window as any).electronAPI?.removeStorageItem) {
        await (window as any).electronAPI.removeStorageItem(key);
      }
    } catch (error) {
      console.error('Electron renderer removeItem failed:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      if ((window as any).electronAPI?.clearStorage) {
        await (window as any).electronAPI.clearStorage();
      }
    } catch (error) {
      console.error('Electron renderer clear failed:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      if ((window as any).electronAPI?.getAllStorageKeys) {
        return await (window as any).electronAPI.getAllStorageKeys();
      }
      return [];
    } catch (error) {
      console.error('Electron renderer getAllKeys failed:', error);
      return [];
    }
  }
}

/**
 * Electron main process storage (file-based)
 */
class ElectronMainStorage implements CodeStorage {
  private storageDir: string;
  private fs: any;
  private path: any;

  constructor() {
    try {
      this.fs = require('fs');
      this.path = require('path');
      
      // Get user data directory
      let userDataPath: string;
      try {
        const { app } = require('electron');
        userDataPath = app.getPath('userData');
      } catch {
        const os = require('os');
        userDataPath = this.path.join(os.homedir(), '.electron-app');
      }
      
      this.storageDir = this.path.join(userDataPath, 'unique-codes');
      this.ensureStorageDir();
    } catch (error) {
      console.error('Failed to initialize Electron main storage:', error);
      throw error;
    }
  }

  private ensureStorageDir(): void {
    try {
      if (!this.fs.existsSync(this.storageDir)) {
        this.fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filename
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.path.join(this.storageDir, `${sanitizedKey}.json`);
  }

  getItem(key: string): string | null {
    try {
      const filePath = this.getFilePath(key);
      if (this.fs.existsSync(filePath)) {
        return this.fs.readFileSync(filePath, 'utf8');
      }
      return null;
    } catch (error) {
      console.error('Electron main getItem failed:', error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      const filePath = this.getFilePath(key);
      this.fs.writeFileSync(filePath, value, 'utf8');
    } catch (error) {
      console.error('Electron main setItem failed:', error);
    }
  }

  removeItem(key: string): void {
    try {
      const filePath = this.getFilePath(key);
      if (this.fs.existsSync(filePath)) {
        this.fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Electron main removeItem failed:', error);
    }
  }

  clear(): void {
    try {
      if (this.fs.existsSync(this.storageDir)) {
        const files = this.fs.readdirSync(this.storageDir);
        files.forEach((file: string) => {
          if (file.endsWith('.json')) {
            this.fs.unlinkSync(this.path.join(this.storageDir, file));
          }
        });
      }
    } catch (error) {
      console.error('Electron main clear failed:', error);
    }
  }

  getAllKeys(): string[] {
    try {
      if (!this.fs.existsSync(this.storageDir)) {
        return [];
      }
      const files = this.fs.readdirSync(this.storageDir);
      return files
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => file.replace('.json', ''));
    } catch (error) {
      console.error('Electron main getAllKeys failed:', error);
      return [];
    }
  }
}

/**
 * Storage factory
 */
class StorageFactory {
  private static instance: CodeStorage | null = null;

  static getStorage(): CodeStorage {
    if (this.instance) return this.instance;

    if (EnvironmentDetector.isElectronMain()) {
      this.instance = new ElectronMainStorage();
    } else if (EnvironmentDetector.isElectronRenderer()) {
      this.instance = new ElectronRendererStorage();
    } else {
      this.instance = new WebStorage();
    }

    return this.instance;
  }
}

/**
 * Secure random code generator
 */
class SecureCodeGenerator {
  private static getRandomBytes(count: number): Uint8Array {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint8Array(count));
    } else if (EnvironmentDetector.isNodeJS()) {
      try {
        const cryptoNode = require('crypto');
        return new Uint8Array(cryptoNode.randomBytes(count));
      } catch {
        return this.getFallbackRandomBytes(count);
      }
    }
    return this.getFallbackRandomBytes(count);
  }

  private static getFallbackRandomBytes(count: number): Uint8Array {
    const bytes = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }

  private static getRandomAlphanumericChar(): string {
    while (true) {
      const bytes = this.getRandomBytes(1);
      const charCode = bytes[0] % 75 + 48; // Covers '0'-'z'

      if (
        (charCode >= 48 && charCode <= 57) ||   // 0-9
        (charCode >= 65 && charCode <= 90) ||   // A-Z
        (charCode >= 97 && charCode <= 122)     // a-z
      ) {
        return String.fromCharCode(charCode);
      }
    }
  }

  static generateCode(length: number = CODE_LENGTH): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += this.getRandomAlphanumericChar();
    }
    return code;
  }
}

/**
 * Code processor class
 */
export class CodeProcessor {
  private storage: CodeStorage;

  constructor() {
    this.storage = StorageFactory.getStorage();
  }

  /**
   * Process and generate a unique code for SDP data
   */
  async processAndGenerateCode(sdp: string, options: CodeOptions = {}): Promise<ProcessingResult> {
    try {
      if (!sdp || typeof sdp !== 'string') {
        return { success: false, error: 'Invalid SDP data' };
      }

      const expiryHours = options.expiryHours || CODE_EXPIRY_HOURS;
      const payload: CodePayload = {
        s: sdp,
        i: options.iceServer,
        c: options.chunkSize?.toString() || '67108864',
        p: options.publicKey,
        h: options.highPerformance ? '1' : '0',
        t: Date.now() + (expiryHours * 60 * 60 * 1000) // expiry timestamp
      };

      const json = JSON.stringify(payload);
      let code = '';

      // Try to generate unique code
      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        code = SecureCodeGenerator.generateCode();
        const key = `${STORAGE_PREFIX}${code}`;
        
        const existing = await this.storage.getItem(key);
        if (!existing) {
          await this.storage.setItem(key, json);
          return { success: true, code };
        }
      }

      // Fallback
      code = SecureCodeGenerator.generateCode();
      await this.storage.setItem(`${STORAGE_PREFIX}${code}`, json);
      return { success: true, code };

    } catch (error) {
      return { 
        success: false, 
        error: `Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Process and parse a code to retrieve data
   */
  async processAndParseCode(code: string): Promise<ProcessingResult> {
    try {
      // Validate code format
      if (!code || !/^[A-Za-z0-9]{5}$/.test(code)) {
        return { success: false, error: 'Invalid code format' };
      }

      const key = `${STORAGE_PREFIX}${code}`;
      const json = await this.storage.getItem(key);
      
      if (!json) {
        return { success: false, error: 'Code not found or expired' };
      }

      const payload = JSON.parse(json) as CodePayload;
      const now = Date.now();
      const isExpired = now > payload.t;

      const parsedData: ParsedCode = {
        sdp: payload.s,
        iceServer: payload.i,
        chunkSize: parseInt(payload.c || '67108864'),
        publicKey: payload.p,
        highPerformance: payload.h === '1' || parseInt(payload.c || '0') > 16777216,
        timestamp: payload.t,
        isExpired
      };

      // Remove expired codes
      if (isExpired) {
        await this.removeCode(code);
        return { success: false, error: 'Code has expired' };
      }

      return { success: true, data: parsedData };

    } catch (error) {
      return { 
        success: false, 
        error: `Failed to parse code: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Remove a specific code
   */
  async removeCode(code: string): Promise<ProcessingResult> {
    try {
      const key = `${STORAGE_PREFIX}${code}`;
      if (this.storage.removeItem) {
        await this.storage.removeItem(key);
      } else {
        await this.storage.setItem(key, '');
      }
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to remove code: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Clean up expired codes
   */
  async cleanupExpiredCodes(): Promise<ProcessingResult> {
    try {
      const keys = this.storage.getAllKeys ? await this.storage.getAllKeys() : [];
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          const json = await this.storage.getItem(key);
          if (json) {
            try {
              const payload = JSON.parse(json) as CodePayload;
              if (now > payload.t) {
                if (this.storage.removeItem) {
                  await this.storage.removeItem(key);
                } else {
                  await this.storage.setItem(key, '');
                }
                cleanedCount++;
              }
            } catch {
              // Remove invalid entries
              if (this.storage.removeItem) {
                await this.storage.removeItem(key);
              }
              cleanedCount++;
            }
          }
        }
      }

      return { success: true, code: `Cleaned ${cleanedCount} expired codes` };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to cleanup: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get statistics about stored codes
   */
  async getCodeStatistics(): Promise<{ total: number; expired: number; active: number }> {
    try {
      const keys = this.storage.getAllKeys ? await this.storage.getAllKeys() : [];
      const now = Date.now();
      let total = 0;
      let expired = 0;
      let active = 0;

      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          total++;
          const json = await this.storage.getItem(key);
          if (json) {
            try {
              const payload = JSON.parse(json) as CodePayload;
              if (now > payload.t) {
                expired++;
              } else {
                active++;
              }
            } catch {
              expired++; // Count invalid entries as expired
            }
          }
        }
      }

      return { total, expired, active };
    } catch {
      return { total: 0, expired: 0, active: 0 };
    }
  }
}

// Export convenience functions
const defaultProcessor = new CodeProcessor();

export async function generateUniqueCode(sdp: string, options: CodeOptions = {}): Promise<string> {
  const result = await defaultProcessor.processAndGenerateCode(sdp, options);
  if (!result.success) {
    throw new Error(result.error || 'Failed to generate code');
  }
  return result.code!;
}

export async function parseUniqueCode(code: string): Promise<ParsedCode> {
  const result = await defaultProcessor.processAndParseCode(code);
  if (!result.success) {
    throw new Error(result.error || 'Failed to parse code');
  }
  return result.data!;
}

export async function clearUniqueCode(code: string): Promise<void> {
  const result = await defaultProcessor.removeCode(code);
  if (!result.success) {
    throw new Error(result.error || 'Failed to clear code');
  }
}

export async function cleanupExpiredCodes(): Promise<string> {
  const result = await defaultProcessor.cleanupExpiredCodes();
  if (!result.success) {
    throw new Error(result.error || 'Failed to cleanup codes');
  }
  return result.code || 'Cleanup completed';
}

// Electron IPC handlers (main process)
if (EnvironmentDetector.isElectronMain()) {
  try {
    const { ipcMain } = require('electron');
    const processor = new CodeProcessor();
    
    ipcMain.handle('process-generate-code', async (_, sdp: string, options: CodeOptions) => {
      return await processor.processAndGenerateCode(sdp, options);
    });
    
    ipcMain.handle('process-parse-code', async (_, code: string) => {
      return await processor.processAndParseCode(code);
    });
    
    ipcMain.handle('process-remove-code', async (_, code: string) => {
      return await processor.removeCode(code);
    });
    
    ipcMain.handle('process-cleanup-codes', async () => {
      return await processor.cleanupExpiredCodes();
    });
    
    ipcMain.handle('process-get-statistics', async () => {
      return await processor.getCodeStatistics();
    });

    // Storage IPC handlers
    const storage = new ElectronMainStorage();
    
    ipcMain.handle('get-storage-item', async (_, key: string) => {
      return storage.getItem(key);
    });
    
    ipcMain.handle('set-storage-item', async (_, key: string, value: string) => {
      return storage.setItem(key, value);
    });
    
    ipcMain.handle('remove-storage-item', async (_, key: string) => {
      return storage.removeItem?.(key);
    });
    
    ipcMain.handle('clear-storage', async () => {
      return storage.clear?.();
    });
    
    ipcMain.handle('get-all-storage-keys', async () => {
      return storage.getAllKeys?.() || [];
    });

  } catch (error) {
    console.error('Failed to set up Electron IPC handlers:', error);
  }
}