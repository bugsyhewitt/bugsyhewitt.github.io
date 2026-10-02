import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { CARDS, repoUrl, title } from './cards';
import { raisedOn, isAlive } from '../raised';

gsap.registerPlugin(Draggable);

// front card full color, others greyscale. Flip to false for all-color.
const DESATURATE_SIBLINGS = true;

export interface CarouselOptions {
  /** Bring an element into view (main.ts passes Lenis when it's running). */
  scrollTo?: (el: HTMLElement) => void;
}

// Set by initCarousel; lets other modules (the séance `summon`) turn the wheel.
let summonByName: ((name: string) => boolean) | null = null;

/** Scroll to the deck and turn it to the named card. False if no such card. */
export function summonCard(name: string): boolean {
  return summonByName ? summonByName(name) : false;
}

const cardFromHash = (): number => {
  const m = /^#card=([\w-]+)$/.exec(location.hash);
  return m ? CARDS.findIndex(c => c.name === m[1].toLowerCase()) : -1;
};

export function initCarousel(opts: CarouselOptions = {}): void {
  const wheel = document.getElementById('carousel');
  const itemsEl = document.getElementById('carouselItems');
  if (!wheel || !itemsEl) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Wheel pivot distance lives in CSS (--pivot on .carousel__items) so the ring can
  // tighten on phones; every card must orbit the same point.
  const pivot = getComputedStyle(itemsEl).getPropertyValue('--pivot').trim() || '200vh';

  // build cards
  CARDS.forEach((card, i) => {
    const item = document.createElement('div');
    item.className = 'carousel__item';
    item.innerHTML =
      `<a class="carousel__card" href="${repoUrl(card)}" target="_blank" rel="noopener" draggable="false" tabindex="${i === 0 ? 0 : -1}">
         <img class="carousel__img" src="/cards/${card.name}.jpg"
              srcset="/cards/${card.name}-340.jpg 340w, /cards/${card.name}-480.jpg 480w, /cards/${card.name}-680.jpg 680w, /cards/${card.name}.jpg 848w"
              sizes="(max-width: 700px) 240px, (max-width: 1000px) 300px, 340px"
              alt="" draggable="false" loading="lazy" decoding="async" />
       </a>`;
    // the cover's printed text, so the card reads the same to a screen reader or a crawler
    item.querySelector('img')!.alt = `${title(card)}, resurrects ${card.raises}: ${card.tagline}`;
    itemsEl.appendChild(item);
  });

  const count = document.getElementById('carouselCount');
  if (count) count.textContent = `${CARDS.length} cards`;

  const images = gsap.utils.toArray<HTMLElement>('.carousel__item');
  const total = images.length;
  const degree = 360 / total;

  // Prevent a click firing at the end of a drag.
  let dragged = false;
  images.forEach(item => {
    const link = item.querySelector('a')!;
    link.addEventListener('click', e => { if (dragged) { e.preventDefault(); } });
  });

  // Build the entrance timeline PAUSED — plays on scroll-in.
  const tl = gsap.timeline({ paused: true });

  // Both assemble tweens (scale reset + fan-out) must co-fire at this instant.
  const assembleAt = 0.15 * (total / 2 - 1) + 1;

  images.forEach((image, index) => {
    const sign = Math.floor((index / 2) % 2) ? 1 : -1;
    const value = Math.floor((index + 4) / 4) * 4;
    const rotation = index > total - 3 ? 0 : sign * value;

    gsap.set(image, { rotation, scale: 0.5 });

    tl.from(image, {
      x: () => index % 2
        ? window.innerWidth + image.clientWidth * 4
        : -window.innerWidth - image.clientWidth * 4,
      y: () => window.innerHeight - image.clientHeight,
      rotation: index % 2 ? 200 : -200,
      scale: 4,
      opacity: 1,
      ease: 'power4.out',
      duration: 1,
      delay: 0.15 * Math.floor(index / 2),
    }, 0);

    const rotationAngle = index * degree;
    tl.to(image, { scale: 1, duration: 0 }, assembleAt);
    tl.to(image, {
      transformOrigin: `center ${pivot}`, // same pivot as .carousel__items (CSS --pivot)
      rotation: index > total / 2 ? -degree * (total - index) : rotationAngle,
      duration: 1,
      ease: 'power1.out',
    }, assembleAt);
  });

  // Liquid materialize on the incoming front card: displace through the shared
  // #liquid SVG filter for ~0.6s, then drop the inline filter so drag stays cheap.
  let prevBest = -1;
  let revealImg: HTMLElement | null = null;
  function liquidReveal(img: HTMLElement): void {
    const disp = document.getElementById('liquidDisp');
    if (!disp) return;
    if (revealImg && revealImg !== img) revealImg.style.filter = ''; // interrupted reveal: unfilter the old card
    revealImg = img;
    gsap.killTweensOf(disp);
    img.style.filter = 'url(#liquid)';
    gsap.fromTo(disp, { attr: { scale: 26 } }, {
      attr: { scale: 0 }, duration: 0.6, ease: 'power2.out',
      onComplete() { img.style.filter = ''; if (revealImg === img) revealImg = null; },
    });
  }

  // Desaturate all but the front-most card. Front = the item whose world
  // rotation is closest to 0 (pointing up at the viewer).
  function updateFocus(): void {
    const wheelRot = (gsap.getProperty(itemsEl, 'rotation') as number) || 0;
    let best = 0, bestDelta = Infinity;
    images.forEach((image, i) => {
      const own = (gsap.getProperty(image, 'rotation') as number) || 0;
      // effective angle of this card relative to top
      let ang = ((own + wheelRot) % 360 + 360) % 360;
      if (ang > 180) ang -= 360;
      const d = Math.abs(ang);
      if (d < bestDelta) { bestDelta = d; best = i; }
    });
    images.forEach((image, i) => {
      if (DESATURATE_SIBLINGS) image.classList.toggle('is-dim', i !== best);
      image.querySelector('a')!.tabIndex = i === best ? 0 : -1;   // only the front card is a tab stop
    });
    if (best !== prevBest) {
      prevBest = best;
      paintCaption(best);
      // keyboard user sitting on a card: follow the wheel to the new front card
      const active = document.activeElement;
      if (active && active !== wheel && wheel!.contains(active)) {
        images[best].querySelector<HTMLElement>('a')!.focus({ preventScroll: true });
      }
      if (!reduceMotion) {
        const img = images[best].querySelector<HTMLElement>('.carousel__img');
        if (img) liquidReveal(img);
      }
    }
  }

  // The reading: the front card's number, name, lineage and printed tagline.
  // The visible caption follows every frame; the screen-reader announcement and
  // the #card= hash only change once the wheel settles.
  const caption = document.getElementById('carouselCaption');
  const live = document.getElementById('carouselLive');
  const pad = (n: number): string => String(n).padStart(2, '0');
  function paintCaption(i: number): void {
    if (!caption) return;
    const c = CARDS[i];
    const seen = raisedOn(c.name);
    caption.querySelector('.cc__meta')!.innerHTML =
      `<b>${pad(i + 1)}</b> / ${pad(total)} &middot; ${title(c)} &middot; resurrects ${c.raises}` +
      (seen ? ` &middot; <span class="cc__alive${isAlive(seen) ? ' is-alive' : ''}">last seen alive ${seen}</span>` : '');
    caption.querySelector('.cc__line')!.textContent = c.tagline;
  }
  function settle(byUser: boolean): void {
    if (prevBest < 0) return;
    const c = CARDS[prevBest];
    if (live) live.textContent = `${title(c)}, card ${prevBest + 1} of ${total}. Resurrects ${c.raises}. ${c.tagline}`;
    if (byUser) history.replaceState(null, '', `#card=${c.name}`);
  }

  // Keyboard (WCAG 2.1.1): the wheel (#carousel, tabindex=0) is the stop, so
  // arrows keep their normal meaning everywhere else on the page. Card i sits
  // at its own rotation; turning the wheel by minus that brings it to the front,
  // so → (next card, on the right) is a negative turn — same feel as dragging left.
  let keyTarget: number | null = null;   // where a running key tween lands; rapid presses chain off it
  function rotateTo(target: number): void {
    keyTarget = target;
    gsap.to(itemsEl, {
      rotation: target, duration: reduceMotion ? 0 : 0.4, ease: 'power2.out', overwrite: true,
      onUpdate: updateFocus, onComplete() { keyTarget = null; updateFocus(); settle(true); },
    });
  }
  function stepBy(delta: number): void {
    const now = (gsap.getProperty(itemsEl, 'rotation') as number) || 0;
    rotateTo((keyTarget ?? Math.round(now / degree) * degree) + delta);
  }
  function rotateToIndex(i: number): void {
    const now = keyTarget ?? ((gsap.getProperty(itemsEl, 'rotation') as number) || 0);
    const own = (gsap.getProperty(images[i], 'rotation') as number) || 0;
    const delta = ((((-own - now) % 360) + 540) % 360) - 180;   // shortest way round
    rotateTo(now + delta);
  }
  wheel.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') stepBy(-degree);
    else if (e.key === 'ArrowLeft') stepBy(degree);
    else if (e.key === 'Home') rotateToIndex(0);
    else if (e.key === 'End') rotateToIndex(total - 1);
    else return;
    e.preventDefault();
  });

  // Draggable rotation with snap + focus update.
  Draggable.create(itemsEl, {
    type: 'rotation',
    inertia: false,
    onPress() { dragged = false; keyTarget = null; },
    onDragStart() { dragged = true; },
    onDrag: updateFocus,
    onDragEnd(this: Draggable) {
      // land on the nearest card — a short drag moves one step, a fling moves several
      const snapped = Math.round(this.rotation / degree) * degree;
      gsap.to(itemsEl, { rotation: snapped, onUpdate: updateFocus, onComplete() { settle(true); } });
      // clear the drag flag shortly after so genuine clicks work next time
      setTimeout(() => { dragged = false; }, 0);
    },
  });

  let ready = false, pending = -1;   // set once the entrance has assembled the wheel

  // Scroll-trigger: play the entrance once when section enters view.
  let played = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !played) {
        played = true;
        if (reduceMotion) { tl.progress(1); assembled(); }
        else { tl.play(); tl.eventCallback('onComplete', assembled); }
      }
    });
  }, { threshold: 0.35 });
  io.observe(wheel);

  // Summoning: deep links (#card=reaper), hash edits, and the séance's `summon`.
  function assembled(): void {
    ready = true;
    updateFocus();
    if (pending >= 0) { rotateToIndex(pending); pending = -1; }
  }
  function summon(i: number): void {
    if (opts.scrollTo) opts.scrollTo(wheel!);
    else wheel!.scrollIntoView?.({ block: 'center' });
    if (ready) rotateToIndex(i); else pending = i;
  }
  summonByName = name => {
    const i = CARDS.findIndex(c => c.name === name.trim().toLowerCase());
    if (i < 0) return false;
    summon(i);
    return true;
  };
  const linked = cardFromHash();
  if (linked >= 0) summon(linked);
  window.addEventListener('hashchange', () => { const i = cardFromHash(); if (i >= 0) summon(i); });
}
