# Mystery Box Weapon Specification — 1970s Casino Set

## Purpose and visual rule

This document is the handoff specification for the next weapon-art and gameplay pass. The setting is a privately owned casino in the late 1970s. Every weapon should look like something that could have been bought, inherited, confiscated, or hidden in that building between roughly 1968 and 1979. The names below are fictional in-game names; do not copy a real manufacturer's logo, serial-marking system, or distinctive trade dress.

The shared visual language is **used blued steel, walnut, Bakelite, parkerized military finish, aged brass, and oxblood leather**. Surfaces should show honest wear at grip points, sling loops, magazine wells, and sharp edges. Avoid modern Picatinny rails, optics with illuminated reticles, polymer frames, carbon-fiber parts, suppressors, laser pointers, tactical lights, M-LOK slots, and post-1980 styling. A small casino detail is welcome on each piece (engraved suit mark, house inventory tag, inlaid coin, or discreet brass plaque), but it must remain a working object rather than a novelty prop.

All firearm models should be authored as fictional, period-inspired silhouettes in Blender. Use named parts for the receiver, barrel, grip or stock, trigger, magazine or cylinder, action, sights, and any moving component. Keep the muzzle along local +Z, the origin at the receiver, and the scale in metres so the renderer can use the same first-person placement and action animation as the existing four guns.

## Mystery Box roster

The box may award the ten firearms below. The **Stickman** is a separate special pickup beside the craps table and is not a random firearm reward. **Fire Exit** is an optional melee addition if the engineering pass wants a second close-range special; it should not displace Stickman.

| ID | House name | Period basis | Combat identity |
| --- | --- | --- | --- |
| `revolver` | High Roller | Large-frame double-action magnum revolver | Six precise, high-damage shots; punishing recoil and reload |
| `tommy` | Chicago Typewriter | 1920s drum SMG still plausible as mob or collector stock in the 70s | Large-volume crowd control; heavy and slow to replenish |
| `doublebarrel` | Double or Nothing | Short side-by-side coach shotgun | Two close-range blasts; alternate fire discharges both barrels |
| `dual` | Snake Eyes | Pair of compact .25/.32-style pocket pistols | Very mobile alternating fire; poor range and paired reload |
| `machinepistol` | The Enforcer | Early-70s stamped machine pistol with wire stock | Fast automatic fire; high spread and ammunition consumption |
| `lever` | Silver Dollar | Western lever-action rifle retained as a casino trophy or ranch gun | Accurate, penetrating follow-up shots; cartridge-by-cartridge load |
| `autoshotgun` | Last Call | 1970s semiautomatic hunting shotgun | Quick close-range follow-ups; small tube and tight timing |
| `sniper` | Eye in the Sky | Military-surplus bolt-action rifle with simple fixed scope | Long-range precision and deep penetration; slow bolt cycle |
| `lmg` | House Edge | Belt-fed or top-box-fed light machine gun in a 1970s security/military configuration | Sustained suppression and stagger; slow movement and very long reload |
| `launcher` | Debt Collector | Single-shot break-open 40 mm-style grenade launcher | Rare explosive crowd clear; scarce ammunition and splash danger |

## Detailed firearm specifications

### High Roller (`revolver`)

Large, six-shot double-action revolver with a 6-inch heavy barrel, exposed hammer, checkered walnut or ivory-colored grip panels, and a blued or deep nickel finish. The cylinder should visibly swing out for reloads. Engrave a tiny four-suit mark on the side plate and a worn brass house plaque on the grip frame. It should read as an expensive private sidearm, not a police service pistol.

Gameplay target: highest single-shot firearm damage, reliable hip-fire accuracy, six-round capacity, strong camera kick, and a deliberate cylinder reload. Headshots are its reason to exist. The reload animation should open the cylinder, eject brass, and close with a hard mechanical snap; no detachable magazine.

Sound: dry double-action click, sharp magnum crack, short metallic ring from the cylinder, and six distinct brass impacts during a full reload. Keep the report bright and close rather than cinematic.

### Chicago Typewriter (`tommy`)

Fictional drum-fed submachine gun with a blued receiver, ribbed cooling shroud, walnut pistol grip and foregrip, and a compact shoulder stock. The drum is a thick, dark steel disc with a brass witness mark. It may be an old gangster weapon stored by the casino's previous owners; it must look maintained enough to run but too old to be comfortable.

Gameplay target: 50-round drum, very high sustained fire, moderate damage, noticeable walk-speed penalty, and a long drum change. The drum should visibly rotate or jostle while firing. Accuracy should deteriorate during a held trigger, encouraging short bursts at the edge of the crowd.

Sound: low, fast mechanical chatter with a heavy receiver clack under it. Drum insertion is a hollow steel thump; the bolt pull is longer and heavier than the existing SMG.

### Double or Nothing (`doublebarrel`)

Short side-by-side shotgun with a dark walnut stock, engraved receiver, exposed hammers or a simple enclosed hammer profile, and a brass bead sight. The barrels should be visibly separate all the way to the muzzle. Use worn silver engraving sparingly: a pair of dice or a split-suit mark is enough.

Gameplay target: two shells, wide close-range spread, high pellet count, and a very short delay between the two barrels. Primary fire spends one shell; alternate fire spends both and creates one broad, high-risk blast. Break-open reload should show both chambers and two shells. No tubular magazine.

Sound: two distinct booms with a short stereo difference between barrels, followed by a wooden fore-end creak and a brass breech snap. The alternate blast should be louder but still recognisably the same weapon.

### Snake Eyes (`dual`)

Two small pocket pistols with mismatched finishes: one worn nickel, one blued steel. Give both compact Bakelite or pearl-colored grips, but avoid making them identical. They can be tucked into a card cheat's vest; the silhouette should be visibly smaller than the House Special pistol.

Gameplay target: fast alternating shots, 16 combined rounds, good movement speed, weak damage and poor long-range accuracy. Fire left and right in sequence rather than creating an implausible simultaneous volley. Reload should lower both pistols and refill them as a pair.

Sound: two slightly different compact pistol reports panned a little left and right, with separate slide clicks. Do not use the same sample as House Special at a higher pitch.

### The Enforcer (`machinepistol`)

Compact stamped-steel machine pistol with a short barrel, slab-sided receiver, ribbed Bakelite grip, selector lever, and folding wire stock. The stock may remain folded in first person. The design should feel like a 1970s security or smuggling weapon, not a modern personal-defense weapon.

Gameplay target: smallest automatic interval in the set, 32-round magazine, low per-shot damage, substantial muzzle climb, and the poorest automatic accuracy. It should be useful in a panic at arm's length, not a precision choice. The magazine is a narrow detachable box with a sharp insertion click.

Sound: high mechanical rate, thin but forceful report, and a prominent cyclic rattle. The firing sound should communicate speed through rhythm and bolt noise rather than excessive bass.

### Silver Dollar (`lever`)

Lever-action rifle with an octagonal or round blued barrel, brass or case-hardened receiver, walnut stock, tubular magazine, and a small silver coin inset into the buttstock. The lever loop must be large enough to read in animation. Use a simple blade-and-notch sight; no scope.

Gameplay target: eight rounds loaded one cartridge at a time, accurate shots, strong body damage, and penetration through up to three lined-up enemies. The lever cycle is the signature: after every shot the receiver and hand move through a visible down-and-forward arc. Reload may be interrupted by firing.

Sound: crisp rifle report, pronounced lever clack, springy tubular-magazine loading sound, and a wood-and-metal stock resonance. The action should be more tactile than loud.

### Last Call (`autoshotgun`)

1970s semiautomatic hunting shotgun with a five-shell tubular magazine, walnut fore-end, vent rib, and oxblood recoil pad. It should be cleaner and more modern-looking than Room Service while still belonging to the same decade. Add a small stamped “BAR” or “HOUSE” inventory tag, never a real brand.

Gameplay target: five shells, tighter spread than Double or Nothing, lower per-pellet damage, and rapid follow-up shots. Reload one shell at a time through the loading port; the player may fire before the tube is full. The action should cycle automatically after each shot.

Sound: softer semiautomatic cycling layered under a broad shotgun report. Shell insertion should be a repeated brass-and-plastic click, with a distinct final bolt closure.

### Eye in the Sky (`sniper`)

Military-surplus bolt-action rifle with a wood stock, leather sling, simple fixed 3x or 4x scope, and a scratched inventory number. The scope is a period tube with external adjustment caps and no illuminated reticle, rangefinder, or modern mounting rail. Keep the optic readable but avoid adding an aim-down-sights system unless the game already supports one.

Gameplay target: five-round internal magazine, lowest spread, very high damage, and penetration through four lined-up enemies. Its bolt cycle should impose the longest shot-to-shot delay of the firearms. The player must commit to a target and reposition rather than spray.

Sound: dry bolt lift and throw, restrained rifle crack, and a long wooden resonance. The scope should not add a digital beep or modern hit-confirmation sound.

### House Edge (`lmg`)

Heavy light machine gun inspired by 1970s military and casino-security surplus: stamped receiver, perforated barrel shroud, wooden or dark polymerized furniture, bipod folded under the handguard, and a top-mounted box or short belt feed. Use a fictional house inventory stencil and a brass serial plaque. Keep the profile broad and weighty; this is visibly heavier than Pit Boss.

Gameplay target: 60-round box or belt, 240-round reserve, strong stagger, sustained fire, and a 22% movement penalty while equipped. It should have moderate spread that grows during continuous fire. The reload is the longest firearm reload: remove the box, expose the feed, seat the new box, and rack the charging handle. It must feel powerful because of control and volume, not because every bullet is a one-shot.

Sound: deep, regular automatic report with an obvious metallic feed rhythm. Add a short belt/feed clatter at the end of a magazine and a heavy charging-handle slam on reload. Avoid the exaggerated modern “minigun” sound.

### Debt Collector (`launcher`)

Single-shot break-open launcher with wood or blackened-steel furniture, a thick short barrel, simple ladder or bead sight, and a worn military inventory stencil. It is a suspicious basement find, not a sleek modern tactical launcher. The breech hinge and latch must be visible.

Gameplay target: one round loaded, eight-round reserve, slow reload, and a projectile that detonates on impact or after a short fuse. Explosion damage falls off with distance and can hurt the player. The muzzle is low and heavy; firing should create a visible recoil shove but no automatic follow-up.

Sound: hollow low-frequency thump, brief projectile flight hiss, and a concussive room-filling blast. Reload is mostly latch, hinge, shell, and latch: four readable mechanical beats.

## Special weapons

### Stickman craps rake (`stick`)

The prop is the long wooden or lacquered craps stick used by a stickperson to move chips and dice. Place it on a small brass hook or against the craps table at approximately hand height, with the rake head pointing toward the felt. The handle is dark polished wood; the head is aged brass or nickel-plated steel with three blunt rounded teeth. It must look like casino equipment first and a weapon only after the player picks it up.

Gameplay contract: this is a melee-only pickup beside the craps table. It survives **three successful hits**, not three swings. Each successful hit consumes one durability point and can damage every zombie in a forward fan roughly 2.8 m long and 100 degrees wide. A swing that hits nothing consumes no durability. On the third successful hit, play the break effect and immediately return the player to the last owned firearm. It has no ammo, cannot be upgraded, and cannot be awarded by the mystery box.

Animation and sound: the player sweeps from low right to high left, with a visible brass head arc. Use a woody whoosh, multiple blunt impacts for multi-zombie contact, and a sharp wooden crack plus brass rattle on the final hit. Do not use a sword clang or a modern melee foley. The pickup message should explicitly show `3 SWEEPS` so the limited life is legible.

### Fire Exit axe (`axe`, optional)

Short red-painted fire axe with a black forged head, worn yellow safety label, and a chipped hardwood handle. It belongs beside an emergency exit or fire cabinet and should be visibly heavier than a knife. The label may use fictional house lettering; do not reproduce a real fire department mark.

Gameplay target: very slow single-target or narrow-cone melee strike with high damage. Unlike Stickman, it does not break after three hits, but it should have a long recovery and prevent firearm use during the swing. Use it only if the level needs a second special pickup; the craps-rake rule remains the featured casino interaction.

## Blender deliverables

For each ID, deliver one `.blend` source and one exported `.glb` in `public/models/`. The source scene should contain a collection named after the weapon, a neutral studio camera, a three-quarter preview render, and named nodes for every animated part. Apply transforms, preserve explicit normals, and keep meshes watertight where practical. Use separate materials for steel, wood, Bakelite, brass, rubber, and any inlaid casino detail.

The first-person asset should have its grip and sight line aligned to the existing hand assets. A display version may share geometry but should be instanced separately so it can be mounted on the mystery-box or wall rack. Stickman needs a world pickup mesh at the craps table plus a first-person mesh; it does not need a firearm magazine node.

## Sound deliverables

Create original synthesized or recorded foley under `public/audio/weapons/`, with source notes in the same asset folder. Every firearm needs: `fire`, `dry`, `reload-start`, `reload-loop` if applicable, `reload-end`, and `pickup`. Special weapons need `swing`, `impact`, and `break` where applicable. Mix for the existing casino reverb: short, warm room reflections, no contemporary trailer booms, and no recognizable commercial weapon sample.

The runtime should select sounds by weapon ID and action, with the LMG, launcher, and Stickman receiving unique signatures. Sound design must reinforce the period materials: wood, brass, Bakelite, spring steel, and mechanical actions are as important as the report itself.

