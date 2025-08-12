
// source/state/init.js
(function(){
  // If Party Select later saves run data, it can store JSON here:
  // localStorage.setItem('etRunState', JSON.stringify({ players:[...], activeCharacterId:'...' }));
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('etRunState') || 'null'); } catch {}
  const fallback = {
    activeCharacterId: "p1",
    players: [
      { id:"p1", name:"Monk", className:"Monk", imageUrl:"images/monk.png", color:"red",
        stats:{hp:100, mana:40, energy:2, block:0, buffs:[], debuffs:[]},
        spells:[ {id:"s1", title:"Jab", iconUrl:"images/icons/jab.png"} ]
      },
      { id:"p2", name:"Archer", className:"Archer", imageUrl:"images/archer.png", color:"green",
        stats:{hp:90, mana:60, energy:1, block:0, buffs:[], debuffs:[]}, spells:[]
      },
      { id:"p3", name:"Samurai", className:"Samurai", imageUrl:"images/samurai.png", color:"blue",
        stats:{hp:110, mana:30, energy:3, block:0, buffs:[], debuffs:[]}, spells:[]
      },
      { id:"p4", name:"Warden", className:"Warden", imageUrl:"images/warden.png", color:"brown",
        stats:{hp:120, mana:25, energy:1, block:0, buffs:[], debuffs:[]}, spells:[]
      }
    ]
  };
  window.ET_STATE = saved || fallback;
})();
