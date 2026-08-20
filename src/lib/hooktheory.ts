import * as cheerio from "cheerio";
import { sindToChord } from "./chords";
import { normalizeForMatch, slugify } from "./slugify";
import type { ParsedChord, SongLookupResult, SongSection } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; ChordComposer/1.0; +https://github.com/chord-composer)";

const MEILI_HOST = "https://search.hooktheory.com";
const MEILI_INDEX = "theorytabs";
const MEILI_SEARCH_KEY =
  "YHXUiQCa6024e2a88cb48f226a94d16db0c20d993e0a424cfde7834b697445bdf280ce88";

interface MeiliHit {
  song?: string;
  artist?: string;
  url?: string;
  path?: string;
}

async function fetchHtml(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) return null;
  return response.text();
}

function scoreHit(hit: MeiliHit, song: string, artist: string): number {
  const targetSong = normalizeForMatch(song);
  const targetArtist = normalizeForMatch(artist);
  const hitSong = normalizeForMatch(hit.song ?? "");
  const hitArtist = normalizeForMatch(hit.artist ?? "");

  let score = 0;
  if (hitSong === targetSong) score += 100;
  else if (hitSong.includes(targetSong) || targetSong.includes(hitSong)) score += 60;

  if (hitArtist === targetArtist) score += 100;
  else if (hitArtist.includes(targetArtist) || targetArtist.includes(hitArtist)) score += 60;

  return score;
}

async function searchTheoryTab(song: string, artist: string): Promise<string | null> {
  const query = `${song} ${artist}`.trim();

  const response = await fetch(`${MEILI_HOST}/indexes/${MEILI_INDEX}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MEILI_SEARCH_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, limit: 20 }),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { hits?: MeiliHit[] };
  const hits = data.hits ?? [];
  if (hits.length === 0) return null;

  const ranked = [...hits].sort(
    (a, b) => scoreHit(b, song, artist) - scoreHit(a, song, artist),
  );
  const best = ranked[0];

  if (best.path) return `https://www.hooktheory.com/theorytab/view/${best.path}`;
  if (best.url) return best.url.replace("http://", "https://").replace("local.www.", "www.");
  return null;
}

async function resolveTheoryTabUrl(song: string, artist: string): Promise<string | null> {
  const directUrl = `https://www.hooktheory.com/theorytab/view/${slugify(artist)}/${slugify(song)}`;
  const directHtml = await fetchHtml(directUrl);
  if (directHtml?.includes("tb-cp-chip")) return directUrl;

  return searchTheoryTab(song, artist);
}

function parseSections(html: string): {
  title: string;
  artist: string;
  key: string;
  scale: "major" | "minor";
  bpm: number;
  sections: SongSection[];
} {
  const $ = cheerio.load(html);

  const title =
    $("h1.tb-song-h1")
      .first()
      .text()
      .replace(/\s*Chords and Melody\s*$/i, "")
      .trim() || "Unknown Song";

  const artist =
    $('meta[name="description"]')
      .attr("content")
      ?.match(/by\s+(.+?)\./i)?.[1]
      ?.trim() ?? "Unknown Artist";

  let tonic = "C";
  let scale: "major" | "minor" = "major";
  const firstChip = $(".tb-cp-chip[data-tonic]").first();
  if (firstChip.length) {
    tonic = firstChip.attr("data-tonic") ?? tonic;
    scale = (firstChip.attr("data-scale") as "major" | "minor") ?? scale;
  }

  const bpmMatch = html.match(/(\d{2,3})\s*BPM/i);
  const bpm = bpmMatch ? Number.parseInt(bpmMatch[1], 10) : 120;

  const sections: SongSection[] = [];

  $("tr").each((_, row) => {
    const $row = $(row);
    const sectionName = $row.find("td").first().text().trim();
    const chips = $row.find(".tb-cp-chip[data-sind]");

    if (!sectionName || chips.length === 0) return;

    const chords: ParsedChord[] = [];
    chips.each((__, chip) => {
      const sind = $(chip).attr("data-sind");
      const chipTonic = $(chip).attr("data-tonic") ?? tonic;
      const chipScale = ($(chip).attr("data-scale") as "major" | "minor") ?? scale;
      if (sind) chords.push(sindToChord(sind, chipTonic, chipScale));
    });

    if (chords.length > 0) {
      sections.push({ name: sectionName, chords });
    }
  });

  if (sections.length === 0) {
    const chips = $(".tb-cp-chip[data-sind]");
    const chords: ParsedChord[] = [];
    chips.each((_, chip) => {
      const sind = $(chip).attr("data-sind");
      const chipTonic = $(chip).attr("data-tonic") ?? tonic;
      const chipScale = ($(chip).attr("data-scale") as "major" | "minor") ?? scale;
      if (sind) chords.push(sindToChord(sind, chipTonic, chipScale));
    });

    if (chords.length > 0) {
      sections.push({ name: "Progression", chords });
    }
  }

  return {
    title,
    artist,
    key: `${tonic} ${scale}`,
    scale,
    bpm,
    sections,
  };
}

function flattenSections(sections: SongSection[]): ParsedChord[] {
  const all: ParsedChord[] = [];
  for (const section of sections) {
    all.push(...section.chords);
  }
  return all.length > 0 ? all : [];
}

export async function lookupSong(song: string, artist: string): Promise<SongLookupResult> {
  const sourceUrl = await resolveTheoryTabUrl(song, artist);
  if (!sourceUrl) {
    throw new Error(`Couldn't find "${song}" by ${artist} in the chord database. Try a different spelling or another song.`);
  }

  const html = await fetchHtml(sourceUrl);
  if (!html) {
    throw new Error("Failed to load song data. Please try again.");
  }

  const parsed = parseSections(html);
  if (parsed.sections.length === 0) {
    throw new Error("Found the song but couldn't parse its chord progression.");
  }

  if (flattenSections(parsed.sections).length === 0) {
    throw new Error("Found the song but no chords were extracted.");
  }

  return {
    title: parsed.title || song,
    artist: parsed.artist || artist,
    key: parsed.key,
    scale: parsed.scale,
    bpm: parsed.bpm,
    sections: parsed.sections,
    sourceUrl,
  };
}
