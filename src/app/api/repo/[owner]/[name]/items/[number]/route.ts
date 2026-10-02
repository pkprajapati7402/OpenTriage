import { NextRequest, NextResponse } from "next/server";
import { DataCache } from "@/lib/github/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: { owner: string; name: string; number: string } }
) {
  const { owner, name, number } = params;
  const num = parseInt(number, 10);
  if (isNaN(num)) {
    return NextResponse.json({ error: { message: "Invalid item number" } }, { status: 400 });
  }

  const cache = new DataCache(owner, name);
  const items = await cache.getItems();
  if (!items) {
    return NextResponse.json({ error: { message: "Repo not loaded" } }, { status: 404 });
  }

  const item = items.find((i) => i.number === num);
  if (!item) {
    return NextResponse.json({ error: { message: `Item #${num} not found` } }, { status: 404 });
  }

  const suggestions = (await cache.getSuggestions()) || {};
  const suggestion = suggestions[num];

  return NextResponse.json({
    item,
    suggestion,
  });
}
