import type { Cluster } from './types.ts';

/**
 * Keeps only the filter groups listed in `filterParams` (the ones a search can send back),
 * as clean `{id,count,label}` lists. `idOf` reads the id field, which differs per site.
 */
export function pickClusters(raw: unknown, filterParams: Record<string, string>, idOf: (c: any) => unknown): Record<string, Cluster[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Cluster[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!(key in filterParams) || !Array.isArray(list) || !list.length) continue;
    out[key] = list.map((c) => ({ id: String(idOf(c)), count: Number(c.count) || 0, label: String(c.label ?? '') }));
  }
  return out;
}
