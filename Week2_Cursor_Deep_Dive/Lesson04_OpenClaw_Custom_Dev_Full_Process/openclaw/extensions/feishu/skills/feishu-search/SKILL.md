---
name: feishu-search
description: |
  AI-optimized web search and URL content extraction via Tavily API. Activate when user needs to search the web, look up current information, or extract content from URLs.
---

# Feishu Web Search Tool

Single tool `feishu_search` with action parameter for web search and content extraction.

## Actions

### Web Search

```json
{ "action": "search", "query": "latest TypeScript 5.x features" }
```

With options:

```json
{
  "action": "search",
  "query": "AI regulation 2026",
  "max_results": 10,
  "search_depth": "advanced",
  "topic": "news",
  "days": 7
}
```

Returns: AI-generated answer + ranked sources with relevance scores.

### Extract URL Content

```json
{ "action": "extract", "urls": ["https://example.com/article"] }
```

Multiple URLs:

```json
{ "action": "extract", "urls": ["https://example.com/a", "https://example.com/b"] }
```

Returns: Raw content extracted from each URL.

## Parameters

### Search

- `query` (required): Search query string
- `max_results`: Number of results, 1-20 (default: 5)
- `search_depth`: `basic` (fast, default) or `advanced` (slower, more comprehensive)
- `topic`: `general` (default) or `news` (current events)
- `days`: For news topic, limit to last n days

### Extract

- `urls` (required): Array of URLs to extract content from

## Usage Tips

- Use `search_depth: "advanced"` for complex research questions
- Use `topic: "news"` with `days` for time-sensitive current events
- Use `extract` when you need full page content from a known URL
- Default `basic` search is fast and sufficient for most queries

## Configuration

```yaml
channels:
  feishu:
    tools:
      search: true # default: true
```
