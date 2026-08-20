import { Chord, Note } from "tonal";
import type { ChartLength, ParsedChord, SongLookupResult, SongSection } from "./types";

const SECTION_PATTERN =
  /^\[([^\]]+)\]$|^(Intro|Verse(?:\s*\d+)?|Chorus|Bridge|Solo|Outro|Pre-Chorus)\b[:\s-]*/i;

const CHORD_TOKEN =
  /\b([A-G](?:#|b)?(?:m(?!aj)|maj|dim|aug|sus|add|M)?(?:maj7|m7|7|9|11|13)?(?:\/[A-G](?:#|b)?)?|NC)\b/g;

const REPEAT_PATTERN = /\(([^)]+)\)\s*x\s*(\d+)/gi;

const SHORT_MAX_CHORDS_PER_BLOCK = 8;
const SHORT_MAX_SECTIONS = 6;
const SHORT_MAX_TOTAL_CHORDS = 32;

function chordNameToParsed(name: string): ParsedChord | null {
  if (name === "NC") return null;

  const data = Chord.get(name);
  if (!data.notes.length) return null;

  const notes = data.notes
    .map((note) => Note.midi(`${note}4`))
    .filter((note): note is number => note != null);

  if (notes.length === 0) return null;

  return { label: name, notes };
}

function extractChordNames(text: string): string[] {
  return [...text.matchAll(new RegExp(CHORD_TOKEN.source, "g"))].map((match) => match[1]);
}

function expandRepeats(text: string, full: boolean): string[] {
  const chords: string[] = [];
  let cursor = 0;
  let repeatMatch: RegExpExecArray | null = REPEAT_PATTERN.exec(text);

  while (repeatMatch) {
    if (repeatMatch.index > cursor) {
      chords.push(...extractChordNames(text.slice(cursor, repeatMatch.index)));
    }

    const inner = extractChordNames(repeatMatch[1]);
    const count = full ? Number.parseInt(repeatMatch[2], 10) : 1;
    for (let index = 0; index < count; index += 1) {
      chords.push(...inner);
    }

    cursor = repeatMatch.index + repeatMatch[0].length;
    repeatMatch = REPEAT_PATTERN.exec(text);
  }

  REPEAT_PATTERN.lastIndex = 0;

  if (cursor < text.length) {
    chords.push(...extractChordNames(text.slice(cursor)));
  }

  return chords.length > 0 ? chords : extractChordNames(text);
}

function normalizeSectionName(name: string): string {
  return name.replace(/\s+\d+$/i, "").trim();
}

function shouldSkipSection(name: string): boolean {
  return /^(solo|interlude)$/i.test(normalizeSectionName(name));
}

function namesToChords(names: string[]): ParsedChord[] {
  return names
    .map((name) => chordNameToParsed(name))
    .filter((chord): chord is ParsedChord => chord != null);
}

function detectKey(sections: SongSection[]): string {
  const first = sections[0]?.chords[0]?.label;
  if (!first) return "Unknown";
  const data = Chord.get(first);
  return data.tonic ? `${data.tonic} ${data.quality || "major"}` : "Unknown";
}

function parseFullChart(content: string): SongSection[] {
  const sections: SongSection[] = [];
  let currentSection = "Song";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSection = sectionMatch[1] ?? sectionMatch[2] ?? currentSection;
    }

    const chords = namesToChords(expandRepeats(line, true));
    if (chords.length === 0) continue;

    const existing = sections.find((section) => section.name === currentSection);
    if (existing) {
      existing.chords.push(...chords);
    } else {
      sections.push({ name: currentSection, chords });
    }
  }

  return sections;
}

function parseShortChart(content: string): SongSection[] {
  const sections: SongSection[] = [];
  const seenSections = new Set<string>();
  let currentSection = "Intro";
  let blockChords: ParsedChord[] = [];
  let blockLines = 0;
  let totalChords = 0;

  const flushBlock = () => {
    if (blockChords.length === 0) return;

    const normalized = normalizeSectionName(currentSection);
    if (!shouldSkipSection(normalized) && !seenSections.has(normalized)) {
      sections.push({ name: normalized, chords: [...blockChords] });
      seenSections.add(normalized);
      totalChords += blockChords.length;
    }

    blockChords = [];
    blockLines = 0;
  };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (totalChords >= SHORT_MAX_TOTAL_CHORDS || sections.length >= SHORT_MAX_SECTIONS) break;

    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      flushBlock();
      currentSection = sectionMatch[1] ?? sectionMatch[2] ?? currentSection;
      if (shouldSkipSection(currentSection)) continue;
    }

    const chords = namesToChords(expandRepeats(line, false));
    if (chords.length === 0) continue;

    if (
      blockChords.length > 0 &&
      (blockChords.length + chords.length > SHORT_MAX_CHORDS_PER_BLOCK || blockLines >= 2)
    ) {
      flushBlock();
      if (sections.length >= SHORT_MAX_SECTIONS || totalChords >= SHORT_MAX_TOTAL_CHORDS) break;

      if (!sectionMatch) {
        currentSection =
          sections.length === 0
            ? "Verse"
            : sections.some((section) => section.name === "Chorus")
              ? "Bridge"
              : "Chorus";
      }
    }

    const remaining = SHORT_MAX_TOTAL_CHORDS - totalChords - blockChords.length;
    blockChords.push(...chords.slice(0, Math.max(remaining, 0)));
    blockLines += 1;

    if (blockChords.length >= SHORT_MAX_CHORDS_PER_BLOCK) {
      flushBlock();
    }
  }

  flushBlock();

  if (sections.length === 0) {
    const fallback = namesToChords(expandRepeats(content.replace(/\n/g, " "), false)).slice(
      0,
      SHORT_MAX_CHORDS_PER_BLOCK,
    );
    if (fallback.length > 0) {
      sections.push({ name: "Progression", chords: fallback });
    }
  }

  return sections;
}

export function parseChordChart(content: string, length: ChartLength = "short"): SongSection[] {
  return length === "full" ? parseFullChart(content) : parseShortChart(content);
}

export function applyChartLength(sections: SongSection[], length: ChartLength): SongSection[] {
  if (length === "full") return sections;

  const condensed: SongSection[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (const section of sections) {
    const name = normalizeSectionName(section.name);
    if (shouldSkipSection(name) || seen.has(name)) continue;

    const chords = section.chords.slice(0, SHORT_MAX_CHORDS_PER_BLOCK);
    if (chords.length === 0) continue;

    seen.add(name);
    total += chords.length;
    condensed.push({ name, chords: chords.slice(0, Math.max(SHORT_MAX_TOTAL_CHORDS - total + chords.length, 0)) });

    if (total >= SHORT_MAX_TOTAL_CHORDS || condensed.length >= SHORT_MAX_SECTIONS) break;
  }

  if (condensed.length === 0 && sections[0]) {
    condensed.push({
      name: "Progression",
      chords: sections[0].chords.slice(0, SHORT_MAX_CHORDS_PER_BLOCK),
    });
  }

  return condensed;
}

export function chartToLookupResult(
  content: string,
  title: string,
  artist: string,
  sourceUrl: string,
  source: SongLookupResult["source"],
  chartLength: ChartLength = "short",
): SongLookupResult {
  const sectionsFull = parseFullChart(content);
  const sections =
    chartLength === "full" ? sectionsFull : parseShortChart(content);

  if (sectionsFull.length === 0 || sectionsFull.every((section) => section.chords.length === 0)) {
    throw new Error("Couldn't parse any chords from the chart.");
  }

  if (sections.length === 0 || sections.every((section) => section.chords.length === 0)) {
    throw new Error("Couldn't build a short chord reference from the chart.");
  }

  return {
    title,
    artist,
    key: detectKey(sections),
    scale: "major",
    bpm: 120,
    sections,
    sectionsFull,
    sourceUrl,
    source,
  };
}
