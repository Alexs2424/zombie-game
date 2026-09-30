# Decision log

## 2026-09-29 — Two-gun loadouts and optional Mystery Box rewards

**User direction:** Q/E switch guns, carry only two guns, explicitly choose whether
to take Mystery Box rewards, and differentiate gun power against scaling zombie
health. **Working choices:** F interacts; third-gun pickups replace the active gun;
melee tools are separate; Mystery Box offers last 15 seconds and pause with the
run. Poker/hotel rewards use the same two-gun grant path. Round/damage tuning is
owned by `docs/combat-balance.md`, and reward behavior by `quests-and-easter-eggs.md`.
These are implemented mechanics in this change, without new story canon.

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


## 2026-09-29 — Detailed narrative production documentation

**Established request:** record the developed characters and provide detailed scenario-specific one-liners, storyline/scenes, and character looks, designs, personalities and voices.

**Working additions:** twelve playable scene treatments with original dialogue, staging, evidence, absent-speaker/recovery rules and explicit provisional finale dependencies; a six-character production design bible covering faces, silhouettes, clothing/materials, first-person identity, gestures, human contradictions and emotional voice range; 48 additional action-specific lines, bringing the contextual bank to 84 individually identified lines plus its three exchanges. Optional Easter egg staging is included without turning deferred guest rooms into committed scope.

The existing biographies remain authoritative. No required cinematics, character-exclusive gameplay roles, final voice selections or new supernatural contract rules were introduced. The existing cashier portrait remains an unnamed proprietor, not a confirmed Voss likeness. Final contract wording, signature eligibility, counter-wager, Collector design, Voss's fate and post-ending session flow remain open. New scripts and visual directions are unimplemented and unrecorded.

Updated the index and owning documents so current narrative sources are linked. Documentation-only verification covers links, unique line/scene IDs, scope and whitespace; no gameplay tests or paid generation were needed. Publication follows the user's standing instruction to put creative Markdown decisions on main and push.


## 2026-09-29 — First in-game voiced reactions

**Established:** user requested actual generated speech in the game for exciting weapon acquisitions and killing groups of zombies, reusing suitable earlier lines.

**Working casting:** Frankie only for this solo pilot; six ElevenLabs Adam / eleven_v3 takes, explicitly provisional rather than final North Jersey casting. Reused the earlier shotgun line and wrote five firearm/multi-kill reactions. Voss's earlier voice is not assigned to the player.

**Implemented:** local speech assets and request manifests; ownership-based firearm reactions; four-kills-in-four-seconds reactions; 12-second overall spacing, 180-second per-line cooldown, two uses per run, one active voice, subtitles and lifecycle cleanup. Reacquisition under the new two-gun loadout does not repeat first-acquisition dialogue. Added a listening page and range link. No runtime API calls or new co-op attribution claims. Exact scripts, limitations and verification are owned by [gameplay voice pilot](gameplay-voice-pilot.md). Subjective voice and combat-mix approval remain open.


## 2026-09-28 — Distinct firearm report palette

**Established:** user requested innovation on gun sounds and authorized the configured ElevenLabs key or alternative sourcing.

**Working decision:** grounded, gritty crime-film firearm identities; heavy revolver and shotgun bodies, tight automatic reports, brief mechanical texture and restrained room send. These are aesthetic choices rather than new narrative canon or verified firearm recordings.

**Implemented:** 15 generated source clips, 48 mastered report assets including three double-barrel alternate reports; per-weapon variation, existing dual-hand panning, local sample playback, loading fallback and starter preloading. Existing reload choreography, melee and explosions remain. Sources, processing, test scope and a listening reel are owned by [gun audio](../gun-audio/README.md). Subjective in-game listening remains open.


## 2026-09-28 — Stronger gun personalities

**Established:** user asked for more variation and personality after the first report pass.

**Working decision:** distinguish guns by material and timbre: smoky iron revolver, bright ringing magnum, hollow Thompson drum, woody lever action, rough shotgun pressure and cavity-like launcher thump. The full 15-gun direction is owned by [gun audio](../gun-audio/README.md).

**Implemented:** remastered the existing 48 reports with per-weapon EQ, saturation, decay and original seeded material accents; broadened take differences in timing, color, bass and accent tuning. Reused accepted ElevenLabs sources without another paid generation batch. Updated the full three-take reel and added a compact six-gun sampler. Supersedes pass 1’s brightness/body-only mastering. Runtime routing and reload choreography are unchanged; subjective listening remains open.


## 2026-09-28 — A few deliberately outlandish gun sounds

**Established:** user said it would be funny if some guns were a bit outlandish.

**Working selection:** High Roller cash-register ding, Chicago Typewriter literal keys/carriage chirp, Silver Dollar bouncing coin and Debt Collector cork-pop/boing. These are sound-design jokes, not gameplay reward cues or new supernatural canon. The remaining eleven guns keep their grounded sound direction.

**Implemented:** original synthesized comic accents baked into the four weapons’ existing three report takes, subtle on takes one/two and strongest on take three. Gunshot onset, runtime selection and reload choreography remain unchanged. Rebuilt previews and provenance, including a dedicated comic sampler. All 48 asset checks and 41 focused audio tests passed; subjective listening is open. [Gun audio](../gun-audio/README.md) owns the updated palette and replaces the exclusively grounded descriptions for these four guns. No new API spend.


## 2026-09-29 — Return to authentic gun texture; two comic exceptions

**Established:** user disliked the prior sounds and requested other options, mostly authentic/cool reports and only one or two humorous exceptions, plus detailed gun documentation.

**Working selection:** Thompson and launcher, only on take three; remove register bells, coin bounces and pitched boings.

**Implemented:** fresh 15-clip ElevenLabs batch mastered into the existing 48 report filenames. Removed synthetic bass, resonant coloring, heavy saturation and pitched material layers. Retained natural source texture, modest take differences and brief unpitched comic accents for the two exceptions. Prior source assets and a sampler remain as historical comparison. Current choices supersede the four-oddball pass; subjective approval remains open.

Created [arsenal reference](../arsenal.md) from current weapon definitions with stats, upgrade names, acquisition, roles, handling and audio status. Corrected High Roller’s ID in the art spec and separated design targets from verified behavior. Flagged the flare pistol as partial integration rather than claiming it is obtainable. [Gun audio](../gun-audio/README.md) owns production details and auditions.


## 2026-09-29 — Compare sound directions before another arsenal replacement

**Established:** user requested more sound designs; authentic/cool reports and a maximum of two humorous exceptions remain the brief.

**Working proposals:** nine fresh clips grouped into three auditions across revolver, shotgun and Thompson: dry/mechanical, heavy action and gritty vintage. Same minimal mastering and weapon order make comparison practical. These auditions do not install another unapproved aesthetic across the game. Current runtime sounds remain unchanged; no new humorous weapon is introduced. [Audition pack](../gun-audio/auditions-01/README.md) owns source provenance and listening artifacts. Selection and subjective listening are open.


## 2026-09-29 — B chosen for the full arsenal

**Established:** user chose B as best, rejected C as dog-like, and requested distinct sounds for all weapons. Authentic/cool remains the foundation, with at most two humorous exceptions.

**Implemented production direction:** reuse approved B revolver/shotgun/Thompson sources; generate separate B sources for remaining firearms including flare, plus cane impact, axe impact and axe swing. Keep selected cane swipes and existing handling choreography. Current bank has 16 firearm report sets plus melee updates; the flare now has dedicated shot playback but acquisition/presentation remain partial. First takes preserve B-style minimal mastering; subsequent takes vary subtly. Humor stays confined to take three of Thompson/launcher. No new gameplay stats. Current sources, outputs and limitations are owned by [gun audio](../gun-audio/README.md); [arsenal](../arsenal.md) is updated.
