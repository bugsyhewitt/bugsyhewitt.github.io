import { initHeroFX } from './hero-fx';

(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v: number, a: number, b: number) { return v < a ? a : (v > b ? b : v); }
  function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }

  var hero = document.getElementById('hero')!,
      inner = document.getElementById('heroInner')!,
      photo = document.getElementById('heroPhoto')! as HTMLElement,
      scrim = document.getElementById('heroScrim')! as HTMLElement,
      content = document.getElementById('heroContent')! as HTMLElement,
      cue = document.getElementById('heroCue')! as HTMLElement,
      nav = document.getElementById('nav')!,
      spine = document.getElementById('spine')!,
      ticking = false;

  function frame() {
    var r = hero.getBoundingClientRect();
    var dist = hero.offsetHeight - window.innerHeight;
    var p = clamp(-r.top / dist, 0, 1);
    var blurMax = reduce ? 0 : 18;
    var pOp = clamp(1 - p * 1.24, 0, 1);
    /* No scale() transform — the div stays full-screen throughout.
       Only background-size animates: cover (close-up face, matching WebGL)
       shrinks toward contain (~57% width for this near-square image on 16:9),
       revealing the full angel. The void background-color fills the sides. */
    photo.style.transform = '';
    var containW = window.innerHeight / window.innerWidth * 100;
    photo.style.backgroundSize = lerp(100, containW, p).toFixed(1) + '% auto';
    photo.style.filter = 'blur(' + (p * blurMax).toFixed(2) + 'px)';
    photo.style.opacity = pOp.toFixed(3);
    scrim.style.opacity = pOp.toFixed(3);
    var cp = clamp(p * 1.9, 0, 1);
    content.style.opacity = (1 - cp).toFixed(3);
    content.style.transform = 'translateY(' + (-p * 70).toFixed(1) + 'px)';
    cue.style.opacity = clamp(1 - p * 3.6, 0, 1).toFixed(3);
    var bp = clamp(p * 1.2, 0, 1);
    var bg = 'rgb(' + lerp(247, 9, bp) + ',' + lerp(247, 9, bp) + ',' + lerp(247, 10, bp) + ')';
    inner.style.background = bg;
    photo.style.backgroundColor = bg;
    var past = window.scrollY > window.innerHeight * 0.8;
    nav.classList.toggle('show', past);
    spine.classList.toggle('show', past);
    ticking = false;
  }
  function onScroll() { if (!ticking) { requestAnimationFrame(frame); ticking = true; } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -7% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a')) as HTMLAnchorElement[];
  var secObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        links.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id);
        });
      }
    });
  }, { threshold: 0.42 });
  document.querySelectorAll('section[id]').forEach(function (s) { secObs.observe(s); });

  var manifesto: HTMLElement | null = document.getElementById('manifesto');
  if (manifesto) {
    var mLines = Array.prototype.slice.call(manifesto.querySelectorAll('.iline')) as HTMLElement[];
    var lastLine = mLines[mLines.length - 1];
    var GLY = 'ABCDEFGHJKLMNPQRSTUVWXYZ#%&/<>*+=$!?23456789';
    var reduceM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function paint(el: HTMLElement, text: string, cursor: boolean) {
      el.innerHTML = cursor ? (text + '<span class="cur"></span>') : text;
    }

    if (reduceM) {
      mLines.forEach(function (el) { paint(el, el.dataset.text!, false); });
    } else {
      mLines.forEach(function (el) { el.textContent = ''; });
      var started = false, inView = false;

      function scrambleCycle() {
        mLines.forEach(function (el, i) {
          var fin = el.dataset.text!, frame = 0, isLast = (el === lastLine);
          setTimeout(function () {
            var iv = setInterval(function () {
              var rev = Math.floor(frame / 2), out = '';
              for (var c = 0; c < fin.length; c++) {
                var ch = fin.charAt(c);
                if (ch === ' ') out += ' ';
                else if (c < rev) out += ch;
                else out += GLY.charAt(Math.floor(Math.random() * GLY.length));
              }
              paint(el, out, isLast); frame++;
              if (rev > fin.length) { paint(el, fin, isLast); clearInterval(iv); }
            }, 42);
          }, i * 170);
        });
      }

      function typewriter() {
        var li = 0;
        (function next() {
          if (li >= mLines.length) {
            paint(lastLine, lastLine.dataset.text!, true);
            setInterval(function () { if (inView) scrambleCycle(); }, 5000);
            return;
          }
          var el = mLines[li], fin = el.dataset.text!, ci = 0;
          var iv = setInterval(function () {
            ci++;
            paint(el, fin.slice(0, ci), true);
            if (ci >= fin.length) {
              clearInterval(iv);
              el.textContent = fin;
              li++;
              setTimeout(next, 260);
            }
          }, 48);
        })();
      }

      var mObs = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          inView = e.isIntersecting;
          if (e.isIntersecting && !started) { started = true; typewriter(); }
        });
      }, { threshold: 0.4 });
      mObs.observe(manifesto);
    }
  }
})();

const heroGL = document.getElementById('heroGL') as HTMLCanvasElement | null;
if (heroGL) {
  try {
    initHeroFX(heroGL, { imageSrc: '/hero.jpg' });
  } catch (e) {
    console.warn('[hero-fx] init threw, ignoring:', e);
  }
}
