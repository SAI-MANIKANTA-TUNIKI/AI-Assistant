# backend/search.py — FIXED version
import os
import time

from ddgs import DDGS  # ← renamed from duckduckgo_search


def _ddg_search(query: str, max_results: int, retries: int = 3) -> list:
    """Run a DuckDuckGo search with retries, proxy, and backend fallback."""
    proxy = os.getenv("DDGS_PROXY")

    for attempt in range(retries):
        for backend in ("bing", "brave", "duckduckgo"):
            try:
                with DDGS(proxy=proxy, timeout=15) as ddgs:
                    results = list(
                        ddgs.text(query, max_results=max_results, backend=backend)
                    )
                if results:
                    print(f"[search] Success with backend: {backend}")
                    return results
            except Exception as e:
                print(f"[search] {backend} attempt {attempt + 1} failed: {e}")

        time.sleep(2 * (attempt + 1))

    return []


def get_search_context(query: str, max_results: int = 4) -> str:
    """
    Search the web and return context for the AI.
    Returns empty string if the search fails or finds nothing.
    """
    if not query or not query.strip():
        return ""

    results = _ddg_search(query, max_results)

    if not results:
        print("[search] All backends failed — no results.")
        return ""

    lines = ["Current web search results for context:"]

    for result in results:
        title = result.get("title", "").strip()
        body = result.get("body", "").strip()[:200]
        href = result.get("href", "").strip()

        if title or body:
            line = f"{title}: {body}"
            if href:
                line += f" | Source: {href}"
            lines.append(line)

    return "\n".join(lines)


if __name__ == "__main__":
    ctx = get_search_context("latest AI news today")
    print(ctx or "No results found.")