// source/state/shopState.js
// Lightweight shop state with flat 1 CP-per-round locks.
// Import into your Map screen and pass pieces to ShopBar / PlayerMats.
//
// Expects JSON catalogs at:
//   source/data/spells_minor.json
//   source/data/spells_major.json
//
// Functions exported:
// - createInitialShop()
// - refreshShop(shop)
// - endMapRound(shop)          // decrements locks, then refreshes
// - lockSlot(shop, slotIndex, spendCP)  // spendCP(amount) must return true if paid
// - buyCard(shop, slotIndex)
// - rerollShop(shop)
//
// Slots: 0–3 = Minor, 4–5 = Major. Locked slots persist exactly 1 round per payment.

import minor from "../data/spells_minor.json";
import major from "../data/spells_major.json";

const draw = (pool, n) => {
  const copy = [...pool];
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
};

export function createInitialShop() {
  return {
    rerollTokens: 0,
    // 6 slots: 0-3 = Minor, 4-5 = Major
    slots: [
      { card: null, lockedRounds: 0 },
      { card: null, lockedRounds: 0 },
      { card: null, lockedRounds: 0 },
      { card: null, lockedRounds: 0 },
      { card: null, lockedRounds: 0 },
      { card: null, lockedRounds: 0 },
    ],
    decks: {
      minor: [...minor],
      major: [...major],
    },
  };
}

export function refreshShop(shop) {
  // Fill empty & unlocked slots (0–3 minor, 4–5 major)
  const next = structuredClone(shop);
  for (let i = 0; i < next.slots.length; i++) {
    const s = next.slots[i];
    const isMinor = i < 4;
    if (s.lockedRounds > 0) continue; // keep exactly as-is
    if (!s.card) {
      const pool = isMinor ? next.decks.minor : next.decks.major;
      const pick = draw(pool, 1)[0] || null;
      s.card = pick;
    }
  }
  return next;
}

export function endMapRound(shop) {
  // Decrement locks and refresh any that are now free.
  const next = structuredClone(shop);
  next.slots.forEach((s) => { s.lockedRounds = Math.max(0, (s.lockedRounds || 0) - 1); });
  return refreshShop(next);
}

export function lockSlot(shop, slotIndex, spendCP) {
  // spendCP(amount) should deduct from whichever player you choose
  if (!spendCP(1)) return shop; // not enough CP
  const next = structuredClone(shop);
  next.slots[slotIndex].lockedRounds = 1; // flat 1 round
  return next;
}

export function buyCard(shop, slotIndex) {
  const next = structuredClone(shop);
  // Buying a locked card removes the lock (card leaves).
  next.slots[slotIndex] = { card: null, lockedRounds: 0 };
  return next;
}

export function rerollShop(shop) {
  if (shop.rerollTokens <= 0) return shop;
  const next = structuredClone(shop);
  next.rerollTokens -= 1;
  // Reroll only *unlocked* slots
  for (let i = 0; i < next.slots.length; i++) {
    if (next.slots[i].lockedRounds > 0) continue;
    next.slots[i].card = null;
  }
  return refreshShop(next);
}
