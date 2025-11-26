
const keywordScore = (query: string, text: string): number => {
  // Split by whitespace but keep special chars attached if possible, or just simple split
  // Improved: allow short tokens if they are not just common 1-2 letter words (a, an, is, etc)
  // For simplicity, we'll keep tokens > 2 OR tokens that contain non-alphanumeric chars (like ==, !=, ++)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => {
    if (t.length > 2) return true;
    // Allow short tokens if they have symbols (e.g. ==, &&, ||, !=)
    if (/[^a-z0-9]/i.test(t)) return true; 
    return false;
  });

  console.log('Query Terms:', queryTerms);

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

const query = "В чем разница между == и ===?";
const text = `Разница между == и === — обычно состоит в том, что == проверяет на равенство значений, а === проверяет на равенство и значений, и типов.`;

const score = keywordScore(query, text);
console.log(`Score for query "${query}":`, score);
