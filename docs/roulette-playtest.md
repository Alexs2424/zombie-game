# Lucky Four roulette — validation

September 27, 2026. Branch: `codex/roulette-rewards`.

## Rules

Every spin costs 200 chips, paid once at the start. A uniform 0–36 draw determines the six-second spin. 4/24 refill the gun equipped when the ball lands; 7 refills every owned gun; 0 refills every owned gun and grants 2× damage for 30 gameplay seconds. Other numbers award nothing, with no second deduction. Wins do not refund the entry fee.

## Automated verification

- `npm test`: 58 passing checks: 34 core simulation, 15 roulette rules, six motion, and three audio checks.
- Roulette coverage includes all 37 outcomes, exact payment and duplicate-input guards, distance/room/phase/balance gates, weapon ownership, upgraded magazines, reload cancellation, changing weapons during a spin, repeat spins, pause/shop/death freezing, jackpot refresh/expiry, doubled body-shot damage, and fresh-run resets.
- Motion tests compare all 37 pockets against Babylon's actual Y-rotation transform and the shipped GLB's pivots/sequence. They also check counter-rotation, deceleration, ball drop, repeated spins, held results, and run resets.
- `npm run typecheck`, `npm run build`, and `git diff --check` pass. The build retains existing Vinext dynamic-import and route-classification notices.

## Chrome checks

Used the visible development controls at `/?playtest=1` on the local Mac. Forced outcomes use a successful, paid purchase before selecting a repeatable test number. This was a controlled interaction and visual check, not a full mouse-captured survival run.

- 4 visibly settled in pocket 4 and refilled the pistol to 12/84. 24 settled in pocket 24 and refilled the rifle to 24/120 after switching weapons during the spin.
- 7 refilled every owned weapon; switching guns showed pistol 12/84, shotgun 6/30, SMG 30/180, and rifle 24/120.
- 0 visibly settled in the green zero pocket, refilled ammo, and displayed the double-damage badge. Pausing and resuming preserved the displayed 27-second countdown. The development expiry control removed the badge; the full timer and damage restoration are covered by simulation tests.
- A paused spin remained unresolved until gameplay resumed. Pressing the interaction control again during a spin did not charge another 200 chips.
- A miss settled in pocket 13, displayed “THE HOUSE HOLDS,” preserved depleted ammo, and retained the balance after the initial 200-chip deduction.
- The ordinary interaction action started a fresh paid spin at the table. Number display stayed hidden until resolution.
- Inspected wheel and ball placement, north-wall rules, and result cards. Fixed an inherited `.ammo` CSS collision discovered on the 4/24 result; the finished card is fully readable. Craps and roulette cards stack without colliding with the round-start announcement.
- Chrome reported no console errors or warnings during the checks. The extra QA tab was closed afterward.

Audio tests cover scheduling, routing, and lifecycle; subjective sound quality and longer survival balance still need a listening/gameplay pass.
