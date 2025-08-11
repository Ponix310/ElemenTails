import React from "react";

/**
 * Props:
 *  - shop: { slots:[{card,lockedRounds}...], rerollTokens }
 *  - onLock(slotIndex)
 *  - onBuy(slotIndex, payerId) -> should also deduct CP = card.energy
 *  - onReroll()
 *  - canAfford(payerId, cost) => bool
 *  - players: [{id, name, cp}, ...]  // to pick who pays
 *  - phase: "map" | "battle"        // hidden automatically in battle
 */
export default function ShopBar({
  shop,
  onLock,
  onBuy,
  onReroll,
  canAfford,
  players,
  phase = "map",
}) {
  if (phase !== "map") return null;

  const payers = players ?? [];

  return (
    <div className="w-full bg-amber-100/85 text-slate-900 border-t border-amber-300 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold">Shop</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              Reroll Tokens: <b>{shop.rerollTokens ?? 0}</b>
            </span>
            <button
              className="px-3 py-1 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              disabled={(shop.rerollTokens ?? 0) <= 0}
              onClick={onReroll}
            >
              Reroll Unlocked
            </button>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3">
          {shop.slots.map((slot, i) => {
            const c = slot.card;
            const locked = (slot.lockedRounds ?? 0) > 0;
            const isMinor = i < 4;

            return (
              <div
                key={i}
                className={`rounded-xl border p-2 bg-white/90 ${
                  locked ? "border-amber-500" : "border-slate-300"
                }`}
              >
                <div className="text-xs mb-1 uppercase tracking-wide opacity-70">
                  {isMinor ? "Minor Spell" : "Major Spell"}
                </div>

                {c ? (
                  <>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs opacity-70">{c.type}</div>

                    <div className="mt-1 text-sm">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border">
                        Cost: <b>{c.energy}</b>
                      </span>
                    </div>

                    {Array.isArray(c.mana) && c.mana.length > 0 && (
                      <div className="mt-1 text-lg">
                        {c.mana.join(" ")}
                      </div>
                    )}

                    <div className="mt-2 flex gap-1">
                      <select
                        className="text-sm border rounded px-1 py-0.5"
                        defaultValue={payers[0]?.id ?? ""}
                        id={`payer-${i}`}
                      >
                        {payers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (CP:{p.cp})
                          </option>
                        ))}
                      </select>
                      <button
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                        disabled={
                          payers.length === 0 ||
                          !canAfford(
                            Number(document.getElementById(`payer-${i}`)?.value ?? payers[0]?.id),
                            c.energy
                          )
                        }
                        onClick={() => {
                          const payerId = Number(
                            document.getElementById(`payer-${i}`)?.value ?? payers[0]?.id
                          );
                          onBuy(i, payerId);
                        }}
                      >
                        Buy
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="italic text-slate-500">— empty —</div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs">
                    {locked ? (
                      <span className="text-amber-700">Locked (1 round)</span>
                    ) : (
                      <span className="opacity-60">Unlocked</span>
                    )}
                  </div>
                  <button
                    className="px-2 py-1 rounded bg-amber-500 text-white text-sm"
                    onClick={() => onLock(i)}
                    title="Costs 1 CP from your chosen payer"
                  >
                    Lock (1 CP)
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-xs opacity-70">
          Lock costs a flat 1 CP per round. At end of round, locks expire and unlocked/empty slots refresh.
        </p>
      </div>
    </div>
  );
}
