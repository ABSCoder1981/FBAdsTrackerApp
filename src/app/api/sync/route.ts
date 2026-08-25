import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

// Manual/testable trigger for the same sync logic the Netlify scheduled
// function runs nightly. Guarded by CRON_SECRET so it isn't publicly callable.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
