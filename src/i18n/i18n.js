window.renderDeathBanner = window.renderDeathBanner || function () {};
      window.trackPlayGoal = window.trackPlayGoal || function () {};

(function () {
  var LANGS = ['ru','en','uk','tr','zh','ar','es','pl','de'];
  var STORE_KEY = 'ui_lang';
  function detectLang() {
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved && LANGS.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || 'ru').toLowerCase();
    if (nav.indexOf('ru') === 0) return 'ru';
    if (nav.indexOf('uk') === 0) return 'uk';
    if (nav.indexOf('en') === 0) return 'en';
    if (nav.indexOf('tr') === 0) return 'tr';
    if (nav.indexOf('zh') === 0) return 'zh';
    if (nav.indexOf('ar') === 0) return 'ar';
    if (nav.indexOf('es') === 0) return 'es';
    if (nav.indexOf('pl') === 0) return 'pl';
    if (nav.indexOf('de') === 0) return 'de';
    return 'en';
  }
  function getText(el) {
    var nodes = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) nodes.push(n);
    }
    if (nodes.length) {
      var t = '';
      for (var j = 0; j < nodes.length; j++) t += nodes[j].textContent;
      return t;
    }
    return el.textContent;
  }
  function setText(el, text) {
    var nodes = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && String(n.textContent).trim()) nodes.push(n);
    }
    if (nodes.length && el.children.length) {
      nodes[0].textContent = text;
      for (var k = 1; k < nodes.length; k++) nodes[k].textContent = '';
      return;
    }
    if (nodes.length === 1 && !el.children.length) {
      nodes[0].textContent = text;
      return;
    }
    el.textContent = text;
  }
  function applyAttrLang(el, lang, base, prop) {
    var key = lang === 'ru' ? 'data-ru' + (base ? '-' + base : '') : 'data-' + lang + (base ? '-' + base : '');
    var val = el.getAttribute(key);
    if (val == null && lang === 'ru') return;
    if (val == null) return;
    if (prop === 'text') setText(el, val);
    else if (prop === 'placeholder') el.setAttribute('placeholder', val);
    else if (prop === 'title') el.setAttribute('title', val);
    else if (prop === 'aria') el.setAttribute('aria-label', val);
  }
  function ensureRu(el, base, getter) {
    var key = 'data-ru' + (base ? '-' + base : '');
    if (!el.hasAttribute(key)) el.setAttribute(key, getter(el));
  }
  function applyUiLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = 'en';
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    document.documentElement.setAttribute('dir', 'ltr');
    if (document.body) document.body.setAttribute('dir', 'ltr');
    var nodes = document.querySelectorAll('[data-en]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.id === 'accountMenuLabel') {

        var cur = getText(el).trim();
        var ruLogin = 'Войти';
        if (!el.hasAttribute('data-ru')) el.setAttribute('data-ru', ruLogin);
        if (cur && cur !== ruLogin && cur !== el.getAttribute('data-en') &&
            cur !== el.getAttribute('data-tr') && cur !== el.getAttribute('data-zh') &&
            cur !== el.getAttribute('data-ar') && cur !== el.getAttribute('data-es') &&
            cur !== el.getAttribute('data-pl') && cur !== el.getAttribute('data-de') &&
            cur !== el.getAttribute('data-ru')) {
          continue;
        }
      }
      ensureRu(el, '', getText);
      var val = lang === 'ru' ? el.getAttribute('data-ru') : el.getAttribute('data-' + lang);
      if (val != null) setText(el, val);
    }
    var ph = document.querySelectorAll('[data-en-placeholder]');
    for (var p = 0; p < ph.length; p++) {
      ensureRu(ph[p], 'placeholder', function (e) { return e.getAttribute('placeholder') || ''; });
      applyAttrLang(ph[p], lang, 'placeholder', 'placeholder');
    }
    var titles = document.querySelectorAll('[data-en-title]');
    for (var t = 0; t < titles.length; t++) {
      ensureRu(titles[t], 'title', function (e) { return e.getAttribute('title') || ''; });
      applyAttrLang(titles[t], lang, 'title', 'title');
    }
    var arias = document.querySelectorAll('[data-en-aria-label]');
    for (var a = 0; a < arias.length; a++) {
      ensureRu(arias[a], 'aria-label', function (e) { return e.getAttribute('aria-label') || ''; });
      applyAttrLang(arias[a], lang, 'aria-label', 'aria');
    }
    var btns = document.querySelectorAll('.lang-flag-btn');
    for (var b = 0; b < btns.length; b++) {
      btns[b].classList.toggle('active', btns[b].getAttribute('data-set-lang') === lang);
    }
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    window.__uiLang = lang;
    try { document.dispatchEvent(new CustomEvent('ui-lang-changed', { detail: { lang: lang } })); } catch (e2) {}
  }
  function bindFlags() {
    var root = document.getElementById('lang-flags');
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    root.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-set-lang]');
      if (!btn) return;
      applyUiLang(btn.getAttribute('data-set-lang'));
    });
  }
  window.setUiLang = applyUiLang;
  window.getUiLang = function () { return window.__uiLang || detectLang(); };
  function bindRatingHeader() {
    var row = document.querySelector('#rating > .header-row');
    if (!row || row.dataset.bound === '1') return;
    row.dataset.bound = '1';
    row.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.rating-col');
      if (!btn) return;
      var open = btn.classList.contains('is-open');
      var opened = row.querySelectorAll('.rating-col.is-open');
      for (var i = 0; i < opened.length; i++) opened[i].classList.remove('is-open');
      if (!open) btn.classList.add('is-open');
    });
    document.addEventListener('click', function (ev) {
      if (row.contains(ev.target)) return;
      var opened = row.querySelectorAll('.rating-col.is-open');
      for (var i = 0; i < opened.length; i++) opened[i].classList.remove('is-open');
    });
  }
  function boot() {
    bindFlags();
    applyUiLang(detectLang());
    bindRatingHeader();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

      (function () {
        try {
          var q = new URLSearchParams(location.search);
          var emb = q.get("embed") === "1" || q.get("wgl") === "1";
          var ref = String(document.referrer || "");
          if (emb || /wgl\.su|etoniko\.github\.io/i.test(ref) || window !== window.top) {
            document.documentElement.classList.add("wgl-embed");
          }
        } catch (e) {}
      })();
