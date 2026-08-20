import { lookupSong } from "@/lib/lookup";
import { generateMidi } from "@/lib/midi";
import type { ComposeRequest, ComposeStyle } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VALID_STYLES: ComposeStyle[] = ["block", "arpeggio", "bass"];

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

    const style = VALID_STYLES.includes(body.style ?? "block")
      ? (body.style ?? "block")
      : "block";
    const beatsPerChord = Math.min(Math.max(body.beatsPerChord ?? 4, 1), 8);

    const lookup = await lookupSong(song, artist, {
      manualChart: body.manualChart,
    });
    const bpm = body.bpm ?? lookup.bpm;

    const midiBytes = generateMidi(lookup.sections, {
      bpm,
      beatsPerChord,
      style,
      trackName: `${lookup.title} - ${lookup.artist}`,
    });

    const filename = `${sanitizeFilename(lookup.title)}.mid`;

    return new NextResponse(Buffer.from(midiBytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/midi",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Song-Title": lookup.title,
        "X-Song-Artist": lookup.artist,
        "X-Song-Key": lookup.key,
        "X-Song-Bpm": String(bpm),
        "X-Song-Source": lookup.sourceUrl,
        "X-Song-Data-Source": lookup.source,
        "X-Song-Sections": JSON.stringify(
          lookup.sections.map((section) => ({
            name: section.name,
            chords: section.chords.map((chord) => chord.label),
          })),
        ),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong generating your MIDI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "POST song + artist to generate a MIDI file.",
  });
}
