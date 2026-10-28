(function () {
  'use strict';

  // The "Bounce Puzzle feedback v2" Google Form, made by tools/make_form.py.
  var FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeM_7UKkpNfWKpr34QblqYFpVRvIT5OFM2foTsZym9i3a2Gxw/formResponse';
  // Answer key -> that form's field, one question per key.
  var FIELDS = {
    p1_attempt: 'entry.922237877', p1_nearmiss: 'entry.1168707383', p1_pov: 'entry.328582414',
    p1_zoom: 'entry.2123002075', p1_plain: 'entry.300313336', p1_story: 'entry.1453603898',
    p1_rank: 'entry.1396488421',
    p2_cys_watch: 'entry.2096683130', p2_cys_download: 'entry.1799300103',
    p2_wl_watch: 'entry.178458060', p2_wl_download: 'entry.80376627',
    p2_ftw_watch: 'entry.1484879136', p2_ftw_download: 'entry.1113555680',
    p3_plots: 'entry.1050931446', p3_caption: 'entry.2139227982', p3_hook: 'entry.1283367253',
    p3_narration: 'entry.2112229059',
    p4_attempt_download: 'entry.1483400404', p4_attempt_ai: 'entry.1512318448',
    p4_nearmiss_download: 'entry.1941313749', p4_nearmiss_ai: 'entry.1946689651',
    p4_pov_download: 'entry.1602677458', p4_pov_ai: 'entry.2089592694',
    p4_zoom_download: 'entry.22883535', p4_zoom_ai: 'entry.257282164',
    p4_plain_download: 'entry.285032175', p4_plain_ai: 'entry.2032082460',
    p4_story_download: 'entry.72826915', p4_story_ai: 'entry.1815440718',
    p4_cys_a_download: 'entry.562780157', p4_cys_a_ai: 'entry.1708879938',
    p4_cys_b_download: 'entry.380603299', p4_cys_b_ai: 'entry.729774536',
    p4_cys_c_download: 'entry.261140446', p4_cys_c_ai: 'entry.789805737',
    p4_wl_a_download: 'entry.980363858', p4_wl_a_ai: 'entry.2059678509',
    p4_wl_b_download: 'entry.382817224', p4_wl_b_ai: 'entry.1138408118',
    p4_wl_c_download: 'entry.1209036199', p4_wl_c_ai: 'entry.2061737866',
    p4_ftw_a_download: 'entry.224541826', p4_ftw_a_ai: 'entry.107544750',
    p4_ftw_b_download: 'entry.972061131', p4_ftw_b_ai: 'entry.968958957',
    p4_ftw_c_download: 'entry.707817124', p4_ftw_c_ai: 'entry.415836664',
    played: 'entry.1262496214', far: 'entry.1677435559', where: 'entry.1924391642',
    else: 'entry.1884087134', name: 'entry.1343568917'
  };
  var DRY = new URLSearchParams(location.search).get('dry') === '1';

  // ---- What the page asks ------------------------------------------------

  var HOOKS = [
    { id: 'attempt', clip: 'hook-attempt', name: 'Attempt 78' },
    { id: 'nearmiss', clip: 'hook-nearmiss', name: 'Near-miss slow-mo' },
    { id: 'pov', clip: 'hook-pov', name: 'POV' },
    { id: 'zoom', clip: 'hook-zoom', name: 'Zoom out' },
    { id: 'plain', clip: 'hook-plain', name: 'Straight in' },
    { id: 'story', clip: 'hook-story', name: 'Story', sound: true }
  ];
  var TYPES = [
    { id: 'cys', dir: 'can-you-solve', title: 'Can you solve <em>this?</em>', edits: ['Countdown ring', 'Rewind reveal', 'Wipe reveal'] },
    { id: 'wl', dir: 'which-layout', title: 'Which one <em>wins?</em>', edits: ['Knockout grid', 'Study and sweep', 'Head to head'] },
    { id: 'ftw', dir: 'fails-then-win', title: 'How many <em>tries?</em>', edits: ['Death counter', 'The wall', 'Rewind'] }
  ];
  var PLOTS = [
    'I spent two months working up the nerve to tell my crush I liked her. When I finally did, she laughed and turned her phone around. She’d had the same message to me sitting in her drafts since September.',
    'My neighbour’s kid kept using our pool without asking. When we locked the gate, her mom called the police on us. The officer who showed up was my uncle, and he had questions for her instead.',
    'My boss banned “unnecessary emails” and said every question had to go through him in person. So for a week, I walked to his office for every single one. All 140 of them.',
    'My roommate kept eating my labelled leftovers and swore it wasn’t him. So I labelled a fresh container “chili”. It was my homemade ghost pepper sauce.',
    'My sister banned my boyfriend from her wedding because he’d “ruin the photos”. So neither of us went. A week before, her photographer cancelled, and she had to call the only one free that day: my boyfriend.',
    'My boyfriend said he was at his grandma’s all weekend. Then his shared location showed him at a concert two hours away, with my best friend.',
    'My parents always told me I was an only child. Then a DNA test said I had a sister, and she lives two streets away.',
    'For three months, someone left a hot coffee on our porch every Monday at 6am. When we finally set up a camera, it was the old man who used to own our house.'
  ];
  var LETTERS = 'ABCD';

  var SCREENS = [];
  HOOKS.forEach(function (h, i) {
    SCREENS.push({ kind: 'hook', part: 'First impressions', step: (i + 1) + ' of ' + HOOKS.length, hook: h });
  });
  SCREENS.push({ kind: 'rank-hooks', part: 'First impressions' });
  TYPES.forEach(function (t, i) {
    SCREENS.push({ kind: 'compare', part: 'Editing styles', step: (i + 1) + ' of ' + TYPES.length, type: t });
  });
  SCREENS.push({ kind: 'rank-plots', part: 'Stories' });
  SCREENS.push({ kind: 'pick', part: 'Stories', key: 'p3_caption', title: 'Which <em>captions</em> do you like most?',
    sound: true, options: [['caption-current', 'Classic'], ['caption-highlight', 'Highlight'], ['caption-pill', 'Pill'], ['caption-editorial', 'Editorial']] });
  SCREENS.push({ kind: 'pick', part: 'Stories', key: 'p3_hook', title: 'Which <em>opening</em> do you like most?',
    sound: true, options: [['storyhook-slam', 'Slam'], ['storyhook-freeze', 'Freeze'], ['storyhook-card', 'Card']] });
  SCREENS.push({ kind: 'pick', part: 'Stories', key: 'p3_narration', title: 'Which <em>speed</em> sounds best?',
    sound: true, needSound: true, options: [['narration-125', 'Slower'], ['narration-135', 'Middle'], ['narration-145', 'Faster']] });
  SCREENS.push({ kind: 'review', part: 'Looking back' });
  SCREENS.push({ kind: 'about' });
  SCREENS.push({ kind: 'thanks' });

  // ---- State ---------------------------------------------------------------
  // Every answer lives here, never in a video element, so nothing a player
  // does (looping, rewinding, scrubbing) can touch it.
  var answers = {};
  var soundOn = false;

  var form = document.getElementById('form');
  var holder = document.getElementById('screens');
  var bar = document.querySelector('.bar');
  var backBtn = document.getElementById('back');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- Pieces ----------------------------------------------------------------

  // A clip with its own controls: tap to pause, a scrub bar, replay, and sound
  // for the clips that have it.
  function player(clip, opts) {
    opts = opts || {};
    var w = el('div', 'player');
    var v = el('video');
    v.src = 'clips/' + clip + '.mp4';
    v.poster = 'clips/' + clip + '.jpg';
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('playsinline', '');
    var tap = el('button', 'p-tap'); tap.type = 'button'; tap.setAttribute('aria-label', 'Pause');
    tap.innerHTML = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>';
    var ctr = el('div', 'p-bar');
    var replay = el('button', 'p-btn'); replay.type = 'button'; replay.setAttribute('aria-label', 'Replay from the start');
    replay.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var scrub = el('input', 'p-scrub'); scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.value = 0; scrub.setAttribute('aria-label', 'Position in the clip');
    ctr.appendChild(replay); ctr.appendChild(scrub);
    var snd = null;
    if (opts.sound) {
      snd = el('button', 'p-btn p-sound'); snd.type = 'button';
      ctr.appendChild(snd);
      snd.addEventListener('click', function () {
        soundOn = !soundOn;
        document.querySelectorAll('.player').forEach(function (p) { if (p.sync) p.sync(); });
      });
    }
    w.appendChild(v); w.appendChild(tap); w.appendChild(ctr);
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
    tap.addEventListener('click', function () { if (v.paused) play(); else v.pause(); });
    replay.addEventListener('click', function () { v.currentTime = 0; play(); });
    scrub.addEventListener('input', function () { dragging = true; if (v.duration) v.currentTime = scrub.value / 1000 * v.duration; });
    scrub.addEventListener('change', function () { dragging = false; });
    v.addEventListener('timeupdate', function () { if (!dragging && v.duration) scrub.value = Math.round(v.currentTime / v.duration * 1000); });
    v.addEventListener('play', function () { w.classList.remove('paused'); tap.setAttribute('aria-label', 'Pause'); });
    v.addEventListener('pause', function () { w.classList.add('paused'); tap.setAttribute('aria-label', 'Play'); });
    function play() {
      v.preload = 'auto';
      var p = v.play();
      // A browser that blocks sound before a tap still plays the clip, muted.
      if (p && p.catch) p.catch(function () { if (!v.muted) { v.muted = true; v.play().catch(function () {}); } });
    }
    w.play = play;
    w.stop = function () { v.pause(); };
    w.load = function (clip2) { v.src = 'clips/' + clip2 + '.mp4'; v.poster = 'clips/' + clip2 + '.jpg'; scrub.value = 0; };
    return w;
  }

  // A 0 to 100% slider in steps of 5. It starts unanswered, showing a dash,
  // and only counts once it has been moved or tapped.
  function slider(key, question, left, right) {
    var w = el('div', 'slider');
    var id = 's-' + key;
    w.innerHTML = '<div class="s-top"><label for="' + id + '">' + question + '</label><output class="s-val" for="' + id + '">–</output></div>' +
      '<input id="' + id + '" type="range" min="0" max="100" step="5" value="50">' +
      '<div class="ends"><span>' + left + '</span><span>' + right + '</span></div>';
    var input = w.querySelector('input');
    var out = w.querySelector('output');
    function show() {
      var on = answers[key] != null;
      w.classList.toggle('set', on);
      if (on) input.value = answers[key];
      out.textContent = on ? answers[key] + '%' : '–';
      input.style.setProperty('--fill', (on ? answers[key] : 0) + '%');
    }
    function take() { answers[key] = Number(input.value); show(); }
    input.addEventListener('input', take);
    input.addEventListener('pointerdown', function () { setTimeout(take, 0); });
    input.addEventListener('keydown', function () { setTimeout(take, 0); });
    show();
    w.refresh = show;
    return w;
  }

  // One answer from a row of options, with the game's squash-and-pop on tap.
  function choice(key, question, options, onPick) {
    var w = el('fieldset', 'choice');
    w.appendChild(el('legend', '', question));
    var row = el('div', 'c-row c' + options.length);
    options.forEach(function (o, i) {
      var b = el('button', 'c-opt', '<b>' + LETTERS[i] + '</b><span>' + esc(o) + '</span>');
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
    var cells = items.map(function (it, i) {
      var b = el('button', 'r-item');
      b.type = 'button';
      b.innerHTML = render(it, i) + '<i class="r-num" aria-hidden="true"></i>';
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
        c.setAttribute('aria-label', (at >= 0 ? 'Ranked ' + (at + 1) + '. ' : '') + 'Tap to rank');
      });
      var left = items.length - order.length;
      hint.textContent = !order.length ? 'Tap your favourite first' : left ? 'Next favourite. ' + left + ' to go' : 'All ranked';
      clear.hidden = !order.length;
    }
    w.appendChild(foot);
    save();
    return w;
  }

  function dock(label) {
    var d = el('div', 'actions dock');
    var b = el('button', 'btn primary', label || 'Next');
    b.type = 'button';
    b.setAttribute('data-next', '');
    d.appendChild(b);
    return d;
  }
  function head(s, title) {
    var h = '';
    if (s.part) h += '<p class="kicker">' + s.part + (s.step ? ' · ' + s.step : '') + '</p>';
    return h + '<h2 class="card" tabindex="-1">' + title + '</h2>';
  }
  // Tabs over one player, for screens that compare versions of a clip.
  function tabbed(options, sound) {
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
      body.appendChild(dock());
      lay.appendChild(body);
      sec.appendChild(lay);
      sec.players = [p];
    },
    'rank-hooks': function (s, sec) {
      var col = el('div', 'col wide');
      col.innerHTML = head(s, 'Rank the <em>openings</em>') + '<p class="desc">Tap them from best to worst.</p>';
      col.appendChild(ranker('p1_rank', HOOKS, function (h) {
        return '<img src="clips/' + h.clip + '.jpg" alt=""><span>' + esc(h.name) + '</span>';
      }, 'thumbs'));
      col.appendChild(dock());
      sec.appendChild(col);
    },
    compare: function (s, sec) {
      var t = s.type;
      var lay = el('div', 'vlayout');
      var tb = tabbed(t.edits.map(function (n, i) { return ['edit-' + t.dir + '-' + 'abc'[i], n]; }), true);
      lay.appendChild(tb.box);
      var body = el('div', 'vbody');
      body.innerHTML = head(s, t.title) + '<p class="desc">Three ways to edit the same video. Watch each, then pick.</p>';
      body.appendChild(choice('p2_' + t.id + '_watch', 'Which would you rather watch?', t.edits));
      body.appendChild(choice('p2_' + t.id + '_download', 'Which makes you most likely to download the game?', t.edits));
      body.appendChild(dock());
      lay.appendChild(body);
      sec.appendChild(lay);
      sec.players = [tb.player];
    },
    'rank-plots': function (s, sec) {
      var col = el('div', 'col wide');
      col.innerHTML = head(s, 'Which stories would you <em>watch?</em>') + '<p class="desc">Tap them from the one you’d most want to hear to the least.</p>';
      col.appendChild(ranker('p3_plots', PLOTS, function (p) { return '<span>' + esc(p) + '</span>'; }, 'texts'));
      col.appendChild(dock());
      sec.appendChild(col);
    },
    pick: function (s, sec) {
      var lay = el('div', 'vlayout');
      var tb = tabbed(s.options, s.sound);
      lay.appendChild(tb.box);
      var body = el('div', 'vbody');
      body.innerHTML = head(s, s.title) + '<p class="desc">' + (s.needSound ? 'Turn your sound on for this one. ' : '') + 'Same story each time, only this changes.</p>';
      body.appendChild(choice(s.key, 'Your pick', s.options.map(function (o) { return o[1]; })));
      body.appendChild(dock());
      lay.appendChild(body);
      sec.appendChild(lay);
      sec.players = [tb.player];
    },
    review: function (s, sec) {
      var col = el('div', 'col wide');
      col.innerHTML = head(s, 'Looking <em>back</em>') + '<p class="desc">One last pass over what you watched. Tap a clip to see it again.</p>';
      var list = el('div', 'review');
      col.appendChild(list);
      col.appendChild(dock());
      sec.appendChild(col);
      // Rebuilt each time the screen opens, so it shows the edits they picked.
      sec.onShow = function () {
        list.innerHTML = '';
        reviewItems().forEach(function (it) {
          var c = el('div', 'r-card');
          var th = el('button', 'r-thumb', '<img src="clips/' + it.clip + '.jpg" alt=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>');
          th.type = 'button';
          th.setAttribute('aria-label', 'Watch ' + it.name + ' again');
          th.addEventListener('click', function () { openSheet(it.clip, it.sound); });
          var bx = el('div', 'r-body', '<p class="r-name">' + esc(it.name) + '</p>');
          bx.appendChild(slider('p4_' + it.id + '_download', 'Makes me want to download it', 'Not at all', 'Definitely'));
          bx.appendChild(slider('p4_' + it.id + '_ai', 'Feels AI-made', 'Not at all', 'Completely'));
          c.appendChild(th); c.appendChild(bx);
          list.appendChild(c);
        });
      };
    },
    about: function (s, sec) {
      var col = el('div', 'col');
      col.innerHTML = '<p class="kicker">Last bit</p><h2 class="card" tabindex="-1">About <em>you</em></h2>';
      var far;
      col.appendChild(choice('played', 'Have you played Bounce Puzzle?', ['Still playing', 'Tried it', 'Not yet'], function (i) {
        far.hidden = i === 2;
        if (i === 2) delete answers.far;
      }));
      far = choice('far', 'How far did you get?', ['World 1 to 2', 'World 3 to 5', 'World 6 to 8', 'Finished']);
      far.hidden = true;
      col.appendChild(far);
      col.appendChild(choice('where', 'Where do you watch short videos most?', ['Instagram', 'TikTok', 'YouTube', 'Snapchat']));
      col.insertAdjacentHTML('beforeend',
        '<label class="field" for="more">Anything else? <span class="opt">Optional</span></label>' +
        '<textarea class="text" id="more" rows="4" maxlength="3000" placeholder="What you liked, what you didn’t, what you’d change"></textarea>' +
        '<label class="field" for="who">Your name <span class="opt">Optional, only if you’re fine with Cheng following up</span></label>' +
        '<input class="text" id="who" type="text" maxlength="100" autocomplete="name" placeholder="First name, or leave it blank">' +
        '<p class="msg" id="msg" role="alert" hidden></p>');
      var d = el('div', 'actions dock');
      d.innerHTML = '<button type="submit" class="btn primary big" id="send">Send my answers</button>';
      col.appendChild(d);
      sec.appendChild(col);
      col.querySelector('#more').addEventListener('input', function (e) { answers.else = e.target.value; });
      col.querySelector('#who').addEventListener('input', function (e) { answers.name = e.target.value; });
    },
    thanks: function (s, sec) {
      sec.classList.add('thanks');
      sec.innerHTML = '<div class="col center"><img class="icon hop" src="assets/icon.png" width="96" height="96" alt="">' +
        '<h2 class="card" tabindex="-1">Thank <em>you</em></h2>' +
        '<p class="desc">If you haven’t played it yet, it’s free on the App Store.</p>' +
        '<a class="badge" href="https://apps.apple.com/us/app/bounce-puzzle-platform-jump/id6757413117" target="_blank" rel="noopener"><img src="assets/app-store-badge.svg" width="168" height="56" alt="Download on the App Store"></a>' +
        '<p class="fine" id="dry" hidden>Dry run. Nothing was sent.</p></div>';
    }
  };

  // The videos for the looking-back screen: every opening, then the edit they
  // said they'd rather watch for each video type.
  function reviewItems() {
    var items = HOOKS.map(function (h) { return { id: h.id, clip: h.clip, name: h.name, sound: h.sound }; });
    TYPES.forEach(function (t) {
      var a = answers['p2_' + t.id + '_watch'];
      if (!a) return;
      var i = LETTERS.indexOf(a[0]);
      items.push({ id: t.id + '_' + 'abc'[i], clip: 'edit-' + t.dir + '-' + 'abc'[i], name: t.edits[i], sound: true });
    });
    return items;
  }

  var screens = [document.querySelector('[data-screen="welcome"]')];
  SCREENS.forEach(function (s) {
    var video = s.kind === 'hook' || s.kind === 'compare' || s.kind === 'pick';
    var sec = el('section', 'screen ' + (video ? 'vscreen' : 'tscreen'));
    sec.setAttribute('data-screen', s.kind);
    sec.hidden = true;
    BUILD[s.kind](s, sec);
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
    if (!reduce.matches) { void s.offsetWidth; s.classList.add(dir < 0 ? 'enter-back' : 'enter-fwd'); }
    if (s.onShow) s.onShow();
    // Only this screen's clip plays.
    document.querySelectorAll('.player').forEach(function (p) { if (!s.contains(p) && p.stop) p.stop(); });
    (s.players || []).forEach(function (p) { p.sync(); p.play(); });
    var pct = i >= last ? 100 : Math.round(i / (last - 1) * 100);
    bar.querySelector('i').style.width = pct + '%';
    bar.querySelector('b').style.left = pct + '%';
    bar.setAttribute('aria-valuenow', pct);
    backBtn.hidden = i === 0 || i === last;
    window.scrollTo(0, 0);
    var h = s.querySelector('[tabindex="-1"]');
    if (h) h.focus({ preventScroll: true });
  }
  function next() { if (current < screens.length - 2) show(current + 1, 1); }
  function back() { if (current > 0 && current < screens.length - 1) show(current - 1, -1); }

  document.addEventListener('click', function (e) { if (e.target.closest('[data-next]')) next(); });
  backBtn.addEventListener('click', back);
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

  function collect() {
    var fd = new FormData();
    var answered = false;
    Object.keys(answers).forEach(function (k) {
      var v = answers[k];
      if (v == null) return;
      v = String(v).trim();
      if (!v) return;
      if (DRY) console.log('[dry-run] ' + k + ' = ' + v);
      if (FIELDS[k]) fd.append(FIELDS[k], v);
      if (k !== 'name') answered = true;
    });
    return { fd: fd, answered: answered };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('msg');
    var sendBtn = document.getElementById('send');
    var c = collect();
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
    if (DRY) document.getElementById('dry').hidden = false;
    show(screens.length - 1, 1);
  }

  if (DRY) window.__feedback = { answers: answers, show: show, screens: screens };
  show(0, 1);
})();
