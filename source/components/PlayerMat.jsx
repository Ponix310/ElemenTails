import React from "react";

/**
 * Props: { name, color, cp }
 */
export default function PlayerMat({ name, color = "#1e293b", cp = 0 }) {
  return (
    <div className="rounded-2xl p-3 text-white shadow-lg"
         style={{ background: color }}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold">{name}</h3>
        <div className="text-sm opacity-90">CP: <b>{cp}</b></div>
      </div>
    </div>
  );
}
