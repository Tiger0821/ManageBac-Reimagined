// ==UserScript==
// @name         ManageBac Reimagined
// @namespace    http://tampermonkey.net/
// @version      2026.09.10.1
// @description  Replaces ManageBac's eight-item sidebar with a three-tab switcher and a type-to-find class palette. Last year's classes fold away on their own.
// @author       Shane
// @match        https://*.managebac.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=managebac.com
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
     SETTINGS
     ============================================================ */

  const CONFIG = {
    // The three places you actually go. Order is the tab order.
    // dynamicLabel is the link's exact text in ManageBac's own sidebar —
    // that link is what actually gets clicked. href is only a fallback for
    // if the sidebar link can't be found, since hardcoded routes here can
    // 404 on an account they weren't tested against.
    tabs: [
      { id: 'tasks',   label: 'Tasks',      dynamicLabel: 'Tasks & Deadlines', href: '/student/tasks_and_deadlines', match: /tasks_and_deadlines|^\/student\/home/ },
      { id: 'classes', label: 'Classes',    panel: 'classes',                                                        match: /^\/student\/classes/ },
      { id: 'ib',      label: 'IB Manager', dynamicLabel: 'IB Manager',        href: '/student/ib/activity/cas',      match: /^\/student\/ib/ },
      // Not in the switcher: it goes nowhere, it pulls the timetable out, so
      // it stands on its own at the right end of the bar. Nothing can make it
      // the active tab by URL either — /(?!)/ never matches, which is the point.
      { id: 'today',   label: 'Today',      panel: 'timetable',                                                      match: /(?!)/ }
    ],

    // Everything else, tucked behind "More" rather than deleted.
    more: [
      { label: 'My Workspace',  dynamicLabel: 'My Workspace',      href: '/student/home' },
      { label: 'Calendar',      dynamicLabel: 'Calendar',          href: '/student/calendar' },
      { label: 'Timetables',    dynamicLabel: 'Timetables',        href: '/student/timetables' },
      { label: 'Portfolio',     dynamicLabel: 'Portfolio',         href: '/student/portfolio' },
      { label: 'Exams Planner', dynamicLabel: 'Exams Planner',     href: '/student/ib/plan' },
      { label: 'Groups',        dynamicLabel: 'Browse All Groups', href: '/student/groups/all' }
    ],

    // Fold classes from earlier school years. The current year is the
    // highest "(Grade N)" found, so this keeps working as you move up.
    foldPastYears: true,

    // "IB DP Chinese A: Language and Literature (Grade 11) -2"
    //   -> "Chinese A: Language and Literature"
    tidyNames: true,

    // Applied after tidying. Left side must match the tidied name.
    shortNames: {
      'Mathematics: Analysis and Approaches HL': 'Math AA HL',
      'Chinese A: Language and Literature': 'Chinese A LL',
      'Theory of Knowledge': 'TOK',
      'HS G11 Guidance': 'Guidance',
      'College Counseling': 'Counseling'
    }
  };

  /* ============================================================
     STATE
     ============================================================ */

  const store = {
    get: (k, d) => { try { return typeof GM_getValue === 'function' ? GM_getValue(k, d) : JSON.parse(localStorage.getItem('mbs-' + k) ?? 'null') ?? d; } catch (e) { return d; } },
    set: (k, v) => { try { typeof GM_setValue === 'function' ? GM_setValue(k, v) : localStorage.setItem('mbs-' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* Light-only by design. ManageBac hardcodes its own colours across
     hundreds of buttons, icons and small controls; recolouring them
     piecemeal read worse than leaving them alone, so dark mode was cut.
     color-scheme is pinned to light so that on a machine set to dark, the
     browser's own widgets (scrollbars, date pickers, native selects) match
     the page instead of rendering dark on top of it. */
  document.documentElement.style.colorScheme = 'light';

  /* ============================================================
     HELPERS
     ============================================================ */

  const gradeOf = s => { const m = (s || '').match(/\(Grade\s*(\d+)\)/i); return m ? +m[1] : null; };

  function tidy(name) {
    let s = (name || '').replace(/\s+/g, ' ').trim();
    if (!CONFIG.tidyNames) return s;
    s = s.replace(/^IB\s+(DP|MYP|PYP|CP)\s+/i, '')
         .replace(/^\[[^\]]*\]\s*/, '')
         .replace(/\s*\(Grade\s*\d+\)\s*/ig, ' ')
         .replace(/\s*-\s*\d+\s*$/, '')
         .replace(/\s+/g, ' ').trim();
    return CONFIG.shortNames[s] || s;
  }

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function loadFonts() {
    if (document.getElementById('mbs-fonts')) return;
    const pre = el('link'); pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = 'anonymous';
    const link = el('link');
    link.id = 'mbs-fonts'; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    (document.head || document.documentElement).append(pre, link);
  }

  /* Class links are context-aware: on a plain page they're
     /student/classes/<id>, but inside a class they gain the current
     subsection, e.g. /student/classes/<id>/core_tasks — ManageBac keeps you
     in the same tab when you switch class. So the id is matched with an
     optional trailing path rather than anchored at the end, or the list
     comes back empty on exactly those pages. "/classes/my" has no digits,
     so "Browse All Classes" still correctly falls out. */
  const CLASS_HREF = /\/classes\/(\d+)(?:\/|$)/;
  const GROUP_HREF = /\/groups\/(\d+)(?:\/|$)/;

  /* Read the class list out of ManageBac's own sidebar before we hide it.

     Both lists are read in one pass and cached. renderPanel() asks for them
     again on every keystroke, and tidy() runs five regexes per class, so
     typing six characters into the palette was re-scanning the sidebar
     twelve times for an answer that hadn't changed. The cache is keyed on
     the wrapper node and the submenu-link count: ManageBac's client-side
     navigation swaps the whole menu, so a new node or a different number of
     links is the same signal a fresh scan would have picked up. */
  let navCache = { wrap: null, count: -1, classes: [], groups: [] };

  function readNav() {
    const wrap = document.querySelector('.f-menu__item.js-menu-classes-list');
    const links = document.querySelectorAll('.f-menu__submenu-link');
    if (navCache.wrap === wrap && navCache.count === links.length) return navCache;

    const classes = [], groups = [];
    if (wrap) wrap.querySelectorAll('.f-menu__submenu-link').forEach(a => {
      const href = a.getAttribute('href') || '';
      const m = href.match(CLASS_HREF);
      if (!m) return;
      const raw = a.textContent.replace(/\s+/g, ' ').trim();
      // elRef: click ManageBac's own link rather than jumping to the URL
      classes.push({ id: m[1], href, raw, name: tidy(raw), grade: gradeOf(raw), elRef: a });
    });

    // Groups aren't classes: no "(Grade N)" or "-N" section suffix to strip,
    // so they skip tidy() rather than risk it eating a real trailing number
    // (e.g. "IB Film Club 2019-2020" is not a class section).
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      const m = href.match(GROUP_HREF);
      if (!m) return;
      const raw = a.textContent.replace(/\s+/g, ' ').trim();
      groups.push({ id: m[1], href, raw, name: raw, grade: null, elRef: a });
    });

    navCache = { wrap, count: links.length, classes, groups };
    return navCache;
  }

  const readClasses = () => readNav().classes;
  const readGroups  = () => readNav().groups;

  /* Find one of ManageBac's own nav links (top level OR submenu) by its
     visible label, e.g. "Tasks & Deadlines" or "IB Manager".

     Every destination in this script routes through the real link rather
     than a URL of our own: some of ManageBac's routes resolve through its
     own client-side click handling, or off in-app state, so jumping
     straight to an href with location.href can land on a 404 even when
     the same link works when actually clicked. The sidebar is only hidden
     with CSS, never removed, so its links stay in the DOM and a
     programmatic click on them behaves exactly like a real one. */
  function findNavLink(label) {
    // submenu links carry .f-menu__link too, so this covers both levels
    const links = document.querySelectorAll('#menu a.f-menu__link[href]');
    for (const a of links) {
      const titleEl = a.querySelector('.f-menu__link-title, .f-menu__submenu-link-title');
      const text = (titleEl ? titleEl.textContent : a.textContent).replace(/\s+/g, ' ').trim();
      if (text === label && a.getAttribute('href') !== 'javascript:void(0)') return a;
    }
    return null;
  }

  /* Navigate the way ManageBac itself would: click its own link when we can
     find it, and only fall back to a plain URL jump when we can't. */
  function goTo(item) {
    const real = (item.elRef && item.elRef.isConnected)
      ? item.elRef
      : findNavLink(item.dynamicLabel || item.label);
    if (real) { real.click(); return true; }
    if (item.href) { location.href = item.href; return true; }
    return false;
  }

  /* ============================================================
     STYLESHEET
     ============================================================ */

  const CSS = `
/* Monochrome: no accent hue at all. Emphasis comes from weight, spacing and
   contrast instead of colour, which leaves ManageBac's own status colours
   (overdue red, the orange it paints on its own controls) as the only
   colour on screen — so they read as signal rather than decoration. */
:root {
  --p:#FAFAFA; --s:#FFFFFF; --s2:#F4F4F4;
  --ink:#242424; --ink2:#5C5C5C; --ink3:#8E8E8E;
  --line:#E5E5E5; --line2:#D4D4D4;
  --a:#242424; --a2:#000000; --aw:#F0F0F0;
  --sh:0 1px 2px rgba(0,0,0,.05), 0 12px 30px -14px rgba(0,0,0,.22);
  --mark:#F7EE96; --mark2:#E6D65A;
  --dock:320px;
  --sans:'Instrument Sans',system-ui,-apple-system,'Segoe UI','PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
}

/* ---------- ground ---------- */
html, body { background:var(--p) !important; color:var(--ink) !important; }
body, .card, .modal-content, .dropdown-menu, .f-tile, input, select, textarea,
button, .btn, h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, div {
  font-family: var(--sans) !important;
}
.bg-gray-100, .f-layout-main__content.bg-gray-100 { background:var(--p) !important; }
.bg-white { background:var(--s) !important; }
.color-gray-600, .color-secondary, .gray-text { color:var(--ink3) !important; }
::selection { background:var(--aw); color:var(--ink); }
:focus-visible { outline:2px solid var(--a) !important; outline-offset:2px !important; border-radius:6px; }
/* fields show focus with their own border + ring, so the global outline
   would draw a second one around them */
.form-control:focus, .form-control:focus-visible,
input:focus-visible, textarea:focus-visible, select:focus-visible { outline:none !important; }
hr { border-color:var(--line) !important; }

h1 { font-size:30px !important; font-weight:700 !important; letter-spacing:-.022em !important; line-height:1.15 !important; color:var(--ink) !important; }
h2, .h5, .f-tile__title { font-size:16px !important; font-weight:600 !important; letter-spacing:-.01em !important; color:var(--ink) !important; }
h3, .h6 { font-size:14px !important; font-weight:600 !important; color:var(--ink) !important; }
/* With no accent hue, links can't be picked out by colour — an underline on
   hover carries the affordance instead.

   .btn is excluded from the hover COLOUR, not just the underline: a:hover
   is specificity (0,1,1) and outranks .btn-primary at (0,1,0), so without
   this the label on a dark button turned black on black and vanished.

   Tabs and menu items are excluded from the underline because they already
   carry their own 2px indicator — a text-decoration line on top of that
   reads as a double rule. */
a { color:var(--a) !important; text-decoration:none; }
a:not(.btn):not(.nav-link):not(.dropdown-item):hover { color:var(--a2) !important; }
a:not(.btn):not(.nav-link):not(.dropdown-item):not(.f-menu__link):not(.mbs-opt):not(.mbs-tab):not(.navbar-brand):hover {
  text-decoration:underline;
}
a.link-dark, .f-tile__title-link { color:var(--ink) !important; font-weight:600 !important; }
a.link-dark:hover, .f-tile__title-link:hover { color:var(--a) !important; }
.f-numeric, .badge-label, time, code, kbd { font-family:var(--mono) !important; font-variant-numeric:tabular-nums; }

/* ---------- the rail goes away, content takes the width ----------
   The rail's offset moves between two properties depending on its state:
   margin-left (250px) when expanded, padding-left (64px) when narrow.
   Both are normalised here, with padding kept at the 16px gutter the
   expanded layout already uses, so content lands in the same place
   regardless of which state ManageBac last remembered. */
#menu.f-menu, #menu-trigger { display:none !important; }
.f-layout-main__wrapper { margin-left:0 !important; padding-left:16px !important; }
.f-layout-main, .f-layout-main__body, .f-layout-main__content, main#main-content {
  margin-left:0 !important; left:0 !important;
}

/* ---------- top bar ---------- */
nav.navbar, nav.navbar.bg-white {
  background:var(--s) !important;
  border-bottom:1px solid var(--line) !important;
  box-shadow:none !important;
}
.navbar .form-control { background:var(--s2) !important; border:1px solid var(--line) !important; border-radius:8px !important; color:var(--ink) !important; font-size:13px !important; }
/* the hamburger used to hold this space; without it the logo hits the edge */
.navbar-row { padding-left:14px !important; }
/* Help menu: never used, and it crowds the right side of the bar */
.f-help-support { display:none !important; }

/* ---------- right-hand column ----------
   The Guides panel is filler. Its tab and body are always hidden; the whole
   column is only removed when Guides was the only thing in it, which
   tidyRightSidebar() decides — class pages keep it for Details and Members. */
.js-sidebar_guides,
.f-sidebar-tabs__toggle[data-bs-target=".js-sidebar_guides"] { display:none !important; }
.f-layout-main__sidebar.mbs-aside-empty { display:none !important; }
/* Chat Bot launcher on the same right-edge strip */
.js-zendesk-launcher { display:none !important; }

/* the unread counter — the bell itself stays, so notifications are still
   reachable; it's the permanent red number that nags */
.f-badge-indicator.count { display:none !important; }

/* Hover tooltips on the icon buttons — notifications, quick add, the panel
   toggles. They label icons you already know, and pop up whenever the
   cursor crosses the top bar. Removing them is safe: each button keeps its
   accessible name in an aria-label or a .visually-hidden span, so screen
   readers still announce it, and the spans are absolutely positioned so
   nothing reflows. */
.btn-tooltip, .tooltip.show { display:none !important; }

/* ---------- the switcher ---------- */
.mbs-switch {
  display:flex; align-items:center; gap:2px;
  padding:3px; margin-left:4px;
  background:var(--s2); border:1px solid var(--line); border-radius:10px;
}
.mbs-tab {
  appearance:none; border:0; background:transparent; cursor:pointer;
  color:var(--ink2); font:500 13px/1 var(--sans);
  padding:7px 12px; border-radius:7px; white-space:nowrap;
  display:flex; align-items:center; gap:7px;
  transition:background .12s ease, color .12s ease;
}
.mbs-tab:hover { color:var(--ink); background:var(--s); }
/* The lifted pill sits on --s2 at 4% contrast, which the drop shadow alone
   wasn't enough to define. A hairline ring under the shadow gives it an
   edge without introducing a border that would change its metrics. */
.mbs-tab.is-active {
  background:var(--s); color:var(--ink); font-weight:600;
  box-shadow:0 0 0 1px rgba(0,0,0,.045), 0 1px 2px rgba(0,0,0,.07);
}
.mbs-tab__count {
  font-family:var(--mono); font-size:10px; font-weight:500;
  color:var(--ink3); background:var(--p);
  border-radius:4px; padding:1px 4px;
}
.mbs-tab.is-active .mbs-tab__count { color:var(--a2); background:var(--aw); }
.mbs-kbd {
  font-family:var(--mono); font-size:9.5px; color:var(--ink3);
  border:1px solid var(--line2); border-radius:4px; padding:1px 4px; opacity:.8;
}

/* Today isn't one of the three places: it opens no page, it pulls a rail out
   of the side of the window. Standing it apart from the segmented group, over
   with the bell and the avatar, says that before it is pressed. */
.mbs-today {
  appearance:none; cursor:pointer;
  display:flex; align-items:center; gap:7px;
  padding:7px 12px; border-radius:9px;
  background:var(--s2); border:1px solid var(--line);
  color:var(--ink2); font:500 13px/1 var(--sans); white-space:nowrap;
  transition:background .12s ease, color .12s ease, border-color .12s ease;
}
/* only when it lands at the end of the bar with nothing to sit against */
.mbs-today--far { margin-left:auto; }
.mbs-today:hover { background:var(--s); color:var(--ink); border-color:var(--line2); }
/* Pressed, this one is holding a whole rail open — the quiet pill the tabs use
   for "you are here" reads as too small a claim for that. */
.mbs-today.is-active { background:var(--a); border-color:var(--a); color:#fff; }
.mbs-today:focus-visible { border-radius:9px !important; }

/* ---------- panels ---------- */
.mbs-panel {
  position:fixed; z-index:2000;
  width:330px; max-height:min(72vh, 540px);
  display:flex; flex-direction:column; overflow:hidden;
  background:var(--s); border:1px solid var(--line);
  border-radius:12px; box-shadow:var(--sh);
}
.mbs-panel[hidden] { display:none !important; }
.mbs-panel__search { flex:none; padding:10px; border-bottom:1px solid var(--line); }
.mbs-panel__search input {
  width:100%; box-sizing:border-box; outline:none;
  background:var(--s2); color:var(--ink);
  border:1px solid var(--line); border-radius:8px;
  padding:8px 10px; font:400 13px var(--sans);
}
.mbs-panel__search input::placeholder { color:var(--ink3); }
.mbs-panel__search input:focus { border-color:var(--a); background:var(--s); }
/* A long class list is cut dead flat by the panel's bottom edge, which
   reads as the end of the list rather than the edge of the window onto it.
   The mask rides the scroll box, so the fade stays at the bottom while rows
   move under it, and the matching bottom padding means the last row can
   still scroll clear of the fade and land fully opaque. */
.mbs-list {
  flex:1 1 auto; min-height:0; overflow-y:auto; padding:6px 6px 16px;
  -webkit-mask-image:linear-gradient(#000 calc(100% - 16px), transparent);
  mask-image:linear-gradient(#000 calc(100% - 16px), transparent);
}
.mbs-opt {
  display:flex; align-items:center; gap:9px;
  padding:7px 9px; border-radius:7px;
  color:var(--ink2) !important; font-size:13px; text-decoration:none; cursor:pointer;
}
.mbs-opt:hover, .mbs-opt.is-cursor { background:var(--s2); color:var(--ink) !important; }
.mbs-opt.is-current { color:var(--a2) !important; font-weight:600; }
.mbs-opt__dot { width:7px; height:7px; border-radius:50%; background:var(--a); flex:none; opacity:.75; }
.mbs-opt.is-past .mbs-opt__dot { background:var(--line2); }
/* Where you are now. The bold label alone is easy to miss mid-list; a halo
   on the dot is the one thing on the row that isn't also doing another job. */
.mbs-opt.is-current .mbs-opt__dot { opacity:1; box-shadow:0 0 0 3px var(--aw); }
/* rows and tabs round at 7px, so the global focus ring's 6px sat just
   inside their corners */
.mbs-opt:focus-visible, .mbs-tab:focus-visible { border-radius:7px !important; }
.mbs-opt__name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mbs-opt__tag { margin-left:auto; font-family:var(--mono); font-size:9.5px; color:var(--ink3); flex:none; }
.mbs-group {
  padding:10px 10px 4px; font-family:var(--mono);
  font-size:9.5px; letter-spacing:.09em; text-transform:uppercase; color:var(--ink3);
}
.mbs-fold {
  display:flex; align-items:center; width:calc(100% - 12px); margin:4px 6px 2px;
  background:transparent; border:0; border-top:1px solid var(--line);
  padding:8px 4px 4px; cursor:pointer; text-align:left;
  font-family:var(--mono); font-size:9.5px; letter-spacing:.09em; text-transform:uppercase; color:var(--ink3);
}
.mbs-fold:hover { color:var(--ink2); }
.mbs-fold::after { content:'▸'; margin-left:auto; transition:transform .15s ease; }
.mbs-fold[aria-expanded="true"]::after { transform:rotate(90deg); }
@keyframes mbs-row-in { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:none; } }
.mbs-opt--enter { animation:mbs-row-in 140ms cubic-bezier(.4,0,.2,1) both; }
.mbs-empty { padding:14px 10px; font-size:12.5px; color:var(--ink3); text-align:center; }

/* The palette is driven from the keyboard but never said so. The legend
   uses the same mono-caps as the group headers, so it reads as part of the
   panel's chrome rather than as a tooltip bolted underneath it. */
.mbs-panel__hint {
  flex:none; display:flex; gap:13px; align-items:center;
  padding:8px 11px; border-top:1px solid var(--line); background:var(--s);
  font-family:var(--mono); font-size:9.5px; letter-spacing:.07em;
  text-transform:uppercase; color:var(--ink3);
}
.mbs-panel__hint > span { display:flex; gap:5px; align-items:center; }
.mbs-panel__hint b {
  font-weight:500; color:var(--ink2);
  border:1px solid var(--line2); border-radius:3px; padding:0 3px;
}

/* ---------- cards, tiles, buttons ---------- */
.card, .f-tile, .f-tile--elevated, .f-box-item {
  background:var(--s) !important; border:1px solid var(--line) !important;
  border-radius:10px !important; box-shadow:none !important;
  transition:border-color .14s ease, box-shadow .14s ease !important;
}
.f-tile--elevated:hover, .f-box-item:hover { border-color:var(--line2) !important; box-shadow:var(--sh) !important; }
.card-tinted { background:var(--s2) !important; }
/* the clipart illustrations, and the tile slot they sat in */
.sebo-icon, .f-tile__icon { display:none !important; }
.btn { border-radius:7px !important; font-size:13px !important; font-weight:500 !important; box-shadow:none !important; }
.btn-primary { background:var(--a) !important; border-color:var(--a) !important; color:#fff !important; }
.btn-primary:hover { background:var(--a2) !important; border-color:var(--a2) !important; }
.btn-secondary, .btn-light { background:var(--s) !important; border:1px solid var(--line2) !important; color:var(--ink2) !important; }
.btn-secondary:hover, .btn-light:hover { background:var(--s2) !important; color:var(--ink) !important; }
.btn-blank, .btn-icon { background:transparent !important; border:0 !important; color:var(--ink2) !important; }
.dropdown-toggle { font-family:var(--mono) !important; font-size:11.5px !important; }
.badge, .badge-label, .label { font-family:var(--mono) !important; font-size:10px !important; font-weight:500 !important; border-radius:4px !important; padding:2px 5px !important; }
.color-box-gray { background:var(--s2) !important; color:var(--ink3) !important; }
.form-control, .filter-input { background:var(--s) !important; border:1px solid var(--line) !important; border-radius:7px !important; color:var(--ink) !important; font-size:13px !important; box-shadow:none !important; }
.form-control:focus { border-color:var(--a) !important; box-shadow:0 0 0 3px var(--aw) !important; }
.dropdown-menu { background:var(--s) !important; border:1px solid var(--line) !important; border-radius:9px !important; box-shadow:var(--sh) !important; }
.dropdown-item { color:var(--ink2) !important; font-size:13px !important; border-radius:5px !important; }
.dropdown-item:hover { background:var(--s2) !important; color:var(--ink) !important; }
.modal-content { background:var(--s) !important; border:1px solid var(--line) !important; border-radius:12px !important; box-shadow:var(--sh) !important; }
.modal-header { background:var(--s) !important; border-bottom:1px solid var(--line) !important; }
.modal-header .modal-title, .modal-header h1, .modal-header h2, .modal-header h4 { color:var(--ink) !important; font-size:17px !important; font-weight:600 !important; }
table, .table { color:var(--ink2) !important; font-size:13px !important; }
.table > :not(caption) > * > * { background:transparent !important; border-color:var(--line) !important; }
.accordion-item, .accordion-button, .accordion-body { background:var(--s) !important; color:var(--ink) !important; border-color:var(--line) !important; }
.accordion-button { font-size:13px !important; box-shadow:none !important; }

/* ---------- surfaces ManageBac paints white ----------
   These aren't .card/.bg-white, so the card rules above miss them. In dark
   mode that left light text stranded on white panels; found by auditing
   contrast on a class page rather than by guessing at class names. */
.f-surface, .f-hero, .f-sidebar, .f-sidebar-wrapper,
.homeroom-attendance-component, .f-sidebar-tabs__toggle {
  background: var(--s) !important;
}
/* .f-task-tile needs the extra class to outrank ManageBac's own !important */
.f-task-tile, .f-tile.f-task-tile { background: var(--s) !important; }
/* select2 widgets ship their own white chrome */
.select2-selection, .select2-selection--single, .select2-dropdown, .select2-results__option {
  background: var(--s) !important; color: var(--ink) !important; border-color: var(--line) !important;
}

/* ---------- segmented button groups ----------
   These arrive as a Bootstrap .btn-group, meant to render as one joined
   control. The blanket border-radius on .btn above was splitting them into
   three separate pills, so the grouping is restored here: square middles,
   rounded ends, and borders collapsed onto each other. */
.btn-group { gap:0 !important; }
.btn-group > .btn { border-radius:0 !important; margin-left:-1px !important; position:relative; }
.btn-group > .btn:first-child { border-radius:7px 0 0 7px !important; margin-left:0 !important; }
.btn-group > .btn:last-child { border-radius:0 7px 7px 0 !important; }
.btn-group > .btn:hover { z-index:1; }
/* The doubled .active is deliberate. ManageBac's competing rule lives in a
   stylesheet this page cannot read (CORS), so rather than guess its weight
   the selector is simply made heavier than any single-class form. */
.btn-group > a.btn.active.active,
.btn-group > button.btn.active.active {
  background:var(--ink) !important; border-color:var(--ink) !important;
  color:#fff !important; z-index:2;
}
.btn-group > .btn.active .f-badge-indicator { color:#fff !important; }

/* the list dips while a view is fetched, instead of the page flashing */
.js-tasks { transition:opacity 120ms ease; }
.js-tasks.mbs-swapping { opacity:.4; }

/* ---------- inline task details ---------- */
/* The panel is the same white as the row above it, so an expanded task
   reads as one continuous card against the page — separation comes from
   the card's edge rather than an internal tint, which at this lightness
   just muddied it. Labels sit at secondary ink, not tertiary: on a tinted
   panel the old grey measured 2.98 against its background. */
.mbs-task-detail {
  box-sizing:border-box;
  background:var(--s); border:1px solid var(--line); border-top:0;
  border-radius:0 0 10px 10px; margin:-1px 0 6px; padding:14px 16px;
  font-size:13px; line-height:1.6; color:var(--ink);
}
.mbs-task-detail[hidden] { display:none !important; }
.f-task-tile.mbs-tile-open { border-radius:10px 10px 0 0 !important; border-bottom-color:transparent !important; }
.mbs-task-detail__status { font-family:var(--mono); font-size:11px; color:var(--ink2); }
.mbs-task-detail h1, .mbs-task-detail h2, .mbs-task-detail h3,
.mbs-task-detail h4, .mbs-task-detail h5, .mbs-task-detail .h4, .mbs-task-detail .h5 {
  font-size:11px !important; font-family:var(--mono) !important; font-weight:500 !important;
  letter-spacing:.08em !important; text-transform:uppercase !important; color:var(--ink2) !important;
  margin:0 0 6px !important;
}
.mbs-task-detail p, .mbs-task-detail span, .mbs-task-detail li { color:var(--ink); }
/* attachments need their own fill now that the panel is white */
.mbs-task-detail a.fr-file, .mbs-task-detail [class*="attachment"] {
  background:var(--s2) !important; border:1px solid var(--line) !important; border-radius:8px !important;
}
.mbs-task-detail a { text-decoration:underline; }
.mbs-task-detail img { max-width:100%; height:auto; }
.mbs-task-detail__foot { margin-top:12px; padding-top:10px; border-top:1px solid var(--line); }
.mbs-task-open {
  font-family:var(--mono); font-size:10px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--ink2) !important; text-decoration:none !important;
}
.mbs-task-open:hover { color:var(--ink) !important; text-decoration:underline !important; }

* { scrollbar-width:thin; scrollbar-color:var(--line2) transparent; }
::-webkit-scrollbar { width:10px; height:10px; }
::-webkit-scrollbar-thumb { background:var(--line2); border-radius:8px; border:3px solid transparent; background-clip:content-box; }
::-webkit-scrollbar-track { background:transparent; }

/* ---------- timetable dock ----------
   The one colour in the whole script. Everywhere else emphasis comes from
   weight and contrast, but "which block am I in" is a thing you look for
   rather than read, and a marker is what you would have used on the printed
   timetable this replaces.

   It stands where ManageBac's own rail used to, and buys that width the way
   the rail did: by pushing the wrapper's left edge across, which is the one
   layout contract this page is already known to honour. Under 900px there is
   no width to give, so it stops pushing and floats over the page instead. */
.mbs-dock {
  position:fixed; left:0; top:var(--dock-top, 56px); bottom:0; width:var(--dock);
  z-index:1500; display:flex; flex-direction:column; overflow:hidden;
  background:var(--s); border-right:1px solid var(--line);
}
.mbs-dock[hidden] { display:none !important; }
html.mbs-docked .f-layout-main__wrapper { padding-left:calc(var(--dock) + 16px) !important; }
/* Pages that don't carry the wrapper — nothing seen so far, but the rail's
   offset has to land somewhere or the dock covers the content. */
html.mbs-docked.mbs-dock-loose body { padding-left:var(--dock) !important; }
@media (max-width:900px) {
  html.mbs-docked .f-layout-main__wrapper { padding-left:16px !important; }
  html.mbs-docked.mbs-dock-loose body { padding-left:0 !important; }
  .mbs-dock { box-shadow:var(--sh); }
}

.mbs-tt__head { flex:none; display:flex; align-items:baseline; gap:8px; padding:11px 13px 9px; border-bottom:1px solid var(--line); }
.mbs-tt__head h2 { margin:0; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink); }
.mbs-tt__head .src { font-family:var(--mono); font-size:9.5px; color:var(--ink3); }
.mbs-tt__head .sp { flex:1 1 auto; }
.mbs-tt__head .tdy { font-family:var(--mono); font-size:9.5px; color:var(--ink2); }
.mbs-tt__x {
  flex:none; align-self:center; appearance:none; border:0; background:transparent;
  cursor:pointer; padding:0 1px; line-height:1; font-size:15px; color:var(--ink3);
}
.mbs-tt__x:hover { color:var(--ink); }

/* Ten days in one strip left each cell 28px wide, which is narrower than the
   day name it has to hold. A row per week gives them 60px, enough to sit the
   name beside the column it is in on the published timetable — which is only
   Week 1, where that grid numbers its columns 1..5. Week 2 names them Mon..Fri
   and the reference would just say the day twice. */
.mbs-tt__ruler { flex:none; border-bottom:1px solid var(--line); }
.mbs-tt__wkrow { display:flex; }
.mbs-tt__wkrow + .mbs-tt__wkrow { border-top:1px solid var(--line); }
/* Eastern Arabic digits come from whichever fallback face has them rather than
   from Plex Mono, and they sit smaller and lighter than Latin ones at a size */
.mbs-tt__wk { flex:none; width:20px; display:flex; align-items:center; justify-content:center;
  font-size:12px; color:var(--ink3); border-right:1px solid var(--line); }
.mbs-tt__day { flex:1 0 0; min-width:0; appearance:none; border:0; border-right:1px solid var(--line);
  background:transparent; cursor:pointer; padding:7px 2px 7px; position:relative;
  display:flex; align-items:baseline; justify-content:center; gap:4px;
  font-family:var(--mono); font-size:9px; color:var(--ink3); }
.mbs-tt__day:last-child { border-right:0; }
.mbs-tt__day b { font-size:10.5px; font-weight:500; color:var(--ink2); }
.mbs-tt__day:hover b { color:var(--ink); }
.mbs-tt__day[aria-current="true"]::after { content:''; position:absolute; left:5px; right:5px; bottom:3px; height:2px; background:var(--ink); }
.mbs-tt__day.is-today .mbs-tt__mark { position:absolute; left:3px; right:3px; top:3px; bottom:3px;
  background:var(--mark); mix-blend-mode:multiply; z-index:-1; border-radius:3px 6px 4px 7px / 6px 3px 7px 4px; }

.mbs-tt__now { flex:none; padding:12px 13px; border-bottom:1px solid var(--line); }
.mbs-tt__now .k { font-family:var(--mono); font-size:9px; letter-spacing:.09em; text-transform:uppercase; color:var(--ink3); }
.mbs-tt__now .v { font-size:17px; font-weight:700; letter-spacing:-.02em; line-height:1.2; margin-top:2px; }
.mbs-tt__now .m { font-family:var(--mono); font-size:10.5px; color:var(--ink2); margin-top:4px;
  display:flex; flex-wrap:wrap; gap:1px 12px; font-variant-numeric:tabular-nums; }
.mbs-tt__nx { margin-top:9px; padding-top:8px; border-top:1px dotted var(--line2);
  display:flex; align-items:baseline; gap:7px; }
.mbs-tt__nx .n { font-size:12px; font-weight:600; }
.mbs-tt__nx .t { margin-left:auto; font-family:var(--mono); font-size:10px; color:var(--ink2); }

.mbs-tt__list { flex:1 1 auto; min-height:0; overflow-y:auto; }
.mbs-tt__row { display:grid; grid-template-columns:15px 46px 1fr; align-items:start;
  padding:8px 13px 8px 9px; border-bottom:1px solid var(--line); position:relative; }
.mbs-tt__row:last-child { border-bottom:0; }
.mbs-tt__row .g { font-family:var(--mono); font-size:9px; color:var(--ink3); padding-top:1px; }
.mbs-tt__row .t { font-family:var(--mono); font-size:10.5px; color:var(--ink2); padding-top:1px; font-variant-numeric:tabular-nums; }
.mbs-tt__row .t i { display:block; font-style:normal; font-size:8.5px; color:var(--ink3); }
.mbs-tt__row .s { min-width:0; }
.mbs-tt__row .s > span { display:block; }
.mbs-tt__row .s .n { font-size:12.5px; font-weight:600; letter-spacing:-.008em; line-height:1.25; }
.mbs-tt__row .s .r { font-family:var(--mono); font-size:9.5px; color:var(--ink2); margin-top:2px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mbs-tt__row.is-alt { border-bottom-style:dotted; }
.mbs-tt__row.is-alt .s .n { font-size:11.5px; font-weight:500; color:var(--ink2); }
.mbs-tt__row.is-alt .t { color:var(--ink3); font-size:9px; }
.mbs-tt__row.is-done { color:var(--ink3); }
.mbs-tt__row.is-done .s .n { font-weight:500; color:var(--ink3); }
.mbs-tt__row.is-done .t, .mbs-tt__row.is-done .s .r, .mbs-tt__row.is-done .g { color:var(--line2); }

.mbs-tt__gap { display:grid; grid-template-columns:15px 46px 1fr; padding:5px 13px 5px 9px;
  border-bottom:1px solid var(--line); position:relative;
  font-family:var(--mono); font-size:9px; color:var(--ink3); letter-spacing:.04em; }
.mbs-tt__gap.is-lunch { background:var(--s2); }
.mbs-tt__gap .t { font-variant-numeric:tabular-nums; }

.mbs-tt__row.is-now, .mbs-tt__gap.is-now { padding-top:11px; padding-bottom:11px; }
.mbs-tt__row.is-now .s .n { font-size:14px; font-weight:700; }
.mbs-tt__gap.is-now { color:var(--ink2); }
/* :not() keeps the countdown out — it is a span as well, and this rule would
   otherwise outrank its own absolute positioning and drop it into the grid */
.mbs-tt__row.is-now > span:not(.mbs-tt__left),
.mbs-tt__gap.is-now > span:not(.mbs-tt__left) { position:relative; z-index:1; }
.mbs-tt__swipe { position:absolute; left:4px; top:5px; bottom:5px; background:var(--mark);
  mix-blend-mode:multiply; pointer-events:none; z-index:0;
  border-radius:3px 2px 2px 8px / 7px 2px 2px 5px; transition:width 700ms cubic-bezier(.4,0,.2,1); }
.mbs-tt__swipe i { position:absolute; right:0; top:0; bottom:0; width:3px; background:var(--mark2); border-radius:0 2px 2px 0; }
.mbs-tt__left { position:absolute; right:13px; top:11px; z-index:1; font-family:var(--mono);
  font-size:10px; font-weight:500; color:var(--ink); font-variant-numeric:tabular-nums; }
.mbs-tt__none { padding:24px 13px; text-align:center; font-size:12px; color:var(--ink3); }

/* Everything above is a copy of a timetable published elsewhere, and a copy
   should say where it came from — both to be checked against when a room
   moves, and because the source is where the ten days actually live. Same
   mono-caps as the palette's key legend, so it reads as the dock's chrome
   rather than as a row of the day. */
.mbs-tt__foot {
  flex:none; display:flex; align-items:center; gap:8px;
  padding:8px 13px; border-top:1px solid var(--line); background:var(--s);
  font-family:var(--mono); font-size:9.5px; letter-spacing:.07em;
  text-transform:uppercase; color:var(--ink3);
}
.mbs-tt__foot a { margin-left:auto; color:var(--ink3) !important; }
.mbs-tt__foot a:hover { color:var(--ink) !important; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
`;

  function injectCSS() {
    if (document.getElementById('mbs-css')) return;
    const st = el('style'); st.id = 'mbs-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ============================================================
     SWITCHER + PALETTE
     ============================================================ */

  let panel, panelSearch, panelList, panelKind = null, panelAnchor = null;
  let panelGlobalsBound = false;
  let foldJustToggled = false;

  function classGroups() {
    const list = readClasses();
    const grades = list.map(c => c.grade).filter(g => g != null);
    const current = grades.length ? Math.max(...grades) : null;
    const now = [], past = [];
    list.forEach(c => {
      const isPast = CONFIG.foldPastYears && current != null && c.grade != null && c.grade < current;
      (isPast ? past : now).push(c);
    });
    return { now, past, current };
  }

  function optionRow(item, opts = {}) {
    const a = el('a', 'mbs-opt' + (opts.past ? ' is-past' : ''));
    a.href = item.href || '#';
    a.title = item.raw || item.label || '';
    // match on id where we have one: the current URL carries a subsection
    // (…/core_tasks) that the sidebar href may not, so paths rarely match whole
    const here = item.id
      ? new RegExp('/(?:classes|groups)/' + item.id + '(?:/|$)').test(location.pathname)
      : (item.href && location.pathname === item.href);
    if (here) a.classList.add('is-current');
    a.append(el('span', 'mbs-opt__dot'));
    a.append(el('span', 'mbs-opt__name', item.name || item.label));
    if (opts.tag) a.append(el('span', 'mbs-opt__tag', opts.tag));
    // keep the href so the row is still a real link (middle-click, copy
    // address), but prefer clicking ManageBac's own link on a plain click
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      closePanel();
      goTo(item);
    });
    return a;
  }

  /* Rows are assembled in a fragment and swapped in as one insertion.
     Appending them straight to the live list meant every row of a long
     class list was its own layout pass, on every keystroke. */
  function renderPanel(term = '') {
    const frag = document.createDocumentFragment();
    const q = term.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    const hit = s => !words.length || words.every(w => (s || '').toLowerCase().includes(w));

    if (panelKind === 'classes') {
      const { now, past, current } = classGroups();
      const showPast = store.get('showPast', false) === true;

      const live = now.filter(c => hit(c.raw + ' ' + c.name));
      if (live.length) {
        if (current != null) frag.append(el('div', 'mbs-group', 'Grade ' + current));
        live.forEach(c => frag.append(optionRow(c)));
      }

      const oldOnes = past.filter(c => hit(c.raw + ' ' + c.name));
      if (oldOnes.length) {
        // a search always reaches earlier years; browsing keeps them folded
        if (q) {
          frag.append(el('div', 'mbs-group', 'Earlier years'));
          oldOnes.forEach(c => frag.append(optionRow(c, { past: true, tag: 'G' + c.grade })));
        } else {
          const fold = el('button', 'mbs-fold', 'Earlier years (' + oldOnes.length + ')');
          fold.type = 'button';
          fold.setAttribute('aria-expanded', showPast ? 'true' : 'false');
          fold.addEventListener('click', () => {
            store.set('showPast', !(store.get('showPast', false) === true));
            foldJustToggled = true;
            renderPanel(panelSearch.value);
          });
          frag.append(fold);
          if (showPast) oldOnes.forEach(c => {
            const row = optionRow(c, { past: true, tag: 'G' + c.grade });
            if (foldJustToggled && !REDUCED_MOTION.matches) row.classList.add('mbs-opt--enter');
            frag.append(row);
          });
          foldJustToggled = false;
        }
      }

      const groups = readGroups().filter(g => hit(g.raw + ' ' + g.name));
      if (groups.length && q) {
        frag.append(el('div', 'mbs-group', 'Groups'));
        groups.forEach(g => frag.append(optionRow(g)));
      }

      if (!frag.querySelector('.mbs-opt')) frag.append(el('div', 'mbs-empty', 'No class matches “' + term.trim() + '”.'));
    } else {
      CONFIG.more.filter(m => hit(m.label)).forEach(m => frag.append(optionRow(m)));
      readGroups().filter(g => hit(g.raw + ' ' + g.name)).forEach(g => frag.append(optionRow(g)));
      if (!frag.querySelector('.mbs-opt')) frag.append(el('div', 'mbs-empty', 'Nothing matches.'));
    }

    panelList.replaceChildren(frag);
    moveCursor(0, true);
  }

  function options() { return [...panelList.querySelectorAll('.mbs-opt')]; }

  function moveCursor(delta, reset) {
    const opts = options();
    if (!opts.length) return;
    let i = opts.findIndex(o => o.classList.contains('is-cursor'));
    if (reset || i < 0) i = 0; else i = (i + delta + opts.length) % opts.length;
    opts.forEach(o => o.classList.remove('is-cursor'));
    opts[i].classList.add('is-cursor');
    opts[i].scrollIntoView({ block: 'nearest' });
  }

  /* The panel lives on <body>, and ManageBac's client-side navigation
     replaces body content — detaching it while this closure still holds
     the reference. Checking only `if (panel)` returned early and re-opened
     a node no longer in the document: the tab lit up, nothing appeared.
     Rebuild whenever it isn't connected. */
  function ensurePanel() {
    if (panel && panel.isConnected) return;
    panel = el('div', 'mbs-panel');
    panel.hidden = true;
    const search = el('div', 'mbs-panel__search');
    panelSearch = el('input');
    panelSearch.type = 'search';
    panelSearch.autocomplete = 'off';
    panelSearch.setAttribute('aria-label', 'Find a class');
    search.append(panelSearch);
    panelList = el('div', 'mbs-list');

    const hint = el('div', 'mbs-panel__hint');
    [['↑↓', 'move'], ['↵', 'open'], ['esc', 'close']].forEach(([key, what]) => {
      const pair = el('span');
      pair.append(el('b', null, key), el('span', null, what));
      hint.append(pair);
    });

    panel.append(search, panelList, hint);
    document.body.appendChild(panel);

    panelSearch.addEventListener('input', () => renderPanel(panelSearch.value));
    panelSearch.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveCursor(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveCursor(-1); }
      else if (e.key === 'Enter') {
        // go through the row's own handler so Enter and click behave alike
        const cur = panelList.querySelector('.mbs-opt.is-cursor') || options()[0];
        if (cur) { e.preventDefault(); cur.click(); }
      } else if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
    });

    // window-level listeners bind once, not on every rebuild
    if (!panelGlobalsBound) {
      panelGlobalsBound = true;
      addEventListener('mousedown', e => {
        if (!panel || panel.hidden) return;
        if (panel.contains(e.target) || (panelAnchor && panelAnchor.contains(e.target))) return;
        closePanel();
      });
      /* positionPanel() measures the anchor and the panel, so running it
         raw on resize forced two layouts per event. One per frame is
         indistinguishable and costs nothing while the panel is closed. */
      let repositioning = false;
      addEventListener('resize', () => {
        if (repositioning || !panel || panel.hidden) return;
        repositioning = true;
        requestAnimationFrame(() => {
          repositioning = false;
          if (panel && !panel.hidden) positionPanel();
        });
      });
      /* The search field carries its own Escape. This covers the case where
         focus has since moved off it — onto a row, or out of the panel. */
      addEventListener('keydown', e => {
        if (e.key === 'Escape' && panel && !panel.hidden) { e.preventDefault(); closePanel(); }
      });
    }
  }

  function positionPanel() {
    if (!panelAnchor) return;
    const r = panelAnchor.getBoundingClientRect();
    panel.style.top = Math.round(r.bottom + 8) + 'px';
    const left = Math.min(Math.round(r.left), innerWidth - panel.offsetWidth - 12);
    panel.style.left = Math.max(12, left) + 'px';
  }

  function openPanel(kind, anchor) {
    ensurePanel();
    panelKind = kind;
    panelAnchor = anchor;
    panelSearch.value = '';
    panelSearch.placeholder = kind === 'classes' ? 'Find a class…' : 'Find a page…';
    panel.hidden = false;
    positionPanel();
    renderPanel('');
    panelSearch.focus();
    if (anchor) anchor.classList.add('is-active');

    /* Opening animates; closing does not. A close that has to finish an
       animation before it can set hidden races the toggle that reopens it,
       and an instant dismissal reads as responsive rather than abrupt. */
    if (!REDUCED_MOTION.matches) {
      panel.animate(
        [{ opacity: 0, transform: 'translateY(-6px) scale(.985)' },
         { opacity: 1, transform: 'none' }],
        { duration: 150, easing: EASE }
      );
    }
  }

  function closePanel() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (panelAnchor) panelAnchor.classList.remove('is-active');
    panelAnchor = null;
    panelKind = null;
    markActiveTab();
  }

  function togglePanel(kind, anchor) {
    if (panel && !panel.hidden && panelKind === kind) closePanel();
    else openPanel(kind, anchor);
  }

  function markActiveTab() {
    const path = location.pathname;
    document.querySelectorAll('.mbs-tab[data-tab], .mbs-today[data-tab]').forEach(b => {
      const spec = CONFIG.tabs.find(t => t.id === b.dataset.tab);
      // Today owns no URL: what lights it is whether the dock is out
      const on = spec && spec.panel === 'timetable'
        ? dockOpen
        : spec && spec.match && spec.match.test(path);
      b.classList.toggle('is-active', !!on);
    });
  }

  function buildSwitch() {
    const host = document.querySelector('.navbar-row');
    if (!host) return;
    // built independently, so a rebuild of one can't duplicate the other
    if (!document.querySelector('.mbs-switch')) buildTabs(host);
    if (!document.querySelector('.mbs-today')) buildToday(host);
    markActiveTab();
  }

  function buildTabs(host) {
    const wrap = el('nav', 'mbs-switch');
    wrap.setAttribute('aria-label', 'Sections');

    CONFIG.tabs.forEach(t => {
      if (t.panel === 'timetable') return;   // stands on its own, see buildToday
      const b = el('button', 'mbs-tab');
      b.type = 'button';
      b.dataset.tab = t.id;
      b.append(el('span', null, t.label));
      if (t.panel === 'classes') {
        const n = classGroups().now.length;
        if (n) b.append(el('span', 'mbs-tab__count', String(n)));
        b.append(el('span', 'mbs-kbd', '⌘K'));
        b.addEventListener('click', e => { e.stopPropagation(); togglePanel('classes', b); });
      } else {
        b.addEventListener('click', () => { goTo(t); });
      }
      wrap.append(b);
    });

    const more = el('button', 'mbs-tab', '···');
    more.type = 'button';
    more.setAttribute('aria-label', 'More sections');
    more.addEventListener('click', e => { e.stopPropagation(); togglePanel('more', more); });
    wrap.append(more);

    host.appendChild(wrap);
  }

  /* Over at the far end of the bar, past the bell and the avatar. Whether
     simply appending lands it there depends on how ManageBac aligns the rest
     of the row — an auto margin on its own right-hand cluster carries the
     button along, no margin at all leaves it stranded mid-bar — and that isn't
     something to read off the markup. So it measures once and pushes itself
     over only if it has to: a second auto margin in a row that already has one
     would split the free space between them and land it in the middle. */
  function buildToday(host) {
    const spec = CONFIG.tabs.find(t => t.panel === 'timetable');
    if (!spec) return;
    const b = el('button', 'mbs-today');
    b.type = 'button';
    b.dataset.tab = spec.id;
    b.append(el('span', null, spec.label));
    b.setAttribute('aria-label', 'Timetable');
    b.addEventListener('click', e => { e.stopPropagation(); toggleDock(); });
    host.appendChild(b);

    // a bar that hasn't been laid out yet measures 0 wide, and a measurement
    // taken then would settle the placement on nothing
    let tries = 20;
    const place = () => {
      const row = host.getBoundingClientRect();
      if (!row.width && tries--) { requestAnimationFrame(place); return; }
      if (row.right - b.getBoundingClientRect().right > 40) b.classList.add('mbs-today--far');
    };
    place();
  }

  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') {
      e.preventDefault();
      togglePanel('classes', document.querySelector('.mbs-tab[data-tab="classes"]'));
    }
  });

  /* ============================================================
     TIMETABLE
     ============================================================ */

  /* Where the rows below came from, and where to go when they stop matching:
     the school's published Prime Timetable for 11B. The 2025 script put last
     year's publish in an iframe over ManageBac's own Timetables page; the dock
     scrapes this one instead and keeps the link at its foot. The id changes
     each time the school republishes, so this is the line to repoint. */
  const TT_SOURCE = 'https://primetimetable.com/publish/?id=3d9e5ee3-c15b-41f7-810c-0e16e6cafa92&rp=1&inc=1&time=6#id=3d9e5ee3-c15b-41f7-810c-0e16e6cafa92&view=1&classId=6e80eda3-3061-41f2-9b6e-7cff2454c3dd';

  /* Read from that timetable on 9 Sep 2026: the "SY115-1 Secondary Sem 1
     [Sept 1 Update]" edition, itself last updated 8 Sep. It carries no dates,
     only the two-week cycle, so which week is which still has to be pinned by
     hand — see TT_ANCHOR below.

     The rows come from the viewer's own JSON rather than its DOM:

       https://primetimetable.com/api/v2/timetables/<the publish id>/

     which holds days, periods, subjects, rooms, teachers and activities. An
     activity belongs to 11B when its groupIds meet one of that class's groups;
     each of its cards is one slot, taking the day from card.dayId, the start
     from card.periodId, and the end from the period (length - 1) further along
     — both ids are omitted when they are the first day or the first period.

     Columns 0-4 are the halves it labels 1..5 (Week 1); 5-9 are the ones it
     labels Mon..Fri (Week 2).
     subject ~ day ~ start ~ end ~ staff ~ room */
  const TT_RAW = `G: Agency [EE, CAS, CC]~0~08:10~08:30~Michael Chiang~5F HS3
DP MAA HL~0~08:35~09:25~Emerson Michel~5F HS5
DP MAA SL~0~08:35~09:25~Adam Chiang~5F-Lab
DP MAI HL~0~08:35~09:25~Benedikt Gottschlich~5F HS3
DP MAA HL~0~09:25~10:10~Emerson Michel~5F HS5
DP MAA SL~0~09:25~10:10~Adam Chiang~5F-Lab
DP MAI HL~0~09:25~10:10~Benedikt Gottschlich~5F HS3
DP Chi B SL/HL~0~10:20~11:05~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~0~10:20~11:05~David Huck~5F HS4
DP Chi B SL/HL~0~11:05~11:50~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~0~11:05~11:50~David Huck~5F HS4
DP Comp. Sc.~0~12:50~13:40~Michael Chiang~6F-DP VA Studio
DP ESS~0~12:50~13:40~Billy Leong~5F HS2
DP Comp. Sc.~0~13:40~14:25~Michael Chiang~6F-DP VA Studio
DP ESS~0~13:40~14:25~Billy Leong~5F HS2
DP Bio~0~14:35~15:20~Sophia Lin~5F-Lab
DP Bus Man~0~14:35~15:20~Antony Chen~5F HS5
DP Physics~0~14:35~15:20~Benedikt Gottschlich~5F HS3
DP V. Arts~0~14:35~15:20~David Wang~6F-DP VA Studio
DP TOK-1~0~15:20~16:05~Michael Chiang~5F HS3
DP TOK-2~0~15:20~16:05~Harrison Hedges~5F HS5
DP Chi A-2 SL Revision~0~15:40~16:30~Judy Wu 伍智梅~5F HS3
DP Bio SL Revision~0~16:05~16:50~Sophia Lin~5F-Lab
DP ESS SL Rrevision~0~16:05~16:50~Billy Leong~5F HS3
DP ESS SL Rrevision~0~16:10~16:55~Billy Leong~5F HS3
DP Bus Man~0~16:15~16:50~Antony Chen~5F HS5
G: Weekly Alignment~1~08:10~08:30~Benedikt Gottschlich~5F HS3
DP Econ~1~08:35~09:25~Michael Chiang~5F HS3
DP History~1~08:35~09:25~Neil Hockin~5F HS2
DP Psych~1~08:35~09:25~Andrew Wang~5F HS5
DP Econ~1~09:25~10:10~Michael Chiang~5F HS3
DP History~1~09:25~10:10~Neil Hockin~5F HS2
DP Psych~1~09:25~10:10~Andrew Wang~5F HS5
DP Eng A-2~1~10:20~11:05~Jillianne Burrow~5F HS4
Eng Lit~1~10:20~11:05~Pete Williams~3F HS6 9A
DP Eng A-2~1~11:05~11:50~Jillianne Burrow~5F HS4
Eng Lit~1~11:05~11:50~Pete Williams~3F HS6 9A
DP Chem~1~12:50~13:40~Maggie Gajewska~5F-Lab
DP Chi A-2~1~12:50~13:40~Judy Wu 伍智梅~5F HS2
DP Chem~1~13:40~14:25~Maggie Gajewska~5F-Lab
DP Chi A-2~1~13:40~14:25~Judy Wu 伍智梅~5F HS2
DP TOK-1~1~14:35~15:20~Michael Chiang~5F HS3
DP TOK-2~1~14:35~15:20~Harrison Hedges~5F HS2
Service Clubs~1~15:20~16:05~Claire Huang;Robert Chung;Evelyn Chang 張韻祥;Nancy Huang 黃聖雅~6F-DP VA Studio;6F DP Library;6F MYP Studio;5F CC;3F HS7 9B;3F HS6 9A;2F DP Chi Lib;5F-Lab
G: Agency [EE, CAS, CC]~2~08:10~08:30~Andrew Wang;Jeremy Yeung~5F HS3
DP MAA HL~2~08:35~09:25~Emerson Michel~5F HS5
DP MAA SL~2~08:35~09:25~Adam Chiang~5F-Lab
DP MAI HL~2~08:35~09:25~Benedikt Gottschlich~5F HS3
DP MAA HL~2~09:25~10:10~Emerson Michel~5F HS5
DP MAA SL~2~09:25~10:10~Adam Chiang~5F-Lab
DP MAI HL~2~09:25~10:10~Benedikt Gottschlich~5F HS3
DP Chi B SL/HL~2~10:20~11:05~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~2~10:20~11:05~David Huck~2F HS8 10A
DP Chi B SL/HL~2~11:05~11:50~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~2~11:05~11:50~David Huck~2F HS8 10A
DP Comp. Sc.~2~12:50~13:40~Michael Chiang~6F-DP VA Studio
DP ESS~2~12:50~13:40~Billy Leong~5F HS2
DP Comp. Sc.~2~13:40~14:25~Michael Chiang~6F-DP VA Studio
DP ESS~2~13:40~14:25~Billy Leong~5F HS2
DP Bio~2~14:35~15:20~Sophia Lin~5F-Lab
DP Bus Man~2~14:35~15:20~Antony Chen~5F HS5
DP Physics~2~14:35~15:20~Benedikt Gottschlich~5F HS3
DP V. Arts~2~14:35~15:20~David Wang~6F-DP VA Studio
DP Bio~2~15:20~16:05~Sophia Lin~5F-Lab
DP Physics~2~15:20~16:05~Benedikt Gottschlich~5F HS3
DP V. Arts~2~15:20~16:05~David Wang~6F-DP VA Studio
DP Chi A-2 SL Revision~2~16:10~16:55~Judy Wu 伍智梅~5F HS3
Guidance~3~08:10~08:30~Benedikt Gottschlich~5F HS3
DP Econ~3~08:35~09:25~Michael Chiang~5F HS3
DP History~3~08:35~09:25~Neil Hockin~5F HS2
DP Psych~3~08:35~09:25~Andrew Wang~5F HS5
DP Econ~3~09:25~10:10~Michael Chiang~5F HS3
DP History~3~09:25~10:10~Neil Hockin~5F HS2
DP Psych~3~09:25~10:10~Andrew Wang~5F HS5
DP Eng A-2~3~10:20~11:05~Jillianne Burrow~5F HS4
DP Eng A-2~3~11:05~11:50~Jillianne Burrow~5F HS4
DP Chem~3~12:50~13:40~Maggie Gajewska~5F-Lab
DP Chi A-2~3~12:50~13:40~Judy Wu 伍智梅~5F HS2
DP Chem~3~13:40~14:25~Maggie Gajewska~5F-Lab
DP Chi A-2~3~13:40~14:25~Judy Wu 伍智梅~5F HS2
DP TOK-1~3~14:35~15:20~Michael Chiang~5F HS3
DP TOK-2~3~14:35~15:20~Harrison Hedges~5F HS2
Academic Clubs~3~15:20~16:05~Judy Wu 伍智梅;Byron Dyck;Neil Hockin;Curtis Quick;David Huck;Emerson Michel;Maggie Gajewska;Michael Chiang;Adam Chiang;Benedikt Gottschlich;Sophia Lin~3F HS7 9B;3F HS6 9A;2F HS8 10A;5F-Lab;5F CC;6F DP Library;6F MYP Studio;6F-MPR;6F-DP VA Studio
DP Bus Man~3~16:10~16:55~Antony Chen~5F HS5
G: Agency [EE, CAS, CC]~4~08:10~08:30~~5F HS3
DP MAA HL~4~08:35~09:25~Emerson Michel~5F HS5
DP MAA SL~4~08:35~09:25~Adam Chiang~5F HS4
DP MAI HL~4~08:35~09:25~Benedikt Gottschlich~5F HS3
DP MAA HL~4~09:25~10:10~Emerson Michel~5F HS5
DP MAA SL~4~09:25~10:10~Adam Chiang~5F HS4
DP MAI HL~4~09:25~10:10~Benedikt Gottschlich~5F HS3
DP Chi B SL/HL~4~10:20~11:05~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~4~10:20~11:05~David Huck~2F HS8 10A
DP Chi B SL/HL~4~11:05~11:50~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~4~11:05~11:50~David Huck~2F HS8 10A
DP Chem~4~12:50~13:40~Maggie Gajewska~5F-Lab
DP Chi A-2~4~12:50~13:40~Judy Wu 伍智梅~5F HS5
DP Chem~4~13:40~14:25~Maggie Gajewska~5F-Lab
DP Chi A-2~4~13:40~14:25~Judy Wu 伍智梅~5F HS5
DP Bio~4~14:35~15:20~Sophia Lin~5F-Lab
DP Bus Man~4~14:35~15:20~Antony Chen~5F HS5
DP Physics~4~14:35~15:20~Benedikt Gottschlich~5F HS3
DP V. Arts~4~14:35~15:20~David Wang~6F-DP VA Studio
DP Bio~4~15:20~16:05~Sophia Lin~5F-Lab
DP Bus Man~4~15:20~16:05~Antony Chen~5F HS5
DP Physics~4~15:20~16:05~Benedikt Gottschlich~5F HS3
DP V. Arts~4~15:20~16:05~David Wang~6F-DP VA Studio
G: Agency [EE, CAS, CC]~5~08:10~08:30~Michael Chiang~5F HS3
DP MAA HL~5~08:35~09:25~Emerson Michel~5F HS5
DP MAA SL~5~08:35~09:25~Adam Chiang~5F-Lab
DP MAI HL~5~08:35~09:25~Benedikt Gottschlich~5F HS3
DP MAA HL~5~09:25~10:10~Emerson Michel~5F HS5
DP MAA SL~5~09:25~10:10~Adam Chiang~5F-Lab
DP MAI HL~5~09:25~10:10~Benedikt Gottschlich~5F HS3
DP Chi B SL/HL~5~10:20~11:05~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~5~10:20~11:05~David Huck~1F HS9 10B
DP Chi B SL/HL~5~11:05~11:50~Evelyn Chang 張韻祥~5F HS3
DP Eng B-2~5~11:05~11:50~David Huck~1F HS9 10B
DP Chem~5~12:50~13:40~Maggie Gajewska~5F-Lab
DP Chi A-2~5~12:50~13:40~Judy Wu 伍智梅~5F HS4
DP Chem~5~13:40~14:25~Maggie Gajewska~5F-Lab
DP Chi A-2~5~13:40~14:25~Judy Wu 伍智梅~5F HS4
DP Bio~5~14:35~15:20~Sophia Lin~5F-Lab
DP Bus Man~5~14:35~15:20~Antony Chen~5F HS5
DP Physics~5~14:35~15:20~Benedikt Gottschlich~5F HS3
DP V. Arts~5~14:35~15:20~David Wang~
DP Bio~5~15:20~16:05~Sophia Lin~5F-Lab
DP Bus Man~5~15:20~16:05~Antony Chen~5F HS5
DP Physics~5~15:20~16:05~Benedikt Gottschlich~5F HS3
DP V. Arts~5~15:20~16:05~David Wang~
G: Weekly Alignment~6~08:10~08:30~Benedikt Gottschlich~5F HS3
DP Econ~6~08:35~09:25~Michael Chiang~5F HS3
DP History~6~08:35~09:25~Neil Hockin~5F HS2
DP Psych~6~08:35~09:25~Andrew Wang~5F HS5
DP Econ~6~09:25~10:10~Michael Chiang~5F HS3
DP History~6~09:25~10:10~Neil Hockin~5F HS2
DP Psych~6~09:25~10:10~Andrew Wang~5F HS5
DP Eng A-2~6~10:20~11:05~Jillianne Burrow~5F HS4
DP Eng A-2~6~11:05~11:50~Jillianne Burrow~5F HS4
DP Comp. Sc.~6~12:50~13:40~Michael Chiang~6F-DP VA Studio
DP ESS~6~12:50~13:40~Billy Leong~5F HS2
DP Comp. Sc.~6~13:40~14:25~Michael Chiang~6F-DP VA Studio
DP ESS~6~13:40~14:25~Billy Leong~5F HS2
Service Clubs~6~15:20~16:05~Billy Leong;Harrison Hedges;Jeremy Yeung;David Wang;Chelia Lei 雷靜宜;Jun-Wei Lee 李峻瑋;Claire Huang~6F-DP VA Studio;6F DP Library;6F MYP Studio;5F CC;3F HS7 9B;3F HS6 9A;2F DP Chi Lib;5F-Lab
G: Agency [EE, CAS, CC]~7~08:10~08:30~Andrew Wang;Jeremy Yeung~5F HS3
DP MAA HL~7~08:35~09:25~Emerson Michel~5F HS5
DP MAA SL~7~08:35~09:25~Adam Chiang~5F-Lab
DP MAI HL~7~08:35~09:25~Benedikt Gottschlich~5F HS3
DP MAA HL~7~09:25~10:10~Emerson Michel~5F HS5
DP MAA SL~7~09:25~10:10~Adam Chiang~5F-Lab
DP MAI HL~7~09:25~10:10~Benedikt Gottschlich~5F HS3
DP Chi B SL/HL~7~10:20~11:05~Evelyn Chang 張韻祥~2F HS8 10A
DP Eng B-2~7~10:20~11:05~David Huck~5F HS3
DP Chi B SL/HL~7~11:05~11:50~Evelyn Chang 張韻祥~2F HS8 10A
DP Eng B-2~7~11:05~11:50~David Huck~5F HS3
DP Chem~7~12:50~13:40~Maggie Gajewska~5F-Lab
DP Chi A-2~7~12:50~13:40~Judy Wu 伍智梅~5F HS2
DP Chem~7~13:40~14:25~Maggie Gajewska~5F-Lab
DP Chi A-2~7~13:40~14:25~Judy Wu 伍智梅~5F HS2
DP TOK-1~7~14:35~15:20~Michael Chiang~5F HS3
DP TOK-2~7~14:35~15:20~Harrison Hedges~5F HS5
DP Bio~7~15:20~16:05~Sophia Lin~5F-Lab
DP Physics~7~15:20~16:05~Benedikt Gottschlich~5F HS3
DP V. Arts~7~15:20~16:05~David Wang~6F-DP VA Studio
Guidance~8~08:10~08:30~Benedikt Gottschlich~5F HS3
DP Econ~8~08:35~09:25~Michael Chiang~5F HS3
DP History~8~08:35~09:25~Neil Hockin~5F HS2
DP Psych~8~08:35~09:25~Andrew Wang~5F HS5
DP Econ~8~09:25~10:10~Michael Chiang~5F HS3
DP History~8~09:25~10:10~Neil Hockin~5F HS2
DP Psych~8~09:25~10:10~Andrew Wang~5F HS5
DP Eng A-2~8~10:20~11:05~Jillianne Burrow~5F HS4
Eng Lit~8~10:20~11:05~Pete Williams~5F HS2
DP Eng A-2~8~11:05~11:50~Jillianne Burrow~5F HS4
Eng Lit~8~11:05~11:50~Pete Williams~5F HS2
DP Comp. Sc.~8~12:50~13:40~Michael Chiang~6F-DP VA Studio
DP ESS~8~12:50~13:40~Billy Leong~5F HS2
DP Comp. Sc.~8~13:40~14:25~Michael Chiang~6F-DP VA Studio
DP ESS~8~13:40~14:25~Billy Leong~5F HS2
DP Chi A-2 SL Revision~8~14:35~15:20~Judy Wu 伍智梅~5F HS3
Academic Clubs~8~15:20~16:05~Judy Wu 伍智梅;Byron Dyck;Neil Hockin;Curtis Quick;David Huck;Emerson Michel;Maggie Gajewska;Michael Chiang;Adam Chiang;Benedikt Gottschlich;Sophia Lin~3F HS7 9B;3F HS6 9A;2F HS8 10A;5F-Lab;5F CC;6F DP Library;6F MYP Studio;6F-MPR;6F-DP VA Studio
DP Bus Man~8~16:10~16:55~Antony Chen~5F HS2
Guidance~9~08:10~08:30~Benedikt Gottschlich~5F HS3
DP Econ~9~08:35~09:25~Michael Chiang~5F HS3
DP History~9~08:35~09:25~Neil Hockin~5F HS2
DP Psych~9~08:35~09:25~Andrew Wang~5F HS5
DP Econ~9~09:25~10:10~Michael Chiang~5F HS3
DP History~9~09:25~10:10~Neil Hockin~5F HS2
DP Psych~9~09:25~10:10~Andrew Wang~5F HS5
DP Eng A-2~9~10:20~11:05~Jillianne Burrow~5F HS4
DP Eng A-2~9~11:05~11:50~Jillianne Burrow~5F HS4
Eng Lit~9~11:05~11:50~Pete Williams~5F HS2
DP Comp. Sc.~9~12:50~13:40~Michael Chiang~6F-DP VA Studio
DP ESS~9~12:50~13:40~Billy Leong~5F HS2
DP Comp. Sc.~9~13:40~14:25~Michael Chiang~6F-DP VA Studio
DP ESS~9~13:40~14:25~Billy Leong~5F HS2
DP Bio~9~14:35~15:20~Sophia Lin~5F-Lab
DP Bus Man~9~14:35~15:20~Antony Chen~5F HS5
DP Physics~9~14:35~15:20~Benedikt Gottschlich~5F HS3
DP V. Arts~9~14:35~15:20~David Wang~6F-DP VA Studio
DP Bio~9~15:20~16:05~Sophia Lin~5F-Lab
DP Bus Man~9~15:20~16:05~Antony Chen~5F HS5
DP Physics~9~15:20~16:05~Benedikt Gottschlich~5F HS3
DP V. Arts~9~15:20~16:05~David Wang~6F-DP VA Studio`;

  /* The IB numbers its subject groups, so the margin carries the number rather
     than a colour. C is the core: TOK, and the pastoral blocks that carry CAS
     and the EE. */
  const TT_GROUPS = [
    ['1', ['DP Chi A-2', 'DP Chi A-2 SL Revision', 'DP Eng A-2', 'Eng Lit']],
    ['2', ['DP Chi B SL/HL', 'DP Eng B-2']],
    ['3', ['DP Econ', 'DP History', 'DP Psych', 'DP Bus Man']],
    ['4', ['DP Bio', 'DP Chem', 'DP Physics', 'DP ESS', 'DP Comp. Sc.']],
    ['5', ['DP MAA HL', 'DP MAA SL', 'DP MAI HL']],
    ['6', ['DP V. Arts']],
    ['C', ['DP TOK-1', 'DP TOK-2', 'G: Agency [EE, CAS, CC]', 'G: Weekly Alignment', 'Guidance']],
    ['\u00b7', ['Service Clubs', 'Academic Clubs']]
  ];
  const TT_MARK = {};
  TT_GROUPS.forEach(([n, subs]) => subs.forEach(x => { TT_MARK[x] = n; }));

  /* Shane's diploma. Edit this list if an option changes. */
  const TT_MINE = new Set([
    'DP Chi A-2', 'DP Chi A-2 SL Revision',   // Chinese A: Lang & Lit
    'DP Eng B-2',                             // English B
    'Eng Lit',                                // the school's own literature
                                              // class, not a DP course — it
                                              // runs opposite DP Eng A-2
    'DP MAI HL',                              // Mathematics AI HL
    'DP Comp. Sc.',                           // Computer Science
    'DP Econ',                                // Economics
    'DP Bus Man',                             // Business Management
    'DP TOK-1',                               // TOK group 1, Michael Chiang's
    'Guidance', 'G: Agency [EE, CAS, CC]', 'G: Weekly Alignment',
    'Service Clubs', 'Academic Clubs'
  ]);

  const TT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  /* The two halves of the fortnight are marked with Eastern Arabic digits.
     Everything else in the strip is a Latin numeral — column numbers, times,
     minutes — and the week is not one more of those; it is the thing they all
     hang off, so it is written in a hand of its own. */
  const TT_WEEK_MARK = ['\u0661', '\u0662'];
  const ttMin = t => (+t.slice(0, 2)) * 60 + (+t.slice(3, 5));
  const ttHHMM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  const TT = TT_RAW.split('\n').map(line => {
    const [subject, d, start, end, staff, room] = line.split('~');
    return { subject, d: +d, s: ttMin(start), e: ttMin(end), start, end,
             staff: (staff || '').split(';').filter(Boolean),
             room: (room || '').split(';').filter(Boolean) };
  }).filter(l => TT_MINE.has(l.subject));

  /* The grid carries no dates. Week 2 is pinned to the week of Mon 7 Sep 2026
     and the rest alternate; if the cycle ever reads a week out, this is the
     only line to change. */
  const TT_ANCHOR = Date.UTC(2026, 8, 7);
  const ttMonday = dt => {
    const d = Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
    return d - ((new Date(d).getUTCDay() + 6) % 7) * 864e5;
  };
  const ttWeek = dt => (Math.round((ttMonday(dt) - TT_ANCHOR) / (7 * 864e5)) % 2 + 2) % 2 === 0 ? 1 : 0;
  const ttNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  const ttToday = () => { const d = new Date().getDay(); return d >= 1 && d <= 5 ? d - 1 : -1; };
  const ttWhere = l => l.room.length === 1 ? l.room[0] : l.room.length ? l.room.length + ' rooms' : '';
  /* The DP prefix comes off, and TOK loses its group number — with only one
     of the two groups taken there is nothing left for it to tell apart. Every
     other trailing "-N" stays, which is why tidy() is not usable here: it
     strips them all, and would turn Eng B-2 into "Eng B". */
  const ttName = s => s.replace(/^DP\s+/, '').replace(/^TOK-\d+$/, 'TOK');

  /* Parallel option blocks share a start, so they become sibling rows under one
     time rather than competing for width. */
  function ttSlots(half, day) {
    const list = TT.filter(l => l.d === half * 5 + day).sort((a, b) => a.s - b.s || a.subject.localeCompare(b.subject));
    const out = [];
    list.forEach(l => {
      const last = out[out.length - 1];
      if (last && last.s === l.s && last.e === l.e) last.items.push(l);
      else out.push({ s: l.s, e: l.e, start: l.start, end: l.end, items: [l] });
    });
    return out;
  }

  /* Once the day is cut to six subjects the holes get long, and one "free" row
     would swallow the lunch hour whole, so any gap crossing it is split. */
  const TT_LUNCH_S = 11 * 60 + 50, TT_LUNCH_E = 12 * 60 + 50;
  function ttGaps(from, to) {
    const parts = [];
    const ls = Math.max(from, TT_LUNCH_S), le = Math.min(to, TT_LUNCH_E);
    if (ls < le) {
      if (from < ls) parts.push([from, ls, null]);
      parts.push([ls, le, 'Lunch']);
      if (le < to) parts.push([le, to, null]);
    } else parts.push([from, to, null]);
    return parts.filter(([a, b]) => b - a >= 10)
                .map(([a, b, l]) => [a, b, l || (b - a <= 15 ? 'Break' : 'Free')]);
  }

  /* Taught slots and the stretches between them are the same kind of thing:
     either can be the one running now, and either can carry the marker. */
  function ttLine(half, day) {
    const out = [];
    let prev = null;
    ttSlots(half, day).forEach(sl => {
      if (prev != null && sl.s - prev >= 10)
        ttGaps(prev, sl.s).forEach(([a, b, label]) => out.push({ s: a, e: b, gap: label }));
      prev = sl.e;
      out.push({ s: sl.s, e: sl.e, slot: sl });
    });
    return out;
  }

  const ttWidth = (seg, t) => {
    const pct = Math.max(0, Math.min(1, (t - seg.s) / (seg.e - seg.s)));
    return 'calc(' + (pct * 100) + '% - ' + (pct * 8) + 'px + 4px)';
  };

  /* The stroke draws itself on once a visit, not once a page. ManageBac moves
     between sections by loading whole pages, so with the rail already out the
     highlighter swept across again on every class, every task, every trip to
     IB Manager — worth watching the first time, noise the twentieth.
     sessionStorage is per tab and survives a navigation, which makes it the
     record of "already seen"; a deliberate reload overrides that record, and
     so does opening the rail by hand. Storage that throws (a locked-down
     profile) falls back to drawing, which is the old behaviour. */
  let ttDrawOn = (() => {
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      const seen = sessionStorage.getItem('mbs-tt-drawn');
      sessionStorage.setItem('mbs-tt-drawn', '1');
      return !seen || (nav && nav.type === 'reload');
    } catch (e) { return true; }
  })();

  /* Width is set to its resting value before the node goes in, so the mark is
     right even in a tab that never paints; the stroke is then drawn on over
     that, and only while the page is actually visible — a hidden tab never
     advances an animation, and a running one outranks the inline width. */
  function ttMarker(row, seg, t) {
    row._seg = seg;
    const sw = el('div', 'mbs-tt__swipe');
    sw.append(el('i'));
    sw.style.width = ttWidth(seg, t);
    row.append(sw, el('span', 'mbs-tt__left', Math.ceil(seg.e - t) + ' min'));
    if (ttDrawOn && !REDUCED_MOTION.matches && document.visibilityState === 'visible') {
      ttDrawOn = false;   // spent only when it actually plays
      sw.animate([{ width: '0px' }, { width: sw.style.width }], { duration: 700, easing: EASE });
    }
  }

  let ttSel = null;

  /* ---------- the dock ----------
     A panel hung off a tab can only be as tall as a dropdown ought to be, and
     it closes the moment you touch the page behind it — which is most of what
     you want to be doing while you check what is next. The dock keeps its
     width instead, and stays out across pages and navigations, so the day is
     simply there to glance at. */
  let dock = null, dockList = null, dockGlobalsBound = false;
  let dockOpen = store.get('dock', false) === true;

  /* The dock hangs from the bottom edge of the top bar, wherever that is on
     this page. */
  function dockTop() {
    const nav = document.querySelector('nav.navbar');
    const top = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
    document.documentElement.style.setProperty('--dock-top', top + 'px');
  }

  function bindDockGlobals() {
    if (dockGlobalsBound) return;
    const nav = document.querySelector('nav.navbar');
    if (!nav) return;
    dockGlobalsBound = true;
    let pending = false;
    const nudge = () => {
      if (pending || !dockOpen) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; dockTop(); });
    };
    addEventListener('resize', nudge);
    /* A pinned bar keeps the same bottom edge the whole way down the page, so
       only a bar that scrolls away is worth following — and following costs a
       forced layout per frame of scrolling. */
    const pos = getComputedStyle(nav).position;
    if (pos !== 'fixed' && pos !== 'sticky') addEventListener('scroll', nudge, { passive: true });
  }

  /* Same problem the palette has: ManageBac's client-side navigation replaces
     the body, taking the dock with it while this closure still holds the
     reference. Rebuilt whenever it isn't connected, and the caller re-renders
     only then. */
  function ensureDock() {
    if (dock && dock.isConnected) return false;
    dock = el('aside', 'mbs-dock');
    dock.setAttribute('aria-label', 'Timetable');
    document.body.appendChild(dock);
    return true;
  }

  /* Called on every pass, so it re-renders only when it has to: when the dock
     has just been rebuilt, or when the caller says the day has changed under
     it. `force` is what makes reopening land on today. */
  function syncDock(force) {
    if (!document.body) return;
    const root = document.documentElement;
    root.classList.toggle('mbs-docked', dockOpen);
    if (!dockOpen) { if (dock) dock.hidden = true; return; }
    root.classList.toggle('mbs-dock-loose', !document.querySelector('.f-layout-main__wrapper'));
    const fresh = ensureDock();
    dock.hidden = false;
    bindDockGlobals();
    dockTop();
    if (force || fresh || !dockList || !dockList.isConnected) renderTimetable();
  }

  function toggleDock(force) {
    dockOpen = force == null ? !dockOpen : !!force;
    store.set('dock', dockOpen);
    // reopening always lands on today, however far the day picker was walked,
    // and is deliberate enough to be worth drawing the marker on again
    if (dockOpen) { ttSel = null; ttDrawOn = true; }
    syncDock(true);
    markActiveTab();
    if (dockOpen && !REDUCED_MOTION.matches)
      dock.animate([{ transform: 'translateX(-12px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
                   { duration: 170, easing: EASE });
  }

  function renderTimetable() {
    if (!dock) return;
    const t = ttNow(), tIdx = ttToday(), tHalf = ttWeek(new Date());
    if (!ttSel) ttSel = tIdx >= 0 ? { half: tHalf, day: tIdx }
      : { half: ttWeek(new Date(Date.now() + (new Date().getDay() === 6 ? 2 : 1) * 864e5)), day: 0 };
    const live = ttSel.day === tIdx && ttSel.half === tHalf;

    const head = el('div', 'mbs-tt__head');
    head.append(el('h2', null, TT_DAYS[ttSel.day] + ' \u2014 Week ' + (ttSel.half + 1)));
    // Week 2's columns are named for the days, so the reference is the title again
    if (ttSel.half === 0) head.append(el('span', 'src', 'col ' + (ttSel.day + 1)));
    head.append(el('span', 'sp'));
    if (live) head.append(el('span', 'tdy', 'today'));
    const x = el('button', 'mbs-tt__x', '\u00d7');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close the timetable');
    x.addEventListener('click', e => { e.stopPropagation(); toggleDock(false); });
    head.append(x);

    const ruler = el('div', 'mbs-tt__ruler');
    [0, 1].forEach(half => {
      const wkrow = el('div', 'mbs-tt__wkrow');
      wkrow.append(el('div', 'mbs-tt__wk', TT_WEEK_MARK[half]));
      TT_DAYS.forEach((d, i) => {
        const b = el('button', 'mbs-tt__day' + (half === tHalf && i === tIdx ? ' is-today' : ''));
        b.type = 'button';
        b.setAttribute('aria-current', String(ttSel.half === half && ttSel.day === i));
        if (half === tHalf && i === tIdx) b.append(el('span', 'mbs-tt__mark'));
        // the numeral stands in for the name on the Week 1 row, so the day
        // has to be said somewhere a screen reader can still reach it
        b.setAttribute('aria-label', d + ', Week ' + (half + 1));
        // Week 1's columns are numbered rather than named, and the Week 2 row
        // standing underneath already says which day each column is
        b.append(el('b', null, half === 0 ? String(i + 1) : d));
        b.addEventListener('click', e => { e.stopPropagation(); ttSel = { half, day: i }; renderTimetable(); });
        wkrow.append(b);
      });
      ruler.append(wkrow);
    });

    const list = el('div', 'mbs-tt__list');
    const line = ttLine(ttSel.half, ttSel.day);
    if (!line.length) list.append(el('div', 'mbs-tt__none', 'Nothing on this day.'));

    line.forEach(seg => {
      const isNow = live && t >= seg.s && t < seg.e;
      if (seg.gap) {
        const g = el('div', 'mbs-tt__gap' + (seg.gap === 'Lunch' ? ' is-lunch' : '') + (isNow ? ' is-now' : ''));
        g.append(el('span'), el('span', 't', ttHHMM(seg.s)),
                 el('span', null, seg.gap + ' \u2014 ' + (seg.e - seg.s) + ' min'));
        if (isNow) ttMarker(g, seg, t);
        list.append(g);
        return;
      }
      seg.slot.items.forEach((l, i) => {
        const r = el('div', 'mbs-tt__row' + (i ? ' is-alt' : '') +
                     (live && t >= seg.e ? ' is-done' : '') +
                     (isNow && seg.slot.items.length === 1 ? ' is-now' : ''));
        if (isNow && seg.slot.items.length === 1) ttMarker(r, l, t);
        r.append(el('span', 'g', i ? '' : (TT_MARK[l.subject] || '')));
        const tm = el('span', 't');
        if (i) tm.append(document.createTextNode('or'));
        else { tm.append(document.createTextNode(l.start)); tm.append(el('i', null, (l.e - l.s) + ' min')); }
        r.append(tm);
        const sub = el('span', 's');
        sub.append(el('span', 'n', ttName(l.subject)));
        const w = ttWhere(l); if (w) sub.append(el('span', 'r', w));
        r.append(sub);
        list.append(r);
      });
    });

    /* A rebuild drops the scroll box, and the place you had scrolled to goes
       with it — without this, the refresh that follows a period rolling over
       would throw a scrolled day back to the top. */
    const foot = el('div', 'mbs-tt__foot');
    const src = el('a', null, 'Prime Timetable \u2197');
    src.href = TT_SOURCE;
    src.target = '_blank';
    src.rel = 'noopener noreferrer';
    foot.append(el('span', null, 'Source'), src);

    const keep = dockList && dockList.isConnected ? dockList.scrollTop : 0;
    dock.replaceChildren(head, ruler, ttNowBar(), list, foot);
    dockList = list;
    list.scrollTop = keep;
  }

  function ttNowBar() {
    const box = el('div', 'mbs-tt__now');
    const col = ttToday(), half = ttWeek(new Date()), t = ttNow();
    const day = col < 0 ? [] : TT.filter(l => l.d === half * 5 + col).sort((a, b) => a.s - b.s);
    const cur = day.filter(l => t >= l.s && t < l.e);
    const next = day.filter(l => l.s > t);
    const at = next.length ? next[0].s : null;

    const k = el('div', 'k'), v = el('div', 'v'), m = el('div', 'm');
    if (col < 0) { k.textContent = 'Right now'; v.textContent = 'Weekend'; m.append(el('span', null, 'Back Monday 08:10')); }
    else if (cur.length) {
      k.textContent = 'Now';
      v.textContent = cur.map(c => ttName(c.subject)).join('  or  ');
      m.append(el('span', null, cur[0].start + '\u2013' + cur[0].end),
               el('span', null, ttWhere(cur[0]) || 'room TBC'),
               el('span', null, Math.ceil(cur[0].e - t) + ' min left'));
    } else if (at != null) {
      k.textContent = 'Now'; v.textContent = t < ttMin('08:10') ? 'Before school' : 'Free';
      m.append(el('span', null, 'Until ' + ttHHMM(at)), el('span', null, Math.ceil(at - t) + ' min'));
    } else {
      k.textContent = 'Now'; v.textContent = 'Done for the day';
      m.append(el('span', null, TT_DAYS[col] + ' \u00b7 Week ' + (half + 1)));
    }
    box.append(k, v, m);

    if (next.length) {
      const n = next.filter(l => l.s === at);
      const row = el('div', 'mbs-tt__nx');
      row.append(el('span', 'k', 'Next'),
                 el('span', 'n', n.map(c => ttName(c.subject)).join('  or  ')),
                 el('span', 't', n[0].start + '  ' + (ttWhere(n[0]) || '\u2014')));
      box.append(row);
    }
    return box;
  }

  /* While the panel is open the marker creeps and the countdown falls. A full
     re-render would restart the stroke, so only the width and the two numbers
     move; the panel is rebuilt just when a period actually rolls over. */
  let ttLastKey = null;
  setInterval(() => {
    if (!dockOpen || !dock || dock.hidden || !dock.isConnected) return;
    const col = ttToday();
    const key = col < 0 ? null : (() => {
      const t = ttNow(), seg = ttLine(ttWeek(new Date()), col).find(x => t >= x.s && t < x.e);
      return seg ? seg.s : null;
    })();
    if (key !== ttLastKey) { ttLastKey = key; renderTimetable(); return; }
    const row = dock.querySelector('.is-now');
    if (row && row._seg) {
      const t = ttNow(), sw = row.querySelector('.mbs-tt__swipe'), left = row.querySelector('.mbs-tt__left');
      if (sw) sw.style.width = ttWidth(row._seg, t);
      if (left) left.textContent = Math.ceil(row._seg.e - t) + ' min';
    }
  }, 15000);

  /* ============================================================
     RUN
     ============================================================ */

  /* Drop the right-hand column when Guides was all it held, so the content
     gets that width back. Decided here rather than in CSS because it depends
     on which panels the page actually has — anything that isn't Guides
     counts as worth keeping, so panels I haven't seen still survive. */
  /* ============================================================
     INLINE TASK DETAILS
     ============================================================ */

  /* Opening a task to read one line of description costs a page load and
     your place in the list. Instead the task page is fetched in the
     background and its description opened underneath the row, so the list
     stays put. Anything interactive — submitting, discussions — still needs
     the real page, so every panel carries a link to it. */
  const taskDetailCache = new Map();

  async function loadTaskDetail(href) {
    if (!taskDetailCache.has(href)) {
      const res = await fetch(href, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const wrap = document.createElement('div');

      const desc = doc.querySelector('.core-task-details');
      if (desc) wrap.append(desc.cloneNode(true));

      const dropbox = doc.querySelector('.core-task-show .mb-6');
      const status = dropbox ? dropbox.textContent.replace(/\s+/g, ' ').trim() : '';
      if (status) {
        const d = el('div', 'mbs-task-detail__status', status.slice(0, 140));
        wrap.append(d);
      }
      if (!wrap.childNodes.length) wrap.append(el('div', 'mbs-task-detail__status', 'This task has no description.'));

      // fetched markup is same-origin, but nothing here needs to run or submit
      wrap.querySelectorAll('script, iframe, style, form, noscript').forEach(n => n.remove());
      // keep the cache bounded over a long session
      if (taskDetailCache.size >= 24) taskDetailCache.delete(taskDetailCache.keys().next().value);
      taskDetailCache.set(href, wrap);
    }
    return cachedDetail(href);
  }

  /* Synchronous read, so a cached task can be built before the panel is
     inserted: it then animates once, straight to its final height, instead
     of opening small and jerking taller when the fetch lands. */
  function cachedDetail(href) {
    // the parsed node is kept and cloned; re-serialising it to HTML and
    // parsing it back on every open was doing the DOMParser's work twice
    const wrap = taskDetailCache.get(href);
    return wrap ? wrap.cloneNode(true) : null;
  }

  /* Height is animated explicitly rather than via a CSS transition: the
     panel's height isn't known ahead of time, and it changes twice — once
     when the row opens, again when the fetched description replaces the
     loading line. Both are measured and tweened, then height is cleared so
     the panel goes back to sizing itself. */
  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.4, 0, .2, 1)';

  function tween(panel, fromHeight, toHeight, fromOpacity, toOpacity, done) {
    panel.style.overflow = 'hidden';
    const anim = panel.animate(
      [{ height: fromHeight + 'px', opacity: fromOpacity },
       { height: toHeight + 'px',   opacity: toOpacity }],
      { duration: 190, easing: EASE }
    );
    anim.onfinish = anim.oncancel = () => {
      panel.style.overflow = '';
      panel.style.height = '';
      panel.style.opacity = '';
      if (done) done();
    };
  }

  function revealPanel(panel, tile) {
    panel.hidden = false;
    tile.classList.add('mbs-tile-open');
    if (REDUCED_MOTION.matches) return;
    tween(panel, 0, panel.scrollHeight, 0, 1);
  }

  function collapsePanel(panel, tile) {
    if (REDUCED_MOTION.matches) {
      panel.hidden = true;
      tile.classList.remove('mbs-tile-open');
      return;
    }
    tween(panel, panel.getBoundingClientRect().height, 0, 1, 0, () => {
      panel.hidden = true;
      tile.classList.remove('mbs-tile-open');
    });
  }

  /* Swap the panel's contents and tween between the two heights. */
  function resizePanel(panel, mutate) {
    if (REDUCED_MOTION.matches) { mutate(); return; }
    const from = panel.getBoundingClientRect().height;
    mutate();
    const to = panel.scrollHeight;
    if (Math.abs(to - from) < 2) return;
    tween(panel, from, to, 1, 1);
  }

  async function toggleTaskDetail(tile, href) {
    const existing = tile.nextElementSibling;
    if (existing && existing.classList.contains('mbs-task-detail')) {
      if (existing.hidden) revealPanel(existing, tile);
      else collapsePanel(existing, tile);
      return;
    }

    const panel = el('div', 'mbs-task-detail');
    const foot = el('div', 'mbs-task-detail__foot');
    const open = el('a', 'mbs-task-open', 'Open full task ↗');
    open.href = href;
    foot.append(open);

    // warm (hovered or opened before): one animation, no loading flash
    const warm = cachedDetail(href);
    if (warm) {
      panel.append(warm, foot);
      tile.after(panel);
      revealPanel(panel, tile);
      return;
    }

    panel.append(el('div', 'mbs-task-detail__status', 'Loading…'));
    tile.after(panel);
    revealPanel(panel, tile);

    try {
      const body = await loadTaskDetail(href);
      resizePanel(panel, () => { panel.textContent = ''; panel.append(body, foot); });
    } catch (err) {
      resizePanel(panel, () => {
        panel.textContent = '';
        panel.append(el('div', 'mbs-task-detail__status', 'Could not load this task — open it directly.'), foot);
      });
      console.warn('[MBS] task detail', err);
    }
  }

  /* Upcoming / Past / Overdue are plain links, so each click was a full page
     load — the flash. They're swapped in place instead: fetch the view,
     replace just the task list and the button group, and push the URL so
     back still works. Any failure falls back to a real navigation, so the
     buttons never become dead ends. */
  let swapInFlight = false;

  async function swapTaskView(href, push = true) {
    const list = document.querySelector('.js-tasks');
    const group = document.querySelector('.btn-group');
    if (!list || swapInFlight) { if (!list) location.href = href; return; }

    swapInFlight = true;
    list.classList.add('mbs-swapping');
    try {
      const res = await fetch(href, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const fresh = doc.querySelector('.js-tasks');
      if (!fresh) throw new Error('no task list in response');

      list.replaceChildren(...fresh.childNodes);
      const freshGroup = doc.querySelector('.btn-group');
      if (freshGroup && group) group.replaceChildren(...freshGroup.childNodes);
      if (push) history.pushState({ mbsView: href }, '', href);
    } catch (err) {
      console.warn('[MBS] view swap', err);
      location.href = href;
      return;
    } finally {
      swapInFlight = false;
      list.classList.remove('mbs-swapping');
    }
  }

  function enhanceViewTabs() {
    document.querySelectorAll('.btn-group a[href*="view="]').forEach(a => {
      if (a.dataset.mbsView) return;
      a.dataset.mbsView = '1';
      a.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (!document.querySelector('.js-tasks')) return;   // not a page we swap
        e.preventDefault();
        swapTaskView(a.getAttribute('href'));
      });
    });
  }

  addEventListener('popstate', () => {
    if (/view=/.test(location.search) && document.querySelector('.js-tasks')) {
      swapTaskView(location.href, false);
    }
  });

  const PREFETCH_DELAY = 180;
  let prefetchTimer = null;
  let prefetchBusy = false;
  let prefetchNext = null;

  /* One request at a time, but the one waiting is held rather than dropped.
     Dropping it meant that reading down a list — settling on a task while
     the previous one was still in flight — left the task you actually
     wanted cold, and the click paid the full fetch. */
  function runPrefetch(href) {
    if (taskDetailCache.has(href)) return;
    if (prefetchBusy) { prefetchNext = href; return; }
    prefetchBusy = true;
    loadTaskDetail(href).catch(() => {}).finally(() => {
      prefetchBusy = false;
      const next = prefetchNext;
      prefetchNext = null;
      if (next && next !== href) runPrefetch(next);
    });
  }

  function schedulePrefetch(href) {
    if (taskDetailCache.has(href)) return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => runPrefetch(href), PREFETCH_DELAY);
  }

  // leaving a row drops the queued follow-up too, so nothing keeps fetching
  // for a task the cursor has already moved off
  function cancelPrefetch() { clearTimeout(prefetchTimer); prefetchNext = null; }

  /* Four delegated listeners on the document, rather than three per tile
     re-attached on every mutation. The task list is replaced wholesale —
     by swapTaskView, and by ManageBac's own navigation — so the old
     per-tile binding had to re-walk every tile just to find the ones that
     had lost their handlers. Delegation survives the swap untouched.

     A link inside an expanded panel resolves to no tile (the panel is the
     tile's sibling, not its child), so "Open full task" still navigates. */
  function taskLinkAt(node) {
    const link = node && node.closest && node.closest('a[href*="/core_tasks/"]');
    if (!link) return null;
    const tile = link.closest('.f-task-tile');
    return tile ? { link, tile } : null;
  }

  document.addEventListener('click', e => {
    const hit = taskLinkAt(e.target);
    if (!hit) return;
    const { link, tile } = hit;
    // a bypass click we fired ourselves — let it navigate untouched
    if (link.dataset.mbsBypass) { delete link.dataset.mbsBypass; return; }
    // cmd/ctrl/shift keep their normal meaning (new tab, new window)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    e.preventDefault();

    /* Option/Alt opens the full task page instead of expanding. This
       overrides the browser's own alt-click-to-download, which is not
       useful on a task link. Re-dispatching the click rather than
       assigning location keeps ManageBac's own navigation in play, so
       it stays a soft page swap instead of a full reload. */
    if (e.altKey) {
      link.dataset.mbsBypass = '1';
      link.click();
      return;
    }

    toggleTaskDetail(tile, link.getAttribute('href'));
  });

  /* Prefetch on hover, but only on deliberate hover. A task page is ~185KB,
     so firing on every pass of the cursor put a megabyte of competing
     requests behind a list you were only scrolling past. Waiting out a
     short intent delay keeps the click instant without saturating the
     connection. mouseover/mouseout are used because mouseenter/mouseleave
     don't bubble; the relatedTarget check filters the crossings that are
     still inside the same link. */
  document.addEventListener('mouseover', e => {
    const hit = taskLinkAt(e.target);
    if (!hit || (e.relatedTarget && hit.link.contains(e.relatedTarget))) return;
    schedulePrefetch(hit.link.getAttribute('href'));
  });

  document.addEventListener('mouseout', e => {
    const hit = taskLinkAt(e.target);
    if (!hit || (e.relatedTarget && hit.link.contains(e.relatedTarget))) return;
    cancelPrefetch();
  });

  document.addEventListener('focusin', e => {
    const hit = taskLinkAt(e.target);
    if (hit) schedulePrefetch(hit.link.getAttribute('href'));
  });

  function tidyRightSidebar() {
    document.querySelectorAll('.f-layout-main__sidebar').forEach(aside => {
      /* [class*=] is the most expensive selector this script runs, and it
         only needs running once: a sidebar's tab set is fixed once the page
         has populated it. An empty result means it hasn't yet, so the mark
         is withheld and the next pass tries again. */
      if (aside.dataset.mbsAside) return;
      const panels = [...aside.querySelectorAll('[class*="js-sidebar_"]')];
      if (!panels.length) return;
      aside.dataset.mbsAside = '1';
      const keep = panels.filter(p => !/js-sidebar_guides/.test(p.className));
      aside.classList.toggle('mbs-aside-empty', keep.length === 0);
    });
  }

  function apply() {
    loadFonts();
    injectCSS();
    if (!document.body) return;
    try { buildSwitch(); } catch (err) { console.warn('[MBS]', err); }
    try { syncDock(); } catch (err) { console.warn('[MBS]', err); }
    try { tidyRightSidebar(); } catch (err) { console.warn('[MBS]', err); }
    try { enhanceViewTabs(); } catch (err) { console.warn('[MBS]', err); }
  }

  /* The observer sees every mutation on the page, and the script's own
     inserts land back in it — expanding a task queued an apply() for each
     node of the description it had just written. Two filters keep apply()
     off that path: a batch that adds no elements can't have added anything
     worth reacting to, and a node under our own UI is ours, not
     ManageBac's. What's left is the case the observer is actually for —
     ManageBac replacing the page under us. */
  const MINE = '.mbs-panel, .mbs-task-detail, .mbs-switch, .mbs-dock';

  function pageChanged(records) {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.closest(MINE)) continue;
        return true;
      }
    }
    return false;
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };

  apply();
  document.addEventListener('DOMContentLoaded', apply);
  new MutationObserver(records => { if (pageChanged(records)) schedule(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
