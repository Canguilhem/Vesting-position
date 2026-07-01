export type PageSlice<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export function paginateSlice<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): PageSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const offset = safePage * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasPrev: safePage > 0,
    hasNext: safePage + 1 < totalPages,
  };
}

/** Run async work in sequential chunks to avoid RPC bursts. */
export async function mapInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
