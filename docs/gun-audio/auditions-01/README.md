# Three gun sound directions — audition 01

**User request:** try more sound designs, preserving the established preference for authentic, cool gun sounds and only one or two humorous weapons.

**Selection update:** the user chose B and rejected C (described as dog-like). B’s three sources are reused in the current production bank; A/C remain unselected alternatives.

Original comparison:

| Option | Direction | Intended distinction |
| --- | --- | --- |
| [A — Dry and mechanical](a-dry.wav) | Close, lean, tactile | Fast pressure snap and exposed steel action |
| [B — Heavy action](b-heavy.wav) | Dense, forceful, contemporary game feel | More midrange weight and a short room slap |
| [C — Gritty vintage](c-vintage.wav) | Coarse, warm, dangerous | Rough report and worn steel, slight tape character requested at generation |

Each reel uses the same order: **revolver → shotgun → Thompson**. Each plays two isolated shots, followed by a six-shot burst for the Thompson at its 0.105-second gameplay interval. Repetition in each chapter is deliberate: this comparison is about direction, not take variation. The first Thompson shot is a single generated discharge reused at the firing cadence, not a generated burst.

All nine candidates use fresh ElevenLabs source generation and identical minimal mastering: onset trim, DC removal, small start/end fades, equal peak ceiling. No synthetic body, ringing layer, comedy, extra EQ, pitch change or saturation is added afterward. Equal peak does not imply equal perceived loudness; body and decay are part of the comparison. The burst may expose an overly long tail, which is useful audition evidence.

**Status:** historical comparison pack; B is now selected and its sources are integrated. The two-humorous-weapon limit still applies to the overall arsenal; these auditions compare the serious foundation. Descriptions above are generation intent, not a claim that a human listening review confirmed them.

Sources, requests and receipts: `assets/source/gun-audio/auditions-01/`. [Manifest](manifest.json) records source/output hashes and trim positions. Reproduce with `tools/gun-audio/auditions.py --generate`, then run without flags to decode/master. Generation is cached and guards uncertain requests; mastering requires NumPy and macOS afconvert. Nine two-second clips are requested. Actual cost is recorded in the receipts.

Verification: nine unique source clips and three reels passed format, onset, fades, headroom and provenance-hash checks. Provider receipts report 180 character credits total. No runtime changes were made, so gameplay tests were not rerun.
