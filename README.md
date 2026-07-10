# Sonica BD — news feed

Public, read-only companion to the [Sonica BD](https://sonicabd.netlify.app) tool. Holds `news.json` only — FT/market headlines about FTSE 100 companies, no client data, no state. Deliberately public and separate from the private `sonica-bd-state` repo (which holds Sonica's synced grades/notes) so the tool can fetch news for any viewer without needing her sync credentials.

- `fetch_news.mjs` — pulls 3 FT RSS feeds (Companies, Markets, M&A), matches headlines against `companies.json`, merges into `news.json` (30-day window, max 6/company). Run by `.github/workflows/ft-news.yml` daily at 06:00 UTC, or manually via workflow_dispatch.
- `companies.json` — the 95 FTSE 100 companies tracked, with name-matching aliases (e.g. HSBC, M&S).
- `news.json` — `{updatedAt, companies: {name: [{h: headline, u: url, d: date}]}}`. Fetched unauthenticated by the tool via raw.githubusercontent.com.
