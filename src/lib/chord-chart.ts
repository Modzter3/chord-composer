import { Chord, Note } from "tonal";
import type { ParsedChord, SongLookupResult, SongSection } from "./types";

const SECTION_PATTERN =
  /^\[([^\]]+)\]$|^(Intro|Verse(?:\s*\d+)?|Chorus|Bridge|Solo|Outro|Pre-Chorus)\b[:\s-]*/i;

const CHORD_TOKEN =
  /\b([A-G](?:#|b)?(?:m(?!aj)|maj|dim|aug|sus|add|M)?(?:maj7|m7|7|9|11|13)?(?:\/[A-G](?:#|b)?)?|NC)\b/g;

const REPEAT_PATTERN = /\(([^)]+)\)\s*x\s*(\d+)/gi;

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

function expandRepeats(text: string): string[] {
  const chords: string[] = [];
  let cursor = 0;
  let repeatMatch: RegExpExecArray | null = REPEAT_PATTERN.exec(text);

  while (repeatMatch) {
    if (repeatMatch.index > cursor) {
      chords.push(...extractChordNames(text.slice(cursor, repeatMatch.index)));
    }

    const inner = extractChordNames(repeatMatch[1]);
    const count = Number.parseInt(repeatMatch[2], 10);
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

function detectKey(sections: SongSection[]): string {
  const first = sections[0]?.chords[0]?.label;
  if (!first) return "Unknown";
  const data = Chord.get(first);
  return data.tonic ? `${data.tonic} ${data.quality || "major"}` : "Unknown";
}

export function parseChordChart(content: string): SongSection[] {
  const sections: SongSection[] = [];
  let currentSection = "Song";

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSection = sectionMatch[1] ?? sectionMatch[2] ?? currentSection;
    }

    const chordNames = expandRepeats(line);
    const chords = chordNames
      .map((name) => chordNameToParsed(name))
      .filter((chord): chord is ParsedChord => chord != null);

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

export function chartToLookupResult(
  content: string,
  title: string,
  artist: string,
  sourceUrl: string,
  source: SongLookupResult["source"],
): SongLookupResult {
  const sections = parseChordChart(content);
  if (sections.length === 0) {
    throw new Error("Couldn't parse any chords from the chart.");
  }

  const totalChords = sections.reduce((sum, section) => sum + section.chords.length, 0);
  if (totalChords === 0) {
    throw new Error("Couldn't parse any chords from the chart.");
  }

  return {
    title,
    artist,
    key: detectKey(sections),
    scale: "major",
    bpm: 120,
    sections,
    sourceUrl,
    source,
  };
}
