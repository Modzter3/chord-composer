import {
  hashSeed,
  variationBpmOffset,
  variationTranspose,
  varyMelodyMidi,
  varySections,
} from "./chord-variation";
import type { ComposeStyle, PlaybackMode, SongSection } from "./types";

export interface ScheduledNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}

function flattenSections(sections: SongSection[]): { label: string; notes: number[] }[] {
  const chords: { label: string; notes: number[] }[] = [];
  for (const section of sections) {
    chords.push(...section.chords);
  }
  return chords;
}

export function scheduleTranscription(sections: SongSection[]): ScheduledNote[] {
  const notes: ScheduledNote[] = [];
  let timeOffset = 0;

  for (const section of sections) {
    const transcription = section.transcription;
    if (!transcription) continue;

    const beatDur = 60 / transcription.bpm;

    for (const note of transcription.melody) {
      notes.push({
        midi: note.midi,
        time: timeOffset + (note.beat - 1) * beatDur,
        duration: note.duration * beatDur * 0.92,
        velocity: 0.8,
      });
    }

    timeOffset += (transcription.endBeat - 1) * beatDur;
  }

  return notes;
}

export function hasTranscription(sections: SongSection[]): boolean {
  return sections.some((section) => section.transcription != null);
}

function scheduleVariedMelody(
  sections: SongSection[],
  seed: string,
): ScheduledNote[] {
  const seedValue = hashSeed(seed);
  const transpose = variationTranspose(seedValue);
  const notes: ScheduledNote[] = [];
  let timeOffset = 0;
  let melodyIndex = 0;

  for (const section of sections) {
    const transcription = section.transcription;
    if (!transcription) continue;

    const bpm = Math.max(70, Math.min(170, transcription.bpm + variationBpmOffset(seedValue)));
    const beatDur = 60 / bpm;

    for (const note of transcription.melody) {
      const timeNudge = ((seedValue + melodyIndex) % 5) * beatDur * 0.02;
      notes.push({
        midi: varyMelodyMidi(note.midi, melodyIndex, seedValue, transpose),
        time: timeOffset + (note.beat - 1) * beatDur + timeNudge,
        duration: note.duration * beatDur * 0.9,
        velocity: 0.8,
      });
      melodyIndex += 1;
    }

    timeOffset += (transcription.endBeat - 1) * beatDur;
  }

  return notes;
}

function scheduleVariedChordSketch(
  sections: SongSection[],
  options: {
    bpm: number;
    beatsPerChord: number;
    seed: string;
  },
): ScheduledNote[] {
  const seedValue = hashSeed(options.seed);
  const transpose = variationTranspose(seedValue);
  const bpm = Math.max(70, Math.min(170, options.bpm + variationBpmOffset(seedValue)));
  const beatDuration = 60 / bpm;
  const chordDuration = options.beatsPerChord * beatDuration;
  const notes: ScheduledNote[] = [];
  let time = 0;

  const chords = flattenSections(sections);

  for (const chord of chords) {
    const transposed = chord.notes.map((midi) => midi + transpose);
    for (const midi of transposed) {
      notes.push({ midi, time, duration: chordDuration * 0.95, velocity: 0.68 });
    }
    time += chordDuration;
  }

  return notes;
}

export function scheduleVariation(
  sections: SongSection[],
  options: {
    bpm: number;
    beatsPerChord: number;
    seed: string;
  },
): ScheduledNote[] {
  if (hasTranscription(sections)) {
    return scheduleVariedMelody(sections, options.seed);
  }

  return scheduleVariedChordSketch(sections, options);
}

export function scheduleComposition(
  sections: SongSection[],
  options: {
    bpm: number;
    beatsPerChord: number;
    style: ComposeStyle;
  },
): ScheduledNote[] {
  const { bpm, beatsPerChord, style } = options;
  const chords = flattenSections(sections);
  const beatDuration = 60 / bpm;
  const chordDuration = beatsPerChord * beatDuration;
  const notes: ScheduledNote[] = [];
  let time = 0;

  for (const chord of chords) {
    if (style === "block") {
      for (const midi of chord.notes) {
        notes.push({ midi, time, duration: chordDuration * 0.95, velocity: 0.72 });
      }
    } else if (style === "arpeggio") {
      const step = chordDuration / Math.max(chord.notes.length, 1);
      chord.notes.forEach((midi, index) => {
        notes.push({
          midi,
          time: time + index * step,
          duration: step * 0.9,
          velocity: 0.68,
        });
      });
    } else {
      const bass = chord.notes[0];
      const harmony = chord.notes.slice(1);
      notes.push({
        midi: bass - 12,
        time,
        duration: chordDuration * 0.95,
        velocity: 0.78,
      });
      for (const midi of harmony) {
        notes.push({ midi, time, duration: chordDuration * 0.95, velocity: 0.62 });
      }
    }

    time += chordDuration;
  }

  return notes;
}

export function getCompositionDuration(notes: ScheduledNote[]): number {
  if (notes.length === 0) return 1;
  return Math.max(...notes.map((note) => note.time + note.duration)) + 0.5;
}

export function schedulePlayback(
  sections: SongSection[],
  options: {
    playbackMode: PlaybackMode;
    bpm: number;
    beatsPerChord: number;
    style: ComposeStyle;
    variationSeed?: string;
  },
): ScheduledNote[] {
  if (options.playbackMode === "transcription" && hasTranscription(sections)) {
    return scheduleTranscription(sections);
  }

  if (options.playbackMode === "variation") {
    return scheduleVariation(sections, {
      bpm: options.bpm,
      beatsPerChord: options.beatsPerChord,
      seed: options.variationSeed ?? "variation",
    });
  }

  return scheduleComposition(sections, {
    bpm: options.bpm,
    beatsPerChord: options.beatsPerChord,
    style: options.style,
  });
}
