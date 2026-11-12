import type { ToolDTO } from "./types";

/**
 * Lightweight multi-field search with scoring.
 * Matches tool names, descriptions, use cases, and category —
 * shared between the client (instant search) and the public API.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "for", "of", "my", "me", "i", "and", "or", "in",
  "on", "with", "how", "do", "does", "you", "your", "want", "is", "are",
  "best", "some", "can", "help", "it", "its", "at", "by", "from", "that",
  "this", "what", "which", "need", "use", "using", "make", "get",
]);

/** Field weights: name hits rank highest, then use cases / category, then descriptions. */
interface SearchFields {
  name: string;
  useCases: string;
  category: string;
  shortDescription: string;
  description: string;
  example: string;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Naive stemming: match "transcribing"/"transcribed" against "transcribe", "images" against "image". */
function variants(token: string): string[] {
  const v = [token];
  if (token.endsWith("ing") && token.length > 5) v.push(token.slice(0, -3));
  if (token.endsWith("ies") && token.length > 4) v.push(token.slice(0, -3) + "y");
  if (token.endsWith("es") && token.length > 4) v.push(token.slice(0, -2));
  if (token.endsWith("s") && token.length > 3) v.push(token.slice(0, -1));
  if (token.endsWith("ed") && token.length > 4) v.push(token.slice(0, -2));
  if (token.endsWith("e") && token.length > 4) v.push(token.slice(0, -1));
  return v;
}

function matchesAny(text: string, toks: string[]): boolean {
  for (const tok of toks) {
    if (text.includes(tok)) return true;
  }
  return false;
}

export function fieldsOf(tool: ToolDTO): SearchFields {
  return {
    name: tool.name.toLowerCase(),
    useCases: tool.useCases.toLowerCase(),
    category: `${tool.category?.name ?? ""} ${tool.category?.slug ?? ""}`.toLowerCase().trim(),
    shortDescription: tool.shortDescription.toLowerCase(),
    description: tool.description.toLowerCase(),
    example: tool.example.toLowerCase(),
  };
}

/**
 * Returns tools matching the query (AND semantics across tokens),
 * ranked by relevance. An empty query returns tools unchanged.
 */
export function searchTools(tools: ToolDTO[], query: string): ToolDTO[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return tools;

  const scored: { tool: ToolDTO; score: number }[] = [];

  for (const tool of tools) {
    const f = fieldsOf(tool);
    const nameWords = f.name.split(/\s+/);
    let total = 0;
    let allMatch = true;

    for (const token of tokens) {
      const v = variants(token);
      let best = 0;

      if (matchesAny(f.name, v)) best = Math.max(best, 6);
      if (matchesAny(f.useCases, v)) best = Math.max(best, 4);
      if (f.category && matchesAny(f.category, v)) best = Math.max(best, 4);
      if (matchesAny(f.shortDescription, v)) best = Math.max(best, 3);
      if (matchesAny(f.description, v)) best = Math.max(best, 2);
      if (matchesAny(f.example, v)) best = Math.max(best, 1);

      if (best === 0) {
        allMatch = false;
        break;
      }

      // Bonus when the token matches a whole word of the name (e.g. "otter").
      if (nameWords.some((w) => w.startsWith(v[0]))) total += 2;
      total += best;
    }

    if (allMatch) scored.push({ tool, score: total });
  }

  scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return scored.map((s) => s.tool);
}

/** Alphabetical fallback ordering used when no query is present. */
export function sortByName(tools: ToolDTO[]): ToolDTO[] {
  return [...tools].sort((a, b) => a.name.localeCompare(b.name));
}
