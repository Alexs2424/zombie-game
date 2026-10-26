# Voice auditions — round 01

Status: API key configured locally and voice-list access verified. Custom Voice Design was rejected with HTTP 403 `feature_unavailable`: the provider says API voice creation requires a paid plan. One existing-voice Voss pilot was successfully generated with Callum using `eleven_v3`. The full custom audition batch remains pending plan access; the user has been offered an existing-voice audition as an alternative. These are exploratory auditions, not final game dialogue. No subscription was purchased.

## Writing revision

The user requested harder, more individual dialogue tied to exact player actions after hearing the stock pilot. [Contextual dialogue](../decisions/contextual-dialogue.md) now owns the current writing direction. Preserve this round as an audition record; revise the next generation input before spending credits on another batch. The pilot and its metadata remain valid historical artifacts.

## Casting approach

Use ElevenLabs Voice Design v3 for the first audition, based on its support for description-driven voice creation and three preview candidates. This is a workflow choice, not a claim that it outperforms every alternative. Audition all three candidates on the same four lines per character. Keep the other three lines for follow-up delivery tests once a voice is promising. Six design requests initially; do not automatically regenerate failures or save permanent voices before review.

References: [Voice Design](https://elevenlabs.io/docs/eleven-creative/voices/voice-design), [design endpoint](https://elevenlabs.io/docs/api-reference/text-to-voice/design).

The exact prompts, stable line IDs, context and preview text are in [round-01.json](round-01.json). The preview combines lines 1, 2, 5 and 7 to test comedy, individual perspective and a change in emotional register. Direction labels are not spoken. All candidate recordings remain dry; no PA effects yet. Preview text intentionally omits provider-specific performance tags for the first identity audition.

## Listening criteria

Can you identify the character without a name? Does the joke sound sincerely meant? Can the same voice get quieter without becoming a different person? Are the regional speech and period cadence consistent? Does the voice stay intelligible at conversational playback volume? For Voss, prioritize the contrast between welcome and threat; for Marlowe, humor should come from timing rather than announcing the joke.

Mark each candidate keep / possible / reject, with one reason. Select character voice identity first, then tune delivery. An absent dramatic shift in a concatenated preview should prompt a focused delivery test, not necessarily rejection of an otherwise strong voice.

## Script

### Frankie “Chips” Caruso

**Voice description:** An original male game character, age 47, with an unmistakable natural North Jersey accent. A gravelly middle-low voice with chest resonance, blunt consonants and sudden changes of pace. A former casino enforcer who treats violence as a matter of etiquette: wounded disbelief becomes operatic indignation, then a small muttered complaint. Funny because he is absolutely sincere, not because he performs punchlines. Loud passages retain intelligible words; quiet concern is embarrassed and gruff. Period 1970s American speech. Expressive dramatic acting, close dry studio sound, no music, no imitation of any real actor.

- **frankie.audition.01 — bitten:** “You BITE me? After I wore a tie to your funeral?”
  Direction: Offended disbelief, swell on funeral. Comic line.
- **frankie.audition.02 — kill:** “You come into a respectable establishment, you eat the STAFF?”
  Direction: Formal reprimand, outraged last word. Comic line.
- **frankie.audition.03 — revive:** “You wanna see a bright light? Look at me. I'm furious.”
  Direction: Furious tenderness, make look at me urgent. Comic line.
- **frankie.audition.04 — reload:** “I'm reloading. Have the decency to threaten somebody else.”
  Direction: Aggrieved, as if requesting ordinary courtesy. Comic line.
- **frankie.audition.05 — locked_door:** “I broke three fingers for this establishment. Now it wants exact change.”
  Direction: Betrayed, injured dignity. Comic line.
- **frankie.audition.06 — horde:** “One at a time! This is an execution, not a buffet!”
  Direction: Address the room like an offended host. Comic line.
- **frankie.audition.07 — quiet:** “I knew where that door went. I just stopped asking who came back.”
  Direction: Drop bravado, plain confession. Serious range test.

### Evelyn “Eve” Vale

**Voice description:** An original British female game character, age 34, a London stage illusionist. Clear rich middle register, crisp educated London diction with a subtle south London edge. A magnificent theatrical ego: lush confident announcements followed by surgically dry criticism. She regards supernatural events as a rival production with dreadful taste. Precise pauses, elegant vowels, abrupt private admissions, genuine fear briefly strips away the stage persona. Dynamic but not perpetually shouting. Period 1970s speech, no contemporary influencer cadence. Close dry studio recording, no music or effects, no imitation of a real performer.

- **eve.audition.01 — resurrection:** “Resurrection. On this carpet. Nobody here understands presentation.”
  Direction: Disgusted artistic assessment; stress carpet. Comic line.
- **eve.audition.02 — escape:** “An exit worthy of a standing ovation. I had absolutely nothing planned.”
  Direction: Grand flourish, then an intimate admission. Comic line.
- **eve.audition.03 — headshot:** “Lovely commitment. You've lost the audience. And most of your face.”
  Direction: Condescending encouragement. Comic line.
- **eve.audition.04 — revive:** “Up, darling. You cannot die in the supporting position.”
  Direction: Brisk stage direction, barely conceal concern. Comic line.
- **eve.audition.05 — horde:** “Oh, NOW they rush the stage. Where was this enthusiasm on Thursday?”
  Direction: Magnificent injured vanity. Comic line.
- **eve.audition.06 — invisible_ghost:** “Invisible? That's your entire act? I have a curtain that does that.”
  Direction: Disdain, as if spotting a lazy stagehand. Comic line.
- **eve.audition.07 — quiet:** “Leave the other case. That's my partner's. I'm still taking it home.”
  Direction: Small honest voice without stage projection. Serious range test.

### Leon Mercer

**Voice description:** An original male game character, age 39, with a natural southeast Texas American accent. Warm resonant middle-register voice, light grain, measured vowels and articulate practical speech. A gifted maintenance engineer of immense professional pride. Patient explanation builds into a thunderous, precisely enunciated verdict when machinery defies him. Speaks to haunted equipment as a disobedient colleague; absurdly offended but entirely competent. Give clear changes between satisfaction, controlled fury and exhausted honesty. Avoid cartoon drawl or generic movie-trailer bass. Period 1970s, close dry studio recording, no music, no actor impersonation.

- **leon.audition.01 — haunted_machine:** “I disconnected you PERSONALLY. This is insubordination.”
  Direction: Measured accusation building to personally. Comic line.
- **leon.audition.02 — power:** “There. Let there be light. And nobody touch a damn thing.”
  Direction: Satisfied biblical flourish, sharply possessive warning. Comic line.
- **leon.audition.03 — strange_noise:** “That's not a death rattle. That's a bearing. Somehow that's worse.”
  Direction: Focused listening; horror secondary to diagnosis. Comic line.
- **leon.audition.04 — locked_door:** “Solid brass lock. Hollow plywood door. We're being held hostage by furniture.”
  Direction: Almost admiring the audacity. Comic line.
- **leon.audition.05 — horde:** “Whole building comes back from the dead. Elevator's still out.”
  Direction: Raised voice of an expert with a legitimate grievance. Comic line.
- **leon.audition.06 — boss:** “Whatever you are, somebody installed you. I'd like their name.”
  Direction: Appraising an expensive disaster. Comic line.
- **leon.audition.07 — quiet:** “I signed that work order. I should've opened the door before I signed.”
  Direction: Controlled shame; no comic landing. Serious range test.

### Vivian Cross

**Voice description:** An original female game character, age 29, raised in Los Angeles. Bright middle register with a light husky edge and a natural American Los Angeles accent, no imposed Spanish accent. A flamboyantly confident card cheat: quick conspiratorial phrasing, shameless salesmanship, luxurious mock sincerity and sudden honest panic. Punchlines land with brisk certainty, not a constant sarcastic drawl. Let fear briefly catch her breath before she recovers authority. Distinct from a British stage actress: intimate persuasion rather than formal projection. Period 1970s vocabulary and cadence. Clean dry studio recording, no music or real-person imitation.

- **vivian.audition.01 — revived:** “Excellent. You've passed the interview. You're my bodyguard.”
  Direction: Breathless, instantly pretend to be the employer. Comic line.
- **vivian.audition.02 — ghost:** “Invisible, walks through walls... sweetheart, you're wasted in hospitality.”
  Direction: Genuinely delighted by a business opportunity. Comic line.
- **vivian.audition.03 — low_ammo:** “I have a very exclusive ammunition shortage. Don't tell anyone.”
  Direction: Offer a glamorous lie, urgent whisper at end. Comic line.
- **vivian.audition.04 — loot:** “It's not looting. I'm the executor. He appointed me just now, with his eyes.”
  Direction: Immediate defensive explanation. Comic line.
- **vivian.audition.05 — failed_bluff:** “I offered him half. He bit me. You cannot build a relationship on that.”
  Direction: Offended by an unreasonable negotiating partner. Comic line.
- **vivian.audition.06 — revive:** “Stay with me. I've already told three people we're business partners.”
  Direction: Warm reassurance turning into a shameless pitch. Comic line.
- **vivian.audition.07 — quiet:** “I had a way out. I came back. Please don't make me explain it.”
  Direction: Unadorned, unsettled by her own choice. Serious range test.

### Vincent Voss

**Voice description:** An original male character, approximately 58, a theatrical American casino kingpin with a luxurious resonant baritone and cultivated mid-Atlantic stage diction. Intoxicating hospitality, extravagant ceremony, immaculate consonants, expansive vowels and a smile audible in the voice. He treats a massacre as a gala he has personally organized. Crucially, real menace becomes quieter and more intimate: one person's name, a pause, a precise instruction. Distinguish charming public spectacle from frightening personal control. No constant growl, no trailer narration, no real actor imitation. Dry close studio voice without PA filter, music, or effects.

- **voss.audition.01 — cashier:** “Everything you see is insured. Do try to die facing away from the paintings.”
  Direction: Lavish welcome; delicate emphasis on paintings. Comic line.
- **voss.audition.02 — defiance:** “Of course you have a choice. I had both options prepared especially for you.”
  Direction: Personal warmth with no actual generosity. Comic line.
- **voss.audition.03 — horde:** “A warm welcome to our returning guests. Several of whom were buried at considerable expense.”
  Direction: Delighted ceremonial announcement. Comic line.
- **voss.audition.04 — escape_attempt:** “Leaving through the service entrance? After everything I've done to make you feel important.”
  Direction: Gently offended host. Comic line.
- **voss.audition.05 — round:** “A moment of silence for the departed. Wonderful. Now, a round of applause for the house.”
  Direction: Roll out the first sentence, intimate relish on house. Comic line.
- **voss.audition.06 — damage:** “You've broken something irreplaceable. Fortunately, I find people much easier to replace.”
  Direction: A tiny delighted laugh before the threat. Comic line.
- **voss.audition.07 — threat:** “Frankie. Put the key down. You know how unpleasant I become when I have to repeat myself.”
  Direction: Stop performing; quiet, exact, no growl. Serious range test.

### Marlowe

**Voice description:** An original male game character who sounds approximately 63. Dry airy middle-low register with a light northern English accent, specifically soft Yorkshire vowels, plain diction and beautifully patient pauses. An old casino bartender maintaining unreasonable etiquette during a massacre. Outrageous judgments delivered as ordinary service information, little pitch movement, never signaling a punchline. Tiny irritation at mess, attentive warmth for staff, and a rare moment of sincere gravity. Distinct from the kingpin's rich theatrical bass. Understated vocal energy but precise comic timing. Close dry studio recording, no music or effects, no actor impersonation.

- **marlowe.audition.01 — severed_hand:** “Whoever this belongs to, you're at your limit.”
  Direction: Practical inconvenience, unhurried verdict. Comic line.
- **marlowe.audition.02 — blood:** “The screaming is complimentary. The upholstery isn't.”
  Direction: Patient correction, slight emphasis on upholstery. Comic line.
- **marlowe.audition.03 — drink:** “Do take the umbrella out. We've had enough unusual deaths.”
  Direction: Matter-of-fact service instruction. Comic line.
- **marlowe.audition.04 — bloody_customer:** “I'll need a name for the tab. 'Mostly blood' isn't helping.”
  Direction: Appraise the mess, politely refuse. Comic line.
- **marlowe.audition.05 — voss_announcement:** “He calls everyone family. Saves a fortune on wages.”
  Direction: Quiet factual correction. Comic line.
- **marlowe.audition.06 — haunting:** “That one haunts the west staircase. Used to haunt the bar. Better for everyone.”
  Direction: As though reviewing a familiar bad customer. Comic line.
- **marlowe.audition.07 — quiet:** “Sit down a moment. You don't have to be useful every second you're alive.”
  Direction: Pause work; gentle direct concern. Serious range test.

## Generation

The browser workflow uses Voices → Add a new voice → Voice Design, with the exact description and preview text from the JSON. Confirm the three previews are actually available before marking a character generated. Export the previews and record their IDs/settings when the UI exposes them. No final voice has been selected.

A local prototype API helper exists at `tools/voice-auditions/generate.py` in the audition workspace. The helper is not included in this documentation publication; the commands below are a record of that local workflow, not setup instructions for a fresh checkout. It uses only Python's standard library and reads `ELEVENLABS_API_KEY` from the process environment or the ignored project `.env`, or a private file specified through `ELEVENLABS_API_KEY_FILE`. It parses credential values without executing the `.env` file. It does not read or print arbitrary local secrets. Do not put credentials in the audition JSON or commit them.

From the repository root:

```sh
python3 tools/voice-auditions/generate.py --dry-run
python3 tools/voice-auditions/generate.py --character voss
python3 tools/voice-auditions/generate.py
```

The default output is `outputs/voice-auditions/round-01/` (ignored by Git). Each character gets a timestamped take directory containing the exact request, MP3 previews, generated voice IDs, durations and response text. A completed manifest prevents accidental duplicate generation. A pending request marker blocks automatic retries after uncertain failures to avoid accidental duplicate charges; inspect provider history before removing it. Dry-run performs local validation only and makes no network requests. The design endpoint was reached but denied by the account plan; it has not returned generated previews. Text-to-speech produced the pilot below. Audio casting quality remains subject to listening review.



## Generated pilot — Voss / Callum

- Existing voice: **Callum — Husky Trickster**, ID `N2lVS1w4EtoT3dr4eOWO`.
- Model: `eleven_v3`; stability `0.5`; MP3 at 44.1 kHz / 128 kbps.
- Script: Voss audition lines 01 and 07, with `[grandly]` and `[quietly]` performance tags respectively.
- Local audition audio (not published): `outputs/voice-auditions/stock-pilot/voss-callum/voss-callum.mp3`.
- Request and result metadata: `outputs/voice-auditions/stock-pilot/voss-callum/`.
- This is a stock-voice delivery test, not an original designed character voice or selected final casting. No subjective listening assessment is claimed.
- Local outputs are ignored by Git. Playback requires the audition workspace's generated files; approved audio should be promoted to a versioned asset location in a later production pass.

The configured key can list voices and synthesize speech. Account subscription inspection was denied because the key lacks `user_read`; that extra permission is not required for the pilot and has not been requested. The custom-design rejection itself establishes the current plan restriction.
