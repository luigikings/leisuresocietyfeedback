// Load of every response row for /admin (plan §4.3, RF-17, RF-21). Adapter only: one page = rows with
// id > lastId, ordered by id, at most `size` (keyset, proposal 28); the paging, dedupe and the guard against a
// server that doesn't advance live in js/lib/admin-load.js. Errors come back as { error: <kind> } classified by
// js/lib/admin-auth.js ("network" | "session_ended", or "stalled" from the guard); nothing here throws.
import { getClient } from "./client.js";
import { classifyLoadResult } from "../../lib/admin-auth.js";
import { loadAllRows } from "../../lib/admin-load.js";

const QUESTIONS = 10;
// Read only what the panel shows or needs to page and break ties (id is never painted or exported, RF-48).
export const COLUMNS = [
  "id",
  "content_version",
  "country",
  "status",
  "created_at",
  "updated_at",
  ...Array.from({ length: QUESTIONS }, (_, i) => [`q${i + 1}_option`, `q${i + 1}_text`]).flat(),
].join(",");

/** One page → { rows } | { error } (each request has the client's 15 s limit, proposal 16). */
async function fetchPage(lastId, size) {
  try {
    const client = await getClient();
    let query = client.from("responses").select(COLUMNS);
    if (lastId !== null) query = query.gt("id", lastId);
    // retry(false): supabase-js would retry a failed page up to 3 times with backoff; RF-21 wants the whole
    // load to fail at once, and each request to wait 15 s at most (proposal 16).
    const { data, error } = await query.order("id", { ascending: true }).limit(size).retry(false);
    const kind = classifyLoadResult({ error });
    if (kind !== "ok") return { error: kind };
    return { rows: Array.isArray(data) ? data : [] };
  } catch {
    return { error: classifyLoadResult({ threw: true }) };
  }
}

/** Every row → { rows } | { error: "network" | "session_ended" | "stalled" } (RF-17, RF-21). */
export async function loadResponses() {
  try {
    return await loadAllRows(fetchPage);
  } catch {
    return { error: classifyLoadResult({ threw: true }) };
  }
}
