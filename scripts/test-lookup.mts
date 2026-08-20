import { lookupSong } from "../src/lib/lookup.ts";

for (const chartLength of ["short", "full"] as const) {
  const result = await lookupSong("Lay It On The Line", "Triumph", { chartLength });
  const count = result.sections.reduce((sum, section) => sum + section.chords.length, 0);
  const fullCount = result.sectionsFull?.reduce((sum, section) => sum + section.chords.length, 0) ?? count;
  console.log(chartLength, "source:", result.source, "active:", count, "full:", fullCount);
  console.log(
    result.sections.map((section) => `${section.name}(${section.chords.length})`).join(", "),
  );
}
