// source/utils/chainDamage.js

// Import the element multipliers JSON.
// If your tooling needs the "assert" clause, keep it; otherwise you can remove it.
import MULTS from "../data/elements_multipliers.json" assert { type: "json" };

/**
 * Get the damage multiplier for (atkElement -> defElement).
 * Falls back to 1 if something is missing.
 */
export function getMultiplier(atkElement, defElement, mults = MULTS) {
  const row = mults[atkElement];
  if (!row) return 1;
  if (defElement in row) return row[defElement];
  return 1;
}

/**
 * Simulate a Chain attack.
 *
 * Rules implemented:
 * - Starts at origin target with initialDamage (integer).
 * - Each bounce travels to a new target within range <= maxRange (hex steps).
 * - Damage decreases by 1 each bounce (never goes below 0 before applying multiplier).
 * - If target is Immune (multiplier 0), the chain ends immediately after that hit.
 * - Tie-breaking when choosing next target:
 *   1) Choose among the **nearest** candidates (minimum distance).
 *   2) If any of those are immune to the element, pick one of them (ends chain).
 *   3) Otherwise pick the one that would take the **most final damage**.
 *   4) If still tied, pick the one with the smallest id (string compare) for determinism.
 *
 * You provide:
 * - getNeighbors(tileId) -> array of adjacent tileIds (for BFS distance).
 * - getUnitAt(tileId) -> { id, element } | null  (id is a stable unique string).
 *   (If your units are addressed by unitId instead of tileId, adapt the accessors.)
 *
 * Return value:
 * {
 *   sequence: [
 *     { targetId, tileId, baseDamage, multiplier, finalDamage, distanceFromPrev }
 *   ],
 *   totalDamage
 * }
 */
export function simulateChain({
  originTileId,
  originTargetId,           // unit id on the origin tile
  initialDamage,
  element,                  // attack element string in your JSON keys (e.g. "Fire", "Water", ...)
  getNeighbors,             // (tileId) => string[]
  getUnitAt,                // (tileId) => { id, element } | null
  maxRange = 2,
  multipliers = MULTS,
}) {
  if (initialDamage <= 0) {
    return { sequence: [], totalDamage: 0 };
  }

  // Helper: BFS distances from a starting tile (stop once > maxRange)
  function distancesFrom(startTile) {
    const dist = new Map([[startTile, 0]]);
    const q = [startTile];
    while (q.length) {
      const cur = q.shift();
      const d = dist.get(cur);
      if (d >= maxRange) continue;
      for (const n of getNeighbors(cur) || []) {
        if (!dist.has(n)) {
          dist.set(n, d + 1);
          q.push(n);
        }
      }
    }
    return dist; // Map(tileId -> distance)
  }

  const alreadyHit = new Set(); // unit ids
  const seq = [];

  // Hit the origin first
  const originUnit = getUnitAt(originTileId);
  if (!originUnit || originUnit.id !== originTargetId) {
    // Safety: if the expected target isn't at the starting tile, bail cleanly.
    return { sequence: [], totalDamage: 0 };
  }

  let currentTile = originTileId;
  let currentDamage = initialDamage;
  let chainEnds = false;

  // Function to apply a hit to a unit at tileId
  const applyHit = (tileId, unit, distanceFromPrev = 0) => {
    const base = Math.max(0, currentDamage); // ensure non-negative before mult
    const mult = getMultiplier(element, unit.element, multipliers);
    const dealt = Math.floor(base * mult);

    seq.push({
      targetId: unit.id,
      tileId,
      baseDamage: base,
      multiplier: mult,
      finalDamage: dealt,
      distanceFromPrev,
    });

    alreadyHit.add(unit.id);
    currentDamage = currentDamage - 1; // next bounce is -1

    if (mult === 0 || currentDamage <= 0) {
      chainEnds = true; // immunity or no damage left ends the chain
    }
  };

  // 1) Apply the origin hit
  applyHit(currentTile, originUnit, 0);

  // 2) Bounce while we can
  while (!chainEnds) {
    // Find candidates within range from the current tile
    const distMap = distancesFrom(currentTile);

    // Collect tiles with units, un-hit, within <= maxRange and distance > 0
    const candidates = [];
    for (const [tileId, d] of distMap.entries()) {
      if (d === 0 || d > maxRange) continue;
      const u = getUnitAt(tileId);
      if (u && !alreadyHit.has(u.id)) {
        const base = Math.max(0, currentDamage);
        const mult = getMultiplier(element, u.element, multipliers);
        const predicted = Math.floor(base * mult);
        candidates.push({ tileId, unit: u, distance: d, mult, predicted });
      }
    }

    if (candidates.length === 0) break; // no one to bounce to

    // Tie-breakers:
    // 1) Nearest distance
    let minD = Infinity;
    for (const c of candidates) minD = Math.min(minD, c.distance);
    let nearest = candidates.filter(c => c.distance === minD);

    // 2) If any immune (mult = 0) among nearest, pick the one with smallest id (deterministic)
    const immune = nearest.filter(c => c.mult === 0);
    let next;
    if (immune.length) {
      immune.sort((a, b) => String(a.unit.id).localeCompare(String(b.unit.id)));
      next = immune[0];
    } else {
      // 3) Otherwise highest predicted damage
      let maxPred = -1;
      for (const c of nearest) maxPred = Math.max(maxPred, c.predicted);
      const best = nearest.filter(c => c.predicted === maxPred);

      // 4) If still tied, smallest id
      best.sort((a, b) => String(a.unit.id).localeCompare(String(b.unit.id)));
      next = best[0];
    }

    // Apply the hit to the chosen target
    applyHit(next.tileId, next.unit, next.distance);

    // Move current tile to continue the BFS outward
    currentTile = next.tileId;
  }

  const total = seq.reduce((s, h) => s + h.finalDamage, 0);
  return { sequence: seq, totalDamage: total };
}
