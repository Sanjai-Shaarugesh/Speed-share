// fileSendHelper.ts
import { 
  tripleLayerEncryptOptimized, 
  generateRsaKeyPair, 
  exportRsaPublicKeyToBase64,
  
} from './crypto';
import { 
  throttledSend, 
  createOptimizedFileChannel, 
  optimizeConnectionForLargeFile,
  measureNetworkAndOptimizeChunkSize,
  progressiveFileTransfer
} from './fileTransferOptimizer';
import { generateHighPerformanceCode, shouldUseHighPerformanceMode } from './uniqueCode';
import { humanFileSize } from './humanFIleSize';
import { chunkSizeConfig } from '../configs';

export interface SendProgressCallback {
  onStart?: () => void;
  onProgress?: (percent: number) => void;
  onConnect?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Enhanced file sender that optimizes for large file transfers
 */
export class EnhancedFileSender {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private keyPair: CryptoKeyPair | null = null;
  private file: File;
  private callbacks: SendProgressCallback;
  private iceServer: string;
  private isEncrypt: boolean;
  private chunkSize: number;
  private highPerformance: boolean;
  private transferStartTime: number = 0;
  
  constructor(
      file: File, 
      callbacks: SendProgressCallback = {},
      options: {
        iceServer?: string,
        isEncrypt?: boolean,
        chunkSize?: number,
        highPerformance?: boolean
      } = {}
    ) {
      this.file = file;
      this.callbacks = callbacks;
      this.iceServer = options.iceServer || 'stun:stun.l.google.com:19302';
      this.isEncrypt = options.isEncrypt || false;

      // Determine optimal chunk size based on file size
      const fileSize = file.size;
      this.highPerformance = options.highPerformance || shouldUseHighPerformanceMode(fileSize);
      // Use configured chunk sizes directly rather than calling as function
      this.chunkSize = options.chunkSize || chunkSizeConfig.medium;

      console.log(`File size: ${humanFileSize(fileSize)}`);
      console.log(`Using chunk size: ${humanFileSize(this.chunkSize)}`);
      console.log(`High performance mode: ${this.highPerformance ? 'ON' : 'OFF'}`);
    }
  
  /**
   * Starts the file transfer process
   * @returns Promise that resolves with the unique code to share
   */
  async start(): Promise<string> {
    try {
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
      
      // Generate keys for encryption if needed
      if (this.isEncrypt) {
        this.keyPair = await generateRsaKeyPair();
      }
      
      // Setup WebRTC connection
      await this.setupConnection();
      
      // Create offer and generate unique code
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete
      const sdp = await this.waitForIceCandidates();
      
      // Generate unique code based on SDP
      let code: string;
      if (this.highPerformance) {
        const publicKeyBase64 = this.isEncrypt 
          ? await exportRsaPublicKeyToBase64(this.keyPair!.publicKey)
          : '';
        
        code = generateHighPerformanceCode(sdp, {
          iceServer: this.iceServer,
          publicKey: publicKeyBase64
        });
      } else {
        // Use normal code generation here (from your existing code)
        // This would be implemented elsewhere
        code = sdp; // Placeholder
      }
      
      return code;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }
  
  /**
   * Sets up the WebRTC connection
   */
  private async setupConnection(): Promise<void> {
    // Create and configure connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: this.iceServer }]
    });
    
    // Optimize connection for large files
    if (this.file.size > 100 * 1024 * 1024) {
      this.peerConnection = optimizeConnectionForLargeFile(this.peerConnection, this.file.size);
    }
    
    // Create data channel
    const channelLabel = `file_${Date.now()}`;
    this.dataChannel = createOptimizedFileChannel(
      this.peerConnection,
      channelLabel,
      this.file.size
    );
    
    // Setup event handlers
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state: ${this.peerConnection?.iceConnectionState}`);
      
      if (this.peerConnection?.iceConnectionState === 'connected') {
        if (this.callbacks.onConnect) {
          this.callbacks.onConnect();
        }
      }
    };
    
    this.dataChannel.onopen = () => {
      this.sendFile();
    };
    
    this.dataChannel.onerror = (error) => {
      this.handleError(new Error(`Data channel error: ${error}`));
    };
  }
  
  /**
   * Waits for ICE gathering to complete and returns the SDP
   */
  private waitForIceCandidates(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve('');
        return;
      }
      
      const iceCandidates: RTCIceCandidate[] = [];
      
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate);
        } else {
          // ICE gathering complete
          resolve(JSON.stringify(this.peerConnection!.localDescription));
        }
      };
      
      // Set a timeout in case ICE gathering takes too long
      setTimeout(() => {
        if (this.peerConnection!.localDescription) {
          resolve(JSON.stringify(this.peerConnection!.localDescription));
        } else {
          resolve('');
        }
      }, 5000);
    });
  }
  
  /**
   * Sends the file over the data channel
   */
   private async sendFile(): Promise<void> {
       if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
         this.handleError(new Error('Data channel not open'));
         return;
       }

       try {
         this.transferStartTime = performance.now();

         // Optimize chunk size based on network conditions
         if (this.highPerformance) {
           this.chunkSize = await measureNetworkAndOptimizeChunkSize(
             this.peerConnection!, 
             this.file.size
           );
         }

         // Read file data
         const fileData = await this.file.arrayBuffer();

         // Send file metadata
         const metadata = {
           name: this.file.name,
           type: this.file.type,
           size: this.file.size,
           lastModified: this.file.lastModified,
           chunkSize: this.chunkSize
         };

         this.dataChannel.send(JSON.stringify(metadata));

         // If encryption is enabled, encrypt the file
         if (this.isEncrypt && this.keyPair) {
           console.time('Encryption');
           const { encryptedMessage, encryptedAesKey } = await tripleLayerEncryptOptimized(
             fileData,
             this.keyPair.publicKey,
             this.chunkSize
           );
           console.timeEnd('Encryption');

           // Send encrypted AES key first
           this.dataChannel.send(encryptedAesKey);

           // Then send the encrypted file data in chunks
           await progressiveFileTransfer(
             async (chunk) => {
               // Wait until buffer is not full
               while (this.dataChannel!.bufferedAmount > this.dataChannel!.bufferedAmountLowThreshold) {
                 await new Promise(resolve => setTimeout(resolve, 10));
               }
               this.dataChannel!.send(chunk);
             },
             new ArrayBuffer(encryptedMessage.buffer.byteLength),
             this.chunkSize,
             this.callbacks.onProgress
           );
         } else {
           // Send unencrypted file in chunks
           await progressiveFileTransfer(
             async (chunk) => {
               // Wait until buffer is not full
               while (this.dataChannel!.bufferedAmount > this.dataChannel!.bufferedAmountLowThreshold) {
                 await new Promise(resolve => setTimeout(resolve, 10));
               }
               this.dataChannel!.send(chunk);
             },
             fileData,
             this.chunkSize,
             this.callbacks.onProgress
           );
         }

         // Calculate and log transfer statistics
         const transferTime = (performance.now() - this.transferStartTime) / 1000; // in seconds
         const speed = this.file.size / (1024 * 1024) / transferTime; // in MB/s
         console.log(`Transfer complete in ${transferTime.toFixed(2)}s at ${speed.toFixed(2)} MB/s`);

         if (this.callbacks.onComplete) {
           this.callbacks.onComplete();
         }
       } catch (error) {
         this.handleError(error as Error);
       }
     }
  
  /**
   * Handles errors during file transfer
   */
  private handleError(error: Error): void {
    console.error('File transfer error:', error);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
    
    // Clean up
    this.close();
  }
  
  /**
   * Closes the connection
   */
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}