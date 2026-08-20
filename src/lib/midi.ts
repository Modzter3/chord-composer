import { Midi } from "@tonejs/midi";
import { midiToNoteName } from "./chords";
import { scheduleComposition } from "./schedule";
import type { ComposeStyle, SongSection } from "./types";

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
  const scheduled = scheduleComposition(sections, { bpm, beatsPerChord, style });
  const midi = new Midi();
  midi.header.setTempo(bpm);

  const track = midi.addTrack();
  track.name = trackName;
  track.channel = 0;
  track.instrument.number = 0;
  track.instrument.name = "Acoustic Grand Piano";

  for (const note of scheduled) {
    track.addNote({
      name: midiToNoteName(note.midi),
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
    });
  }

  return midi.toArray();
}
