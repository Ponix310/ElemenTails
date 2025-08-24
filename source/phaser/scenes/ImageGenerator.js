// Generate placeholder spell card images
export function generateSpellCardImages(scene, spellsData) {
  const cardWidth = 140;
  const cardHeight = 196; // 3.5:2.5 aspect ratio
  
  // Generate images for all spells
  Object.entries(spellsData.spells.minor || {}).forEach(([key, spell]) => {
    createSpellCardTexture(scene, key, spell, cardWidth, cardHeight, false);
  });
  
  Object.entries(spellsData.spells.major || {}).forEach(([key, spell]) => {
    createSpellCardTexture(scene, key, spell, cardWidth, cardHeight, true);
  });
}

function createSpellCardTexture(scene, key, spell, width, height, isMajor) {
  const texKey = `spell_${key}`;
  
  if (scene.textures.exists(texKey)) return;
  
  const canvas = scene.textures.createCanvas(texKey, width, height);
  const ctx = canvas.getContext();
  
  // Background gradient based on spell type
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (spell.type === 'Attack') {
    gradient.addColorStop(0, isMajor ? '#7f1d1d' : '#dc2626');
    gradient.addColorStop(1, isMajor ? '#450a0a' : '#991b1b');
  } else if (spell.type === 'Defense') {
    gradient.addColorStop(0, isMajor ? '#1e3a8a' : '#2563eb');
    gradient.addColorStop(1, isMajor ? '#0f172a' : '#1e40af');
  } else { // Utility
    gradient.addColorStop(0, isMajor ? '#166534' : '#16a34a');
    gradient.addColorStop(1, isMajor ? '#052e16' : '#15803d');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Border
  ctx.strokeStyle = isMajor ? '#fbbf24' : '#e5e7eb';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
  
  // Spell name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  const name = spell.name || key;
  wrapText(ctx, name, width / 2, 30, width - 20, 16);
  
  // Spell type
  ctx.fillStyle = '#d1d5db';
  ctx.font = '12px Arial';
  ctx.fillText(spell.type || '', width / 2, height - 60);
  
  // Energy cost
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(`${spell.energyCost || 2}`, width / 2, height - 20);
  
  // Elemental cost icons (simple colored circles)
  if (spell.cost) {
    const elements = Object.entries(spell.cost);
    const startX = (width - elements.length * 25) / 2;
    elements.forEach(([element, cost], i) => {
      const x = startX + i * 25;
      const y = height - 40;
      
      // Element color
      const colors = {
        fire: '#ef4444',
        water: '#3b82f6',
        plant: '#10b981',
        air: '#93c5fd',
        lightning: '#f59e0b',
        earth: '#92400e'
      };
      
      ctx.fillStyle = colors[element.toLowerCase()] || '#6b7280';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Cost number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(cost.toString(), x, y + 3);
    });
  }
  
  canvas.refresh();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
