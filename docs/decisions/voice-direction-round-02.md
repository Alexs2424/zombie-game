# Voice and dialogue correction — round 02

## Established feedback

On 2026-09-30 the user rejected both the Adam voice and the six-line Frankie pilot as lame. They want much more unique, sexy, raspy voices with cartoonish depth. This rejects the pilot's artistic result; passing technical playback tests was not evidence of a successful performance.

The earlier six recordings remain historical implementation samples, not approved casting or approved writing. They are still wired into the existing game pending replacement; this documentation update does not claim to have replaced or muted runtime audio.

## Working interpretation

Design unmistakable people with exaggerated vocal behavior. Adult sensuality can be a dangerous intimacy, a delighted appetite, a smile inside a rough voice or confidence that takes up the whole room. It should remain audible when the character stops flirting. Texture means audible grain, uneven breath, worn resonance and a laugh that interrupts the pose. Cartoonish depth means large emotional and pitch contrasts while preserving the human being underneath.

Do not make six uniformly low, slow, gravelly voices. Differentiate where the roughness lives and what causes the person to lose control. A sustained growl with a generic threat remains generic. More profanity, a pitch shifter or an audio tag cannot substitute for a distinctive underlying voice identity.

This pass supersedes the previous pilot's restrained stock-voice interpretation. Accents remain original character accents rather than celebrity impersonations. The character histories, 1976 setting and co-op ambitions remain unchanged.

## Cast performance targets

| Character | Texture and attraction | Exaggerated behavior | Emotional break |
| --- | --- | --- | --- |
| Frankie | Chesty, battered baritone with a nasal edge and a crooked smile. Warm gravel, audible breath, musical North Jersey vowels. Dangerous physical warmth. | Delighted vowel stretches; suddenly rises into offended, cracked indignation; laughs a little too hard at his own terrible impulse. Can become quiet instantly. | Guilt makes him brief and unadorned. Do not perform the Keene confession like a threatening catchphrase. |
| Eve | Low smoky contralto; dry friction, rich chest resonance and precise bright consonants. Intimate, commanding and amused by her own effect on people. | Languid invitation turns into a room-filling stage command. A low involuntary laugh briefly spoils her perfect composure. | Fear removes the elegance. An ordinary “please” should expose more than a scream. This lower register replaces the earlier middle-register target. |
| Leon | Warm resonant middle-low voice, worn grain around its edges, southeast Texas vowels. Attractive ease, patience and physical presence. | Starts quietly, then builds a wonderfully furious, specific complaint. His delighted laugh should sound bigger than his ordinary speech. | Concern is direct and generous. Never make him the slow, dim character; he is usually paying closer attention than everyone else. |
| Vivian | Smoky lower edge under a bright mobile middle register. Close, conspiratorial Los Angeles English with a wicked broken laugh. | Can make a bargain sound like a proposition, then snap into shrill outrage at a petty inconvenience. Change speed and distance, not just pitch. | A sincere sentence comes out level and slightly unfinished, with no wink to protect it. |
| Voss | Luxurious, resonant baritone with a fine dry burr beneath smooth public diction. Cultivated American / light mid-Atlantic formality. | Makes a name sound like a caress and an instruction sound like ownership. Public amusement may be expansive; private menace almost conversational. | His control briefly frays when another person freely refuses him. Avoid a demon filter or constant sinister chuckle. |
| Marlowe | Papery, lightly raspy northern English middle-low voice; unexpectedly rich on a quiet phrase. Intimacy through close attention rather than seduction in every line. | Underplays terrible information, then becomes startlingly loud over a small breach of manners. Give the old voice range. | When he admits his complicity, lose the charming little pauses. He has run out of ways to make it sound tidy. |

## Rewrite principles

Write an impulse before a joke. A gun can provoke greedy delight, a distasteful memory or absurd possessiveness. A kill can release an argument the character was already having in their own head. Let a fragment, a laugh or a single offended word do the work when appropriate. Avoid six variations of a setup followed by an efficient punchline.

Personal detail should change the response, not merely decorate it. Frankie thinking of Ruth gives an acquisition line an entire failed marriage behind it. Eve becoming furious over something she made exposes her craft and vanity. Leon briefly invoking Della brings an affectionate home life into the room. These references do not invent new family events or require an exposition exchange first.

## New performance tests — unrecorded proposals

These are audition material, not newly implemented triggers or accepted final lines. Delivery instructions are not subtitles. Specific claims require matching gameplay or staging.

| Speaker / context | Exact words | Performance |
| --- | --- | --- |
| Frankie acquires the double-barrel shotgun | “Ohhh, look at you. Look at those barrels. Ruth would've hated you.” | Genuine greedy affection; small private laugh at the memory. Only a visibly double-barrel gun supports “those barrels.” |
| Frankie after a rapid multi-kill | “Everybody gets a turn. I'm a gentleman.” | Cheerfully accommodating, breath still catching from violence. No polished announcer cadence. |
| Frankie beginning a future revive on casino carpet | “Hey! Hey, look at me. You're not dying on this carpet. It's disgusting.” | First two calls sharp and scared; disgust is how he avoids admitting tenderness. Longer rescue scene, not a kill bark. |
| Eve acquires an extravagant firearm | “Oh, that's indecent. Give it here.” | A low, delighted appraisal followed by sudden proprietorial authority. |
| Eve before attacking an enemy focused on her | “No, darling. Eyes on me. The gun is the surprise.” | Almost inviting, then brutally matter-of-fact. An audition scenario, not an implemented enemy-attention predicate. |
| Eve discovers damage to her repaired jacket | “You tore my sleeve. I made that. I MADE that!” | Escalating, outrageous personal affront. Costume-damage scene is a performance exercise, not a new runtime feature. |
| Leon first fires a newly acquired loud automatic | “Lord, listen to her. Della can't know about this.” | Involuntary delighted grin; conspiratorial last sentence. Affectionate exaggeration, not new marital conflict. |
| Vivian acquires a firearm from somebody else's private stash | “Mmm. Expensive, loud, and somebody else's. My type.” | Appreciative inspection, a little wicked laugh; ownership condition must be established. Do not play after an ordinary purchase. |
| Voss after an observed player victory | “Darling, I said enjoy yourself. Not survive.” | Warm amusement with a dry edge of irritation. An NPC reaction, never the player's voice. |
| Marlowe sees a nearby corpse continue twitching | “Still twitching. Shall I leave his tab open?” | Looks at the movement, then asks as an ordinary practical question. Requires an actual visible corpse animation. |

Two longer scripts test whether a voice can change gear within one performance. Their exact descriptions and scripts are in [round-02.json](../voice-auditions/round-02.json). They cover Frankie and Eve first because their contrasting timbres can establish the acceptable degree of exaggeration before spending on all six.

## Audition gate and actual access result

Working approach: request one custom Voice Design batch for Frankie, then one for Eve, retaining the returned candidates as auditions. Listen for identity, texture, desire, indignation and vulnerability. Do not replace game lines simply because a request returned audio. The user should be able to hear a clear improvement before expansion to the rest of the cast.

On 2026-09-30 a fresh request to ElevenLabs `/v1/text-to-voice/design` with model `eleven_ttv_v3` returned HTTP 403, `feature_unavailable`: “Creating a voice through the API is only available on a paid plan.” The batch stopped after that rejection; Eve was not submitted, and no round-02 audio was generated. The local sanitized diagnostic is under `outputs/voice-auditions/round-02/frankie/`. That output directory is not a committed voice asset.

Custom API voice design therefore needs a key backed by an eligible paid plan. No subscription was purchased and no upgrade is authorized by this decision. No additional stock-voice fallback was generated. The scripts and direction are ready even though the new sound remains unverified. A future successful audition should update this status and preserve its request/manifests.


## Follow-up priority and library access

The user explicitly prioritizes voice quality over further script expansion. Optional use of open-source writing models is permitted but not a requirement; no external writing model was used for this revision. Cast a distinctive voice with emotional range before generating a large bank of lines.

Library search succeeded, but a test synthesis request for Chuck Miller returned HTTP 402 `payment_required`: free users cannot use library voices via the API. Dean was not submitted after this rejection. This is separate from the earlier custom Voice Design 403. Both production routes need eligible account access; the catalog's free-user flag is not sufficient evidence of API availability.

The comparison page at `/audio/dialogue/casting.html` retains existing remote previews for Chuck Miller, Dean, Tatiana and Rosie. Following user listening, Chuck is preferred and the other three are rejected; see the verdict below. These are not newly generated performances of our characters. No canonical accents change. [Candidate metadata](../voice-auditions/library-texture-candidates.json) preserves the source descriptions and preview URLs. No remote preview is downloaded into gameplay assets.

Two fresh Frankie acting proposals are “Oh, I missed this. Being understood.” for a first firearm acquisition, and “Five of you. Not one fucking apology.” after five confirmed kills following recent enemy damage. The latter requires a new five-kill/damage predicate and must not be installed on the current four-kill rule. These are unrecorded tests, not proof of improved quality.


## Listening verdict — Chuck Miller only

**Established user feedback, 2026-09-30:** only Chuck Miller sounds good. Dean, Tatiana and Rosie were rejected as boring, nerdy, radio-like, lacking character and monotone. Chuck is the preferred candidate and positive voice reference. This is approval of the heard preview, not proof of a final character/accent match or emotional range on our dialogue.

**Working casting standard:** prioritize audible wear, roughness, irregularity and personal presence. A low pitch, smoky catalog description or polished radio delivery is not enough. Auditions must expose amused pleasure, genuine annoyance and a sudden shift of intensity, as well as a quiet human sentence. Cartoonish expressiveness remains required; continuous shouting is not its substitute. Do not assume Chuck's full range has been heard from one preview.

Keep Chuck first for the next Frankie acting test once generation access is available. Seek the same degree of distinctive texture for the others while preserving their different genders, accents, rhythms and personalities; do not make them all sound like Chuck or silently replace their biographies. Do not re-present Dean, Tatiana or Rosie as viable candidates without an explicit reason and new evidence.

The live casting page now features Chuck as the preferred reference and labels the other candidates rejected. Existing remote previews are retained only as historical comparison. No new paid request, voice cloning, game recasting or replacement audio occurred. The previously verified library API paywall remains unresolved; no redundant request was made this turn.


## Next audition batch — prepared, awaiting access confirmation

The user said they will enable paid API access and let us know. This is not confirmation that access is already enabled. Do not repeat blocked requests in the meantime.

[Round 03 scripts and candidates](../voice-auditions/round-03.json) own the next prepared acting tests: Chuck Miller / Frankie, Charmion / Eve, Kathie / Vivian, Monty / Voss. Chuck's preview remains the only positive user selection. The other three are unreviewed screening options; their catalog descriptions are not evidence of performance quality. Charmion may be too soft, Kathie insufficiently husky, and Monty older or more caricatured than Voss. No character biography or accent is changed to fit a sample. Leon and Marlowe remain uncast.

The next batch tests pleasure, anger and quiet vulnerability on each character's own words, rather than a generic narration paragraph. Exact text and matching context are in the JSON, superseding earlier audition text for that batch only. All are unrecorded proposals. Test Chuck first once access is confirmed; stop on any provider rejection. No automatic retries or permanent voice creation are planned.

`/audio/dialogue/casting-round-03.html` provides existing remote previews and the prepared scripts. It excludes the three rejected candidates. Do not claim these previews are performances of our dialogue or that this page replaces in-game speech.
