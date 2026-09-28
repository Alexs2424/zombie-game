# Casino undead

Original geometry created in Blender by `tools/zombie-assets/generate_zombies.py`.

- `casino-undead.blend`: editable neutral-pose models grouped into three collections.
- `lineup.png`: Blender render of the three variants.
- `../../public/models/casino-undead.glb`: portable geometry export.
- `../../public/models/zombies.json`: the same Blender geometry, grouped by pivot and material for the game. Uses Babylon triangle winding and game coordinates in meters.

Regenerate from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/zombie-assets/generate_zombies.py
```

The runtime animates rigid shoulder, elbow, hip, head and jaw pivots. `lib/game/zombie-pose.ts` defines the three attacks and limb hit volumes together. Animations are procedural in the game, not baked skeletal clips in the GLB. This lets permanent severing, hit reactions, and attack poses compose without restoring a missing limb. Damage and wound state belong to the simulation and survive rendering changes.

Attacks: a wide backhand rake, a raised two-handed hammer, and an open-armed snatch. All have a 0.65-second windup, contact at windup completion, and 0.35-second follow-through. Armless zombies still attack using a jaw lunge. Head and jaw animation supplies a scowl, asymmetric sneer, and open-mouthed gasp across the variants.

Stains and bone-capped stumps are authored separately and revealed as damage accumulates. Limbs disappear permanently on severing; detached physics debris is not generated. Corpses retain the game's existing immediate removal behavior.
