import { lookupSong } from "@/lib/hooktheory";
import type { ComposeRequest } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const lookup = await lookupSong(song, artist);
    const bpm = body.bpm ?? lookup.bpm;

    return NextResponse.json({
      title: lookup.title,
      artist: lookup.artist,
      key: lookup.key,
      bpm,
      sourceUrl: lookup.sourceUrl,
      sections: lookup.sections.map((section) => ({
        name: section.name,
        chords: section.chords.map((chord) => ({
          label: chord.label,
          notes: chord.notes,
        })),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong looking up the song.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
