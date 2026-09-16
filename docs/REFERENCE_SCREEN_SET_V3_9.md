# Reference Screen Set v3.9

Open `/reference` in the mobile development build.

Routes:

- `/reference/home`
- `/reference/neighborhood`
- `/reference/business`
- `/reference/care`
- `/reference/reading`

Each reference screen is intentionally inspectable without real backend data.

## What is real

- layout rules
- text wrapping behavior
- semantic color roles
- borders/dividers/radius candidates
- touch target rules
- large/accessibility mode reflow
- action hierarchy
- Care density decisions

## What is reference-only

- sample content
- fake map canvas in reference routes
- button actions that do nothing

Production screens remain API-driven.

## Computer phase

Use these screens first to tune:

1. typography
2. spacing
3. visual density
4. large-text reflow
5. bottom-sheet geometry
6. real MapLibre composition
7. native haptic feel
8. native speech quality
