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
// Simple keyword matching score (BM25-like)
// Simple keyword matching score (BM25-like)
const keywordScore = (query: string, text: string): number => {
  // Split by whitespace
  const rawTerms = query.toLowerCase().split(/\s+/);
  
  // Clean terms: remove punctuation from start/end
  const queryTerms = rawTerms.map(t => {
    return t.replace(/[?.,!;:"')\]}]+$/, '').replace(/^[(\[{'"]+/, '');
  }).filter(t => {
    // Filter out empty strings after cleanup
    if (!t) return false;
    
    if (t.length > 2) return true;
    // Allow short tokens if they have symbols (e.g. ==, &&, ||, !=)
    if (/[^a-z0-9]/i.test(t)) return true; 
    return false;
  });

  const textLower = text.toLowerCase();
  
  if (queryTerms.length === 0) return 0;
  
  let matches = 0;
  for (const term of queryTerms) {
    if (textLower.includes(term)) {
      matches++;
    }
  }
  
  // DEBUG LOGGING
  if (matches > 0) {
     console.log(`[KeywordDebug] QueryTerms: ${JSON.stringify(queryTerms)} | Matches: ${matches} | Score: ${matches / queryTerms.length}`);
  }
  
  return matches / queryTerms.length;
};

export const search = async (
  query: string, 
  index: VectorIndex, 
  topK: number = 3,
  threshold: number = 0.1,
  useReranker: boolean = false
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
      
      // Combine scores: 30% semantic, 70% keyword
      // Drastic shift to favor exact keyword matches for this knowledge base
      const combinedScore = semanticScore * 0.3 + keywordSimilarity * 0.7;
      
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

  let results: SearchResult[] = [];

  if (useReranker) {
    console.log('Applying MMR Reranking...');
    // Get top candidates (3x topK) for reranking
    const candidates = allResults.slice(0, topK * 3);
    
    // MMR Logic
    const selected: SearchResult[] = [];
    const remaining = [...candidates];
    const lambda = 0.7; // Balance between relevance (0.7) and diversity (0.3)

    while (selected.length < topK && remaining.length > 0) {
      let bestScore = -Infinity;
      let bestIdx = -1;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const relevance = item.score;
        
        let maxSimToSelected = 0;
        for (const sel of selected) {
          if (item.chunk.embedding && sel.chunk.embedding) {
            const sim = cosineSimilarity(item.chunk.embedding, sel.chunk.embedding);
            if (sim > maxSimToSelected) maxSimToSelected = sim;
          }
        }

        // MMR = λ * Relevance - (1 - λ) * Redundancy
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
      } else {
        break;
      }
    }
    results = selected;
  } else {
    results = allResults.slice(0, topK);
  }

  // Final filter by threshold
  results = results.filter((result) => result.score >= threshold);

  // Relative score filtering: if we have a very good match, drop significantly worse ones
  if (results.length > 0) {
    const bestScore = results[0].score;
    // Keep results that are within 15% of the best score
    results = results.filter(r => r.score >= bestScore * 0.85);
  }
    
  console.log(`Found ${results.length} results above threshold ${threshold} (and relative filter)`);

  return results;
};
