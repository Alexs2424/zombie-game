# Slot-machine pass-by audio

The twelve cabinets share their layout between rendering and audio. Each speaker
sits just outside its bank's collision rectangle, facing the adjacent aisle.
Walking within 3.5 metres can trigger the nearest visible cabinet. Actual player
displacement drives the trigger, so holding a movement key against an obstacle
does not count as walking.

## Sound and pacing

Three original, deterministic Web Audio buffer recipes in
`lib/game/slot-sounds.ts` combine quiet motor noise, padded reel stops, coin ticks,
and short electronic bell notes. Each lasts 1.45 seconds. A slightly drooping
last note gives the machines a tired casino character. These sounds are
synthesized locally; they are not AI-generated samples or third-party recordings.
They require no additional downloads, credentials, or external service.

- One slot voice can play at a time, with a four-second shared minimum interval.
- A cabinet must wait 20 seconds and the player must leave beyond 4.5 metres
  before it can play again. Standing beside a machine stays quiet.
- Playback follows listener rotation and distance, with a low-pass filter and
  zero gain at five metres. Walls and the back of a cabinet bank block both new
  cues and active tails.
- Zombie calls, attack grunts, and round stingers take priority. Pause, focus
  loss, a fresh run, and audio disposal stop active slot playback.
- The existing sound-volume control applies. The previous room-wide random
  slot melody has been removed; incidental sounds in the other rooms remain.

## Implementation

- `lib/game/slot-machines.ts`: shared cabinet positions and model variants.
- `lib/game/slot-audio-director.ts`: proximity, visibility, cooldowns, and rearming.
- `lib/game/slot-sounds.ts`: three local sample recipes.
- `lib/game/audio.ts`: buffer creation, playback, priority, and listener updates.
- `lib/game/runtime.ts`: actual movement and development walkthrough scenarios.

## Validation

The suite contains 125 tests. Slot coverage checks all twelve cabinet positions,
nearest-source selection, both banks, obstruction, stationary behavior,
cooldowns, rearming, pause/reset, playback routing, distance/panning updates,
combat priority, cleanup, and bounded, distinct sample waveforms.

In development, open `/?playtest=1` and use **Walk slots west**, **Walk slots
east**, or **Walk second bank**. Each starts a safe simulation and walks down
the selected aisle for 2.3 seconds. The status line identifies the last emitting
cabinet and recipe. These controls and diagnostics are excluded from the
production interface. Browser checks confirmed the expected cabinet in all
three scenarios. Waveform and routing checks do not substitute for a human
listening pass when tuning the mix.
