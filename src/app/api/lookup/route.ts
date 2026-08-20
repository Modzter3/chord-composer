import { lookupSong } from "@/lib/lookup";
import { hasTranscription } from "@/lib/schedule";
import type { ComposeRequest, SongSection } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function serializeSection(section: SongSection) {
  return {
    name: section.name,
    chords: section.chords.map((chord) => ({
      label: chord.label,
      notes: chord.notes,
    })),
    transcription: section.transcription,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ComposeRequest;
    const song = body.song?.trim();
    const artist = body.artist?.trim();

    if (!song || !artist) {
      return NextResponse.json(
        { error: "Please enter both a song title and artist." },
        { status: 400 },
      );
    }

    const lookup = await lookupSong(song, artist, {
      manualChart: body.manualChart,
      chartLength: body.chartLength ?? "short",
    });
    const bpm = body.bpm ?? lookup.bpm;

    return NextResponse.json({
      title: lookup.title,
      artist: lookup.artist,
      key: lookup.key,
      bpm,
      sourceUrl: lookup.sourceUrl,
      source: lookup.source,
      hasTranscription: hasTranscription(lookup.sections),
      sections: lookup.sections.map(serializeSection),
      sectionsFull: lookup.sectionsFull?.map(serializeSection),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong looking up the song.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
