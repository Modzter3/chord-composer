import { sindToChord } from "./chords";
import type { ParsedChord, SectionTranscription } from "./types";

const TONIC_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export interface HookpadKey {
  beat: number;
  tonic: string;
  scale: "major" | "minor";
}

export interface HookpadMelodyNote {
  sd: string;
  octave: number;
  beat: number;
  duration: number;
  isRest: boolean;
}

export interface HookpadChord {
  root: number;
  beat: number;
  duration: number;
  type: number;
  inversion: number;
  adds: number[];
  omits: number[];
  isRest: boolean;
}

export interface HookpadSectionData {
  version?: string;
  keys: HookpadKey[];
  tempos: Array<{ beat: number; bpm: number }>;
  meters: Array<{ beat: number; numBeats: number; beatUnit: number }>;
  endBeat: number;
  chords: HookpadChord[];
  notes: HookpadMelodyNote[];
}

export interface HookpadSectionRef {
  name: string;
  hash: string;
}

export function parseSectionHashes(html: string): HookpadSectionRef[] {
  const hashes = [
    ...html.matchAll(/pushToPendingTheoryTabs\("tab-[^"]+",\s*\{id:\s*"([^"]+)"/g),
  ].map((match) => match[1]);

  const names = [...html.matchAll(/tb-section-tab[^>]*>\s*([^<]+?)\s*<\/a>/g)]
    .map((match) => match[1].trim())
    .filter((name) => name !== "All Sections");

  return hashes.map((hash, index) => ({
    hash,
    name: names[index] ?? `Section ${index + 1}`,
  }));
}

function scaleIntervals(scale: "major" | "minor"): number[] {
  return scale === "major" ? MAJOR_INTERVALS : MINOR_INTERVALS;
}

function keyAtBeat(keys: HookpadKey[], beat: number): HookpadKey {
  let current = keys[0] ?? { beat: 1, tonic: "C", scale: "major" as const };
  for (const key of keys) {
    if (key.beat <= beat) current = key;
    else break;
  }
  return current;
}

function bpmAtBeat(tempos: Array<{ beat: number; bpm: number }>, fallback: number): number {
  if (tempos.length === 0) return fallback;
  return tempos[0].bpm;
}

function sdToSemitoneFromTonic(sd: string, scale: "major" | "minor"): number {
  const intervals = scaleIntervals(scale);
  const normalized = sd.trim();

  if (/^[1-7]$/.test(normalized)) {
    return intervals[Number.parseInt(normalized, 10) - 1] ?? 0;
  }

  const altered = normalized.match(/^([#b])([1-7])$/);
  if (altered) {
    const degree = Number.parseInt(altered[2], 10);
    let semitone = intervals[degree - 1] ?? 0;
    if (altered[1] === "#") semitone += 1;
    if (altered[1] === "b") semitone -= 1;
    return semitone;
  }

  if (normalized === "7f" || normalized === "7s" || normalized === "#7") {
    return (intervals[6] ?? 11) + 1;
  }

  const flatDegree = normalized.match(/^b([1-7])$/);
  if (flatDegree) {
    const degree = Number.parseInt(flatDegree[1], 10);
    return (intervals[degree - 1] ?? 0) - 1;
  }

  return intervals[0];
}

export function hookpadNoteToMidi(
  note: HookpadMelodyNote,
  key: HookpadKey,
): number | null {
  if (note.isRest) return null;

  const tonic = TONIC_TO_SEMITONE[key.tonic] ?? 0;
  const semitone = sdToSemitoneFromTonic(note.sd, key.scale);
  const baseOctave = 5 + note.octave;
  return baseOctave * 12 + tonic + semitone;
}

export function hookpadChordToSind(chord: HookpadChord): string {
  let sind = String(chord.root);
  if (chord.type === 7) sind += "7";
  if (chord.adds.includes(6)) sind += "add6";
  if (chord.adds.includes(9)) sind += "add9";
  return sind;
}

export async function fetchHookpadSection(
  hash: string,
): Promise<{ section: string; bpm: number | null; data: HookpadSectionData } | null> {
  const response = await fetch(
    `https://api.hooktheory.com/v1/songs/public/${hash}?fields=section,jsonData,bpm`,
    {
      headers: { Accept: "application/json", "User-Agent": "ChordComposer/1.0" },
      next: { revalidate: 3600 },
    },
  );

  if (!response.ok) return null;

  const row = (await response.json()) as {
    section?: string;
    bpm?: number | null;
    jsonData?: string;
  };

  if (!row.jsonData) return null;

  const data = JSON.parse(row.jsonData) as HookpadSectionData;
  const bpm = data.tempos?.[0]?.bpm ?? row.bpm ?? 120;

  return {
    section: row.section ?? "Section",
    bpm,
    data,
  };
}

export function hookpadToTranscription(
  hash: string,
  data: HookpadSectionData,
  bpm: number,
): SectionTranscription {
  const defaultKey = data.keys[0] ?? { beat: 1, tonic: "C", scale: "major" as const };

  const melody = data.notes
    .filter((note) => !note.isRest)
    .map((note) => {
      const key = keyAtBeat(data.keys, note.beat);
      const midi = hookpadNoteToMidi(note, key);
      return midi == null
        ? null
        : {
            beat: note.beat,
            duration: note.duration,
            midi,
          };
    })
    .filter((note): note is NonNullable<typeof note> => note != null);

  const timedChords = data.chords
    .filter((chord) => !chord.isRest)
    .map((chord) => {
      const key = keyAtBeat(data.keys, chord.beat);
      const sind = hookpadChordToSind(chord);
      const parsed = sindToChord(sind, key.tonic, key.scale);
      return {
        beat: chord.beat,
        duration: chord.duration,
        label: parsed.label,
        notes: parsed.notes,
      };
    });

  return {
    hash,
    bpm: bpmAtBeat(data.tempos, bpm),
    endBeat: data.endBeat,
    key: { tonic: defaultKey.tonic, scale: defaultKey.scale },
    melody,
    timedChords,
  };
}

export async function fetchTranscriptions(
  refs: HookpadSectionRef[],
): Promise<Map<string, SectionTranscription>> {
  const results = await Promise.all(
    refs.map(async (ref) => {
      const fetched = await fetchHookpadSection(ref.hash);
      if (!fetched) return null;
      return {
        name: ref.name,
        transcription: hookpadToTranscription(ref.hash, fetched.data, fetched.bpm ?? 120),
      };
    }),
  );

  const map = new Map<string, SectionTranscription>();
  for (const result of results) {
    if (result) map.set(result.name, result.transcription);
  }
  return map;
}

export function mergeTranscriptionChords(
  transcription: SectionTranscription,
): ParsedChord[] {
  return transcription.timedChords.map((chord) => ({
    label: chord.label,
    notes: chord.notes,
  }));
}
