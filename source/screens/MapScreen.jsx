import React, { useState } from "react";
import PlayerMat from "../components/PlayerMat";
import ShopBar from "../components/ShopBar";
import {
  createInitialShop, refreshShop, endMapRound,
  lockSlot, buyCard, rerollShop
} from "../state/shopState";

export default function MapScreen() {
  const [players, setPlayers] = useState([
    { id: 1, name: "Player 1", cp: 3, color: "#7f1d1d" },
    { id: 2, name: "Player 2", cp: 3, color: "#1e3a8a" },
    { id: 3, name: "Player 3", cp: 3, color: "#166534" },
    { id: 4, name: "Player 4", cp: 3, color: "#92400e" }
  ]);

  const spendCP = (playerId, amount) => {
    const i = players.findIndex(p => p.id === playerId);
    if (i === -1) return false;
    if (players[i].cp < amount) return false;
    const next = players.slice();
    next[i] = { ...next[i], cp: next[i].cp - amount };
    setPlayers(next);
    return true;
  };

  const canAfford = (playerId, amount) => {
    const p = players.find(p => p.id === playerId);
    return !!p && p.cp >= amount;
  };

  const [shop, setShop] = useState(() => refreshShop(createInitialShop()));

  const onLock = (slotIndex) => {
    // For now, lock always charges Player 1 (you can change this to a selector later).
    if (!spendCP(players[0].id, 1)) return;
    setShop(prev => lockSlot(prev, slotIndex, () => true));
  };

  const onBuy = (slotIndex, payerId) => {
    const card = shop.slots[slotIndex]?.card;
    if (!card) return;
    if (!spendCP(payerId, card.energy)) return;
    setShop(prev => refreshShop(buyCard(prev, slotIndex)));
    // TODO: Add the card to payer's inventory
  };

  const onReroll = () => setShop(prev => refreshShop(rerollShop(prev)));
  const onEndRound = () => setShop(prev => endMapRound(prev));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top area: player mats in a grid (placeholder layout) */}
      <div className="max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {players.map(p => (
          <PlayerMat key={p.id} name={p.name} color={p.color} cp={p.cp} />
        ))}
      </div>

      {/* Center: world map placeholder */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
        <div className="h-64 rounded-2xl border border-slate-700 bg-slate-800/60 flex items-center justify-center">
          <span className="text-slate-300">World Map Placeholder</span>
        </div>
      </div>

      {/* Bottom: Shop bar */}
      <ShopBar
        shop={shop}
        onLock={onLock}
        onBuy={onBuy}
        onReroll={onReroll}
        canAfford={canAfford}
        players={players}
        phase="map"
      />

      {/* Controls */}
      <div className="max-w-7xl mx-auto w-full px-4 py-3">
        <button
          onClick={onEndRound}
          className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600"
        >
          End Map Round (decrement locks & refresh)
        </button>
      </div>
    </div>
  );
}
