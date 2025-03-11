// concatUint8Arrays concat 2 Uint8Array with split index to determine
// split index (2 bytes) | array 1 | array 2
function concatUint8Arrays(array1: Uint8Array, array2: Uint8Array): Uint8Array {
  const splitIndex = new Uint16Array([array1.length]);
  const splitIndexBytes = new Uint8Array(splitIndex.buffer);

  // Use pre-allocated buffer for better performance
  const concatedArray = new Uint8Array(2 + array1.length + array2.length);
  
  // Use copyWithin for faster array copying
  concatedArray.set(splitIndexBytes);
  concatedArray.set(array1, 2);
  concatedArray.set(array2, 2 + array1.length);

  return concatedArray;
}

// splitUint8Array split Uint8Array to 2 Uint8Array determine by splitIndex
// split index (2 bytes) | array 1 | array 2
function splitUint8Array(combinedArray: Uint8Array): [Uint8Array, Uint8Array] {
  const splitIndexBytes = combinedArray.slice(0, 2);
  const splitIndex = new Uint16Array(splitIndexBytes.buffer)[0];

  // Use subarray instead of slice to avoid unnecessary copying
  const array1 = combinedArray.subarray(2, 2 + splitIndex);
  const array2 = combinedArray.subarray(2 + splitIndex);

  return [array1, array2];
}

// Export these functions to make them available
export { concatUint8Arrays, splitUint8Array };

// New optimized function for handling large file chunks
export function createOptimizedChunks(data: Uint8Array, chunkSize: number): Uint8Array[] {
  // Calculate optimal chunk size based on network conditions
  // For 10GB+ files, we need much larger chunks than default
  const optimalChunkSize = Math.max(chunkSize, 16 * 1024 * 1024); // Minimum 16MB chunks
  
  const chunks: Uint8Array[] = [];
  let offset = 0;
  
  while (offset < data.byteLength) {
    // Use subarray for zero-copy chunk creation
    const chunk = data.subarray(offset, offset + optimalChunkSize);
    chunks.push(chunk);
    offset += optimalChunkSize;
  }
  
  return chunks;
}

// Process multiple chunks in parallel
export async function processChunksParallel<T>(
  chunks: Uint8Array[], 
  processor: (chunk: Uint8Array) => Promise<T>,
  concurrency = 6 // Use 6 parallel processors by default
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  
  // Process chunks in batches to control memory usage
  async function processNextBatch(): Promise<void> {
    const batch = [];
    
    // Create a batch of promises up to concurrency limit
    for (let i = 0; i < concurrency && index < chunks.length; i++) {
      batch.push(processor(chunks[index++]));
    }
    
    // Wait for all promises in the batch to resolve
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Process next batch if there are more chunks
    if (index < chunks.length) {
      await processNextBatch();
    }
  }
  
  await processNextBatch();
  return results;
}