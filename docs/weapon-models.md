# Last Jackpot original weapon assets

All four models were authored procedurally for this project with `tools/generate_weapons.py`. They use no imported models, third-party geometry, texture files, licensed weapon names, or brand marks. Model designs are fictional vintage firearms intended for the casino game.

The files are self-contained glTF 2.0 binary assets with differentiated PBR metallic/roughness materials and explicit vertex normals. They require no external textures. Units are metres, origin is at the receiver, +Y is up, and the muzzle points along +Z. Each functional or decorative group is a named mesh node with geometry recentered locally. Mesh nodes include `Magazine`, `Bolt`, `Trigger`, `Receiver`, and sight components. Static geometry only; no animations or skinning.

| Asset       | Named nodes | Vertices | Triangles |    Length |     Width |   Height |     File size |
| ----------- | ----------: | -------: | --------: | --------: | --------: | -------: | ------------: |
| pistol.glb  |          38 |    8,402 |     4,696 |   0.368 m | 0.06425 m |  0.255 m | 289,852 bytes |
| shotgun.glb |          44 |   14,544 |     7,172 |   1.002 m | 0.07035 m |  0.196 m | 471,732 bytes |
| smg.glb     |          41 |   16,374 |     9,880 | 0.69125 m |   0.102 m | 0.2615 m | 545,664 bytes |
| rifle.glb   |          52 |   13,236 |     7,248 | 0.99775 m |  0.0987 m |  0.251 m | 448,012 bytes |

Muzzle tips: pistol `(0, 0.043, 0.24)`; shotgun `(0, 0.033, 0.64)`; SMG `(0, 0.011, 0.398)`; rifle `(0, 0.013, 0.637)`. These are useful for positioning muzzle-flash nodes before applying the weapon root transform.

Pistol detail: beveled machined slide and frame, serrations and forward slide cuts, brass-accented ribbed Bakelite grips, slide stop and safety levers, recessed ejection port with separate bolt face, exposed barrel and open muzzle crown, barrel bushing, recoil guide rod, open trigger guard, magazine and floor plate, front/rear iron sights, hammer, fasteners and backstrap.

Shotgun detail: walnut buttstock and wrist, wood grain, rubber recoil pad, rounded steel barrel and tubular magazine, knurled magazine cap, ventilated sight rib and brass bead, wood pump with eleven grip grooves, action bars, separate `Pump`, `Bolt`, `Magazine`, and `Trigger` nodes, receiver ejection/loading ports, action release, selector, sling rings and fasteners. Pump detail meshes (`Pump grooves`, `Pump underside grooves`, `Pump wood grain`, `Pump front band`, `Pump rear band`) and `Action bars` should move with the pump if cycling it.

SMG detail: beveled stamped receiver, true perforations through the cylindrical heat shield, barrel, open muzzle bore, recessed brake ports, separately named bolt, charging handle, trigger and magazine, pistol-grip ribbing, dual stock rods, shoulder pad, front and rear iron sights, selector, screw slots and brass serial plaque.

Rifle detail: beveled walnut buttstock, pistol-grip checkering, wood-grain accents, handguard ribs, turned barrel and gas tube, gas regulator rings, receiver and bolt, charging handle, detachable magazine, trigger guard, two iron sights, metal bands, rubber recoil pad, sling loops, screw slots and brass stock plaque.

Validation passed: binary GLB headers and buffer lengths; 4-byte accessor alignment; all index bounds; finite vertex positions and unit normals; face winding agrees with explicit normals; no degenerate triangles. `weapons-preview.png` is a CPU z-buffer render of the actual generated geometry, checked for silhouette and detail. Browser material appearance will depend on the scene lighting and environment.

The generator writes its assets and preview into `/private/tmp/last-jackpot-models`; it requires NumPy and Pillow for the preview render. Runtime weapon action/magazine animation is applied to named mesh components in `lib/game/renderer.ts`.
