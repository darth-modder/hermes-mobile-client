/*
 * hermes-desktop prototype runtime.
 *
 * NOT part of the design. It only makes the static mockups usable:
 *   1. theme: light / dark / system (the real app's modes), saved in localStorage.
 *      URL override: ?theme=light|dark
 *   2. sub-views: <section data-views="group"> holds <div data-view="id"> panels;
 *      any element with data-show="group:id" switches to that panel.
 *      Deep link: #group=id (several: #a=x&b=y)
 *   3. frame fit: scales the 1220×800 .frame to the viewport. ?fit=0 disables.
 *      ?bare=1 hides the prototype bar and pins the frame at 0,0 (for screenshots).
 *   4. shell stamp: <div data-shell="app" ...> expands into the real app shell
 *      (sidebar + titlebar + status bar) around its children. See SHELL OPTIONS below.
 *
 * Load in <head> WITHOUT defer so the theme class lands before first paint.
 */
;(function () {
  'use strict'

  var KEY = 'hd-proto-theme'
  var root = document.documentElement
  var params = new URLSearchParams(location.search)
  var mq = window.matchMedia('(prefers-color-scheme: dark)')

  function readMode() {
    try {
      return localStorage.getItem(KEY) || 'system'
    } catch (e) {
      return 'system'
    }
  }

  function applyMode(mode) {
    var dark = mode === 'dark' || (mode === 'system' && mq.matches)
    root.classList.toggle('dark', dark)
    root.dataset.protoMode = mode
    var labels = document.querySelectorAll('[data-proto-mode-label]')
    for (var i = 0; i < labels.length; i++) labels[i].textContent = mode
  }

  function setMode(mode) {
    try {
      localStorage.setItem(KEY, mode)
    } catch (e) {}
    applyMode(mode)
  }

  applyMode(params.get('theme') || readMode())
  mq.addEventListener('change', function () {
    if (!params.get('theme')) applyMode(readMode())
  })

  // ── Icons ───────────────────────────────────────────────────────────────
  // ti(name) → Tabler glyph, ci(name) → codicon glyph.
  function ti(name, cls) {
    return '<i class="ti ti-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>'
  }
  function ci(name, cls) {
    return '<i class="codicon codicon-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>'
  }

  // ── Shell stamp ─────────────────────────────────────────────────────────
  // SHELL OPTIONS (data-* on the [data-shell] element):
  //   data-nav="new|skills|messaging|artifacts|cron|kanban"   active sidebar nav row
  //   data-session="id"        selected session row (see SESSIONS ids below)
  //   data-title="…"           titlebar session title (default: selected session)
  //   data-sidebar="sessions|bots|none"   which sidebar tab (bots = Bot Mode roster tab)
  //   data-statusbar="off"     hide the status bar
  //   data-plugins="kanban"    show plugin nav rows
  var SESSIONS = [
    { group: 'Pinned', rows: [{ id: 'release', title: 'Release checklist for v0.9', dot: 'idle', pin: true }] },
    {
      group: 'Today',
      rows: [
        { id: 'auth', title: 'Refactor gateway auth handshake', dot: 'working', age: 'now' },
        { id: 'flaky', title: 'Why is the e2e suite flaky on Windows?', dot: 'unread', age: '12m' },
        { id: 'readme', title: 'Draft README for the Android client', dot: 'done', age: '1h' },
        { id: 'cron', title: 'Summarize inbox every morning', dot: 'idle', age: '3h' }
      ]
    },
    {
      group: 'Yesterday',
      rows: [
        { id: 'theme', title: 'Port nous theme tokens to mobile', dot: 'idle', age: '1d' },
        { id: 'bench', title: 'Benchmark streaming throttle', dot: 'idle', age: '1d' },
        { id: 'sql', title: 'SQLite FTS for session search', dot: 'error', age: '1d' }
      ]
    },
    {
      group: 'Last week',
      rows: [
        { id: 'kanban', title: 'Kanban board orchestration ideas', dot: 'idle', age: '5d' },
        { id: 'voice', title: 'Voice mode latency notes', dot: 'idle', age: '6d' },
        { id: 'ssh', title: 'SSH remote backend setup', dot: 'idle', age: '6d' }
      ]
    }
  ]

  var NAV = [
    { id: 'new', icon: ti('edit'), label: 'New session', kbd: ['Ctrl', 'N'] },
    { id: 'skills', icon: ti('puzzle'), label: 'Capabilities' },
    { id: 'messaging', icon: ti('message-circle'), label: 'Messaging' },
    { id: 'artifacts', icon: ti('photo'), label: 'Artifacts' }
  ]

  function sessionTitle(id) {
    for (var g = 0; g < SESSIONS.length; g++)
      for (var r = 0; r < SESSIONS[g].rows.length; r++) if (SESSIONS[g].rows[r].id === id) return SESSIONS[g].rows[r].title
    return ''
  }

  function sidebarHTML(o) {
    var nav = NAV.slice()
    if ((o.plugins || '').indexOf('kanban') !== -1) nav.push({ id: 'kanban', icon: ci('project'), label: 'Kanban' })
    var bots = o.sidebar === 'bots'
    var h =
      '<aside class="sidebar" aria-label="Sessions sidebar">' +
      '<div class="zstrip" role="tablist"><div class="zstrip__tabs">' +
      '<div class="ztab' + (bots ? '' : ' is-active') + '" role="tab"><span>sessions</span></div>' +
      '<div class="ztab' + (bots ? ' is-active' : '') + '" role="tab"><span>bots</span></div>' +
      '</div><button class="zstrip__min" aria-label="Minimize">' + ci('chevron-down') + '</button></div>' +
      '<nav class="sidebar__nav">'
    for (var i = 0; i < nav.length; i++) {
      var n = nav[i]
      h +=
        '<button class="side-nav' + (o.nav === n.id ? ' is-active' : '') + '" type="button">' + n.icon + '<span class="t-truncate">' + n.label + '</span>' +
        (n.kbd ? '<span class="kbd-group"><span class="kbd kbd--sm">' + n.kbd.join('</span><span class="kbd kbd--sm">') + '</span></span>' : '') +
        '</button>'
    }
    h += '</nav>'
    if (bots) {
      h += '<div data-slot="bots-pane" class="sidebar__list"></div>'
    } else {
      h +=
        '<div class="sidebar__search"><label class="search-field">' + ci('search', 'i-xs') +
        '<input placeholder="Search sessions…" aria-label="Search sessions" /></label>' +
        '<button class="btn btn--ghost btn--icon-xs" aria-label="Filter">' + ci('filter', 'i-xs') + '</button>' +
        '<button class="btn btn--ghost btn--icon-xs" aria-label="New session">' + ci('add', 'i-xs') + '</button></div>'
      h += '<div class="sidebar__list">'
      for (var g = 0; g < SESSIONS.length; g++) {
        var grp = SESSIONS[g]
        h += '<div class="date-divider"><span class="date-divider__label">' + grp.group + '</span><span class="date-divider__rule"></span></div>'
        for (var r = 0; r < grp.rows.length; r++) {
          var s = grp.rows[r]
          h +=
            '<div class="s-row' + (o.session === s.id ? ' is-selected' : '') + '"><div class="s-row__body"><span class="s-row__lead">' +
            (s.pin ? ci('pinned', 'i-xs') : '<span class="status-dot status-dot--' + s.dot + '"></span>') +
            '</span><span class="s-row__label">' + s.title + '</span></div><div class="s-row__meta">' +
            (s.age ? '<span class="s-row__age">' + s.age + '</span>' : '') +
            '<span class="s-row__kebab">' + ci('kebab-vertical', 'i-sm') + '</span></div></div>'
        }
      }
      h += '</div>'
    }
    h +=
      '<div class="sidebar__foot"><span class="avatar">H</span><span class="grow t-truncate">default</span>' +
      '<span class="t-tertiary t-xs">Local</span>' + ci('chevron-up', 'i-xs t-tertiary') + '</div>'
    return h + '</aside>'
  }

  function titlebarHTML(o) {
    var title = o.title != null ? o.title : sessionTitle(o.session) || ''
    return (
      '<header class="titlebar">' +
      '<div class="titlebar__cluster">' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="Hide sidebar">' + ci('layout-sidebar-left') + '</button>' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="Swap sidebar sides">' + ci('arrow-swap') + '</button>' +
      '</div>' +
      (title ? '<button class="titlebar__title" type="button"><span class="t-truncate">' + title + '</span>' + ci('chevron-down', 'i-xs') + '</button>' : '') +
      '<div class="titlebar__cluster ml-auto">' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="Layout editor">' + ci('layout') + '</button>' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="HUD mode">' + ci('comment-discussion') + '</button>' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="Mute haptics">' + ci('unmute') + '</button>' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="Open settings">' + ci('settings-gear') + '</button>' +
      '<button class="btn btn--ghost btn--icon-titlebar" aria-label="Show right sidebar">' + ci('layout-sidebar-right') + '</button>' +
      '</div>' +
      '<div class="win-controls" aria-hidden="true"><span>' + ci('chrome-minimize') + '</span><span>' + ci('chrome-maximize') + '</span><span>' + ci('chrome-close') + '</span></div>' +
      '</header>'
    )
  }

  function statusbarHTML() {
    return (
      '<footer class="statusbar">' +
      '<div class="statusbar__group">' +
      '<button class="statusbar__item" aria-label="Open command center">' + ti('command', 'i-sm') + '</button>' +
      '<button class="statusbar__item"><span class="status-dot status-dot--done"></span>Local gateway</button>' +
      '<button class="statusbar__item">' + ti('folder-open', 'i-xs') + 'hermes-android</button>' +
      '<button class="statusbar__item">' + ti('users', 'i-xs') + 'Agents</button>' +
      '<button class="statusbar__item">' + ti('clock', 'i-xs') + 'Cron</button>' +
      '<button class="statusbar__item">' + ti('world', 'i-xs') + 'Webhooks</button>' +
      '</div>' +
      '<div class="statusbar__group ml-auto">' +
      '<button class="statusbar__item"><span class="context-bar"><span style="width:22%;background:var(--context-usage-system)"></span><span style="width:18%;background:var(--context-usage-tools)"></span><span style="width:12%;background:var(--context-usage-conversation)"></span></span>52%</button>' +
      '<button class="statusbar__item">Session 14m</button>' +
      '<button class="statusbar__item" aria-label="Show terminal">' + ti('terminal-2', 'i-sm') + '</button>' +
      '<button class="statusbar__item">' + ti('hash', 'i-xs') + 'v0.9.2</button>' +
      '</div>' +
      '</footer>'
    )
  }

  function stampShells() {
    var shells = document.querySelectorAll('[data-shell="app"]')
    for (var i = 0; i < shells.length; i++) {
      var el = shells[i]
      var o = el.dataset
      var content = el.innerHTML
      var noSidebar = o.sidebar === 'none'
      el.classList.add('app')
      if (noSidebar) el.classList.add('app--no-sidebar')
      if (o.statusbar === 'off') el.classList.add('app--no-status')
      el.innerHTML =
        titlebarHTML(o) +
        (noSidebar ? '' : sidebarHTML(o)) +
        '<div class="app__main"><div class="workspace">' + content + '</div></div>' +
        (o.statusbar === 'off' ? '' : statusbarHTML())
      var botsSlot = el.querySelector('[data-slot="bots-pane"]')
      var botsTpl = document.getElementById('bots-pane')
      if (botsSlot && botsTpl) botsSlot.innerHTML = botsTpl.innerHTML
    }
  }

  // ── Sub-views ───────────────────────────────────────────────────────────
  function showView(group, id) {
    var host = document.querySelector('[data-views="' + group + '"]')
    if (!host) return
    var panels = host.querySelectorAll(':scope [data-view]')
    var found = false
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].closest('[data-views]') !== host) continue
      var on = panels[i].dataset.view === id
      panels[i].hidden = !on
      if (on) found = true
    }
    if (!found) return
    var triggers = document.querySelectorAll('[data-show^="' + group + ':"]')
    for (var t = 0; t < triggers.length; t++) {
      var active = triggers[t].dataset.show === group + ':' + id
      triggers[t].classList.toggle('is-active', active)
      if (active) triggers[t].setAttribute('aria-current', 'page')
      else triggers[t].removeAttribute('aria-current')
    }
  }

  function applyHash() {
    var hash = new URLSearchParams(location.hash.slice(1))
    var hosts = document.querySelectorAll('[data-views]')
    for (var i = 0; i < hosts.length; i++) {
      var group = hosts[i].dataset.views
      var first = hosts[i].querySelector('[data-view]')
      showView(group, hash.get(group) || hosts[i].dataset.default || (first && first.dataset.view))
    }
  }

  function initViews() {
    applyHash()
    window.addEventListener('hashchange', applyHash)
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-show]')
      if (!t) return
      e.preventDefault()
      var parts = t.dataset.show.split(':')
      showView(parts[0], parts[1])
      var h = new URLSearchParams(location.hash.slice(1))
      h.set(parts[0], parts[1])
      history.replaceState(null, '', '#' + h.toString())
    })
  }

  // ── Frame fit + prototype bar ───────────────────────────────────────────
  function fitFrames() {
    if (params.get('fit') === '0' || params.get('bare') === '1') return
    var frames = document.querySelectorAll('.stage > .frame')
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i]
      var stage = f.parentElement
      var w = f.offsetWidth
      var h = f.offsetHeight
      var s = Math.min(1, (window.innerWidth - 48) / w, (window.innerHeight - 88) / h)
      f.style.transform = 'scale(' + s + ')'
      f.style.transformOrigin = 'top left'
      stage.style.width = w * s + 'px'
      stage.style.height = h * s + 'px'
    }
  }

  function injectChrome() {
    var css =
      '.proto-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px 24px 64px}' +
      '.proto-page--bare{padding:0;display:block}' +
      '.stage{position:relative;flex-shrink:0;box-shadow:0 20px 60px rgb(0 0 0/.25),0 0 0 1px rgb(0 0 0/.12);border-radius:8px;overflow:hidden}' +
      '.proto-page--bare .stage{box-shadow:none;border-radius:0}' +
      '.proto-bar{position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;border-radius:999px;background:rgb(20 22 26/.92);color:#e8eaed;font:500 12px/1 system-ui,sans-serif;box-shadow:0 6px 24px rgb(0 0 0/.3)}' +
      '.proto-bar a{color:#9ec1ff;text-decoration:none}.proto-bar button{all:unset;cursor:pointer;padding:5px 10px;border-radius:999px;background:rgb(255 255 255/.1)}' +
      '.proto-bar button:hover{background:rgb(255 255 255/.18)}.proto-bar .sep{opacity:.35}' +
      '.proto-views{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:1220px;font-family:system-ui,sans-serif}' +
      '.proto-views .btn{font-size:12px}.proto-views .btn.is-active{background:var(--dt-primary);color:var(--dt-primary-foreground)}' +
      '.proto-page--bare .proto-views{display:none}'
    var style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)

    var page = document.querySelector('.proto-page')
    if (params.get('bare') === '1') {
      if (page) page.classList.add('proto-page--bare')
      return
    }
    var home = root.dataset.protoRoot || '../'
    var bar = document.createElement('div')
    bar.className = 'proto-bar'
    bar.innerHTML =
      '<a href="' + home + 'index.html">← All screens</a><span class="sep">|</span><span>' + document.title.replace(/ · hermes-desktop.*/, '') +
      '</span><button type="button" data-proto-cycle>Theme: <span data-proto-mode-label>' + (root.dataset.protoMode || 'system') + '</span></button>'
    document.body.appendChild(bar)
    bar.querySelector('[data-proto-cycle]').addEventListener('click', function () {
      var order = ['light', 'dark', 'system']
      setMode(order[(order.indexOf(root.dataset.protoMode || 'system') + 1) % 3])
    })
  }

  window.HDProto = { setMode: setMode, showView: showView, ti: ti, ci: ci }

  document.addEventListener('DOMContentLoaded', function () {
    stampShells()
    initViews()
    injectChrome()
    fitFrames()
    window.addEventListener('resize', fitFrames)
  })
})()
