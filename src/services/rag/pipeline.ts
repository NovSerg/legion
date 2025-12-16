import { Document, DocumentChunk, VectorIndex } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Worker instance
let worker: Worker | null = null;

export const initWorker = () => {
  if (typeof window === 'undefined') return null;
  
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url));
  }
  return worker;
};

export const terminateWorker = () => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
};

export const chunkText = (text: string, size: number = 500, overlap: number = 50): { content: string; lineStart: number; lineEnd: number }[] => {
  const chunks: { content: string; lineStart: number; lineEnd: number }[] = [];
  let start = 0;

  const countLines = (str: string) => (str.match(/\n/g) || []).length;

  while (start < text.length) {
    let end = start + size;
    
    // If we're not at the end of the text, try to break at a newline or space
    if (end < text.length) {
      const lastNewLine = text.lastIndexOf('\n', end);
      const lastSpace = text.lastIndexOf(' ', end);
      
      if (lastNewLine > start) {
        end = lastNewLine + 1;
      } else if (lastSpace > start) {
        end = lastSpace + 1;
      }
    }

    const chunkContent = text.slice(start, end).trim();
    if (chunkContent.length > 0) {
      // Calculate line numbers
      // Lines before this chunk
      const textBefore = text.slice(0, start);
      const lineStart = countLines(textBefore) + 1;
      
      // Lines in this chunk (approximate based on original text slice to handle trim)
      // Actually, better to count lines in the slice before trim, or just count newlines in textBefore + slice
      const textUntilEnd = text.slice(0, end);
      const lineEnd = countLines(textUntilEnd) + 1;

      chunks.push({
        content: chunkContent,
        lineStart,
        lineEnd
      });
    }

    start = end - overlap;
    // Prevent infinite loop if overlap is too large or chunk is too small
    if (start >= end) start = end;
  }

  return chunks;
};

export const getEmbeddings = async (texts: string[], onProgress?: (progress: any) => void): Promise<number[][]> => {
  const worker = initWorker();
  if (!worker) throw new Error('Worker not initialized');

  return new Promise((resolve, reject) => {
    const id = uuidv4();
    
    const handler = (event: MessageEvent) => {
      const { id: responseId, status, data, output, error } = event.data;
      
      if (responseId !== id) return;

      if (status === 'progress') {
        onProgress?.(data);
      } else if (status === 'complete') {
        worker?.removeEventListener('message', handler);
        resolve(output);
      } else if (status === 'error') {
        worker?.removeEventListener('message', handler);
        reject(new Error(error));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ id, texts });
  });
};

export const buildIndex = async (
  texts: string[],
  metadatas: Record<string, any>[],
  onProgress?: (status: string, progress?: number) => void
): Promise<VectorIndex> => {
  const documents: Document[] = [];
  const allChunks: DocumentChunk[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const metadata = metadatas[i];
    const name = metadata.source || `Document ${i + 1}`;
    
    onProgress?.(`Processing ${name}...`);
    
    const docId = uuidv4();
    const textChunks = chunkText(text);
    
    const doc: Document = {
      id: docId,
      name: name,
      content: text,
      type: 'text', // Default to text, can be inferred from metadata if needed
      createdAt: Date.now(),
      chunks: []
    };

    onProgress?.(`Generating embeddings for ${name}...`);
    // Extract just content for embedding generation
    const chunkContents = textChunks.map(c => c.content);
    const embeddings = await getEmbeddings(chunkContents, (p) => {
      if (p.status === 'progress') {
        onProgress?.(`Loading model... ${Math.round(p.progress || 0)}%`);
      }
    });

    textChunks.forEach((chunkData, index) => {
      const chunk: DocumentChunk = {
        id: uuidv4(),
        documentId: docId,
        content: chunkData.content,
        embedding: embeddings[index],
        metadata: { 
          ...metadata, 
          index,
          lineStart: chunkData.lineStart,
          lineEnd: chunkData.lineEnd
        }
      };
      doc.chunks?.push(chunk);
      allChunks.push(chunk);
    });

    documents.push(doc);
  }

  return {
    version: 1,
    documents,
    chunks: allChunks
  };
};
