import { put, list } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "data/events.json";

async function getEventsUrl() {
  const { blobs } = await list({ prefix: KEY, limit: 1 });
  return blobs?.[0]?.url || null;
}

export async function GET() {
  try {
    const url = await getEventsUrl();
    if (!url) return NextResponse.json([]);
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req) {
  try {
    const updated = await req.json();
    await put(KEY, JSON.stringify(updated, null, 2), {
      access: "public",
      contentType: "application/json",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }
}
