# ManageBac Switch

A Tampermonkey userscript that reshapes ManageBac around the three places
actually used day to day.

## What it does

- **Replaces the eight-item sidebar** with a three-tab switcher in the top
  bar: Tasks, Classes, IB Manager. Everything else lives behind "···".
  Removing the rail hands ~250px of width back to the content.
- **Class palette** (`⌘K` / `Ctrl+K`, or the Classes tab) — type to filter,
  arrow keys to move, Enter to open.
- **Folds away earlier years.** The current year is detected as the highest
  `(Grade N)` across your classes, so last year's duplicates collapse on
  their own and it keeps working as you move up a grade. A search still
  reaches them.
- **Tidies class names.** `IB DP Mathematics: Analysis and Approaches HL
  (Grade 11)` → `Math AA HL`. The full name stays on hover.
- **Hides filler** — the Guides panel and the Help menu. The right-hand
  column is only removed when Guides was the only thing in it, so class
  pages keep Details and Members.

## Install

Tampermonkey → Dashboard → Utilities → Import File → `ManageBac Switch.user.js`

## Notes

- Light-only. Dark mode was implemented and then removed: ManageBac hardcodes
  colours across hundreds of buttons, icons and small controls, and
  recolouring them piecemeal read worse than leaving them alone.
- Every destination clicks ManageBac's *own* sidebar link rather than
  navigating to a URL of its own. Some routes resolve through ManageBac's
  client-side handling and 404 when opened directly.
- Personal short names live in `CONFIG.shortNames` at the top of the file.

## Files

| File | |
|---|---|
| `ManageBac Switch.user.js` | current script |
| `ManageBac Elite - Elegant Material Design.CSS` | superseded 2025 userstyle, kept for reference |
| `ManageBac Enhanced - Interactive Text & Course Optimizer.js` | superseded 2025 userscript, kept for reference |
