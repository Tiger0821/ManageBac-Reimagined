// ==UserScript==
// @name         ManageBac Switch
// @namespace    http://tampermonkey.net/
// @version      2026.09.07.16
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
      { id: 'ib',      label: 'IB Manager', dynamicLabel: 'IB Manager',        href: '/student/ib/activity/cas',      match: /^\/student\/ib/ }
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

  /* Read the class list out of ManageBac's own sidebar before we hide it. */
  function readClasses() {
    const wrap = document.querySelector('.f-menu__item.js-menu-classes-list');
    if (!wrap) return [];
    const out = [];
    wrap.querySelectorAll('.f-menu__submenu-link').forEach(a => {
      const href = a.getAttribute('href') || '';
      const m = href.match(CLASS_HREF);
      if (!m) return;
      const raw = a.textContent.replace(/\s+/g, ' ').trim();
      // elRef: click ManageBac's own link rather than jumping to the URL
      out.push({ id: m[1], href, raw, name: tidy(raw), grade: gradeOf(raw), elRef: a });
    });
    return out;
  }

  function readGroups() {
    // Groups aren't classes: no "(Grade N)" or "-N" section suffix to strip,
    // so they skip tidy() rather than risk it eating a real trailing number
    // (e.g. "IB Film Club 2019-2020" is not a class section).
    const out = [];
    document.querySelectorAll('.f-menu__submenu-link').forEach(a => {
      const href = a.getAttribute('href') || '';
      const m = href.match(GROUP_HREF);
      if (!m) return;
      const raw = a.textContent.replace(/\s+/g, ' ').trim();
      out.push({ id: m[1], href, raw, name: raw, grade: null, elRef: a });
    });
    return out;
  }

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
.mbs-tab.is-active { background:var(--s); color:var(--ink); font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.07); }
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

/* ---------- panels ---------- */
.mbs-panel {
  position:fixed; z-index:2000;
  width:330px; max-height:min(72vh, 540px);
  display:flex; flex-direction:column; overflow:hidden;
  background:var(--s); border:1px solid var(--line);
  border-radius:12px; box-shadow:var(--sh);
}
.mbs-panel[hidden] { display:none !important; }
.mbs-panel__search { padding:10px; border-bottom:1px solid var(--line); }
.mbs-panel__search input {
  width:100%; box-sizing:border-box; outline:none;
  background:var(--s2); color:var(--ink);
  border:1px solid var(--line); border-radius:8px;
  padding:8px 10px; font:400 13px var(--sans);
}
.mbs-panel__search input::placeholder { color:var(--ink3); }
.mbs-panel__search input:focus { border-color:var(--a); background:var(--s); }
.mbs-list { overflow-y:auto; padding:6px; }
.mbs-opt {
  display:flex; align-items:center; gap:9px;
  padding:7px 9px; border-radius:7px;
  color:var(--ink2) !important; font-size:13px; text-decoration:none; cursor:pointer;
}
.mbs-opt:hover, .mbs-opt.is-cursor { background:var(--s2); color:var(--ink) !important; }
.mbs-opt.is-current { color:var(--a2) !important; font-weight:600; }
.mbs-opt__dot { width:7px; height:7px; border-radius:50%; background:var(--a); flex:none; opacity:.75; }
.mbs-opt.is-past .mbs-opt__dot { background:var(--line2); }
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

  function renderPanel(term = '') {
    panelList.textContent = '';
    const q = term.trim().toLowerCase();
    const words = q ? q.split(/\s+/) : [];
    const hit = s => !words.length || words.every(w => (s || '').toLowerCase().includes(w));

    if (panelKind === 'classes') {
      const { now, past, current } = classGroups();
      const showPast = store.get('showPast', false) === true;

      const live = now.filter(c => hit(c.raw + ' ' + c.name));
      if (live.length) {
        if (current != null) panelList.append(el('div', 'mbs-group', 'Grade ' + current));
        live.forEach(c => panelList.append(optionRow(c)));
      }

      const oldOnes = past.filter(c => hit(c.raw + ' ' + c.name));
      if (oldOnes.length) {
        // a search always reaches earlier years; browsing keeps them folded
        if (q) {
          panelList.append(el('div', 'mbs-group', 'Earlier years'));
          oldOnes.forEach(c => panelList.append(optionRow(c, { past: true, tag: 'G' + c.grade })));
        } else {
          const fold = el('button', 'mbs-fold', 'Earlier years (' + oldOnes.length + ')');
          fold.type = 'button';
          fold.setAttribute('aria-expanded', showPast ? 'true' : 'false');
          fold.addEventListener('click', () => {
            store.set('showPast', !(store.get('showPast', false) === true));
            foldJustToggled = true;
            renderPanel(panelSearch.value);
          });
          panelList.append(fold);
          if (showPast) oldOnes.forEach(c => {
            const row = optionRow(c, { past: true, tag: 'G' + c.grade });
            if (foldJustToggled && !REDUCED_MOTION.matches) row.classList.add('mbs-opt--enter');
            panelList.append(row);
          });
          foldJustToggled = false;
        }
      }

      const groups = readGroups().filter(g => hit(g.raw + ' ' + g.name));
      if (groups.length && q) {
        panelList.append(el('div', 'mbs-group', 'Groups'));
        groups.forEach(g => panelList.append(optionRow(g)));
      }

      if (!panelList.querySelector('.mbs-opt')) panelList.append(el('div', 'mbs-empty', 'No class matches “' + term.trim() + '”.'));
    } else {
      CONFIG.more.filter(m => hit(m.label)).forEach(m => panelList.append(optionRow(m)));
      readGroups().filter(g => hit(g.raw + ' ' + g.name)).forEach(g => panelList.append(optionRow(g)));
      if (!panelList.querySelector('.mbs-opt')) panelList.append(el('div', 'mbs-empty', 'Nothing matches.'));
    }
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
    panel.append(search, panelList);
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
      addEventListener('resize', () => { if (panel && !panel.hidden) positionPanel(); });
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
    document.querySelectorAll('.mbs-tab[data-tab]').forEach(b => {
      const spec = CONFIG.tabs.find(t => t.id === b.dataset.tab);
      const on = spec && spec.match && spec.match.test(path);
      b.classList.toggle('is-active', !!on);
    });
  }

  function buildSwitch() {
    if (document.querySelector('.mbs-switch')) { markActiveTab(); return; }
    const host = document.querySelector('.navbar-row');
    if (!host) return;

    const wrap = el('nav', 'mbs-switch');
    wrap.setAttribute('aria-label', 'Sections');

    CONFIG.tabs.forEach(t => {
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
    markActiveTab();
  }

  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') {
      e.preventDefault();
      togglePanel('classes', document.querySelector('.mbs-tab[data-tab="classes"]'));
    }
  });

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
      taskDetailCache.set(href, wrap.innerHTML);
    }
    return cachedDetail(href);
  }

  /* Synchronous read, so a cached task can be built before the panel is
     inserted: it then animates once, straight to its final height, instead
     of opening small and jerking taller when the fetch lands. */
  function cachedDetail(href) {
    if (!taskDetailCache.has(href)) return null;
    const frag = document.createElement('div');
    frag.innerHTML = taskDetailCache.get(href);
    return frag;
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

  function schedulePrefetch(href) {
    if (taskDetailCache.has(href)) return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => {
      if (prefetchBusy || taskDetailCache.has(href)) return;
      prefetchBusy = true;
      loadTaskDetail(href).catch(() => {}).finally(() => { prefetchBusy = false; });
    }, PREFETCH_DELAY);
  }

  function cancelPrefetch() { clearTimeout(prefetchTimer); }

  function enhanceTaskTiles() {
    document.querySelectorAll('.f-task-tile').forEach(tile => {
      if (tile.dataset.mbsTask) return;
      const link = tile.querySelector('a[href*="/core_tasks/"]');
      if (!link) return;
      tile.dataset.mbsTask = '1';
      link.addEventListener('click', e => {
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

      /* Prefetch on hover, but only on deliberate hover. A task page is
         ~185KB, so firing on every pass of the cursor put a megabyte of
         competing requests behind a list you were only scrolling past.
         Waiting out a short intent delay, and allowing one prefetch at a
         time, keeps the click instant without saturating the connection. */
      const href = link.getAttribute('href');
      link.addEventListener('mouseenter', () => schedulePrefetch(href));
      link.addEventListener('mouseleave', cancelPrefetch);
      link.addEventListener('focus', () => schedulePrefetch(href));
    });
  }

  function tidyRightSidebar() {
    document.querySelectorAll('.f-layout-main__sidebar').forEach(aside => {
      const panels = [...aside.querySelectorAll('[class*="js-sidebar_"]')];
      const keep = panels.filter(p => !/js-sidebar_guides/.test(p.className));
      aside.classList.toggle('mbs-aside-empty', panels.length > 0 && keep.length === 0);
    });
  }

  function apply() {
    loadFonts();
    injectCSS();
    if (document.body) {
      try { buildSwitch(); } catch (err) { console.warn('[MBS]', err); }
      try { tidyRightSidebar(); } catch (err) { console.warn('[MBS]', err); }
      try { enhanceTaskTiles(); } catch (err) { console.warn('[MBS]', err); }
      try { enhanceViewTabs(); } catch (err) { console.warn('[MBS]', err); }
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };

  apply();
  document.addEventListener('DOMContentLoaded', apply);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
