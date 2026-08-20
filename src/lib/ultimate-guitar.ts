import * as cheerio from "cheerio";
import { chartToLookupResult } from "./chord-chart";
import { normalizeForMatch } from "./slugify";
import type { SongLookupResult } from "./types";

const UG_BASE = "https://www.ultimate-guitar.com";
const USER_AGENT =
  "Mozilla/5.0 (compatible; ChordComposer/1.0; +https://github.com/Modzter3/chord-composer)";

interface UltimateGuitarResult {
  song_name?: string;
  artist_name?: string;
  rating?: number;
  votes?: number;
  tab_url?: string;
  type?: string;
  marketing_type?: string;
}

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) return null;
  return response.text();
}

function scoreTab(tab: UltimateGuitarResult, song: string, artist: string): number {
  const targetSong = normalizeForMatch(song);
  const targetArtist = normalizeForMatch(artist);
  const tabSong = normalizeForMatch(tab.song_name ?? "");
  const tabArtist = normalizeForMatch(tab.artist_name ?? "");

  let score = 0;
  if (tabSong === targetSong) score += 100;
  else if (tabSong.includes(targetSong) || targetSong.includes(tabSong)) score += 60;

  if (tabArtist === targetArtist) score += 100;
  else if (tabArtist.includes(targetArtist) || targetArtist.includes(tabArtist)) score += 60;

  score += (tab.rating ?? 0) * 5;
  score += Math.min(tab.votes ?? 0, 100) * 0.05;

  return score;
}

async function searchUltimateGuitar(
  song: string,
  artist: string,
): Promise<UltimateGuitarResult[]> {
  const query = encodeURIComponent(song);
  const html = await fetchHtml(`${UG_BASE}/search.php?search_type=title&value=${query}&type=300`);

  if (!html) return [];

  const $ = cheerio.load(html);
  const storeAttr = $("div.js-store").attr("data-content");
  if (!storeAttr) return [];

  const parsed = JSON.parse(storeAttr) as {
    store?: { page?: { data?: { results?: UltimateGuitarResult[] } } };
  };

  const results = parsed.store?.page?.data?.results ?? [];
  const artistPattern = new RegExp(artist, "i");

  return results.filter((result) => {
    if (result.type?.toLowerCase() === "pro") return false;
    if (result.marketing_type) return false;
    if (result.type?.toLowerCase() !== "chords") return false;
    return result.artist_name ? artistPattern.test(result.artist_name) : true;
  });
}

async function fetchUltimateGuitarChart(tabUrl: string): Promise<string | null> {
  const html = await fetchHtml(tabUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  const storeAttr = $("div.js-store").attr("data-content");
  if (!storeAttr) return null;

  const parsed = JSON.parse(storeAttr) as {
    store?: { page?: { data?: { tab_view?: { wiki_tab?: { content?: string } } } } };
  };

  const content = parsed.store?.page?.data?.tab_view?.wiki_tab?.content;
  if (!content) return null;

  return content.replace(/(\[\/ch\]|\[\/tab\]|\[tab\]|\[ch\])/gi, "");
}

export async function lookupUltimateGuitar(
  song: string,
  artist: string,
): Promise<SongLookupResult> {
  const results = await searchUltimateGuitar(song, artist);
  if (results.length === 0) {
    throw new Error(`Couldn't find "${song}" by ${artist} on Ultimate Guitar.`);
  }

  const ranked = [...results].sort(
    (a, b) => scoreTab(b, song, artist) - scoreTab(a, song, artist),
  );
  const best = ranked[0];

  if (!best.tab_url) {
    throw new Error("Found a chord chart but couldn't open its tab URL.");
  }

  const chart = await fetchUltimateGuitarChart(best.tab_url);
  if (!chart?.trim()) {
    throw new Error("Found a chord chart but couldn't read its content.");
  }

  return chartToLookupResult(
    chart,
    best.song_name ?? song,
    best.artist_name ?? artist,
    best.tab_url,
    "ultimate-guitar",
  );
}
