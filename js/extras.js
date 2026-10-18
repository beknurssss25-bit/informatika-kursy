/* Extras: nav progress, floating CTA, cursor glow, animated counters, typed terminal, plan spotlight, smooth accordions. No dependencies. */
(function () {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var raf = window.requestAnimationFrame.bind(window);

  /* nav progress + floating CTA (shown once the hero is passed, hidden while the booking block is on screen) */
  var bar = $('navProgress'), cta = $('floatCta'), story = $('top'), booking = $('booking'), bookingOn = false, tick = false;
  function onScroll() {
    tick = false;
    var max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0).toFixed(4) + ')';
    if (cta) {
      var past = scrollY > story.offsetHeight - innerHeight * 0.4, show = past && !bookingOn;
      cta.classList.toggle('show', show); cta.tabIndex = show ? 0 : -1;
    }
  }
  addEventListener('scroll', function () { if (!tick) { tick = true; raf(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  if (booking && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { bookingOn = es[0].isIntersecting; onScroll(); }, { threshold: 0.12 }).observe(booking);
  onScroll();

  /* cursor-follow glow */
  var glow = $('cursorGlow');
  if (glow && fine && !reduce) {
    var gx = 0, gy = 0, tx = 0, ty = 0, run = false;
    var loop = function () { gx += (tx - gx) * 0.14; gy += (ty - gy) * 0.14; glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)'; if (Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) raf(loop); else run = false; };
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; glow.classList.add('on'); if (!run) { run = true; raf(loop); } }, { passive: true });
    document.addEventListener('pointerleave', function () { glow.classList.remove('on'); });
  }

  /* animated counters */
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  function count(el) {
    var to = +el.dataset.count; if (reduce) { el.textContent = to; return; }
    var t0 = performance.now(), dur = 1400;
    (function step(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) raf(step); })(t0);
  }
  counters.forEach(function (c) { c.textContent = '0'; });
  /* typed terminal: the full text is in the HTML; it is cleared and re-typed when the block scrolls into view */
  var body = $('termBody'), nodes = [];
  if (body) {
    var w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) { var n = w.currentNode; if (n.nodeValue.trim() || n.nodeValue === ' ') nodes.push([n, n.nodeValue]); }
    var caret = body.querySelector('.caret');
    if (!reduce) { nodes.forEach(function (p) { p[0].nodeValue = ''; }); if (caret) caret.style.visibility = 'hidden'; }
  }
  var typed = false;
  function typeTerm() {
    if (typed || !body || reduce) return; typed = true;
    var ni = 0, ci = 0;
    (function step() {
      if (ni >= nodes.length) { if (caret) caret.style.visibility = ''; return; }
      var p = nodes[ni]; ci += 2; p[0].nodeValue = p[1].slice(0, ci);
      if (ci >= p[1].length) { ni++; ci = 0; setTimeout(step, p[1].length > 12 ? 110 : 30); } else setTimeout(step, 22);
    })();
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        if (e.target.id === 'term') typeTerm(); else e.target.querySelectorAll('[data-count]').forEach(count);
      });
    }, { threshold: 0.35 });
    var sg = document.querySelector('.stats-grid'); if (sg) io.observe(sg);
    var tm = $('term'); if (tm) io.observe(tm);
  } else { counters.forEach(function (c) { c.textContent = c.dataset.count; }); nodes.forEach(function (p) { p[0].nodeValue = p[1]; }); if (caret) caret.style.visibility = ''; }
  window.__extras = { typeTerm: typeTerm, count: count };

  /* price-card spotlight */
  if (fine) [].forEach.call(document.querySelectorAll('.plan'), function (p) {
    p.addEventListener('pointermove', function (e) { var r = p.getBoundingClientRect(); p.style.setProperty('--mx', (e.clientX - r.left) + 'px'); p.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });

  /* smooth accordions (program + FAQ); plain <details> keeps working without JS / with reduced motion */
  if (!reduce && document.documentElement.animate) [].forEach.call(document.querySelectorAll('.faq details, .prog details'), function (d) {
    var sum = d.querySelector('summary'), anim = null;
    sum.addEventListener('click', function (e) {
      e.preventDefault(); if (anim) anim.cancel();
      var start = d.offsetHeight, opening = !d.open;
      if (opening) d.open = true;
      var end = opening ? d.scrollHeight : sum.offsetHeight + 2;
      d.style.overflow = 'hidden';
      anim = d.animate({ height: [start + 'px', end + 'px'] }, { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
      anim.onfinish = anim.oncancel = function () { if (!opening) d.open = false; d.style.height = d.style.overflow = ''; anim = null; };
    });
  });
})();
