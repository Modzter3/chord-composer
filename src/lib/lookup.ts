import { chartToLookupResult } from "./chord-chart";
import { lookupSong as lookupHooktheory } from "./hooktheory";
import { lookupUltimateGuitar } from "./ultimate-guitar";
import type { ChartLength, SongLookupResult } from "./types";

function withChartVariants(
  result: SongLookupResult,
  chartLength: ChartLength,
): SongLookupResult {
  if (result.sectionsFull) {
    return {
      ...result,
      sections: chartLength === "full" ? result.sectionsFull : result.sections,
    };
  }

  return result;
}

export async function lookupSong(
  song: string,
  artist: string,
  options?: { manualChart?: string; chartLength?: ChartLength },
): Promise<SongLookupResult> {
  const chartLength = options?.chartLength ?? "short";

  if (options?.manualChart?.trim()) {
    return chartToLookupResult(
      options.manualChart,
      song,
      artist,
      "manual-input",
      "manual",
      chartLength,
    );
  }

  try {
    const result = await lookupHooktheory(song, artist);
    return withChartVariants({ ...result, sectionsFull: result.sections }, chartLength);
  } catch (hooktheoryError) {
    try {
      const result = await lookupUltimateGuitar(song, artist);
      return withChartVariants(result, chartLength);
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
