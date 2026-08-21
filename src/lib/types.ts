export type ChordQuality = "maj" | "min" | "dim" | "maj7" | "min7" | "dom7";

export interface ParsedChord {
  label: string;
  notes: number[];
}

export interface TranscriptionMelodyNote {
  beat: number;
  duration: number;
  midi: number;
}

export interface TranscriptionTimedChord {
  beat: number;
  duration: number;
  label: string;
  notes: number[];
}

export interface SectionTranscription {
  hash: string;
  bpm: number;
  endBeat: number;
  key: { tonic: string; scale: "major" | "minor" };
  melody: TranscriptionMelodyNote[];
  timedChords: TranscriptionTimedChord[];
}

export interface SongSection {
  name: string;
  chords: ParsedChord[];
  transcription?: SectionTranscription;
}

export interface SongLookupResult {
  title: string;
  artist: string;
  key: string;
  scale: "major" | "minor";
  bpm: number;
  sections: SongSection[];
  sectionsFull?: SongSection[];
  sourceUrl: string;
  source: "hooktheory" | "ultimate-guitar" | "manual";
}

export type { ComposeInstrument } from "./instruments";

export type ComposeStyle = "block" | "arpeggio" | "bass";

export type PlaybackMode = "transcription" | "chords" | "variation" | "combined";

export type ChartLength = "short" | "full";

export interface ComposeRequest {
  song: string;
  artist: string;
  style?: ComposeStyle;
  bpm?: number;
  beatsPerChord?: number;
  manualChart?: string;
  chartLength?: ChartLength;
}

export interface LookupResponse {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  sourceUrl: string;
  source: SongLookupResult["source"];
  hasTranscription: boolean;
  sections: SongSection[];
  sectionsFull?: SongSection[];
}
