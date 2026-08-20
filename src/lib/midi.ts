import { Midi } from "@tonejs/midi";
import { midiToNoteName } from "./chords";
import type { ComposeStyle, ParsedChord, SongSection } from "./types";

function flattenWithSections(sections: SongSection[]): ParsedChord[] {
  const chords: ParsedChord[] = [];
  for (const section of sections) {
    chords.push(...section.chords);
  }
  return chords;
}

export function generateMidi(
  sections: SongSection[],
  options: {
    bpm: number;
    beatsPerChord: number;
    style: ComposeStyle;
    trackName?: string;
  },
): Uint8Array {
  const { bpm, beatsPerChord, style, trackName = "Chords" } = options;
  const chords = flattenWithSections(sections);
  const midi = new Midi();
  midi.header.setTempo(bpm);

  const track = midi.addTrack();
  track.name = trackName;
  track.channel = 0;
  track.instrument.number = 0;
  track.instrument.name = "Acoustic Grand Piano";

  const beatDuration = 60 / bpm;
  const chordDuration = beatsPerChord * beatDuration;
  let time = 0;

  for (const chord of chords) {
    if (style === "block") {
      for (const note of chord.notes) {
        track.addNote({
          name: midiToNoteName(note),
          time,
          duration: chordDuration * 0.95,
          velocity: 0.72,
        });
      }
    } else if (style === "arpeggio") {
      const step = chordDuration / Math.max(chord.notes.length, 1);
      chord.notes.forEach((note, index) => {
        track.addNote({
          name: midiToNoteName(note),
          time: time + index * step,
          duration: step * 0.9,
          velocity: 0.68,
        });
      });
    } else {
      const bass = chord.notes[0];
      const harmony = chord.notes.slice(1);
      track.addNote({
        name: midiToNoteName(bass - 12),
        time,
        duration: chordDuration * 0.95,
        velocity: 0.78,
      });
      for (const note of harmony) {
        track.addNote({
          name: midiToNoteName(note),
          time,
          duration: chordDuration * 0.95,
          velocity: 0.62,
        });
      }
    }

    time += chordDuration;
  }

  return midi.toArray();
}
