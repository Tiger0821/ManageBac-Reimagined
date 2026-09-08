# ManageBac Reimagined

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
- **Tasks expand in place.** Clicking a task in the list fetches its page in
  the background and opens the description underneath the row, so you keep
  your place. Resting on a task starts the fetch early, so by the time you
  click it is usually already there — ~570ms cold, ~8ms once warm.

  | Click | |
  |---|---|
  | click | expand inline |
  | option-click | open the full task page |
  | cmd-click | open in a new tab |

- **View tabs swap in place.** Upcoming, Past and Overdue were plain links,
  so every click was a full page load. The new view is fetched and dropped
  into the list that is already there, with the URL pushed so Back still
  works. Any failure falls back to a real navigation, so the buttons never
  become dead ends.

- **Hides filler** — the Guides panel and the Help menu. The right-hand
  column is only removed when Guides was the only thing in it, so class
  pages keep Details and Members.

## Install

Tampermonkey → Dashboard → Utilities → Import File → `ManageBac Reimagined.user.js`

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
| `ManageBac Reimagined.user.js` | current script |
| `ManageBac Elite - Elegant Material Design.CSS` | superseded 2025 userstyle, kept for reference |
| `ManageBac Enhanced - Interactive Text & Course Optimizer.js` | superseded 2025 userscript, kept for reference |
