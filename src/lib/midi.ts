import { Midi } from "@tonejs/midi";
import { midiToNoteName } from "./chords";
import { getInstrumentOption, type ComposeInstrument } from "./instruments";
import { schedulePlayback } from "./schedule";
import type { ComposeStyle, PlaybackMode, SongSection } from "./types";

export function generateMidi(
  sections: SongSection[],
  options: {
    bpm: number;
    beatsPerChord: number;
    style: ComposeStyle;
    playbackMode?: PlaybackMode;
    instrument?: ComposeInstrument;
    trackName?: string;
  },
): Uint8Array {
  const {
    bpm,
    beatsPerChord,
    style,
    playbackMode = "chords",
    instrument = "piano",
    trackName = "Chords",
  } = options;
  const scheduled = schedulePlayback(sections, {
    playbackMode,
    bpm,
    beatsPerChord,
    style,
  });
  const instrumentMeta = getInstrumentOption(instrument);
  const midi = new Midi();
  midi.header.setTempo(bpm);

  const track = midi.addTrack();
  track.name = trackName;
  track.channel = 0;
  track.instrument.number = instrumentMeta.midiProgram;
  track.instrument.name = instrumentMeta.midiName;

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
