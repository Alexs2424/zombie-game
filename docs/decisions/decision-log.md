# Decision log

## 2026-09-28 — Cashier portrait map polish

**User direction:** improve the cashier portrait's artwork. **Working choice:** an original period proprietor painting with a walnut/bronze frame. The sitter remains unnamed; this visual replacement does not establish Voss's appearance, a new character identity, or a change to the 1976 setting. Recorded in `characters.md`, with the exact generation prompt in `docs/portrait-art/README.md`.

**Implemented and checked:** the painting and frame slide together and expose the existing interactive keypad. No story or puzzle progression was added by this asset replacement.

## 2026-09-28 — Narrative source of truth and creative direction

**Established by the user:** AI-led game and voice production; dialogue-led characterization; unique accents and intonation; dark noir with funny one-liners; charming, theatrical, intimidating Voss; browser/budget-conscious characters with Blender preferred and facial polish deferred. Character preferences delegated to the agent. Creative decisions must be recorded in Markdown.

**Working decisions selected in response:**

- Use this folder as the current narrative source of truth; preserve the earlier proposal as a historical pitch and add repository instructions for maintaining these records.
- Use 1976 as the present-night working date, with a recently operating casino rather than a long-abandoned ruin. Exact bargain date and public casino brand remain open.
- Retain Frankie, Eve, Leon, Vivian, Voss, and Marlowe; specify ages, backgrounds, personal conflicts, performance briefs, and practical visual direction in the character document.
- Give Voss contrasting public-host and private-threat delivery. Use original AI voice auditions and authored, prerecorded dialogue; do not require cinematics or runtime generated conversations.
- Integrate Varga's existing investigation and the Velvet Hour into the main story. The speakeasy replaces the pitch's assumption of another missing room. The inaccessible cashier cage becomes a late-story destination requiring new work.
- Preserve existing rewards and mysteries. Main-quest deductions must not depend on random table outcomes or a specific selected character.
- Prove voice and shared quest behavior in the short hotel investigation before producing the full story or polishing faces.

**Still open:** full contract rules and four-signature eligibility; Varga's identity; Marlowe's obligation; the earlier crew; Collector design; Voss's ending; final voices/provider; online hosting and revive rules. These are development tasks, not blockers requiring immediate user answers.

Documentation only. No gameplay, assets, voices, or network functionality were added by this decision pass.

## 2026-09-28 — Character design review pass

**User-requested sequence:** lead character design, ask for feedback, then write funny character-specific one-liners, then explore voices.

**Working design additions:** expanded all six character briefs with recognizable physical features, behavior under pressure, weaknesses, habits, emotional development, and distinct sources of humor. Clarified Eve's audience-facing performance versus Vivian's person-specific deception; gave Leon practical authority and interests beyond repair jokes; tied Frankie's protectiveness to unresolved complicity. Voss's warmth and cultivated hospitality make his threats personal. Marlowe's apparent neutrality is a flaw rather than a source of unlimited cryptic wisdom.

All additions are recorded in `characters.md` as a review pass. No final one-liner batch, concept images, character models, voice selections, or audio generation have been produced. Next step is user feedback on the cast, followed by the requested writing pass.

## 2026-09-28 — Heightened cast and perspective-driven comedy

**Established user correction:** the cast should be exaggerated, outlandish, dramatic, and occasionally over the top. One-liners must be unique to how each character sees the world. This supersedes the earlier emphasis on restrained characterization, not the noir stakes or browser-conscious visual targets.

**Working response:** added heightened behavioral and vocal directions for all six characters, updated story and voice guidance, and wrote twelve exploratory tone samples in `dialogue-samples.md`. Exaggeration comes from different obsessions and performance styles rather than everyone shouting or relying on accent caricature. These samples are for feedback; no voices or runtime dialogue were generated.

## 2026-09-28 — First full audition pack

**User request:** write the one-liners and generate voice auditions for each character with ElevenLabs or a suitable alternative.

**Prepared:** 36 comic lines and six serious range tests, stable audition IDs and performance notes; six original voice-design descriptions; four-line preview scripts shared by each character's candidates. Selected ElevenLabs Voice Design v3 for the initial attempt because its custom-description and three-preview workflow fits the casting task. No claim of superiority from a listening comparison has been made.

Added a standard-library Python API runner with local validation, per-character output manifests, credential handling outside tracked files, completed-batch skipping, and a guard against retrying requests with uncertain outcomes. A real API call remains unverified until credentials are available.

**Access status:** plugin search returned no ElevenLabs integration; no relevant credential is configured in this project's environment. Opening the service reached its sign-in page. User asked to sign in or configure a key locally. Audio generation is pending access; no credits were spent, clips generated, or final voices selected in this preparation pass.


## 2026-09-28 — API access verified and first audible pilot

The user configured a key in `.env` and requested Git exclusion. Confirmed `.env` is ignored by the existing `.env*` rule and is not tracked. Corrected the variable name from `ELEVENLABS_API_KEY_FIL` to `ELEVENLABS_API_KEY` without displaying the secret. Added restricted, non-executing `.env` loading to the audition runner and sanitized provider diagnostics.

The sandbox initially failed DNS resolution before connecting; a network-approved attempt reached ElevenLabs. Voice Design returned HTTP 403 `feature_unavailable`, explicitly requiring a paid plan. A diagnostic retry confirmed the rejection; no designed voices were generated. Existing voice listing succeeded. Subscription inspection lacked `user_read`, which is not needed for generation.

Generated one Voss pilot using the existing Callum voice, model `eleven_v3`, stability 0.5, with public-host and quiet-threat lines. This is a provisional performance comparison, not a replacement for the intended original voice or a change to Voss's canonical accent. Saved audio, exact request, and manifest locally under `outputs/voice-auditions/stock-pilot/voss-callum/`. Subjective listening review is pending. User offered existing-voice auditions versus enabling a paid plan for custom design; no upgrade purchased.


## 2026-09-28 — Action-specific noir dialogue revision

**User correction:** dialogue should be more specific to player actions, more unique to the speaker, and badass; supplied a Mob of the Dead intro video and Sin City as inspiration. Identified the video through its page, but could not retrieve its transcript; no full audio-analysis claim made.

**Working response:** wrote 36 contextual character lines plus three short exchanges in `contextual-dialogue.md`, each with event conditions and delivery notes. Shifted from broad occupational jokes toward physical consequences, personal history, ruthless confidence, and uncomfortable humor. Documented current simulation event limits and proposed context/anti-repetition rules. Deferred conditions are labeled rather than represented as implemented mechanics. Round 01 and its stock Voss pilot remain historical; use revised contextual material for the next delivery audition. No gameplay or new audio was generated during this writing pass.


## 2026-09-28 — Extensive human character backstories

**User direction:** develop extensive histories and personalities for all six, with human badass energy and Fallout as a broad reference. Keep the previously established outlandish noir cast and action-specific dialogue.

**Working canon added:** six individual dossiers plus an ensemble bible. Defined lives before the casino, surviving family/friends with independent concerns, ordinary pleasures, damaging choices, competence limits, emotional arcs, speech examples and paced reveals. Named Martin Keene, Arthur “Art” Bell, the families of Frankie and Leon, Vivian's brother Tomas and the invitation identity Celia March, Voss's former wife Helena, and Marlowe's sister Elsie. These are supporting writing resources, not a new asset or quest scope.

Selected Voss's human motive and knowing complicity: preserve the casino's prosperity and personal control by accepting collection of designated debtors. Kept contract mechanics and final fate open. Marlowe has no current blanket magical ban on speaking; his evasions have human causes. Updated the concise cast and plot documents to reflect the new specifics instead of leaving competing open questions.

No family reconciliation or forgiveness is automatic upon escaping the map. No new character becomes secretly the Collector by default. Keene, Varga and the earlier four remain distinct unresolved story elements. Dialogue examples require matching context and are not new runtime lines.

Documentation only; no gameplay, voice generation, or visual assets changed.


## 2026-09-28 — Sin City character emphasis

**User clarification:** “or sin city characters,” following the request for extensive human, badass character histories.

**Working interpretation:** make Sin City the stronger reference for noir character stakes—dangerous loyalties, costly personal codes, wounded pride, obsessive choices, and flashes of tenderness. Retain Fallout as a secondary reference for eccentricity and contradiction. Added a per-character noir emphasis to the ensemble bible, preserving the authored histories, surviving families, ordinary speech and distinct voices. No copied characters, plotlines, compulsory inner narration, or new gameplay mechanics.

## 2026-09-29 — Hotel gate and surrounding wall alignment

**Established direction:** the user requested a new branch/worktree to fix the
hotel gate and adjacent walls shown in their screenshot, using detailed Blender
models with carefully aligned placement.

**Working art direction:** extend the entrance into a full-height Art Deco facade
with jade wall panels, walnut dado panels, limestone crowns, restrained marble
veining and bronze fan/sunburst reliefs. The jade palette was superseded by the
user-selected smoky oxblood direction below. Treat those reliefs as architectural
ornaments, without introducing new lore, clues or interaction requirements.
The owning asset document is [the entrance README](../hotel-assets/entry/README.md).

**Implemented:** the portal, grille and two wall wings are original Blender
exports with a shared origin. Geometry audits verify the unchanged 4.8 m passage,
full-height closure and wall joints. The existing 2,000-chip unlock and gate
removal behavior remain; no opening animation or new quest is claimed.


## 2026-09-30 — Smoky oxblood Art Deco facade

**Established direction:** the user selected the proposed smoky oxblood palette
and requested ornate Art Deco models and walls with professional game polish.
This supersedes the initial jade color direction for the hotel entrance and
its north casino wall wings.

**Working execution:** smoky oxblood lacquer (#5B3038), champagne brass
(#C2A574), dark walnut (#3B2923), warm ivory stone and deeper oxblood reveals.
Use beveled fan castings, stepped geometric frames, pendants, corner inlays
and gate escutcheons. Preserve visual hierarchy with quieter fields between
ornaments. All motifs are architectural, without adding narrative significance.

**Implemented:** regenerated the editable Blender source and all four runtime
exports; updated the dynamic purchase plaque and loading fallback colors.
Reduced ornamental bevel/profile tessellation to keep each export within the
existing asset budgets. The owning [entrance documentation](../hotel-assets/entry/README.md)
records material choices, coordinates, reproduction and visual verification.
