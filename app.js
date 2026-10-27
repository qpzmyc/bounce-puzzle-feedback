(function () {
  'use strict';

  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe8H4qbIsHXVZ6o2ZSgHvsWh-kcJIOMHdtrgiEEJ_mhbXaEJw/formResponse';
  var NAME_FIELD = 'entry.792023968';
  var DRY = new URLSearchParams(location.search).get('dry') === '1';

  var form = document.getElementById('form');
  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var bar = document.querySelector('.bar');
  var barFill = bar.querySelector('i');
  var barBall = bar.querySelector('b');
  var backBtn = document.getElementById('back');
  var msg = document.getElementById('msg');
  var sendBtn = document.getElementById('send');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = 0;
  var activeGroup = null;

  function groupsIn(s) { return Array.prototype.slice.call(s.querySelectorAll('.rate')); }
  function groupValue(g) { var c = g.querySelector('input:checked'); return c ? c.value : null; }

  function show(i, dir) {
    var last = screens.length - 1;
    screens.forEach(function (s, n) {
      s.hidden = n !== i;
      s.classList.remove('enter-fwd', 'enter-back');
    });
    var s = screens[i];
    current = i;
    if (!reduce.matches) {
      void s.offsetWidth;
      s.classList.add(dir < 0 ? 'enter-back' : 'enter-fwd');
    }
    // Only the visible clip plays.
    Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
      if (s.contains(v)) {
        v.preload = 'auto';
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
    var pct = i >= last ? 100 : Math.round((i / (last - 1)) * 100);
    barFill.style.width = pct + '%';
    barBall.style.left = pct + '%';
    bar.setAttribute('aria-valuenow', pct);
    backBtn.hidden = i === 0 || i === last;
    activeGroup = null;
    var gs = groupsIn(s);
    var vb = s.querySelector('.vbody');
    // A video screen shows its second rating once the first has an answer.
    if (vb) vb.classList.toggle('step2', !!(gs[0] && groupValue(gs[0])));
    activeGroup = gs.filter(function (g) { return !groupValue(g); })[0] || gs[0] || null;
    msg.hidden = true;
    window.scrollTo(0, 0);
    var h = s.querySelector('[tabindex="-1"]');
    if (h) h.focus({ preventScroll: true });
  }

  function next() { if (current < screens.length - 2) show(current + 1, 1); }
  function back() { if (current > 0 && current < screens.length - 1) show(current - 1, -1); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-next]');
    if (t) { next(); return; }
    var sk = e.target.closest('[data-skip]');
    if (sk) {
      var ss = sk.closest('.screen');
      Array.prototype.forEach.call(ss.querySelectorAll('input[type=radio]'), function (r) { r.checked = false; });
      var svb = ss.querySelector('.vbody');
      if (svb) svb.classList.remove('step2');
      next();
    }
  });
  backBtn.addEventListener('click', back);

  form.addEventListener('change', function (e) {
    var g = e.target.closest('.rate');
    if (!g) return;
    activeGroup = g;
    var gs = groupsIn(screens[current]);
    var other = gs.filter(function (x) { return x !== g && !groupValue(x); })[0];
    if (other && gs.indexOf(g) < gs.indexOf(other)) activeGroup = other;
    var vb = g.closest('.vbody');
    if (!vb) return;
    // Video screens: reveal the second rating, and move on once both are answered.
    vb.classList.add('step2');
    if (gs.every(groupValue)) {
      var here = current;
      setTimeout(function () { if (current === here) next(); }, reduce.matches ? 150 : 550);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.altKey || (e.metaKey && e.key !== 'Enter') || (e.ctrlKey && e.key !== 'Enter')) return;
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'textarea' || (tag === 'input' && e.target.type === 'text');
    if (current === screens.length - 1) return;
    if (e.key >= '1' && e.key <= '5' && !typing) {
      var g = activeGroup || groupsIn(screens[current])[0];
      if (!g) return;
      var r = g.querySelector('input[value="' + e.key + '"]');
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      var onBtn = tag === 'button' || tag === 'a';
      if (onBtn) return; // the focused button handles it
      if (tag === 'textarea' && !(e.ctrlKey || e.metaKey)) return;
      if (current === screens.length - 2) return; // name field submits through the form
      e.preventDefault();
      next();
    }
  });

  function collect() {
    var fd = new FormData();
    var answered = false;
    new FormData(form).forEach(function (v, k) {
      v = String(v).trim();
      if (!v) return;
      fd.append(k, v);
      if (k !== NAME_FIELD) answered = true;
    });
    return { fd: fd, answered: answered };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = collect();
    if (!c.answered) {
      msg.textContent = 'Answer at least one question before you send. Use Back to go and rate a video.';
      msg.hidden = false;
      return;
    }
    msg.hidden = true;
    if (DRY) {
      c.fd.forEach(function (v, k) { console.log('[dry-run] ' + k + ' = ' + v); });
      finish();
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending';
    fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: c.fd }).then(finish, function () {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Try again';
      msg.textContent = 'That did not go through. Check your connection and tap Try again.';
      msg.hidden = false;
    });
  });

  function finish() {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send my answers';
    if (DRY) document.getElementById('dry').hidden = false;
    show(screens.length - 1, 1);
  }

  show(0, 1);
})();
