import { lookupSong } from "../src/lib/lookup.ts";
import { scheduleTranscription } from "../src/lib/schedule.ts";
import { midiToNoteName } from "../src/lib/chords.ts";

const result = await lookupSong("In the End", "Linkin Park");
console.log("has transcription:", result.sections.some((s) => s.transcription));

for (const section of result.sections.slice(0, 2)) {
  const t = section.transcription;
  if (!t) {
    console.log(section.name, ": no transcription");
    continue;
  }
  console.log(
    section.name,
    `bpm=${t.bpm}`,
    `melody=${t.melody.length}`,
    `first notes:`,
    t.melody.slice(0, 4).map((n) => midiToNoteName(n.midi)).join(", "),
  );
}

const scheduled = scheduleTranscription(result.sections);
console.log("total scheduled notes:", scheduled.length);
console.log("duration ~", Math.max(...scheduled.map((n) => n.time + n.duration)).toFixed(1), "sec");
