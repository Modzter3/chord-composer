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
  },
): ScheduledNote[] {
  if (options.playbackMode === "transcription" && hasTranscription(sections)) {
    return scheduleTranscription(sections);
  }

  return scheduleComposition(sections, {
    bpm: options.bpm,
    beatsPerChord: options.beatsPerChord,
    style: options.style,
  });
}
