# Home Reference Screen v3.8

A real inspectable reference route is included:

- `/reference/home`
- `/reference/reading`

## Home reference modes

The Home reference has three built-in simulation controls:

- Normal
- Large
- Accessibility

These controls do not change the OS. They let us inspect Palta's intended reflow and reprioritization immediately on a simulator/device.

The actual production Home uses the real device font scale through `PixelRatio.getFontScale()`.

## What to inspect

### Normal
- glance is compact
- one primary action surface
- list rows carry secondary work
- content stays text/list based
- restrained borders and surfaces

### Large
- one-column glance
- less horizontal metadata compression
- explicit labels become more important
- primary actions may stack

### Accessibility
- only the highest-value glance/secondary items are initially shown
- hidden information remains reachable with explicit "more" text
- no important action depends on chevrons, swipe or long press
- large text is allowed to wrap

## Visual tokens

`paltaTheme.ts` contains candidate semantic UI tokens derived from the current official Palta mark.

They remain UI implementation candidates until Brand Master color roles are formally frozen.

## Reading route

`/reference/reading` demonstrates:

- scalable article text
- focus-reading mode
- explicit Listen control
- semantic content-first layout

TTS playback itself is intentionally not faked. The native speech adapter remains NOT VERIFIED until the computer/device phase.
