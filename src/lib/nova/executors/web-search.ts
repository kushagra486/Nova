/**
 * Level 2 "specialized tool" execution: a real web search with no LLM
 * involved at any point — the raw results are the answer. Uses Brave
 * Search's API (free tier: 2,000 queries/month, no card required) rather
 * than scraping a search engine, which breaks the moment the target
 * changes markup or blocks the request.
 */

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResult {
  query: string;
  results: WebSearchResultItem[];
}

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY);
}

const SEARCH_INTENT_RE =
  /^(please\s+)?(search( the web)?|google|look\s?up)\s+(for\s+|about\s+|on\s+)?/i;

/** Strips the "search for" / "look up" intent phrase, leaving the actual query. */
export function extractSearchQuery(task: string): string {
  const stripped = task.trim().replace(SEARCH_INTENT_RE, "").trim();
  return stripped.length > 0 ? stripped : task.trim();
}

export async function webSearch(query: string): Promise<WebSearchResult> {
  if (!isWebSearchConfigured()) {
    throw new Error("BRAVE_SEARCH_API_KEY is not configured");
  }

  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY!,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Brave Search API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const results: WebSearchResultItem[] = (data.web?.results ?? []).slice(0, 5).map(
    (r: { title?: string; url?: string; description?: string }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description ?? "",
    })
  );

  return { query, results };
}

export function formatWebSearchOutput(result: WebSearchResult): string {
  if (result.results.length === 0) {
    return `No results found for "${result.query}".`;
  }
  return result.results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
    .join("\n\n");
}
