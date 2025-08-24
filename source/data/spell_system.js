// Spell System for ElemenTails
export class SpellSystem {
  constructor(scene) {
    this.scene = scene;
    this.spellsData = null;
  }

  async loadSpells() {
    if (this.spellsData) return;
    try {
      const response = await fetch('source/data/spells.json');
      this.spellsData = await response.json();
    } catch (error) {
      console.error('Failed to load spells:', error);
      this.spellsData = { spells: { minor: {}, major: {} } };
    }
  }

  getSpell(key, tier = 'minor') {
    if (!this.spellsData) return null;
    return this.spellsData.spells[tier]?.[key] || null;
  }

  canCastSpell(caster, spellKey, tier = 'minor') {
    const spell = this.getSpell(spellKey, tier);
    if (!spell) return { canCast: false, reason: 'Spell not found' };

    // Check energy cost
    const energyPool = caster.energyPool || { A: 0, D: 0, U: 0, E: 0 };
    const requiredEnergy = spell.energyCost || 0;
    
    // Calculate total available energy
    const totalEnergy = energyPool.A + energyPool.D + energyPool.U + energyPool.E;
    if (totalEnergy < requiredEnergy) {
      return { canCast: false, reason: `Need ${requiredEnergy} energy, have ${totalEnergy}` };
    }

    // Check elemental mana costs
    const elementsMana = caster.elementsMana || {};
    const spellCost = spell.cost || {};
    
    for (const [element, cost] of Object.entries(spellCost)) {
      const available = elementsMana[element] || 0;
      if (available < cost) {
        return { canCast: false, reason: `Need ${cost} ${element} mana, have ${available}` };
      }
    }

    return { canCast: true };
  }

  castSpell(caster, spellKey, tier = 'minor', target = null) {
    const canCast = this.canCastSpell(caster, spellKey, tier);
    if (!canCast.canCast) {
      console.log(`Cannot cast ${spellKey}: ${canCast.reason}`);
      return { success: false, reason: canCast.reason };
    }

    const spell = this.getSpell(spellKey, tier);
    
    // Consume resources
    this.consumeSpellCosts(caster, spell);
    
    // Apply spell effects
    const result = this.applySpellEffects(caster, spell, target);
    
    console.log(`${caster.heroName} cast ${spell.name}!`);
    return { success: true, result };
  }

  consumeSpellCosts(caster, spell) {
    // Consume elemental mana
    const spellCost = spell.cost || {};
    for (const [element, cost] of Object.entries(spellCost)) {
      caster.elementsMana[element] = Math.max(0, (caster.elementsMana[element] || 0) - cost);
    }

    // Consume energy (prioritize by spell type)
    const energyCost = spell.energyCost || 0;
    let remaining = energyCost;
    
    // Attack spells use Attack energy first, Defense spells use Defense first, etc.
    const priority = spell.type === 'Attack' ? ['A', 'D', 'U', 'E'] :
                    spell.type === 'Defense' ? ['D', 'A', 'U', 'E'] :
                    ['U', 'A', 'D', 'E']; // Utility

    for (const energyType of priority) {
      if (remaining <= 0) break;
      const available = caster.energyPool[energyType] || 0;
      const consumed = Math.min(available, remaining);
      caster.energyPool[energyType] -= consumed;
      remaining -= consumed;
    }
  }

  applySpellEffects(caster, spell, target) {
    const effects = [];
    
    // Parse main effect
    if (spell.effect) {
      effects.push(...this.parseEffect(spell.effect, caster, target));
    }
    
    // Parse secondary effect
    if (spell.effect2) {
      effects.push(...this.parseEffect(spell.effect2, caster, target));
    }

    return effects;
  }

  parseEffect(effectText, caster, target) {
    const effects = [];
    
    // Damage effects
    if (effectText.includes('Deal') && effectText.includes('damage')) {
      const damageMatch = effectText.match(/Deal (\d+) .*?damage/i);
      if (damageMatch) {
        const damage = parseInt(damageMatch[1]);
        effects.push({ type: 'damage', amount: damage, target: target || 'enemy' });
      }
    }

    // Shield effects
    if (effectText.includes('Gain') && effectText.includes('Shield')) {
      const shieldMatch = effectText.match(/Gain (\d+) Shield/i);
      if (shieldMatch) {
        const shield = parseInt(shieldMatch[1]);
        effects.push({ type: 'shield', amount: shield, target: caster });
      }
    }

    // Mana generation effects
    if (effectText.includes('Renew')) {
      const renewMatch = effectText.match(/(\d+) Renew/i);
      if (renewMatch) {
        const renew = parseInt(renewMatch[1]);
        effects.push({ type: 'mana_regen', amount: renew, target: target || caster });
      }
    }

    // Status effects
    if (effectText.includes('Burn')) {
      const burnMatch = effectText.match(/(\d+) Burn/i);
      if (burnMatch) {
        const burn = parseInt(burnMatch[1]);
        effects.push({ type: 'status', status: 'burn', stacks: burn, target: target || 'enemy' });
      }
    }

    if (effectText.includes('Inspired')) {
      const inspiredMatch = effectText.match(/(\d+) Inspired/i);
      if (inspiredMatch) {
        const inspired = parseInt(inspiredMatch[1]);
        effects.push({ type: 'status', status: 'inspired', stacks: inspired, target: target || caster });
      }
    }

    // Movement effects
    if (effectText.includes('Move')) {
      const moveMatch = effectText.match(/Move (\d+)/i);
      if (moveMatch) {
        const move = parseInt(moveMatch[1]);
        effects.push({ type: 'movement', amount: move, target: caster });
      }
    }

    if (effectText.includes('Push')) {
      const pushMatch = effectText.match(/Push (\d+)/i);
      if (pushMatch) {
        const push = parseInt(pushMatch[1]);
        effects.push({ type: 'push', amount: push, target: target || 'enemy' });
      }
    }

    return effects;
  }

  // Generate mana at start of turn based on character's elements
  generateMana(character) {
    const elements = character.elements || [];
    const manaGain = {};
    
    // Primary element generates 2 mana, secondary generates 1
    if (elements[0]) {
      manaGain[elements[0]] = (manaGain[elements[0]] || 0) + 2;
    }
    if (elements[1] && elements[1] !== elements[0]) {
      manaGain[elements[1]] = (manaGain[elements[1]] || 0) + 1;
    }

    // Apply mana generation
    for (const [element, amount] of Object.entries(manaGain)) {
      character.elementsMana[element] = (character.elementsMana[element] || 0) + amount;
    }

    return manaGain;
  }
}
