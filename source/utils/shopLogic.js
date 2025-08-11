// source/utils/shopLogic.js
//
// Core helpers for the ElemenTails shop based on shop_rules.json.
//
// State shape created by initShopState():
// {
//   round: 0,
//   stock: [ {slot: "minor-0", tier: "Minor", cardId, lockedUntilRound} ... ],
//   locks: { [cardId]: { by: playerId, until: number } },
//   rerollTokens: 0
// }
//
// Catalog schema suggestion:
// { minors: Card[], majors: Card[] } where Card has at least:
//   { id, name, tier: "Minor"|"Major", energyCost: [{ type: "A"|"D"|"U", amount: number }] }
//
// Hooks required by some functions:
// - spendCp(playerId, amount)
// - canAddCard(playerId) -> boolean
// - onCardPurchased(playerId, card)
// - spendRerollToken()
//
// -----------------------------------------------------------------------------

export function initShopState({ startRound = 0, rerollTokens = 0 } = {}) {
  return {
    round: startRound,
    stock: [],
    locks: {},          // cardId -> { by, until }
    rerollTokens: rerollTokens
  };
}

export function priceFromCard(card, rules) {
  const { pricing } = rules;
  if (!card) return 0;
  if (pricing.mode === "energy_cost") {
    const costs = Array.isArray(card.energyCost) ? card.energyCost : (card.energyCost ? [card.energyCost] : []);
    const sum = costs.reduce((s, c) => s + (c?.amount || 0), 0);
    return Math.max(0, Math.floor(sum * (pricing.energyToCp ?? 1)));
  }
  return 0;
}

export function listOpenSlots(state, rules) {
  const slots = [];
  for (let i = 0; i < rules.stock.minor; i++) slots.push({ slot: `minor-${i}`, tier: "Minor" });
  for (let i = 0; i < rules.stock.major; i++) slots.push({ slot: `major-${i}`, tier: "Major" });
  return slots;
}

function pickRandomDistinct(arr, count, excludeSet = new Set(), rng = Math.random) {
  const pool = arr.filter(x => !excludeSet.has(x.id));
  const out = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function buildExcludeSetFromStock(state) {
  const ex = new Set();
  for (const s of state.stock) {
    if (s?.cardId) ex.add(s.cardId);
  }
  return ex;
}

export function indexCatalog(catalog) {
  const map = new Map();
  for (const c of (catalog.minors || [])) map.set(c.id, c);
  for (const c of (catalog.majors || [])) map.set(c.id, c);
  return map;
}

export function advanceRoundAndRefresh(state, catalog, rules, rng = Math.random) {
  state.round += 1;

  // Drop expired locks
  for (const [cardId, lock] of Object.entries(state.locks)) {
    if (lock.until <= state.round) delete state.locks[cardId];
  }

  const keep = [];
  const lockedIds = new Set(Object.keys(state.locks));
  const slotsAll = listOpenSlots(state, rules);

  // Carry forward any locked cards already in stock
  for (const s of state.stock) {
    if (s.cardId && lockedIds.has(s.cardId) && s.lockedUntilRound > state.round) {
      keep.push(s);
    }
  }

  const takenSlots = new Set(keep.map(k => k.slot));
  const fresh = [...keep];

  const wantMinor = rules.stock.minor - fresh.filter(s => s.slot.startsWith("minor-")).length;
  const wantMajor = rules.stock.major - fresh.filter(s => s.slot.startsWith("major-")).length;

  const exclude = rules.selection.avoidDuplicatesInStock
    ? buildExcludeSetFromStock({ stock: fresh })
    : new Set();

  const minors = pickRandomDistinct(catalog.minors || [], wantMinor, exclude, rng);
  for (const m of minors) exclude.add(m.id);
  const majors = pickRandomDistinct(catalog.majors || [], wantMajor, exclude, rng);

  for (const slot of slotsAll) {
    if (takenSlots.has(slot.slot)) continue;
    const list = slot.tier === "Minor" ? minors : majors;
    const next = list.shift();
    fresh.push({
      slot: slot.slot,
      tier: slot.tier,
      cardId: next ? next.id : null,
      lockedUntilRound: next && lockedIds.has(next.id) ? (state.round + (rules.lock.durationRounds || 1)) : 0
    });
  }

  state.stock = fresh.sort((a, b) => a.slot.localeCompare(b.slot));
  return state;
}

export function lockCard(state, cardId, playerId, rules, { spendCp }) {
  const entry = state.stock.find(s => s.cardId === cardId);
  if (!entry) throw new Error("Card not in stock");
  spendCp(playerId, rules.lock.cpPerLock);
  if (state.locks[cardId]?.until > state.round) {
    // Extend existing lock
    state.locks[cardId].until += (rules.lock.durationRounds || 1);
  } else {
    // New lock
    state.locks[cardId] = { by: playerId, until: state.round + (rules.lock.durationRounds || 1) };
  }
  entry.lockedUntilRound = state.locks[cardId].until;
  return true;
}

export function purchaseCard(state, cardId, playerId, rules, hooks, catalogIndex) {
  const { spendCp, canAddCard, onCardPurchased } = hooks;

  const stockEntry = state.stock.find(s => s.cardId === cardId);
  if (!stockEntry) throw new Error("Card not available");
  const card = catalogIndex.get(cardId);
  if (!card) throw new Error("Card not found in catalog");

  if (!canAddCard(playerId)) throw new Error("Card limit reached for this player");

  const price = priceFromCard(card, rules);
  spendCp(playerId, price);
  onCardPurchased(playerId, card);

  // Remove from stock (no immediate restock by default)
  stockEntry.cardId = null;
  if (state.locks[cardId]) delete state.locks[cardId];

  return { price };
}

export function rerollUnLocked(state, catalog, rules, hooks, rng = Math.random) {
  const { spendRerollToken } = hooks;
  spendRerollToken();

  const lockedIds = new Set(Object.keys(state.locks));
  const exclude = rules.selection.avoidDuplicatesInStock
    ? buildExcludeSetFromStock(state)
    : new Set();

  const minorSlots = state.stock.filter(s => s.slot.startsWith("minor-") && (!s.cardId || !lockedIds.has(s.cardId)));
  const majorSlots = state.stock.filter(s => s.slot.startsWith("major-") && (!s.cardId || !lockedIds.has(s.cardId)));

  const minors = pickRandomDistinct(catalog.minors || [], minorSlots.length, exclude, rng);
  for (const m of minors) exclude.add(m.id);
  const majors = pickRandomDistinct(catalog.majors || [], majorSlots.length, exclude, rng);

  minors.forEach((c, i) => { minorSlots[i].cardId = c.id; minorSlots[i].lockedUntilRound = 0; });
  majors.forEach((c, i) => { majorSlots[i].cardId = c.id; majorSlots[i].lockedUntilRound = 0; });

  return true;
}

export function priceLabel(card, rules) {
  const p = priceFromCard(card, rules);
  return `${p} CP`;
}
