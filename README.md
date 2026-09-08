# ManageBac Reimagined

A Tampermonkey userscript that reshapes ManageBac around the three places
actually used day to day.

## What it does

- **Replaces the eight-item sidebar** with a three-tab switcher in the top
  bar: Tasks, Classes, IB Manager. Everything else lives behind "···".
  Removing the rail hands ~250px of width back to the content — of which the
  timetable takes 320px back only while you have it out.
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

- **Today's timetable**, in a rail of its own. Today sits apart from the three
  tabs, at the far end of the bar past the bell, because it opens no page — it
  slides out a dock where ManageBac's sidebar used to be, holding the school's
  two-week timetable cut to the six subjects actually taken. It shows what is running now with the
  minutes left, what is next, and the rest of the day underneath — free periods
  and lunch included, since those are most of what you want to know. The current
  block is marked with a highlighter that fills across it as the period runs
  down; it draws itself on once a visit rather than on every page, so moving
  around the site with the rail out doesn't replay it. Any of the ten days in the cycle is one click away.

  The day picker gives each week a row of its own, marked ١ and ٢ in the
  gutter — the one hand in the strip that isn't a Latin numeral, since the week
  is not another number in the grid but the thing the grid hangs off. The
  published timetable names Week 2's columns for the days, so that row carries
  the names; it numbers Week 1's, so that row carries 1-5 and takes its day
  names from the column standing underneath.

  It stays out until you close it, across pages and navigations, and the page
  gets pushed across rather than covered. Under 900px there is no width to give,
  so it floats over the page instead. Reopening always lands back on today.

  The published timetable has no API and no dates, only a two-week cycle, so the
  rows are scraped into `TT_RAW` and Week 2 is pinned to the week of
  Mon 7 Sep 2026 in `TT_ANCHOR`. Subjects live in `TT_MINE`, and the dock keeps
  a link to the Prime Timetable it was copied from at its foot — `TT_SOURCE` —
  to check against when a room moves. The publish id changes whenever the
  school republishes, so that constant is the one line to repoint.

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
