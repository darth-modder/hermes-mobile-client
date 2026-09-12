/*
 * hermes-android mobile prototype runtime. NOT part of the design — it only makes the static
 * mockups usable, exactly like the desktop prototypes' proto.js:
 *   1. theme: light / dark / system (the app's modes), saved in localStorage. URL: ?theme=dark
 *   2. sub-views: <section data-views="group"> holds <div data-view="id"> panels; any element with
 *      data-show="group:id" switches to that panel. Deep link: #group=id (several: #a=x&b=y)
 *   3. fit: scales the 412×915 .phone to the viewport. ?fit=0 disables; ?bare=1 hides the bar.
 *
 * Load in <head> WITHOUT defer so the theme class lands before first paint.
 */
;(function () {
  'use strict'

  var KEY = 'hd-mobile-proto-theme'
  var root = document.documentElement
  var params = new URLSearchParams(location.search)
  var mq = window.matchMedia('(prefers-color-scheme: dark)')

  function readMode() {
    try { return localStorage.getItem(KEY) || 'system' } catch (e) { return 'system' }
  }
  function applyMode(mode) {
    var dark = mode === 'dark' || (mode === 'system' && mq.matches)
    root.classList.toggle('dark', dark)
    root.dataset.protoMode = mode
    var labels = document.querySelectorAll('[data-proto-mode-label]')
    for (var i = 0; i < labels.length; i++) labels[i].textContent = mode
  }
  function setMode(mode) {
    try { localStorage.setItem(KEY, mode) } catch (e) {}
    applyMode(mode)
  }
  applyMode(params.get('theme') || readMode())
  mq.addEventListener('change', function () { if (!params.get('theme')) applyMode(readMode()) })

  // ── Sub-views ───────────────────────────────────────────────────────────
  function showView(group, id) {
    var host = document.querySelector('[data-views="' + group + '"]')
    if (!host) return
    var panels = host.querySelectorAll('[data-view]')
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

  // ── Fit + prototype bar ─────────────────────────────────────────────────
  function fitPhones() {
    if (params.get('fit') === '0' || params.get('bare') === '1') return
    var phones = document.querySelectorAll('.stage > .phone')
    for (var i = 0; i < phones.length; i++) {
      var p = phones[i]
      var stage = p.parentElement
      var w = p.offsetWidth
      var h = p.offsetHeight
      var s = Math.min(1, (window.innerHeight - 96) / h)
      p.style.transform = 'scale(' + s + ')'
      p.style.transformOrigin = 'top left'
      stage.style.width = w * s + 'px'
      stage.style.height = h * s + 'px'
    }
  }

  function injectChrome() {
    var css =
      '.proto-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px 16px 72px}' +
      '.proto-page--bare{padding:0;display:block}' +
      '.stage{position:relative;flex-shrink:0;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgb(0 0 0/.28),0 0 0 1px rgb(0 0 0/.14)}' +
      '.proto-page--bare .stage{box-shadow:none;border-radius:0}' +
      '.proto-views{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:780px;font-family:system-ui,sans-serif}' +
      '.proto-views .btn{min-height:34px;padding:0 12px;font-size:12px;border-radius:999px;background:rgb(255 255 255/.1);color:#e8eaed;border:1px solid rgb(255 255 255/.14);cursor:pointer}' +
      '.proto-views .btn.is-active{background:#2f6ef0;border-color:#2f6ef0;color:#fff}' +
      '.proto-bar{position:fixed;right:14px;bottom:14px;z-index:99999;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;border-radius:999px;background:rgb(20 22 26/.92);color:#e8eaed;font:500 12px/1 system-ui,sans-serif;box-shadow:0 6px 24px rgb(0 0 0/.3)}' +
      '.proto-bar a{color:#9ec1ff;text-decoration:none}.proto-bar button{all:unset;cursor:pointer;padding:5px 10px;border-radius:999px;background:rgb(255 255 255/.1)}' +
      '.proto-page--bare .proto-views,.proto-page--bare .proto-bar{display:none}'
    var style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)

    var page = document.querySelector('.proto-page')
    if (params.get('bare') === '1') { if (page) page.classList.add('proto-page--bare'); return }
    var home = root.dataset.protoRoot || './'
    var bar = document.createElement('div')
    bar.className = 'proto-bar'
    bar.innerHTML =
      '<a href="' + home + 'index.html">← All screens</a><span style="opacity:.35">|</span><span>' +
      document.title.replace(/ · hermes-android.*/, '') +
      '</span><button type="button" data-proto-cycle>Theme: <span data-proto-mode-label>' + (root.dataset.protoMode || 'system') + '</span></button>'
    document.body.appendChild(bar)
    bar.querySelector('[data-proto-cycle]').addEventListener('click', function () {
      var order = ['light', 'dark', 'system']
      setMode(order[(order.indexOf(root.dataset.protoMode || 'system') + 1) % 3])
    })
  }

  window.HDProto = { setMode: setMode, showView: showView }

  document.addEventListener('DOMContentLoaded', function () {
    initViews()
    injectChrome()
    fitPhones()
    window.addEventListener('resize', fitPhones)
  })
})()
