import type { ParsedChord, SongSection } from "./types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function chordRootMidi(notes: number[]): number {
  return Math.min(...notes);
}

function chordIntervalsFromRoot(notes: number[], root: number): number[] {
  return [...new Set(notes.map((note) => (note - root) % 12))].sort((a, b) => a - b);
}

function noteNameFromMidi(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

function isDominant(intervals: number[]): boolean {
  return intervals.includes(4) && intervals.includes(7) && intervals.includes(10);
}

function isMajorTriad(intervals: number[]): boolean {
  return intervals.includes(4) && intervals.includes(7) && !intervals.includes(3);
}

function isMinorTriad(intervals: number[]): boolean {
  return intervals.includes(3) && intervals.includes(7) && !intervals.includes(4);
}

function transposeNotes(notes: number[], semitones: number): number[] {
  return notes.map((note) => note + semitones);
}

function uniqueSorted(notes: number[]): number[] {
  return [...new Set(notes)].sort((a, b) => a - b);
}

function addExtension(notes: number[], semitone: number): ParsedChord {
  const root = chordRootMidi(notes);
  const extended = uniqueSorted([...notes, root + semitone]);
  const name = noteNameFromMidi(root);
  return {
    label: `${name}+`,
    notes: extended,
  };
}

function toSus4(notes: number[]): ParsedChord {
  const root = chordRootMidi(notes);
  const intervals = chordIntervalsFromRoot(notes, root);
  if (!isMajorTriad(intervals)) {
    return { label: notes.map((n) => noteNameFromMidi(n)).join("/"), notes: uniqueSorted(notes) };
  }
  const sus = uniqueSorted([root, root + 5, root + 7]);
  const name = noteNameFromMidi(root);
  return { label: `${name}sus4`, notes: sus };
}

function addSeventh(notes: number[]): ParsedChord {
  const root = chordRootMidi(notes);
  const intervals = chordIntervalsFromRoot(notes, root);
  let seventh = 10;
  if (isMajorTriad(intervals)) seventh = 11;
  if (intervals.includes(11)) seventh = 10;
  const withSeventh = uniqueSorted([...notes, root + seventh]);
  const name = noteNameFromMidi(root);
  const suffix =
    seventh === 11 ? "maj7" : isMinorTriad(intervals) ? "m7" : "7";
  return { label: `${name}${suffix}`, notes: withSeventh };
}

function spreadVoicing(notes: number[], inversion: number): ParsedChord {
  const sorted = uniqueSorted(notes);
  const rotated = sorted.map((_, index) => sorted[(index + inversion) % sorted.length]);
  const spread = rotated.map((note, index) => note + (index > 0 ? 12 * Math.floor(index / 2) : 0));
  const root = chordRootMidi(spread);
  const name = noteNameFromMidi(root);
  return { label: `${name}°${inversion}`, notes: uniqueSorted(spread) };
}

function tritoneSubstitution(notes: number[]): ParsedChord {
  const root = chordRootMidi(notes);
  const intervals = chordIntervalsFromRoot(notes, root);
  if (!isDominant(intervals)) {
    return { label: noteNameFromMidi(root), notes: uniqueSorted(notes) };
  }
  const newRoot = root - 6;
  const sub = uniqueSorted([newRoot, newRoot + 4, newRoot + 7, newRoot + 10]);
  const name = noteNameFromMidi(newRoot);
  return { label: `${name}7 (sub)`, notes: sub };
}

function jazzShell(notes: number[]): ParsedChord {
  const root = chordRootMidi(notes);
  const intervals = chordIntervalsFromRoot(notes, root);
  const third = intervals.includes(3) ? root + 3 : root + 4;
  const seventh = intervals.includes(10) || intervals.includes(11)
    ? root + (intervals.includes(11) ? 11 : 10)
    : root + (intervals.includes(3) ? 10 : 11);
  const shell = uniqueSorted([root, third, seventh]);
  const name = noteNameFromMidi(root);
  return { label: `${name} shell`, notes: shell };
}

function varyChord(chord: ParsedChord, index: number, seed: number): ParsedChord {
  const root = chordRootMidi(chord.notes);
  const intervals = chordIntervalsFromRoot(chord.notes, root);
  const variant = (seed + index * 17) % 6;

  switch (variant) {
    case 0:
      return addExtension(chord.notes, 14);
    case 1:
      return toSus4(chord.notes);
    case 2:
      return addSeventh(chord.notes);
    case 3:
      return spreadVoicing(chord.notes, 1 + ((seed + index) % 2));
    case 4:
      return tritoneSubstitution(chord.notes);
    case 5:
      return jazzShell(chord.notes);
    default:
      return chord;
  }
}

export function variationTranspose(seed: number): number {
  const options = [2, 3, 5, 7, -3, -5, 4, -2];
  return options[seed % options.length];
}

export function variationBpmOffset(seed: number): number {
  return ((seed % 17) - 8);
}

export function variationRhythmPattern(seed: number, baseBeats: number): number[] {
  const patterns = [
    [baseBeats, baseBeats - 1, baseBeats + 1, baseBeats],
    [baseBeats, 2, baseBeats, 3],
    [3, baseBeats, 2, baseBeats],
    [baseBeats + 1, baseBeats, baseBeats, 2],
  ];
  return patterns[seed % patterns.length].map((beats) => Math.max(2, Math.min(6, beats)));
}

export function varyMelodyMidi(midi: number, index: number, seed: number, transpose: number): number {
  let varied = midi + transpose;

  // Occasional octave color — keeps contour but shifts fingerprint slightly.
  if ((seed + index * 11) % 13 === 0) varied += 12;
  if ((seed + index * 7) % 17 === 0 && varied > 58) varied -= 12;

  return varied;
}

export function varySections(
  sections: SongSection[],
  options: { seed: string },
): { sections: SongSection[]; transpose: number; bpmOffset: number; rhythmPattern: number[] } {
  const seed = hashSeed(options.seed);
  const transpose = variationTranspose(seed);
  const bpmOffset = variationBpmOffset(seed);

  const variedSections = sections.map((section) => ({
    name: section.name,
    chords: section.chords.map((chord, index) => {
      const varied = varyChord(chord, index, seed);
      return {
        label: varied.label,
        notes: transposeNotes(varied.notes, transpose),
      };
    }),
  }));

  const rhythmPattern = variationRhythmPattern(seed, 4);

  return { sections: variedSections, transpose, bpmOffset, rhythmPattern };
}
