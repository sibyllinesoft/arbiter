import type { APISurface, APISymbol } from './types.js';

export function calculateStatistics(symbols: APISymbol[]): APISurface['statistics'] {
  const byType: Record<string, number> = {};
  let publicCount = 0;
  let privateCount = 0;

  for (const symbol of symbols) {
    byType[symbol.type] = (byType[symbol.type] || 0) + 1;

    if (symbol.visibility === 'public') {
      publicCount++;
    } else {
      privateCount++;
    }
  }

  return {
    totalSymbols: symbols.length,
    publicSymbols: publicCount,
    privateSymbols: privateCount,
    byType,
  };
}
