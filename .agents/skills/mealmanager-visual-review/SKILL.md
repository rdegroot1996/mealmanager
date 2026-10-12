---
name: mealmanager-visual-review
description: Review MealManager's live rendered UI for responsive, layout, dialog, navigation, image, contrast, overlap, or overflow regressions. Use only when explicitly requested or when the requested change creates plausible visual risk; do not use for non-rendered changes or merely because frontend files changed.
---

# MealManager visual review

This skill is opt-in. Do not start or announce a visual review for every frontend change. Use it when the user explicitly requests visual review, or when the change plausibly affects rendered UI—for example layout, responsive behavior, dialogs, navigation, images, contrast, overlap, overflow, or a browser workflow that requires rendered-state investigation. For non-rendered changes, use the smallest relevant automated checks and do not invoke this skill.

Playwright CLI and its installed workspace skills are required for navigation, focused E2E investigation, and routine browser checks. Unless investigation needs earlier browser evidence, perform one targeted review near final handoff rather than repeating it during implementation. Prefer screenshot-free evidence from accessibility snapshots, DOM state, computed styles, element bounds, overflow measurements, and console or network output. Capture and inspect only the changed surface, and only when the user explicitly requests visual judgment or those CLI checks cannot establish the rendered result. Use Playwright MCP only for a targeted screenshot that remains necessary.

## Prepare Playwright CLI

Before the first browser task in a checkout, run `playwright-cli install --skills`. This installs the CLI skill files under `.claude/skills/playwright-cli`; they are generated local artifacts and intentionally ignored. If `playwright-cli` is not available, install it before proceeding.

## Start and connect

1. From `src/MealManager.App`, run `npm run start:mock`.
2. Navigate the browser to `http://localhost:4200`.
3. Use the mock server for visual review by default. It is the fast path for inspecting rendered layout, responsive behavior, dialogs, navigation, and image presentation.
4. Use the production Docker app only when the review depends on production integration, authentication or persistence behavior, or state supplied by an existing E2E spec. In that case, run `npm run e2e:up` and navigate to `http://localhost:8081`.

## Risk-based responsive review

Start at the viewport where the change was made. Add the nearest breakpoint only when a responsive boundary, wrapping, layout, dialog size, navigation, or image sizing could be affected. Check all four presets only for shared application shells, broadly responsive surfaces, or a change that can plausibly affect every layout. Do not perform visual review for non-rendered changes.

| Name           | Viewport     |
| -------------- | ------------ |
| Small mobile   | `390 × 844`  |
| Mobile (`sm`)  | `640 × 844`  |
| Tablet (`md`)  | `768 × 1024` |
| Desktop (`lg`) | `1024 × 768` |

At each selected preset, inspect the changed surface and any affected dialog for horizontal scrolling, clipping, overlap, off-screen controls, broken image layout, and unusable touch targets. Prefer element bounds and computed layout checks for these conditions. Scroll dense or deliberately scrollable regions only when the change could affect them.

## E2E-assisted investigation

Use `npm run test:e2e:reuse -- <spec>` when an existing test provides the needed state. It leaves the Docker container running after the test. Prefer CLI for the routine reproducible flow; use MCP only when the rendered state needs visual inspection.

Do not add screenshot baselines or pixel-diff assertions. When a screenshot is necessary, keep it as transient evidence and avoid repeats for unchanged state. Report each finding with route, state, viewport, observed behavior, and concise reproduction steps. State explicitly when no visual regression is found.

## Cleanup

Stop the mock development server when the review is complete. If production Docker was used, run `npm run e2e:down` from `src/MealManager.App`; do not stop the isolated stack while another E2E run uses it.
