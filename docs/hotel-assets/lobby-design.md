# Hotel lobby — fidelity roadmap

## Established direction

The user approved the first ivory/forest-green/brass wall treatment and its commit. The next request is to continue improving the lobby design and use higher-fidelity Blender models. The recently deserted luxury-hotel setting remains current; see [story and plot](../decisions/story-and-plot.md).

The committed [wall pass](lobby-walls.md) is runtime-authored Babylon geometry. Existing hotel furniture already has Blender sources. Future model upgrades should retain editable `.blend` sources and export optimized runtime GLBs.

## Approved implementation scope — pending unless explicitly marked verified

The user requested all of the following improvements as a methodical PR stack, with in-game checks of wall projection and overall cohesion. The sequence below is approved scope, not a claim of completed implementation. No new narrative content is introduced.

1. **Stair and balcony architecture.** Make the double staircase a deliberate focal point: sculpted newel posts, continuous curved walnut handrails, restrained bronze baluster motifs, shaped stone stringers, and a properly fitted woven runner. Give the balcony edge a molded fascia and stronger supports. Preserve current traversal, openings, and sightlines; validate any replacement rail geometry against gameplay collision.
2. **Chandelier and ceiling.** Author a signature tiered brass-and-crystal chandelier with convincing suspension, sockets, faceted drops, and an ornamental canopy. Refine the ceiling into recessed plaster coffers that meet the perimeter molding. Repeat smaller fixtures from the same family. Compare in-game lighting and exported materials with the Blender preview.
3. **Floor and material response.** Rework the broad floor surface with coherent marble slab scale, restrained veining, joints, complementary border stone, and variation in roughness. Refine the compass inlay as fitted stone. Review the material under existing runtime lighting before increasing geometric detail.
4. **Hotel lighting.** Build hierarchy around the chandelier, reception lamps, and wall sconces, with cooler window fill and contact shadows grounding furniture and architectural details. Keep gameplay readable and avoid changing the casino's global exposure to compensate for hotel materials.
5. **Seating groups and textiles.** Improve the existing seating assets with rounded upholstery, seams, piping, cushion compression, varied fabric roughness, and manufactured wood edges. Arrange coherent small groups around rugs and tables while preserving the central route. This is an arrangement proposal, not a new collision layout.
6. **Close-range finish.** Upgrade door casings, hardware, sconces, curtain folds, and selected existing reception objects. Concentrate fine geometry where the player can approach. Avoid uniformly increasing polygon counts across the room.

## Implementation record

The [fidelity asset record](lobby/README.md) owns completed models, rebuild instructions, and measured validation. Items above remain planned until that record marks them implemented.

## Recommended starting scope

A coordinated staircase/balcony Blender pass, followed by the chandelier/ceiling and floor/lighting, would improve the entrance view most. Retain the approved palette and recently maintained appearance, with restrained use wear. The user can supply references if a different style is desired; references are not required to continue this direction.

For each implemented pass: review at player height in the live game, retain editable source, check the actual GLB export, and measure runtime cost. Model silhouettes and bevels; use texture maps for fine surface detail. Verification should remain focused on the assets and systems actually changed.
