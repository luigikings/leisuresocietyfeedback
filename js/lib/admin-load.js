// Paginated load of all response rows for /admin (spec 002: RF-17, RF-21, propuesta 28). Pure: the network
// call is injected as fetchPage(lastId, size) → { rows } | { error }, returning rows with id > lastId
// (all rows when lastId is null), ordered by id ascending, at most `size` rows.
//
// Keyset by id (primary key, immutable): an update never moves a row and an insert with a lower id never
// shifts later pages, so every row that existed when the load started comes back exactly once.

export const DEFAULT_PAGE_SIZE = 1000;

/**
 * Error of a load whose server returned a page that doesn't move past the last id (it ignores the filter,
 * repeats rows or answers without rows): the load fails instead of looping for ever. The UI shows it as any
 * failed load (RF-21).
 */
export const STALLED_PAGE = "stalled";

/** Loads every page until an empty one. Any failing page fails the whole load, with no retry (RF-21). */
export async function loadAllRows(fetchPage, pageSize = DEFAULT_PAGE_SIZE) {
  const rows = new Map();
  let lastId = null;
  for (;;) {
    const page = await fetchPage(lastId, pageSize);
    if (page.error) return { error: page.error };
    if (!Array.isArray(page.rows)) return { error: STALLED_PAGE };
    // End only on an empty page: the server may cap pages below pageSize.
    if (page.rows.length === 0) break;
    const nextId = page.rows.at(-1).id;
    let added = 0;
    for (const r of page.rows) {
      if (!rows.has(r.id)) added += 1;
      rows.set(r.id, r); // dedupe, just in case
    }
    if (added === 0 || nextId === lastId) return { error: STALLED_PAGE };
    lastId = nextId;
  }
  return { rows: [...rows.values()] };
}
