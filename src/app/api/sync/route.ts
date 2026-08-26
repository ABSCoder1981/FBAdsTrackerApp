import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    // The nightly cron hits this route directly (not the triggerSync server
    // action), so it needs its own revalidation or pages would stay cached
    // with pre-sync data until their revalidate window happens to expire.
    revalidatePath("/");
    revalidatePath("/campaigns");
    revalidatePath("/alerts");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
