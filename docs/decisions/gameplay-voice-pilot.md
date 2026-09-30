# First playable character voice pilot

## Scope and status

**Established request:** generate actual speech and put character reactions in the game, particularly after acquiring an exciting gun or killing a group of zombies. Reuse suitable earlier writing.

**Working selection:** Frankie is the single local-player voice for this small solo pilot. Six original, authored lines use ElevenLabs' stock **Adam** voice (`pNInz6obpgDQGcFmaJgB`), `eleven_v3`, stability 0.5. This is provisional performance casting, not approval of Frankie's final accent or a replacement for his North Jersey design. Other protagonists and Voss are not randomly rotated into the player's mouth. The previous Voss/Callum recording is not reused as a player reaction.

**Implemented:** six local MP3 assets; a character reaction director; playback through the game's master volume; speaker-labelled subtitles; cancellation on pause/death/reset/disposal; and an independent listening page at `/audio/dialogue/index.html`. No live generation or credential reaches the browser. This is solo event attribution; future co-op must identify the player responsible for a kill before using these rules.

## Recorded script and exact triggers

Runtime IDs below correspond to filenames in `public/audio/dialogue/frankie-pilot/`. Each adjacent JSON records exact request text including performance tags, subtitle, provider, voice/model/settings, generation timestamp, request ID, byte count and SHA-256. These are working takes awaiting the user's subjective listening feedback.

| Runtime ID | Line | Trigger / performance |
| --- | --- | --- |
| shotgun | “Good. Something they'll hear upstairs.” | First acquisition of shotgun, auto shotgun or double barrel while playing. Reuses `frankie.context.04`, extending its shotgun-family coverage for this pilot. Pleased, approving menace. |
| tommy | “Now that's a proper complaint department.” | First acquisition of the Tommy gun while playing. Amused recognition of excessive force. |
| new-gun | “Nice weight. Somebody's about to have a very bad evening.” | First acquisition of another firearm while playing. Confident anticipation; no kill claim. |
| multikill-1 | “You all came together? Saves me making calls.” | Four confirmed kills in a rolling four-second window. Sarcastic professional familiarity. |
| multikill-2 | “Look at this mess. I used to get overtime for this.” | Same multi-kill condition; rotating alternative. Genuine workplace indignation in an appalling situation. |
| multikill-3 | “Anybody else? Come on. I'm already in a bad mood.” | Same multi-kill condition; rotating alternative. Irritated challenge, not an announcement that the room is empty. |

The audio totals approximately 19.4 seconds and 314 KB. Each clip is roughly 2.5–4 seconds, mono MP3 at 44.1 kHz / 128 kbps. Exact file measurements live in the per-take manifests. Unprocessed provider takes are used at a runtime gain of 0.85 through the shared master. There is no separate speech slider or new ducking behavior in this first pass; listening under heavy weapon fire should guide that next adjustment.

## Selection and repetition

- Observe ownership changes, not generic purchase sounds. Ammunition refills, denied purchases, doors, switching weapons, and melee pickups do not count as new guns.
- Record firearm identities seen during the run. Dropping a gun and reacquiring it under the two-gun loadout rules does not make it new again. Starting inventory establishes the baseline without an opening purchase quip.
- Count only actual kill events, not hits or kills inferred from ammunition spent. The current solo simulation attributes these events to the player. No claim of a grenade multi-kill or headshot is made by this generic streak bank.
- Require at least 12 seconds between pilot reactions. Each line has a 180-second repeat cooldown and a two-use-per-run cap. This pilot's 12-second spacing intentionally differs from the broader proposed eight-second team spacing.
- Consume a four-kill opportunity even if speech is busy or cooling down. Do not queue old jokes. Another opportunity requires four more kills within the window.
- A new-gun reaction takes precedence over a simultaneous streak. Only one foreground character line plays. Pause and death clear the active speech/subtitle and partial streak; resuming never replays an interrupted joke.
- Acquisition observed while paused is discarded. No delayed pickup queue is implemented. This limitation should be revisited if future reward menus grant firearms while paused.
- New simulation/run resets clear reaction history. Missing or undecodable files fail silently; gameplay continues. A skipped unavailable clip currently still consumes its reaction opportunity.

## Listening and playtesting

Open `/audio/dialogue/index.html` to hear all six takes individually. Its controls play only one sample at a time. The mechanics range also links there. In the casino, buy a new shotgun or acquire another firearm; in either the casino or range, kill four zombies within four seconds. Existing range starting guns do not trigger acquisition reactions.

Verification against main with the two-gun update: typecheck and focused lint passed, and all 289 tests passed. For trigger verification, focused tests cover first ownership versus resupply, melee exclusion, rapid versus slow kills, precedence, cooldown/caps, pause/death, audio cleanup/failure, and real simulation purchase/kill events. Browser checks verified all six files decode and an audition clip starts playback. This does not claim an expert listening review or that an entire live combat encounter was manually completed in the browser.

Keep the recording voice provisional until hearing the in-game mix. Next feedback: does he sound sufficiently dangerous and human, are the complaints funny without becoming repetitive, and is the speech audible over the new weapon sounds? No new voice generation is scheduled automatically.

## Reproduction

`tools/voice-auditions/generate-gameplay.py` loads the existing local `.env` key without printing it, makes at most six successful requests for missing takes, and skips completed assets. A pending marker blocks automatic retries after uncertain requests. Do not clear one without inspecting the provider history. Generation uses the [ElevenLabs speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert). Credentials stay ignored and outside tracked assets. These takes do not settle commercial release rights or final casting; use the account's applicable license when preparing a release.
