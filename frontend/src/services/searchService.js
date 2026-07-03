// Levenshtein distance for typo tolerance
export const getLevenshteinDistance = (a, b) => {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp.push([i]);
  }
  for (j = 1; j <= b.length; j++) {
    tmp[0].push(j);
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
};

// Check if query is close enough to target string
export const isTypoMatch = (queryStr, targetStr) => {
  const q = queryStr.toLowerCase().trim();
  const t = targetStr.toLowerCase().trim();
  if (t.includes(q)) return true;

  // Split into words and check distance
  const qWords = q.split(/\s+/);
  const tWords = t.split(/\s+/);

  for (const qw of qWords) {
    if (qw.length < 3) continue;
    for (const tw of tWords) {
      if (tw.length < 3) continue;
      // If words are very close (distance 1 for short words, distance 2 for longer ones)
      const dist = getLevenshteinDistance(qw, tw);
      const limit = qw.length > 5 ? 2 : 1;
      if (dist <= limit) return true;
    }
  }
  return false;
};

// Manage local search history
const HISTORY_KEY = "lumora_search_history";

export const getSearchHistory = () => {
  const saved = localStorage.getItem(HISTORY_KEY);
  return saved ? JSON.parse(saved) : [];
};

export const addSearchHistory = (queryStr) => {
  if (!queryStr || !queryStr.trim()) return;
  const q = queryStr.trim();
  let history = getSearchHistory();
  // Filter out existing and keep top 8
  history = [q, ...history.filter(item => item.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const clearSearchHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

// Generate autocomplete and category/creator suggestions
export const getSearchSuggestions = (products, queryStr) => {
  if (!queryStr || !queryStr.trim()) return { products: [], categories: [], creators: [] };
  const q = queryStr.toLowerCase().trim();

  const matchedProducts = products.filter(p => 
    p.title.toLowerCase().includes(q) || 
    isTypoMatch(q, p.title) ||
    p.description.toLowerCase().includes(q)
  );

  const matchedCategories = Array.from(new Set(
    products
      .filter(p => p.category.toLowerCase().includes(q) || isTypoMatch(q, p.category))
      .map(p => p.category)
  ));

  const matchedCreators = Array.from(new Set(
    products
      .filter(p => p.creator?.name.toLowerCase().includes(q) || isTypoMatch(q, p.creator?.name || ""))
      .map(p => JSON.stringify(p.creator))
  )).map(str => JSON.parse(str));

  return {
    products: matchedProducts.slice(0, 4),
    categories: matchedCategories.slice(0, 3),
    creators: matchedCreators.slice(0, 2)
  };
};
