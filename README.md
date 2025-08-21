# ElemenTails

A tactical RPG where players cleanse corruption from the forest using elemental magic and legendary weapons.

## Game Features

- **6 Heroes** with unique elemental affinities (Fox, Frog, Rabbit, Raven, Wolf, Bear)
- **18 Classes** formed by Hero + Weapon combinations
- **Tactical Combat** with enemy intentions and corruption system
- **Elemental Dice** system for strategic resource management
- **Party Formation** with 4 random legendary weapons per run

## How to Play

1. **Party Selection**: Receive 4 random legendary weapons from the Sun Dragon
2. **Form Your Party**: Assign heroes to weapons to create unique classes
3. **Combat**: Use tactical turn-based combat with elemental advantages
4. **Cleanse Corruption**: Reduce enemy corruption to 0 to cleanse them

## Development

### Local Development
```bash
# Start local server (Windows)
powershell -ExecutionPolicy Bypass -File start-server.ps1

# Or use Python if available
python serve.py
```

### Live Version
Play at: https://ponix310.github.io/ElemenTails

## Game Rules

See `ElemenTails_Master_Rules_Download.md` for complete game mechanics and rules.

## Tech Stack

- **Phaser.js** - Game engine
- **Firebase** - Backend services (auth, database)
- **GitHub Pages** - Hosting and deployment
