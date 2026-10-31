(function () {
  'use strict';

  // The "Bounce Puzzle feedback v2" Google Form, made by tools/make_form.py.
  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeM_7UKkpNfWKpr34QblqYFpVRvIT5OFM2foTsZym9i3a2Gxw/formResponse';
  // Answer key -> that form's field, one question per key.
  var FIELDS = {
    p1_attempt: 'entry.922237877', p1_nearmiss: 'entry.1168707383', p1_pov: 'entry.328582414',
    p1_zoom: 'entry.2123002075', p1_plain: 'entry.300313336',
    p1_rank: 'entry.1396488421', p1_rank_download: 'entry.698736129',
    p1_attempt_ai: 'entry.1512318448', p1_nearmiss_ai: 'entry.1946689651', p1_pov_ai: 'entry.2089592694',
    p1_zoom_ai: 'entry.257282164', p1_plain_ai: 'entry.2032082460',
    p2_cys_watch: 'entry.2096683130', p2_cys_download: 'entry.1799300103',
    p2_wl_watch: 'entry.178458060', p2_wl_download: 'entry.80376627',
    p2_ftw_watch: 'entry.1484879136', p2_ftw_download: 'entry.1113555680',
    p3_plots: 'entry.1050931446', p3_plot_text: 'entry.667428298', p3_caption: 'entry.2139227982', p3_hook: 'entry.1283367253',
    p3_narration: 'entry.2112229059',
    seen: 'entry.1326805459', played: 'entry.1262496214', far: 'entry.1677435559', where: 'entry.1924391642',
    else: 'entry.1884087134', name: 'entry.1343568917',
    sid: 'entry.983195683', finished: 'entry.908961105'
  };
  var QUERY = new URLSearchParams(location.search);
  // ?cheng=1 shows Cheng's own answers as text to copy, instead of sending them.
  var CHENG_MODE = QUERY.get('cheng') === '1';
  var DRY = QUERY.get('dry') === '1' || CHENG_MODE;
  // Cheng's own picks, recorded with ?cheng=1, for "you agreed with Cheng" on
  // the result card. Null until he records them, and the line stays hidden.
  var CHENG = null;

  // ---- What the page asks ------------------------------------------------

  var HOOKS = [
    { id: 'attempt', clip: 'hook-attempt', name: 'Attempt 78' },
    { id: 'nearmiss', clip: 'hook-nearmiss', name: 'Near-miss slow-mo' },
    { id: 'pov', clip: 'hook-pov', name: 'POV' },
    { id: 'zoom', clip: 'hook-zoom', name: 'Zoom out' },
    { id: 'plain', clip: 'hook-plain', name: 'Straight in' }
  ];
  var TYPES = [
    { id: 'cys', dir: 'can-you-solve', title: 'Can you solve <em>this?</em>', edits: ['Countdown ring', 'Rewind reveal', 'Wipe reveal'] },
    { id: 'wl', dir: 'which-layout', title: 'Which one <em>wins?</em>', edits: ['Knockout grid', 'Study and sweep', 'Head to head'] },
    { id: 'ftw', dir: 'fails-then-win', title: 'How many <em>tries?</em>', edits: ['Death counter', 'The wall', 'Rewind'] }
  ];
  // name: the one-line hook shown and saved; text: the full plot it stands for.
  var PLOTS = [
    { name: 'My crush laughed at my confession, then showed me her drafts', text: 'I spent two months working up the nerve to tell my crush I liked her. When I finally did, she laughed and turned her phone around. She’d had the same message to me sitting in her drafts since September.' },
    { name: 'A mom called the cops on us. The cop was my uncle', text: 'My neighbour’s kid kept using our pool without asking. When we locked the gate, her mom called the police on us. The officer who showed up was my uncle, and he had questions for her instead.' },
    { name: 'My boss banned emails, so I asked him 140 questions in person', text: 'My boss banned “unnecessary emails” and said every question had to go through him in person. So for a week, I walked to his office for every single one. All 140 of them.' },
    { name: 'My roommate kept stealing my food, so I labelled my ghost pepper sauce “chili”', text: 'My roommate kept eating my labelled leftovers and swore it wasn’t him. So I labelled a fresh container “chili”. It was my homemade ghost pepper sauce.' },
    { name: 'My sister banned my boyfriend from her wedding, then needed him as the photographer', text: 'My sister banned my boyfriend from her wedding because he’d “ruin the photos”. So neither of us went. A week before, her photographer cancelled, and she had to call the only one free that day: my boyfriend.' },
    { name: 'My boyfriend’s location put him at a concert with my best friend', text: 'My boyfriend said he was at his grandma’s all weekend. Then his shared location showed him at a concert two hours away, with my best friend.' },
    { name: 'A DNA test found the sister I never knew, two streets away', text: 'My parents always told me I was an only child. Then a DNA test said I had a sister, and she lives two streets away.' },
    { name: 'Someone left us coffee every Monday. The camera caught the old owner', text: 'For three months, someone left a hot coffee on our porch every Monday at 6am. When we finally set up a camera, it was the old man who used to own our house.' }
  ];
  // The full-plot ranking: a new story on the same idea as each of the first
  // six first lines above, so nobody ranks the same story twice. Six, not
  // eight, to keep the reading short. name is the label saved.
  var SIBLINGS = [
    { name: 'Prom sign', text: 'I asked my crush to prom in the cafeteria, and she said no in front of everyone. Later her best friend told me why. She’d been planning to ask me that afternoon.' },
    { name: 'Parking officer mom', text: 'My neighbor reported my car for parking too close to her driveway. The parking officer who came to check was my mom. She measured, and the neighbor’s car was the one over the line.' },
    { name: 'Show every step', text: 'My math teacher said we had to show every step, no exceptions. So on the next test, for 2 + 3, I handed in a full page proving it equals 5.' },
    { name: 'Toothpaste cookies', text: 'My little brother kept stealing my cookies and swore it wasn’t him. So I baked a batch with toothpaste instead of frosting. He hasn’t touched the jar since.' },
    { name: 'Cousin’s DJ', text: 'My cousin didn’t invite me to her birthday because I’m “too loud”. The day before, her DJ cancelled, and the only one free was me.' },
    { name: 'Sick on my birthday', text: 'My best friend said she was too sick to come to my birthday. That night she posted from a party across town, with my ex.' }
  ];
  var LETTERS = 'ABCD';

  var SCREENS = [];
  HOOKS.forEach(function (h, i) {
    SCREENS.push({ kind: 'hook', part: 'First impressions', step: (i + 1) + ' of ' + HOOKS.length, hook: h });
  });
  SCREENS.push({ kind: 'rank-hooks', part: 'First impressions', key: 'p1_rank',
    title: 'Which would you keep <em>watching?</em>', desc: 'Tap the openings from the one you’d most keep watching to the least.' });
  SCREENS.push({ kind: 'rank-hooks', part: 'First impressions', key: 'p1_rank_download',
    title: 'Which would make you <em>download</em> it?', desc: 'Same openings. Tap them from most likely to least.' });
  TYPES.forEach(function (t, i) {
    SCREENS.push({ kind: 'compare', part: 'Editing styles', step: (i + 1) + ' of ' + TYPES.length, type: t });
  });
  SCREENS.push({ kind: 'rank-plots', part: 'Stories', key: 'p3_plots', items: PLOTS, show: 'name',
    title: 'Which <em>first lines</em> grab you?', desc: 'Just the opening line of each story. Tap them from best to worst.' });
  SCREENS.push({ kind: 'rank-plots', part: 'Stories', key: 'p3_plot_text', items: SIBLINGS, show: 'text',
    title: 'Which stories would you <em>watch?</em>', desc: 'The whole plot this time. Tap them from the one you’d most want to hear to the least.' });
  SCREENS.push({ kind: 'pick', part: 'Stories', key: 'p3_caption', title: 'Which <em>captions</em> do you like most?',
    sound: true, options: [['caption-current', 'Classic'], ['caption-highlight', 'Highlight'], ['caption-pill', 'Pill'], ['caption-editorial', 'Editorial']] });
  SCREENS.push({ kind: 'pick', part: 'Stories', key: 'p3_hook', title: 'Which <em>opening</em> do you like most?',
    sound: true, options: [['storyhook-slam', 'Slam'], ['storyhook-freeze', 'Freeze'], ['storyhook-card', 'Card']] });
  SCREENS.push({ kind: 'pick', part: 'Stories', key: 'p3_narration', title: 'Which <em>speed</em> sounds best?',
    sound: true, needSound: true, options: [['narration-125', 'Slower'], ['narration-135', 'Middle'], ['narration-145', 'Faster']] });
  SCREENS.push({ kind: 'q', part: 'Last bit', key: 'seen', title: 'Seen our videos on <em>social media?</em>', options: ['Yes, a lot', 'A few times', 'No'] });
  SCREENS.push({ kind: 'q', part: 'Last bit', key: 'played', title: 'Have you played <em>Bounce Puzzle?</em>', options: ['Still playing', 'Tried it', 'Not yet'],
    follow: { key: 'far', unless: 2, title: 'How far did you get?', options: ['1 to 5 levels', '6 to 12 levels', '13 to 24 levels', '25+ levels'] } });
  SCREENS.push({ kind: 'q', part: 'Last bit', key: 'where', title: 'Where do you watch short videos <em>most?</em>', options: ['Instagram', 'TikTok', 'YouTube'] });
  SCREENS.push({ kind: 'about' });
  SCREENS.push({ kind: 'thanks' });

  // ---- State ---------------------------------------------------------------
  // Every answer lives here, never in a video element, so nothing a player
  // does (looping, rewinding, scrubbing) can touch it.
  var answers = {};
  var soundOn = false;

  // Answers are kept on their phone, so a reload picks up where they left off,
  // and sent early if they leave before pressing Send. sid matches those early
  // rows to the final one in the sheet.
  var STORE = DRY ? 'bp-feedback-dry' : 'bp-feedback';
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch (e) {}
  if (saved && saved.done) saved = null;
  if (saved && saved.answers) answers = saved.answers;
  var sid = (saved && saved.sid) || Math.random().toString(36).slice(2, 10);
  var sent = false;
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify({ sid: sid, answers: answers, at: current, done: sent })); } catch (e) {}
  }

  var form = document.getElementById('form');
  var holder = document.getElementById('screens');
  var bar = document.querySelector('.bar');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- Pieces ----------------------------------------------------------------

  // A clip with its own controls under it, so they never cover the clip: play
  // and pause, replay, a scrub bar, and sound for the clips that have it.
  // Tapping the clip also pauses it.
  var PAUSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';
  var PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>';
  function player(clip, opts) {
    opts = opts || {};
    var w = el('div', 'player');
    var frame = el('div', 'p-frame');
    var v = el('video');
    v.src = 'clips/' + clip + '.mp4';
    // The poster loads only once the clip's screen opens, so the first screen
    // does not download every screen's image.
    var poster = 'clips/' + clip + '.jpg';
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('playsinline', '');
    var tap = el('button', 'p-tap'); tap.type = 'button'; tap.setAttribute('aria-label', 'Pause');
    tap.innerHTML = PLAY_SVG.replace('<svg', '<svg class="i-play"');
    var ctr = el('div', 'p-bar');
    var pp = el('button', 'p-btn'); pp.type = 'button'; pp.setAttribute('aria-label', 'Pause'); pp.innerHTML = PAUSE_SVG;
    var replay = el('button', 'p-btn'); replay.type = 'button'; replay.setAttribute('aria-label', 'Replay from the start');
    replay.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var scrub = el('input', 'p-scrub'); scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.value = 0; scrub.setAttribute('aria-label', 'Position in the clip');
    ctr.appendChild(pp); ctr.appendChild(replay); ctr.appendChild(scrub);
    var snd = null;
    if (opts.sound) {
      snd = el('button', 'p-btn p-sound'); snd.type = 'button';
      ctr.appendChild(snd);
      snd.addEventListener('click', function () {
        soundOn = !soundOn;
        document.querySelectorAll('.player').forEach(function (p) { if (p.sync) p.sync(); });
      });
    }
    frame.appendChild(v); frame.appendChild(tap);
    w.appendChild(frame); w.appendChild(ctr);
    w.sync = function () {
      if (!snd) return;
      v.muted = !soundOn;
      snd.setAttribute('aria-label', soundOn ? 'Mute' : 'Sound on');
      snd.innerHTML = soundOn
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      w.classList.toggle('loud', soundOn);
    };
    w.sync();
    var dragging = false;
    function toggle() { if (v.paused) play(); else v.pause(); }
    tap.addEventListener('click', toggle);
    pp.addEventListener('click', toggle);
    replay.addEventListener('click', function () { v.currentTime = 0; play(); });
    scrub.addEventListener('input', function () { dragging = true; if (v.duration) v.currentTime = scrub.value / 1000 * v.duration; });
    scrub.addEventListener('change', function () { dragging = false; });
    v.addEventListener('timeupdate', function () { if (!dragging && v.duration) scrub.value = Math.round(v.currentTime / v.duration * 1000); });
    v.addEventListener('play', function () { w.classList.remove('paused'); tap.setAttribute('aria-label', 'Pause'); pp.setAttribute('aria-label', 'Pause'); pp.innerHTML = PAUSE_SVG; });
    v.addEventListener('pause', function () { w.classList.add('paused'); tap.setAttribute('aria-label', 'Play'); pp.setAttribute('aria-label', 'Play'); pp.innerHTML = PLAY_SVG; });
    function play() {
      if (v.getAttribute('poster') !== poster) v.poster = poster;
      v.preload = 'auto';
      var p = v.play();
      // A browser that blocks sound before a tap still plays the clip, muted.
      if (p && p.catch) p.catch(function () { if (!v.muted) { v.muted = true; v.play().catch(function () {}); } });
    }
    w.play = play;
    w.stop = function () { v.pause(); };
    w.load = function (clip2) {
      v.src = 'clips/' + clip2 + '.mp4';
      poster = 'clips/' + clip2 + '.jpg';
      if (v.hasAttribute('poster')) v.poster = poster;
      scrub.value = 0;
    };
    return w;
  }

  // A 0 to 100% slider in steps of 5. It starts unanswered, showing a dash,
  // and only counts once it has been moved or tapped.
  function slider(key, question, left, right, onTake) {
    var w = el('div', 'slider');
    var id = 's-' + key;
    w.innerHTML = '<div class="s-top"><label class="sr-only" for="' + id + '">' + question + '</label><output class="s-val" for="' + id + '"></output></div>' +
      '<input id="' + id + '" type="range" min="0" max="100" step="5" value="50">' +
      '<div class="ends"><span>' + left + '</span><span>' + right + '</span></div>';
    var input = w.querySelector('input');
    var out = w.querySelector('output');
    function show() {
      var on = answers[key] != null;
      w.classList.toggle('set', on);
      if (on) input.value = answers[key];
      out.textContent = on ? answers[key] + '%' : 'Drag to answer';
      input.style.setProperty('--fill', (on ? answers[key] : 0) + '%');
    }
    function take() { answers[key] = Number(input.value); show(); if (onTake) onTake(); }
    input.addEventListener('input', take);
    input.addEventListener('pointerdown', function () { setTimeout(take, 0); });
    input.addEventListener('keydown', function () { setTimeout(take, 0); });
    show();
    w.refresh = show;
    return w;
  }

  // A 1 to 5 rating as a row of buttons, for ratings that repeat down a list,
  // where a tap is faster than a drag.
  function rate5(key, question, left, right) {
    var w = el('fieldset', 'rate5');
    w.innerHTML = '<legend>' + question + '</legend>';
    var row = el('div', 'r5-row');
    for (var n = 1; n <= 5; n++) {
      (function (n) {
        var b = el('button', 'r5', String(n));
        b.type = 'button';
        b.setAttribute('aria-label', question + ': ' + n + ' of 5');
        b.addEventListener('click', function () {
          answers[key] = n;
          show();
          b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        });
        row.appendChild(b);
      })(n);
    }
    w.appendChild(row);
    w.insertAdjacentHTML('beforeend', '<div class="ends"><span>' + left + '</span><span>' + right + '</span></div>');
    function show() {
      Array.prototype.forEach.call(row.children, function (b, i) {
        b.classList.toggle('on', answers[key] === i + 1);
        b.setAttribute('aria-pressed', answers[key] === i + 1 ? 'true' : 'false');
      });
    }
    show();
    return w;
  }

  // One answer from a row of options, with the game's squash-and-pop on tap.
  // rows=true lays them out as full-width rows with no letters, for screens
  // where the speech bubble already asks the question.
  function choice(key, question, options, onPick, rows) {
    var w = el('fieldset', 'choice');
    w.appendChild(el('legend', rows ? 'sr-only' : '', question));
    var row = el('div', 'c-row ' + (rows ? 'rows' : 'c' + options.length));
    options.forEach(function (o, i) {
      var b = el('button', 'c-opt', (rows ? '' : '<b>' + LETTERS[i] + '</b>') + '<span>' + esc(o) + '</span>');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        answers[key] = LETTERS[i] + ': ' + o;
        show();
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        if (onPick) onPick(i);
      });
      row.appendChild(b);
    });
    w.appendChild(row);
    function show() {
      Array.prototype.forEach.call(row.children, function (b, i) {
        var on = answers[key] === LETTERS[i] + ': ' + options[i];
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    show();
    return w;
  }

  // Tap the items from best to worst. Tapping a ranked item takes it, and
  // every one after it, back out.
  function ranker(key, items, render, cls) {
    var w = el('div', 'rank ' + (cls || ''));
    var order = [];
    // A ranking saved before a reload, as "1. name | 2. name".
    var names = items.map(function (it) { return typeof it === 'string' ? it : it.name; });
    (answers[key] || '').split(' | ').forEach(function (part) {
      var i = names.indexOf(part.replace(/^\d+\. /, ''));
      if (i >= 0) order.push(i);
    });
    var cells = items.map(function (it, i) {
      var b = el('button', 'r-item');
      b.type = 'button';
      b.innerHTML = render(it, i) + '<i class="r-num" aria-hidden="true"></i><span class="sr-only r-state"></span>';
      b.addEventListener('click', function () {
        var at = order.indexOf(i);
        if (at >= 0) order = order.slice(0, at); else order.push(i);
        save();
        b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      });
      w.appendChild(b);
      return b;
    });
    var foot = el('div', 'r-foot');
    var hint = el('p', 'r-hint');
    var clear = el('button', 'btn ghost', 'Start over'); clear.type = 'button';
    clear.addEventListener('click', function () { order = []; save(); });
    foot.appendChild(hint); foot.appendChild(clear);
    function save() {
      answers[key] = order.length ? order.map(function (i, n) { return (n + 1) + '. ' + (typeof items[i] === 'string' ? items[i] : items[i].name); }).join(' | ') : null;
      cells.forEach(function (c, i) {
        var at = order.indexOf(i);
        c.classList.toggle('ranked', at >= 0);
        c.querySelector('.r-num').textContent = at >= 0 ? at + 1 : '';
        c.querySelector('.r-state').textContent = at >= 0 ? ', ranked ' + (at + 1) : ', not ranked yet';
      });
      var left = items.length - order.length;
      hint.textContent = !order.length ? '' : left ?'Next favourite. ' + left + ' to go' : 'All ranked';
      clear.hidden = !order.length;
    }
    // Above the grid, so the count stays in view and never sits under the Next button.
    w.insertBefore(foot, w.firstChild);
    save();
    return w;
  }

  var BACK_BTN = '<button type="button" class="back" data-back aria-label="Back"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
  // Back and Next share one row at the bottom of each screen.
  function dock(label) {
    var d = el('div', 'actions dock', BACK_BTN);
    var b = el('button', 'btn primary', label || 'Next');
    b.type = 'button';
    b.setAttribute('data-next', '');
    d.appendChild(b);
    return d;
  }
  function answered(sec) { return !!sec.querySelector('.c-opt.on, .r5.on, .r-item.ranked, .slider.set'); }
  // On a phone, a video screen opens with the clip large and the questions
  // hidden. Answer (the dock's Next) shrinks the clip and shows them.
  var phone = window.matchMedia('(max-width: 899px)');
  function watching(sec) { return phone.matches && sec.classList.contains('watching'); }
  // The screen's Next reads "Skip" and sits quiet until something on it is
  // answered, then lights up as "Next".
  function refreshDock(sec) {
    var b = sec && sec.querySelector('.dock [data-next]');
    if (!b) return;
    var has = answered(sec);
    b.textContent = watching(sec) ? 'Answer' : has ? 'Next' : 'Skip';
    b.classList.toggle('quiet', !has && !watching(sec));
  }
  // Screen header: the part name, then the question in a speech bubble from the game icon.
  function head(s, title, desc) {
    var h = '';
    if (s.part) h += '<p class="kicker">' + s.part + (s.step ? ' · ' + s.step : '') + '</p>';
    return h + '<div class="ask"><img class="ask-icon" src="assets/icon.png" width="44" height="44" alt="">' +
      '<div class="bubble"><h2 class="card" tabindex="-1">' + title + '</h2>' +
      (desc ? '<p class="desc">' + desc + '</p>' : '') + '</div></div>';
  }
  // Tabs over one player, for screens that compare versions of a clip.
  function tabbed(options, sound, onSelect) {
    var box = el('div', 'vside');
    var tabs = el('div', 'tabs');
    var p = player(options[0][0], { sound: sound });
    options.forEach(function (o, i) {
      var b = el('button', 'tab', '<b>' + LETTERS[i] + '</b> ' + esc(o[1])); b.type = 'button';
      b.addEventListener('click', function () { select(i, true); });
      tabs.appendChild(b);
    });
    function select(i, go) {
      Array.prototype.forEach.call(tabs.children, function (b, n) { b.classList.toggle('on', n === i); b.setAttribute('aria-pressed', n === i ? 'true' : 'false'); });
      p.load(options[i][0]);
      if (go) p.play();
      if (onSelect) onSelect(i);
    }
    box.appendChild(tabs); box.appendChild(p);
    select(0, false);
    return { box: box, player: p };
  }

  // ---- Screens ---------------------------------------------------------------

  var BUILD = {
    hook: function (s, sec) {
      var lay = el('div', 'vlayout');
      var p = player(s.hook.clip, { sound: s.hook.sound });
      var side = el('div', 'vside');
      side.appendChild(p);
      lay.appendChild(side);
      var body = el('div', 'vbody');
      body.innerHTML = head(s, 'Would you keep <em>watching?</em>');
      body.appendChild(slider('p1_' + s.hook.id, 'How likely are you to keep watching?', 'Scroll', 'Keep watching'));
      // The gut reaction on first watch, the way a scrolling viewer meets it.
      body.appendChild(rate5('p1_' + s.hook.id + '_ai', 'Feels AI-made', 'Not at all', 'Completely'));
      body.appendChild(dock());
      lay.appendChild(body);
      sec.appendChild(lay);
      sec.players = [p];
    },
    'rank-hooks': function (s, sec) {
      var col = el('div', 'col wide');
      col.innerHTML = head(s, s.title, s.desc);
      col.appendChild(ranker(s.key, HOOKS, function (h) {
        return '<img src="clips/' + h.clip + '.jpg" alt="" loading="lazy"><span>' + esc(h.name) + '</span>';
      }, 'thumbs'));
      col.appendChild(dock());
      sec.appendChild(col);
    },
    compare: function (s, sec) {
      var t = s.type;
      var key = 'p2_' + t.id + '_watch';
      var lay = el('div', 'vlayout');
      // One slider per edit, shown with the tab that is playing.
      var rate = el('fieldset', 'choice');
      var legend = el('legend');
      rate.appendChild(legend);
      var sliders = t.edits.map(function (n, i) {
        var w = slider(key + i, 'How long would you watch ' + LETTERS[i] + ', ' + n + '?', 'Scroll past', 'Watch it all', combine);
        rate.appendChild(w);
        return w;
      });
      var tb = tabbed(t.edits.map(function (n, i) { return ['edit-' + t.dir + '-' + 'abc'[i], n]; }), true, function (i) {
        legend.innerHTML = 'How long would you watch <b>' + LETTERS[i] + '</b>?';
        sliders.forEach(function (w, n) { w.hidden = n !== i; });
      });
      lay.appendChild(tb.box);
      var body = el('div', 'vbody');
      body.innerHTML = head(s, t.title, t.edits.length + ' ways to edit the same video. Watch each, then pick.');
      body.appendChild(rate);
      // One question at a time: the second appears once all three are rated.
      var second = choice('p2_' + t.id + '_download', 'Which makes you most likely to download the game?', t.edits);
      second.hidden = !/(\|.*){2}/.test(answers[key] || '');
      // Saved together as "A: name 80 | C: name 55 | B: name 20", highest first.
      function combine() {
        var r = t.edits.map(function (n, i) { return i; }).filter(function (i) { return answers[key + i] != null; })
          .sort(function (a, b) { return answers[key + b] - answers[key + a]; });
        answers[key] = r.length ? r.map(function (i) { return LETTERS[i] + ': ' + t.edits[i] + ' ' + answers[key + i]; }).join(' | ') : null;
        if (r.length < t.edits.length || !second.hidden) return;
        second.hidden = false;
        setTimeout(function () { second.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' }); }, 120);
      }
      body.appendChild(second);
      body.appendChild(dock());
      lay.appendChild(body);
      sec.appendChild(lay);
      sec.players = [tb.player];
    },
    'rank-plots': function (s, sec) {
      var col = el('div', 'col wide');
      col.innerHTML = head(s, s.title, s.desc);
      col.appendChild(ranker(s.key, s.items, function (p) { return '<span>' + esc(p[s.show]) + '</span>'; }, 'texts'));
      col.appendChild(dock());
      sec.appendChild(col);
    },
    pick: function (s, sec) {
      var lay = el('div', 'vlayout');
      var tb = tabbed(s.options, s.sound);
      lay.appendChild(tb.box);
      var body = el('div', 'vbody');
      body.innerHTML = head(s, s.title, (s.needSound ? 'Turn your sound on for this one. ' : '') + 'Same story each time, only this changes.');
      body.appendChild(choice(s.key, 'Your pick', s.options.map(function (o) { return o[1]; })));
      body.appendChild(dock());
      lay.appendChild(body);
      sec.appendChild(lay);
      sec.players = [tb.player];
    },
    // One quick question as full-width rows. A tap moves on by itself, unless
    // the answer opens a follow-up question, which then moves on when answered.
    q: function (s, sec) {
      var col = el('div', 'col');
      col.innerHTML = head(s, s.title);
      var timer = null;
      function go() { clearTimeout(timer); timer = setTimeout(function () { if (screens[current] === sec) next(); }, 420); }
      var follow = null;
      col.appendChild(choice(s.key, s.title.replace(/<[^>]+>/g, ''), s.options, function (i) {
        if (!s.follow) return go();
        var open = i !== s.follow.unless;
        follow.hidden = !open;
        if (!open) { delete answers[s.follow.key]; go(); }
        else clearTimeout(timer);
      }, true));
      if (s.follow) {
        follow = choice(s.follow.key, s.follow.title, s.follow.options, go, false);
        follow.hidden = !answers[s.key] || answers[s.key].indexOf(LETTERS[s.follow.unless] + ':') === 0;
        col.appendChild(follow);
      }
      col.appendChild(dock());
      sec.appendChild(col);
    },
    about: function (s, sec) {
      var col = el('div', 'col');
      col.innerHTML = head({ part: 'Last bit' }, 'Anything <em>else?</em>');
      col.insertAdjacentHTML('beforeend',
        '<label class="sr-only" for="more">Anything else?</label>' +
        '<textarea class="text" id="more" rows="4" maxlength="3000" placeholder="What you liked, what you didn’t, what you’d change"></textarea>' +
        '<label class="field" for="who">Your name <span class="opt">Only if Cheng can follow up</span></label>' +
        '<input class="text" id="who" type="text" maxlength="100" autocomplete="name" placeholder="First name, or leave it blank">' +
        '<p class="msg" id="msg" role="alert" hidden></p>');
      var d = el('div', 'actions dock');
      d.innerHTML = BACK_BTN + '<button type="submit" class="btn primary big" id="send">Send my answers</button>';
      col.appendChild(d);
      sec.appendChild(col);
      col.querySelector('#more').value = answers.else || '';
      col.querySelector('#who').value = answers.name || '';
      col.querySelector('#more').addEventListener('input', function (e) { answers.else = e.target.value; });
      col.querySelector('#who').addEventListener('input', function (e) { answers.name = e.target.value; });
    },
    // The ending: a taste card built from their answers, a share button, and the App Store link.
    thanks: function (s, sec) {
      sec.classList.add('thanks');
      var col = el('div', 'col center');
      sec.appendChild(col);
      sec.onShow = function () {
        var t = taste();
        // Two big facts, Wrapped-style: how long they'd watch their top opening,
        // then agreement with Cheng once his picks are in, else their first edit pick.
        var facts = [];
        if (t.hook) facts.push(['Kept watching', answers['p1_' + t.hook.id] + '%', esc(t.hook.name)]);
        var agree = agreement();
        var firstPick = TYPES.map(function (ty) { var a = answers['p2_' + ty.id + '_watch']; return a ? a.slice(3) : null; }).filter(Boolean)[0];
        if (agree) facts.push(['Agreed with Cheng', agree[0] + '/' + agree[1], 'picks']);
        else if (firstPick) facts.push(['Favourite edit', esc(firstPick), '']);
        // The frame shows a still of their top opening, or the game scene when they rated none.
        var pic = t.hook ? '<img src="clips/' + t.hook.clip + '.jpg" alt="">' : ART;
        col.innerHTML =
          '<div class="result" style="--accent:' + t.color + '">' +
            '<div class="res-top" aria-hidden="true"><span class="res-side">TASTE</span><div class="res-frame">' + pic + '</div></div>' +
            '<p class="res-kicker">Your video taste</p>' +
            '<h2 class="res-name" tabindex="-1">' + t.name + '</h2>' +
            '<p class="res-line">' + t.line + '</p>' +
            (facts.length ? '<dl class="res-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>' + (f[2] ? '<span>' + f[2] + '</span>' : '') + '</div>'; }).join('') + '</dl>' : '') +
            '<p class="res-foot"><img src="assets/icon.png" width="28" height="28" alt=""><span>Bounce Puzzle</span><small>' + esc((location.host + location.pathname).replace(/\/$/, '')) + '</small></p>' +
          '</div>' +
          '<p class="res-ask">Thanks for helping. Send it to a friend and see what taste they get.</p>' +
          '<div class="actions center"><button type="button" class="btn primary big" id="share">Send to a friend</button></div>' +
          '<p class="fine" id="share-note" role="status"></p>' +
          '<a class="badge" href="https://apps.apple.com/us/app/bounce-puzzle-platform-jump/id6757413117" target="_blank" rel="noopener"><img src="assets/app-store-badge.svg" width="168" height="56" alt="Download on the App Store"></a>' +
          (DRY ? '<p class="fine">Dry run. Nothing was sent.</p>' : '') +
          (CHENG_MODE ? '<label class="field" for="mine">Your answers, for Claude</label><textarea class="text" id="mine" rows="8" readonly>' + esc(JSON.stringify(answers)) + '</textarea>' : '');
        col.querySelector('#share').addEventListener('click', function () { share(t); });
      };
    }
  };

  // ---- The taste card --------------------------------------------------------

  // Small game scene for the top of the card: a dotted arc from the ball to the goal.
  var ART = '<svg viewBox="0 0 320 120"><path d="M40 30 Q150 -10 200 60 T290 92" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"/>' +
    '<circle cx="40" cy="30" r="15" fill="#ff6b6b" stroke="#14121f" stroke-width="4"/><rect x="150" y="70" width="70" height="12" rx="6" transform="rotate(24 185 76)" fill="#4ecdc4"/>' +
    '<rect x="268" y="80" width="40" height="28" rx="8" fill="#95e77e"/></svg>';
  // One type per opening, picked by whichever they would keep watching longest.
  var TASTES = {
    attempt: { name: 'The Grinder', color: '#ff6b6b', line: 'You stay for the struggle. Seventy-eight tries in, you want to see try seventy-nine.' },
    nearmiss: { name: 'The Slow-mo Snob', color: '#a78bfa', line: 'You live for the almost. One pixel off the goal is your favourite place.' },
    pov: { name: 'The Relatable One', color: '#4ecdc4', line: 'If it feels like you, you watch it. Stuck on a level for an hour? Been there.' },
    zoom: { name: 'The Big Picture', color: '#ffc83d', line: 'You need to see the whole board before you care.' },
    plain: { name: 'The No-Nonsense Viewer', color: '#95e77e', line: 'No intro, no gimmick. Just show you the level.' }
  };
  function taste() {
    var best = null;
    HOOKS.forEach(function (h) { var v = answers['p1_' + h.id]; if (v != null && (!best || v > answers['p1_' + best.id])) best = h; });
    if (!best) return { name: 'The Mystery Viewer', color: '#8c8cc4', line: 'You skipped the ratings, so your taste stays a secret.', hook: null };
    var t = TASTES[best.id];
    return { name: t.name, color: t.color, line: t.line, hook: best };
  }
  // [matches, compared] over the pick questions both they and Cheng answered.
  function agreement() {
    if (!CHENG) return null;
    var keys = ['p2_cys_watch', 'p2_wl_watch', 'p2_ftw_watch', 'p2_cys_download', 'p2_wl_download', 'p2_ftw_download', 'p3_caption', 'p3_hook', 'p3_narration'];
    var n = 0, same = 0;
    keys.forEach(function (k) { if (answers[k] && CHENG[k]) { n++; if (answers[k] === CHENG[k]) same++; } });
    return n ? [same, n] : null;
  }
  // The phone's share sheet where there is one, otherwise copy the link.
  function share(t) {
    var url = location.origin + location.pathname;
    var note = document.getElementById('share-note');
    var text = 'Rate Bounce Puzzle’s videos and find your video taste. I got ' + t.name + '.';
    if (navigator.share) { navigator.share({ title: 'Bounce Puzzle', text: text, url: url }).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(function () { note.textContent = 'Link copied. Paste it to a friend.'; }, function () { note.textContent = url; });
    else note.textContent = url;
  }

  var screens = [document.querySelector('[data-screen="welcome"]')];
  SCREENS.forEach(function (s) {
    var video = s.kind === 'hook' || s.kind === 'compare' || s.kind === 'pick';
    var sec = el('section', 'screen ' + (video ? 'vscreen' : 'tscreen'));
    sec.setAttribute('data-screen', s.kind);
    sec.hidden = true;
    BUILD[s.kind](s, sec);
    if (video) {
      sec.next = function () {
        if (!watching(sec)) return false;
        sec.classList.remove('watching');
        refreshDock(sec);
        sec.querySelector('[tabindex="-1"]').focus({ preventScroll: true });
        return true;
      };
      sec.back = function () {
        if (!phone.matches || sec.classList.contains('watching')) return false;
        sec.classList.add('watching');
        refreshDock(sec);
        window.scrollTo(0, 0);
        return true;
      };
    }
    holder.appendChild(sec);
    screens.push(sec);
  });

  // ---- Moving between screens --------------------------------------------------

  var current = 0;
  function show(i, dir) {
    var last = screens.length - 1;
    screens.forEach(function (s, n) { s.hidden = n !== i; s.classList.remove('enter-fwd', 'enter-back'); });
    var s = screens[i];
    current = i;
    // A video screen with nothing answered opens on the large clip.
    if (s.classList.contains('vscreen')) s.classList.toggle('watching', !answered(s));
    // The first screen shows at once: a fade-in from nothing delays its first paint.
    if (!reduce.matches && dir) { void s.offsetWidth; s.classList.add(dir < 0 ? 'enter-back' : 'enter-fwd'); }
    // Only this screen's clip plays.
    document.querySelectorAll('.player').forEach(function (p) { if (!s.contains(p) && p.stop) p.stop(); });
    if (s.onShow) s.onShow(dir);
    else (s.players || []).forEach(function (p) { p.sync(); p.play(); });
    progress();
    refreshDock(s);
    // No chrome on the welcome screen or around the card, so it screenshots clean.
    bar.parentNode.hidden = i === 0 || i === last;
    window.scrollTo(0, 0);
    var h = s.querySelector('[tabindex="-1"]');
    if (h) h.focus({ preventScroll: true });
    persist();
  }
  // Fills fast early and slower later, which keeps more people going than an
  // even bar (Villar et al. 2013), and hops the ball on every move.
  function progress() {
    var last = screens.length - 1;
    var s = screens[current];
    var x = current >= last ? 1 : (current + (s.fraction ? s.fraction() : 0)) / (last - 1);
    var pct = Math.round(Math.pow(Math.min(x, 1), 0.75) * 100);
    var ball = bar.querySelector('b');
    bar.querySelector('i').style.width = pct + '%';
    ball.style.left = 'clamp(9px, ' + pct + '%, calc(100% - 9px))';
    bar.setAttribute('aria-valuenow', pct);
    if (!reduce.matches) { ball.classList.remove('hop'); void ball.offsetWidth; ball.classList.add('hop'); }
  }
  function next() {
    var s = screens[current];
    if (s.next && s.next()) return;
    if (current < screens.length - 2) show(current + 1, 1);
  }
  function back() {
    var s = screens[current];
    if (s.back && s.back()) return;
    if (current > 0 && current < screens.length - 1) show(current - 1, -1);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-next]')) next();
    else if (e.target.closest('[data-back]')) back();
    else setTimeout(function () { refreshDock(screens[current]); persist(); }, 0);
  });
  document.addEventListener('input', function () { refreshDock(screens[current]); persist(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'textarea') return;
    if (current >= screens.length - 2) return;
    e.preventDefault();
    next();
  });

  // ---- Replay sheet for the looking-back screen ------------------------------

  var sheet = document.getElementById('sheet');
  var sheetBox = document.getElementById('sheet-player');
  function openSheet(clip, sound) {
    document.querySelectorAll('.player').forEach(function (p) { if (p.stop) p.stop(); });
    sheetBox.innerHTML = '';
    var p = player(clip, { sound: sound });
    sheetBox.appendChild(p);
    sheet.hidden = false;
    p.play();
    document.getElementById('sheet-close').focus();
  }
  function closeSheet() { sheet.hidden = true; sheetBox.innerHTML = ''; }
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // ---- Sending ---------------------------------------------------------------

  // done: they pressed Send, rather than left early.
  function collect(done) {
    var fd = new FormData();
    fd.append(FIELDS.sid, sid);
    fd.append(FIELDS.finished, done ? 'yes' : 'no');
    var answered = false;
    Object.keys(answers).forEach(function (k) {
      var v = answers[k];
      if (v == null) return;
      v = String(v).trim();
      if (!v) return;
      if (DRY) console.log('[dry-run] ' + k + ' = ' + v);
      if (FIELDS[k] && k !== 'sid' && k !== 'finished') fd.append(FIELDS[k], v);
      if (k !== 'name') answered = true;
    });
    return { fd: fd, answered: answered };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('msg');
    var sendBtn = document.getElementById('send');
    var c = collect(true);
    if (!c.answered) {
      msg.textContent = 'Answer at least one question before you send. Use Back to go and rate a video.';
      msg.hidden = false;
      return;
    }
    msg.hidden = true;
    if (DRY) { finish(); return; }
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
    var sendBtn = document.getElementById('send');
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send my answers';
    sent = true;
    show(screens.length - 1, 1);
  }

  // Leaving before Send: send what they have, once per change, without waiting
  // for an answer. visibilitychange also covers a phone switching apps.
  var lastEarly = '';
  function sendEarly() {
    if (sent) return;
    var snap = JSON.stringify(answers);
    if (snap === lastEarly) return;
    var c = collect(false);
    if (!c.answered) return;
    lastEarly = snap;
    if (DRY) { console.log('[dry-run] early send for ' + sid); return; }
    try { fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: c.fd, keepalive: true }); } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendEarly(); });
  window.addEventListener('pagehide', sendEarly);

  if (DRY) window.__feedback = { answers: answers, show: show, screens: screens, sendEarly: sendEarly };
  // Back where they were, after a reload partway through.
  show(saved && saved.at > 0 && saved.at < screens.length - 1 ? saved.at : 0, 0);
})();
