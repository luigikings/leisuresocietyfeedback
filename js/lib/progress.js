// Progress header and question bar (RF-125 to RF-130). Pure module: no DOM, no network, no clock.

/**
 * @param {{ litCount: number, total?: number, current?: number|null, answeredIndexes?: readonly number[] }} input
 *   litCount: lit sites = answered questions (RF-126);
 *   current: index 0-9 of the question on screen, or null on the final screen (RF-129, RF-130);
 *   answeredIndexes: indexes of the answered questions. With Back an answered question can come after the
 *   current one, so the filled segments come from this set and not from litCount in order (RF-128).
 *   Without it, the first litCount segments are filled.
 * @returns {{ percentText: string, placesText: string, segments: Array<{ filled: boolean, current: boolean }> }}
 */
export function progressView({ litCount, total = 10, current = null, answeredIndexes } = {}) {
  const answered = new Set(answeredIndexes ?? Array.from({ length: litCount }, (_, i) => i));
  const percent = total > 0 ? Math.round((litCount * 100) / total) : 0;
  const segments = Array.from({ length: total }, (_, i) => ({
    filled: answered.has(i),
    current: current !== null && i === current,
  }));
  return { percentText: `${percent}%`, placesText: `${litCount} of ${total} places`, segments };
}
