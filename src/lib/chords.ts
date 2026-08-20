import type { ChordQuality, ParsedChord } from "./types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

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

const MAJOR_DIATONIC: Record<number, ChordQuality> = {
  1: "maj",
  2: "min",
  3: "min",
  4: "maj",
  5: "maj",
  6: "min",
  7: "dim",
};

const MINOR_DIATONIC: Record<number, ChordQuality> = {
  1: "min",
  2: "dim",
  3: "maj",
  4: "min",
  5: "min",
  6: "maj",
  7: "maj",
};

function parseSind(
  sind: string,
  scale: "major" | "minor",
): { degree: number; quality: ChordQuality } {
  const match = sind.match(/^([1-7])/);
  const degree = match ? Number.parseInt(match[1], 10) : 1;
  let quality = (scale === "major" ? MAJOR_DIATONIC : MINOR_DIATONIC)[degree] ?? "maj";

  // "57"/"67" = seventh chord; plain "7" is scale degree VII, not a 7th extension.
  const hasSeventh = /^([1-7])7/.test(sind) && !sind.includes("add");

  if (hasSeventh) {
    if (degree === 5) return { degree, quality: "dom7" };
    if (quality === "maj") return { degree, quality: "maj7" };
    if (quality === "min") return { degree, quality: "min7" };
    if (quality === "dim") return { degree, quality: "min7" };
  }

  return { degree, quality };
}

function chordIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case "maj":
      return [0, 4, 7];
    case "min":
      return [0, 3, 7];
    case "dim":
      return [0, 3, 6];
    case "maj7":
      return [0, 4, 7, 11];
    case "min7":
      return [0, 3, 7, 10];
    case "dom7":
      return [0, 4, 7, 10];
  }
}

function degreeToRoman(degree: number, quality: ChordQuality): string {
  const numerals = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
  const base = numerals[degree] ?? "I";
  if (quality === "dim") return `${base.toLowerCase()}°`;
  if (quality === "dom7" || quality === "maj7") return `${base}7`;
  if (quality === "min7") return `${base.toLowerCase()}7`;
  if (quality === "min") return base.toLowerCase();
  return base;
}

export function sindToChord(
  sind: string,
  tonic: string,
  scale: "major" | "minor",
  octave = 4,
): ParsedChord {
  const { degree, quality } = parseSind(sind, scale);
  const scaleIntervals = scale === "major" ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const rootSemitone = (TONIC_TO_SEMITONE[tonic] ?? 0) + scaleIntervals[degree - 1];
  const intervals = chordIntervals(quality);

  const notes = intervals.map((interval) => rootSemitone + interval + (octave + 1) * 12);
  const rootName = NOTE_NAMES[rootSemitone % 12];
  const suffix =
    quality === "min7"
      ? "m7"
      : quality === "min"
        ? "m"
        : quality === "dim"
          ? "dim"
          : quality === "maj7" || quality === "dom7"
            ? "7"
            : "";
  const label = `${rootName}${suffix}`;

  return {
    label: `${degreeToRoman(degree, quality)} (${label})`,
    notes,
  };
}

export function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}
