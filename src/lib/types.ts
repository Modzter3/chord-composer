export type ChordQuality = "maj" | "min" | "dim" | "maj7" | "min7" | "dom7";

export interface ParsedChord {
  label: string;
  notes: number[];
}

export interface SongSection {
  name: string;
  chords: ParsedChord[];
}

export interface SongLookupResult {
  title: string;
  artist: string;
  key: string;
  scale: "major" | "minor";
  bpm: number;
  sections: SongSection[];
  sourceUrl: string;
  source: "hooktheory" | "ultimate-guitar" | "manual";
}

export type ComposeStyle = "block" | "arpeggio" | "bass";

export interface ComposeRequest {
  song: string;
  artist: string;
  style?: ComposeStyle;
  bpm?: number;
  beatsPerChord?: number;
  manualChart?: string;
}

export interface LookupResponse {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  sourceUrl: string;
  source: SongLookupResult["source"];
  sections: SongSection[];
}
