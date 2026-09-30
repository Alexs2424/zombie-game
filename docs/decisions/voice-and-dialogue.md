# Voice and dialogue

Status: AI character voices are established direction. ElevenLabs Voice Design v3 remains the intended custom audition route, but the configured account is blocked by its paid-plan requirement. One existing-voice Voss/Callum pilot has been generated with Eleven v3; no final character voice has been selected. The [round 01 audition pack](../voice-auditions/README.md) contains the scripts, prompts and generation status.

Use the [character production design bible](character-production-design.md) for detailed vocal contrast and the [playable scene treatment](story-scenes.md) for dramatic context. Both are working direction; final casting and recording remain pending.

## Production approach

Generate authored dialogue ahead of time, audition and edit the takes, then ship audio assets with the game. Runtime generative conversation is not in scope for the first story implementation. AI-led creation does not require live generation during gameplay.

Use original designed voices, not recognizable actor impersonations. Keep one stable voice identity per character. The performance briefs are in [characters](characters.md). Start auditions with ElevenLabs Voice Design v3. Final production-provider choice follows listening, cost and intended distribution-rights checks; this first audition does not make the browser game dependent on a live provider.

## Audition plan

1. Generate three distinct voice candidates per character from the performance brief.
2. Test each on the same five situations: restrained introduction, dry joke, frightened whisper, urgent combat call, and honest confession. Audition Voss in both PA-host and private-threat registers.
3. Test short paired exchanges, especially Frankie/Voss, Eve/Leon, and Voss/Marlowe.
4. Listen without visuals. Check character recognition, natural delivery, accent consistency, intelligibility under combat sound, and fatigue after repetition.
5. Select and record the voice ID, model/version, prompt, settings, and representative takes. Generate a small in-game batch before committing to the full script.

Three candidates and five situations are a bounded first audition batch, not a commitment to unlimited regeneration. Stronger intonation and consistent identity matter more than accent intensity.

## Script and asset records

Every line needs a stable ID, speaker, exact subtitle text, triggering event, required story knowledge, listener/audience, emotional direction, priority, replay rule, and interruption policy. Exchanges also identify their response and fallback when a speaker is absent.

Each approved asset records its provider, model, voice identity, generation settings, source take, processed output, duration, and relevant rights/provenance information. Keep API credentials outside the repository and browser bundle.

Keep clean source audio. Create PA/telephone/room treatment separately so Voss does not permanently sound like a loudspeaker in every context. Match perceived dialogue levels and keep enough headroom for combat mixing.

Example future ID: `voss.gallery.first_warning`. These are proposed metadata requirements, not an existing runtime schema.

## Current writing revision

The user requested more action-specific, individual, badass noir dialogue after the first audible pilot. [Contextual dialogue](contextual-dialogue.md) is now the current writing pass. Round 01 remains a historical audition; do not generate its full script as the current production batch. Preserve cast identities while revising delivery text around exact gameplay triggers. No additional audio is generated until the revised material is selected for the next audition.

## Human conversational range

Consult the [character backstory bible](character-backstories/README.md) for personal speech and relationships. Auditions should eventually include ordinary speech, an interrupted thought, an unadorned admission, and a familiar disagreement as well as threats and jokes. A character who cannot sound tired, pleased, embarrassed or briefly boring will sound like a collection of catchphrases. Named relatives are writing resources, not automatic new voice-production requirements.

## Character comedy and performance

The user requests heightened, occasionally over-the-top personalities. Audition both ordinary delivery and each character's extravagant register. Preserve contrast: a cast that shouts continuously loses its individuality.

Write from a character's judgment of the situation, not a generic joke with an occupational noun substituted. Remove the speaker label: the attitude, construction, and delivery should still suggest who said it. Use distinct joke forms—Frankie's offended reprimands, Eve's devastating reviews, Leon's escalating diagnoses, Vivian's shameless pitches, Voss's coercive ceremony, Marlowe's unreasonable housekeeping.

Give each character subjects they cannot joke about comfortably. Allow bravado to break and sincere lines to land. Keep combat lines short enough to hear during play; longer theatrical remarks belong to quieter windows. Exploratory samples live in [dialogue-samples.md](dialogue-samples.md), separate from a future fully tagged production script.

## Writing and playback rules

- Personality is primarily audible. No required cinematic staging or lip sync.
- Main revelations outrank banter. Urgent gameplay calls can interrupt; interrupted essential information must remain recoverable through a short replay or journal entry.
- Subtitles identify the speaker. Important information cannot be audio-only.
- Keep the mix to one foreground dialogue line at a time. Explicit exchanges own their response window; unrelated characters do not talk over them.
- Quest dialogue reaches the team; nearby incidental remarks may use positional audio. Late joiners receive current journal knowledge without replaying the entire script to everyone.
- Use per-line and per-category cooldowns. One-liners should not fire after every kill. A character can simply be quiet.
- Banter respects revealed knowledge and current danger. Do not disclose a twist because a random line selected too early.
- Public quest events select one valid speaker once for all clients. Disconnecting must not strand a required conversation or quest step.
- Separate dialogue volume from effects/music when integrating the system.

## First playable audio batch

Target a small investigation covering Voss's welcome, the crew's immediate reactions, Marlowe's counterpoint, the reception/suitcase discovery, and the gallery register reveal. Add enough combat calls to test coexistence with weapons and enemy audio. Final line count and asset sizes follow the first script and listening pass.

This batch proves that the cast sounds like six different people and that story information survives real gameplay. Full quest dialogue waits until the major supernatural rules are settled.
