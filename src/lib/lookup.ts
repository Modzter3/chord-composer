import { chartToLookupResult } from "./chord-chart";
import { lookupSong as lookupHooktheory } from "./hooktheory";
import { lookupUltimateGuitar } from "./ultimate-guitar";
import type { SongLookupResult } from "./types";

export async function lookupSong(
  song: string,
  artist: string,
  options?: { manualChart?: string },
): Promise<SongLookupResult> {
  if (options?.manualChart?.trim()) {
    return chartToLookupResult(
      options.manualChart,
      song,
      artist,
      "manual-input",
      "manual",
    );
  }

  try {
    return await lookupHooktheory(song, artist);
  } catch (hooktheoryError) {
    try {
      return await lookupUltimateGuitar(song, artist);
    } catch (ultimateGuitarError) {
      const hooktheoryMessage =
        hooktheoryError instanceof Error ? hooktheoryError.message : "Hooktheory lookup failed.";
      const ultimateGuitarMessage =
        ultimateGuitarError instanceof Error
          ? ultimateGuitarError.message
          : "Ultimate Guitar lookup failed.";

      throw new Error(
        `${hooktheoryMessage} Ultimate Guitar fallback also failed: ${ultimateGuitarMessage} Try pasting a chord chart manually.`,
      );
    }
  }
}
