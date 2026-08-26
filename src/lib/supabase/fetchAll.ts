// Supabase's REST API caps a single query at 1000 rows by default. Any query
// against a table that can realistically exceed that (insight_snapshots
// already does — 1577+ rows and growing daily) must paginate or it silently
// truncates, which is worse than an error: it looks like it worked. Found
// this the hard way building Alerts (§9) — 37% of rows were missing.
//
// Takes a factory that builds a fresh range-limited query each call, rather
// than a live query builder — Supabase's generic types make a reusable
// builder painful to type, and re-invoking .range() on an already-awaited
// builder isn't a documented-safe pattern anyway.
export async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await queryFactory(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}
