# Arsenal reference

Current repository snapshot: 2026-09-29. This document consolidates the roster and snapshots current base tuning; [combat balance](combat-balance.md) owns progression and balancing rules. [Period art specification](weapon-spec-1970s.md) owns visual intent; [gun audio](gun-audio/README.md) owns sound production. Recheck runtime sources when balance changes.

## Direction and status

**User-established:** most guns should sound authentic and cool; only one or two should be humorous. **Working selection:** Thompson and launcher, with comedy on one take each. B heavy action is the selected foundation. The generated sounds aim for believable texture; they are not authenticated firearm recordings.

There are 16 firearm report banks, two melee weapons, and one partially integrated flare-pistol definition. High Roller is `magnum`; `revolver` is the separate poker reward Dead Man’s Hand.

## Verified base tuning

Read from `WEAPONS` in `lib/game/simulation.ts` and `lib/game/weapon-expansion.ts`. Damage is per pellet; projectile damage is an effect input, not guaranteed damage to every target. Lever/auto-shotgun reload time is per cartridge/shell. Interval is a code cooldown, not a claim about trigger mode.

| ID | Name | Magazine / reserve | Damage × pellets | Interval (s) | Reload (s) | Spread (rad) |
| --- | --- | --- | --- | --- | --- | --- |
| `magnum` | HIGH ROLLER | 6 / 48 | 180 × 1 | 0.52 | 2.9 | 0.003 |
| `tommy` | THE CHICAGO TYPEWRITER | 50 / 250 | 32 × 1 | 0.105 | 3 | 0.017 |
| `doublebarrel` | DOUBLE OR NOTHING | 2 / 40 | 36 × 10 | 0.2 | 2.4 | 0.085 |
| `dual` | SNAKE EYES | 16 / 128 | 42 × 1 | 0.13 | 3.1 | 0.028 |
| `machinepistol` | THE ENFORCER | 32 / 192 | 19 × 1 | 0.055 | 2.1 | 0.03 |
| `lever` | SILVER DOLLAR | 8 / 64 | 140 × 1 | 0.62 | 0.55 | 0.003 |
| `autoshotgun` | LAST CALL | 5 / 40 | 24 × 8 | 0.3 | 0.6 | 0.05 |
| `sniper` | THE EYE IN THE SKY | 5 / 35 | 420 × 1 | 1.25 | 3.2 | 0.0008 |
| `lmg` | HOUSE EDGE | 60 / 240 | 55 × 1 | 0.11 | 5.2 | 0.016 |
| `launcher` | THE DEBT COLLECTOR | 1 / 8 | 420 × 1 | 1 | 2.8 | 0.01 |
| `flare` | RED CARPET | 1 / 12 | 140 × 1 | 0.9 | 2.2 | 0.012 |
| `axe` | FIRE EXIT | 1 / 0 | 260 × 1 | 1.35 | 0 | 0 |
| `stick` | STICKMAN | 3 / 0 | 350 × 1 | 0.8 | 0 | 0 |
| `pistol` | HOUSE SPECIAL | 12 / 84 | 34 × 1 | 0.22 | 1.5 | 0.004 |
| `shotgun` | ROOM SERVICE | 6 / 30 | 24 × 8 | 0.8 | 2.5 | 0.07 |
| `smg` | DEALER’S CHOICE | 30 / 180 | 22 × 1 | 0.085 | 1.9 | 0.013 |
| `rifle` | PIT BOSS | 24 / 120 | 65 × 1 | 0.18 | 2.4 | 0.007 |
| `revolver` | THE DEAD MAN’S HAND | 6 / 48 | 110 × 1 | 0.5 | 2.6 | 0.003 |

## Weapon details

### HIGH ROLLER (`magnum`)

**Type:** Magnum. **Upgrade name:** DIAMOND SIX.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Six precise, heavy shots. Aim for the head and mind the kick.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Distinct B magnum pressure crack; no register bell.

### THE CHICAGO TYPEWRITER (`tommy`)

**Type:** Drum SMG. **Upgrade name:** THE HOUSE COLLECTOR.

**Acquisition/status:** Hotel reward or Mystery Box.

**Role:** Fifty-round drum from the old owners. Heavy, loud, hungry.

**Handling:** movement multiplier 0.9; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Low .45 chatter; take three adds a short typewriter-carriage friction zip.

### DOUBLE OR NOTHING (`doublebarrel`)

**Type:** Double barrel. **Upgrade name:** ALL IN.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Two barrels, one decision. Alt-fire bets both.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### SNAKE EYES (`dual`)

**Type:** Twin pistols. **Upgrade name:** PAIR OF ACES.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** A pair of card-cheat pocket pistols, fired in turn.

**Handling:** movement multiplier 1.08; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### THE ENFORCER (`machinepistol`)

**Type:** Machine pistol. **Upgrade name:** COLLECTION NOTICE.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Fastest gun in the house and the least precise. Arm's length only.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### SILVER DOLLAR (`lever`)

**Type:** Lever action. **Upgrade name:** STERLING STANDARD.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Punches through three in a line. Lever between every shot.

**Handling:** movement multiplier 1; penetration limit 3 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Distinct B rifle report and existing lever cues; no coin bounce.

### LAST CALL (`autoshotgun`)

**Type:** Auto shotgun. **Upgrade name:** CLOSING TIME.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Five quick shells, loaded one at a time; fire whenever you like.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### THE EYE IN THE SKY (`sniper`)

**Type:** Bolt action. **Upgrade name:** OMNISCIENT.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Surplus bolt-action with a 4x tube. Four targets deep.

**Handling:** movement multiplier 1; penetration limit 4 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### HOUSE EDGE (`lmg`)

**Type:** LMG. **Upgrade name:** THE HOUSE ALWAYS COLLECTS.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** Belt-fed suppression. Staggers the crowd, slows your feet.

**Handling:** movement multiplier 0.78; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### THE DEBT COLLECTOR (`launcher`)

**Type:** Grenade launcher. **Upgrade name:** FINAL NOTICE.

**Acquisition/status:** Mystery Box firearm reward.

**Role:** One 40 mm round. Clears a crowd and does not care who.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Hollow discharge; take three adds a breathy oversized cork pop. No pitched boing.

### RED CARPET (`flare`)

**Type:** Flare pistol. **Upgrade name:** INFERNO LOUNGE.

**Acquisition/status:** Partial integration: defined projectile/fire behavior, included in WEAPON_ORDER through EXTRA_WEAPONS, but absent from the Mystery Box; no normal acquisition route verified.

**Role:** Flare projectile creates a four-second fire patch; not an obtainable, fully integrated weapon.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Dedicated B-style primer pop, launch puff and hiss; three report takes are wired. Acquisition remains unverified.

### FIRE EXIT (`axe`)

**Type:** Fire axe. **Upgrade name:** EVACUATION NOTICE.

**Acquisition/status:** Supply-room fire cabinet.

**Role:** From the fire cabinet by the exit. Slow, heavy, never breaks.

**Handling:** movement multiplier 0.92; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** New heavy air swing and crunchy chop impact takes.

### STICKMAN (`stick`)

**Type:** Craps rake. **Upgrade name:** STICKMAN.

**Acquisition/status:** Special pickup beside craps.

**Role:** The stickman's rake. Three solid sweeps before it snaps.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Established A/D cane swipes; newly generated woody impact takes; existing break.

### HOUSE SPECIAL (`pistol`)

**Type:** Pistol. **Upgrade name:** LOADED DICE.

**Acquisition/status:** Starting weapon.

**Role:** The house sidearm. Reliable, forgiving, always in reach.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 150 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### ROOM SERVICE (`shotgun`)

**Type:** Shotgun. **Upgrade name:** HOUSE SWEEPER.

**Acquisition/status:** Wall purchase: 800 points.

**Role:** Pump-action room service. Clears a doorway.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 300 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### DEALER’S CHOICE (`smg`)

**Type:** SMG. **Upgrade name:** FULL HOUSE.

**Acquisition/status:** Wall purchase: 1,100 points.

**Role:** The dealer's choice when the floor gets crowded.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 400 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### PIT BOSS (`rifle`)

**Type:** Rifle. **Upgrade name:** ROYAL FLUSH.

**Acquisition/status:** Wall purchase: 1,600 points.

**Role:** Pit boss issue. Steady, hard-hitting, patient.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 500 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

### THE DEAD MAN’S HAND (`revolver`)

**Type:** Revolver. **Upgrade name:** ACE OF SPADES.

**Acquisition/status:** Flush-poker reward.

**Role:** Won at the table. Six chambers of pure spite.

**Handling:** movement multiplier 1; penetration limit 1 for hitscan weapons. Base reserve refill parameter: 400 points, subject to shop/reward availability.

**Sound:** Selected B heavy-action report with three subtly varied takes; no comic layer. Existing handling cues retained.

## Shared implemented rules

- Upgrades multiply base damage by 1.35, rounded; relics use ×2 instead. Temporary roulette damage bonuses apply afterward.
- Upgrades multiply magazine size by 1.5, rounded, except the poker revolver stays at six and melee capacity is unchanged.
- Quick Pour multiplies reload time by 0.7; the upgraded poker revolver also applies ×0.75.
- Aimed single-projectile spread starts at 35% of base plus bloom. Pellet weapons retain their base spread.
- Hitscan head hits receive ×2 damage. Successive penetrated enemies receive another ×0.75. Pellet falloff begins past eight metres and bottoms at 40%.
- Double-barrel alternate fire consumes up to two shells and scales pellet count accordingly.
- Lever and auto shotgun load one round at a time; firing interrupts reload.
- LMG hits extend enemy attack cooldown to at least 0.4 seconds.
- Normal upgrades exclude melee; melee upgrade names in the data are not proof of obtainable upgrades.

## Assets and owning sources

- [Original four models](weapon-models.md): dimensions, named parts and generation.
- [1970s art specification](weapon-spec-1970s.md): silhouettes, materials and historical gameplay targets. Current tuning is above.
- [Expanded asset audit](weapon-1970s-assets/README.md): model previews and authoring evidence.
- [Gun audio](gun-audio/README.md): sound direction, exact prompts, provenance and previews.
- `lib/game/weapon-viewmodels.ts`: collectible action/reload cue timing.
- `lib/game/weapon-audio.ts`: sample loading, take selection, panning and fallback.

## Open work

B heavy action is user-selected and now covers every firearm definition. New individual clips still need in-game listening. Flare-pistol acquisition and visual presentation need separate integration. No weapon balance was changed in this pass.
