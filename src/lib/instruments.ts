import * as Tone from "tone";

export type ComposeInstrument =
  | "piano"
  | "electric-piano"
  | "organ"
  | "strings"
  | "guitar"
  | "synth-pad"
  | "marimba";

export interface InstrumentOption {
  id: ComposeInstrument;
  label: string;
  description: string;
  midiProgram: number;
  midiName: string;
}

export const INSTRUMENT_OPTIONS: InstrumentOption[] = [
  {
    id: "piano",
    label: "Piano",
    description: "Warm triangle piano — default chord bed.",
    midiProgram: 0,
    midiName: "Acoustic Grand Piano",
  },
  {
    id: "electric-piano",
    label: "Electric Piano",
    description: "Rhodes-style FM tone — pop and soul.",
    midiProgram: 4,
    midiName: "Electric Piano 1",
  },
  {
    id: "organ",
    label: "Organ",
    description: "Sustained drawbar organ — gospel and rock.",
    midiProgram: 16,
    midiName: "Drawbar Organ",
  },
  {
    id: "strings",
    label: "Strings",
    description: "Slow-attack string pad — ballads and film cues.",
    midiProgram: 48,
    midiName: "String Ensemble 1",
  },
  {
    id: "guitar",
    label: "Guitar",
    description: "Plucked nylon guitar — singer-songwriter feel.",
    midiProgram: 24,
    midiName: "Acoustic Guitar (nylon)",
  },
  {
    id: "synth-pad",
    label: "Synth Pad",
    description: "Soft evolving pad — ambient and electronic.",
    midiProgram: 88,
    midiName: "Pad 2 (warm)",
  },
  {
    id: "marimba",
    label: "Marimba",
    description: "Mallet percussion — great with arpeggio style.",
    midiProgram: 12,
    midiName: "Marimba",
  },
];

const INSTRUMENT_BY_ID = Object.fromEntries(
  INSTRUMENT_OPTIONS.map((option) => [option.id, option]),
) as Record<ComposeInstrument, InstrumentOption>;

export function getInstrumentOption(instrument: ComposeInstrument): InstrumentOption {
  return INSTRUMENT_BY_ID[instrument];
}

export type InstrumentSynth = Tone.PolySynth<Tone.Synth> | Tone.PolySynth<Tone.FMSynth> | Tone.PolySynth<Tone.AMSynth>;

export function createInstrumentSynth(instrument: ComposeInstrument): InstrumentSynth {
  switch (instrument) {
    case "electric-piano":
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.5,
        modulationIndex: 3,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.45, sustain: 0.12, release: 0.7 },
        modulation: { type: "square" },
      });
    case "organ":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.01, decay: 0.05, sustain: 0.95, release: 0.15 },
      });
    case "strings":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.45, decay: 0.25, sustain: 0.75, release: 1.4 },
      });
    case "guitar":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.28, sustain: 0.02, release: 0.35 },
      });
    case "synth-pad":
      return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.55, decay: 0.35, sustain: 0.82, release: 2.1 },
      });
    case "marimba":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.45 },
      });
    case "piano":
    default:
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.35, release: 0.6 },
      });
  }
}

export function instrumentVolume(instrument: ComposeInstrument): number {
  switch (instrument) {
    case "organ":
    case "strings":
      return -10;
    case "guitar":
    case "marimba":
      return -6;
    case "synth-pad":
      return -9;
    default:
      return -8;
  }
}
