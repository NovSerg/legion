import { VectorIndex, SearchResult, DocumentChunk } from '@/types';
import { getEmbeddings } from './pipeline';

const STORAGE_KEY = 'legion_rag_index';

export const saveIndex = (index: VectorIndex) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Failed to save index:', error);
    // Fallback or alert user about quota
  }
};

export const loadIndex = (): VectorIndex | null => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load index:', error);
    return null;
  }
};

export const clearIndex = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};

const dotProduct = (a: number[], b: number[]) => {
  return a.reduce((acc, val, i) => acc + val * b[i], 0);
};

const magnitude = (a: number[]) => {
  return Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
};

const cosineSimilarity = (a: number[], b: number[]) => {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
};

// Simple keyword matching score (BM25-like)
const keywordScore = (query: string, text: string): number => {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const textLower = text.toLowerCase();
  
  if (queryTerms.length === 0) return 0;
  
  let matches = 0;
  for (const term of queryTerms) {
    if (textLower.includes(term)) {
      matches++;
    }
  }
  
  return matches / queryTerms.length;
};

export const search = async (
  query: string, 
  index: VectorIndex, 
  topK: number = 3,
  threshold: number = 0.1
): Promise<SearchResult[]> => {
  if (!index.chunks.length) return [];

  console.log(`RAG Search Query: "${query}"`);
  
  // 1. Generate embedding for query
  const [queryEmbedding] = await getEmbeddings([query]);
  if (!queryEmbedding) {
    console.error('Failed to generate query embedding');
    return [];
  }
  console.log('Query embedding generated, length:', queryEmbedding.length);

  // 2. Calculate similarities (hybrid: semantic + keyword)
  const allResults = index.chunks
    .map((chunk) => {
      const semanticScore = chunk.embedding 
        ? cosineSimilarity(queryEmbedding, chunk.embedding) 
        : 0;
      const keywordSimilarity = keywordScore(query, chunk.content);
      
      // Combine scores: 70% semantic, 30% keyword
      const combinedScore = semanticScore * 0.7 + keywordSimilarity * 0.3;
      
      return {
        chunk,
        score: combinedScore
      };
    })
    .sort((a, b) => b.score - a.score);

  console.log('Top 5 matches (hybrid scoring):');
  allResults.slice(0, 5).forEach(r => {
    console.log(`Score: ${r.score.toFixed(4)} | Content: ${r.chunk.content.substring(0, 50)}...`);
  });

  const results = allResults
    .filter((result) => result.score >= threshold)
    .slice(0, topK);
    
  console.log(`Found ${results.length} results above threshold ${threshold}`);

  return results;
};
