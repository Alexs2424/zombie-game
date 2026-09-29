# Combat balance — current implementation

User-established requirements: at most two guns, Q/E switching, optional Mystery
Box pickups, increasing zombie health, and meaningful differences in gun power.
The values below are working tuning choices for playtesting, not historical
claims about real firearms. Art and period references remain in the weapon spec.

## Inventory and rewards

- Q previous / E next firearm. With two guns, either toggles between them. 1/2
  select the displayed gun slots. Wheel also cycles firearms. F interacts.
- A new gun fills the second slot or replaces the held firearm when full. If a
  melee tool is held, it replaces the most recently held firearm. Other gun ammo
  is preserved. Dropped ammo and upgrades do not remain owned. Duplicate guns
  refill their existing slot. Melee tools do not count toward the two-gun limit.
- Wall purchases, poker rewards, Last Service, development grants and the test
  range all use this rule. The range starts with pistol + shotgun.
- Mystery Box cost/chance remain 400 chips and 50% win. Reveal leaves the current
  gun and ammo unchanged. F takes the offer for no extra cost; X declines. Offers
  expire after 15 simulation seconds; pause freezes the timer. Taking a gun with
  full slots explicitly replaces the gun indicated in the current prompt.

## Round progression

For integer round r >= 1, health is 80 + 20(r - 1) through round 10. After round
10 it is round(260 × 1.12^(r - 10)). This removes the old 300 HP ceiling. Population,
movement speed and spawn cadence retain their existing progression. The test
range's round selector uses this same function for current and new targets.

## Weapon roles

Pistol is a dependable starter, not a late-game solution. SMG/machine pistol
trade damage per bullet for cadence; the machine pistol also has strong bloom.
Rifle and lever action favor accuracy, with the lever penetrating three targets.
Magnum/revolver give heavier individual hits with small magazines. Sniper has the
largest bullet hit and four-target penetration, offset by a slow 1.25 s cycle.
Shotguns reward close range and pellet coverage. LMG sustains fire at a movement
and reload penalty. Launcher trades scarce ammo and self-damage risk for area
hits. No gun automatically gains damage just because the round increased.

Head hits multiply bullet damage by 2. Standard upgrades multiply base damage by
1.35 (rounded per projectile), relics by 2; roulette temporarily multiplies damage
by 2. Spread, range falloff, pellet misses, reloads and penetration reduce practical
performance. The table below shows *unupgraded full-damage body-hit* thresholds,
not a guarantee of kills at every distance. Shotgun damage assumes all pellets hit;
launcher damage is its blast-center maximum and falls off with radius.

| Round | 1 | 5 | 10 | 15 | 20 | 30 |
| --- | --- | --- | --- | --- | --- | --- |
| Zombie HP | 80 | 160 | 260 | 458 | 808 | 2508 |

| Weapon | Damage / trigger | Shot interval | R1 hits | R10 hits | R20 hits |
| --- | --- | --- | --- | --- | --- |
| HOUSE SPECIAL | 34 | 0.22s | 3 | 8 | 24 |
| ROOM SERVICE | 192 (8 pellets) | 0.8s | 1 | 2 | 5 |
| DEALER’S CHOICE | 22 | 0.085s | 4 | 12 | 37 |
| PIT BOSS | 65 | 0.18s | 2 | 4 | 13 |
| THE DEAD MAN’S HAND | 110 | 0.5s | 1 | 3 | 8 |
| THE CHICAGO TYPEWRITER | 32 | 0.105s | 3 | 9 | 26 |
| HIGH ROLLER | 180 | 0.52s | 1 | 2 | 5 |
| DOUBLE OR NOTHING | 360 (10 pellets) | 0.2s | 1 | 1 | 3 |
| SNAKE EYES | 42 | 0.13s | 2 | 7 | 20 |
| THE ENFORCER | 19 | 0.055s | 5 | 14 | 43 |
| SILVER DOLLAR | 140 | 0.62s | 1 | 2 | 6 |
| LAST CALL | 192 (8 pellets) | 0.3s | 1 | 2 | 5 |
| THE EYE IN THE SKY | 420 | 1.25s | 1 | 1 | 2 |
| HOUSE EDGE | 55 | 0.11s | 2 | 5 | 15 |
| THE DEBT COLLECTOR | 420 | 1s | 1 | 1 | 2 |
