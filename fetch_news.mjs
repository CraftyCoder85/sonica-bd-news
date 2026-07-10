// Fetches FT RSS feeds, matches headlines to the FTSE companies in companies.json,
// and merges results into news.json (per company, newest first, 30-day window, max 6).
// No dependencies; Node 18+. Run: node fetch_news.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FEEDS = [
  'https://www.ft.com/companies?format=rss',
  'https://www.ft.com/markets?format=rss',
  'https://www.ft.com/mergers-acquisitions?format=rss',
];
const KEEP_DAYS = 30, MAX_PER_COMPANY = 6;
// short aliases that collide with ordinary words: require they are NOT followed by these
const AMBIGUOUS_NEXT_WORDS = /^(week|month|year|time|step|steps|move|moves|up|to|in|on|of|for)$/i;

const companies = JSON.parse(readFileSync(new URL('./companies.json', import.meta.url), 'utf8'));
let existing = { updatedAt: null, companies: {} };
try { existing = JSON.parse(readFileSync(new URL('./news.json', import.meta.url), 'utf8')); } catch (e) {}

const unesc = s => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

function parseItems(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>(.*?)<\/item>/gs)) {
    const block = m[1];
    const pick = tag => { const t = block.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's')); return t ? unesc(t[1]) : ''; };
    const title = pick('title'), link = pick('link'), pub = pick('pubDate');
    if (title && link) items.push({ title, link, date: pub ? new Date(pub).toISOString().slice(0, 10) : null });
  }
  return items;
}

function matches(title, alias) {
  // word-boundary, case-sensitive (FT capitalises company names; avoids "next week" for Next)
  const re = new RegExp(`(^|[^A-Za-z0-9&])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9&]|$)`);
  const m = re.exec(title);
  if (!m) return false;
  if (alias.length <= 4 || ['Next'].includes(alias)) {
    const after = title.slice(m.index + m[0].length).trim().split(/\s+/)[0] || '';
    if (alias === 'Next' && AMBIGUOUS_NEXT_WORDS.test(after)) return false;
  }
  return true;
}

const all = [];
for (const url of FEEDS) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (sonica-bd news fetcher)' } });
    if (!r.ok) { console.error('feed failed', url, r.status); continue; }
    const items = parseItems(await r.text());
    console.log(url, '->', items.length, 'items');
    all.push(...items);
  } catch (e) { console.error('feed error', url, e.message); }
}

const merged = existing.companies || {};
let added = 0;
for (const item of all) {
  for (const co of companies) {
    if (!co.aliases.some(a => matches(item.title, a))) continue;
    const list = merged[co.name] = merged[co.name] || [];
    if (list.some(x => x.u === item.link)) continue;
    list.push({ h: item.title, u: item.link, d: item.date || new Date().toISOString().slice(0, 10) });
    added++;
  }
}
const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
for (const name of Object.keys(merged)) {
  merged[name] = merged[name].filter(x => x.d >= cutoff)
    .sort((a, b) => b.d.localeCompare(a.d)).slice(0, MAX_PER_COMPANY);
  if (!merged[name].length) delete merged[name];
}
const out = { updatedAt: new Date().toISOString(), companies: merged };
writeFileSync(new URL('./news.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`news.json written: ${added} new matches, ${Object.keys(merged).length} companies with headlines`);
