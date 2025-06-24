// Import compression libraries (you'll need to add these to your project)
importScripts('/libs/pako.min.js');
importScripts('/libs/lz4.min.js');

// Handle compression requests
self.onmessage = async function(e) {
  const { chunk, fileType, operation } = e.data;
  
  if (operation === 'compress') {
    try {
      let compressedChunk;
      
      // Choose compression algorithm based on file type
      if (fileType && (fileType.startsWith('text/') || 
                       fileType.startsWith('application/json') || 
                       fileType.startsWith('application/xml'))) {
        // Text data compresses well with GZIP
        compressedChunk = pako.gzip(chunk, { level: 9 });
      } else if (fileType && (fileType.startsWith('image/') || 
                             fileType.startsWith('video/') || 
                             fileType.startsWith('audio/'))) {
        // Already compressed media - use fast LZ4 with low compression
        compressedChunk = LZ4.compress(chunk, { compressionLevel: 3 });
      } else {
        // Unknown type - use balanced approach
        compressedChunk = pako.deflate(chunk, { level: 6 });
      }
      
      // Return the original if compression didn't help
      if (compressedChunk.length >= chunk.length) {
        self.postMessage({ 
          compressedChunk: chunk,
          compressionRatio: 1.0,
          algorithm: 'none'
        });
      } else {
        self.postMessage({ 
          compressedChunk,
          compressionRatio: compressedChunk.length / chunk.length,
          algorithm: fileType && fileType.startsWith('text/') ? 'gzip' : 'lz4'
        });
      }
    } catch (error) {
      console.error('Compression failed:', error);
      // Fall back to original data if compression fails
      self.postMessage({ 
        compressedChunk: chunk,
        compressionRatio: 1.0,
        algorithm: 'none',
        error: error.message
      });
    }
  }
};