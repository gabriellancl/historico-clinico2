import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file) {
      return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }

    const blobName = `exames/${Date.now()}-${file.name}`;
    const { url } = await put(blobName, file, { access: "public" });

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: "Falha no upload" }, { status: 500 });
  }
}
