import type { Config } from "@netlify/functions";
import { runSync } from "../../src/lib/sync";

// Netlify Scheduled Function: pulls yesterday's campaign insights from the
// Meta Marketing API and upserts them into insight_snapshots.

export default async () => {
  try {
    const result = await runSync();
    console.log("Sync complete", result);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error("Sync failed", err);
    return new Response(String(err), { status: 500 });
  }
};

export const config: Config = {
  schedule: "0 2 * * *", // daily at 02:00 UTC
};
