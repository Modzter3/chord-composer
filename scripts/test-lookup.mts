import { lookupSong } from "../src/lib/lookup.ts";

const result = await lookupSong("Lay It On The Line", "Triumph");
console.log("source:", result.source);
console.log("key:", result.key);
console.log(
  "sections:",
  result.sections.map((section) => ({
    name: section.name,
    chords: section.chords.length,
    preview: section.chords.slice(0, 6).map((chord) => chord.label),
  })),
);
