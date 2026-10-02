import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { CARDS, repoUrl, title } from './cards';
import { raisedOn, isAlive } from '../raised';
import { initFoil, initTilt } from './foil';
import { makeProof } from './proof';
import { RITE, DUR } from '../fx/motion';
import { tick } from '../fx/sound';

gsap.registerPlugin(Draggable, InertiaPlugin);

// front card in full colour, the rest as newsprint proofs. Flip to false for all-colour.
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
    // where this cover would be foil-stamped (CSSOM, not a style attribute: keeps the CSP tight)
    item.querySelector<HTMLElement>('.carousel__card')!.style.setProperty('--foil-mask', `url(/cards/fx/${card.name}-foil.webp)`);
    itemsEl.appendChild(item);
  });

  const count = document.getElementById('carouselCount');
  if (count) count.textContent = `${CARDS.length} cards`;

  const images = gsap.utils.toArray<HTMLElement>('.carousel__item');
  const total = images.length;
  const degree = 360 / total;

  // Newsprint proofs for the dimmed cards: screened once each cover has loaded, in idle
  // time. Until a card has one it keeps the plain grey (CSS: .is-dim:not(.has-proof)).
  // (with a timeout: the page's animation loops keep frames busy enough that a bare
  // requestIdleCallback never fires)
  const idle = (fn: () => void): void => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 500 }); else setTimeout(fn, 1);
  };
  images.forEach(item => {
    const card = item.querySelector<HTMLElement>('.carousel__card')!;
    const img = item.querySelector<HTMLImageElement>('.carousel__img')!;
    const proofIt = (): void => idle(() => {
      const proof = makeProof(img, card.clientWidth);
      if (proof) { img.before(proof); item.classList.add('has-proof'); }
    });
    if (img.complete && img.naturalWidth) proofIt(); else img.addEventListener('load', proofIt, { once: true });
  });

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
      ease: RITE,
      duration: 1,
      delay: 0.15 * Math.floor(index / 2),
    }, 0);

    const rotationAngle = index * degree;
    tl.to(image, { scale: 1, duration: 0 }, assembleAt);
    tl.to(image, {
      transformOrigin: `center ${pivot}`, // same pivot as .carousel__items (CSS --pivot)
      rotation: index > total / 2 ? -degree * (total - index) : rotationAngle,
      duration: 1,
      ease: RITE,
    }, assembleAt);
  });

  let prevBest = -1;
  const cardOf = (i: number): HTMLElement => images[i].querySelector<HTMLElement>('.carousel__card')!;

  // Proof all but the front-most card; the one arriving comes into register (CSS). Front = the item whose world
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
    if (best !== prevBest) {
      if (prevBest >= 0) cardOf(prevBest).style.removeProperty('--lean');   // only the front card leans
      prevBest = best;
      // runs per drag frame: touch the DOM only when the front card actually changes
      images.forEach((image, i) => {
        image.classList.toggle('is-front', i === best);   // explicit: before the first pass no card is dim
        if (DESATURATE_SIBLINGS) image.classList.toggle('is-dim', i !== best);
        image.querySelector('a')!.tabIndex = i === best ? 0 : -1;   // only the front card is a tab stop
      });
      paintCaption(best);
      tick(reduceMotion ? 0 : InertiaPlugin.getVelocity(itemsEl!, 'rotation') || 0);   // opt-in: silent unless enabled
      // keyboard user sitting on a card: follow the wheel to the new front card
      const active = document.activeElement;
      if (active && active !== wheel && wheel!.contains(active)) {
        images[best].querySelector<HTMLElement>('a')!.focus({ preventScroll: true });
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
    const sep = '<span class="cc__sep"> &middot; </span>';
    caption.querySelector('.cc__meta')!.innerHTML =
      `<span class="cc__seg"><b>${pad(i + 1)}</b> / ${pad(total)} &middot; ${title(c)}</span>${sep}` +
      `<span class="cc__seg">resurrects ${c.raises}</span>` +
      (seen ? `${sep}<span class="cc__seg cc__alive${isAlive(seen) ? ' is-alive' : ''}">last seen alive ${seen}</span>` : '');
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
      rotation: target, duration: reduceMotion ? 0 : DUR.short, ease: RITE, overwrite: true,
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
  // the visitor took the wheel while the cards are still flying in: land them first,
  // or the front card is judged against a fan that's still moving
  const finishEntrance = (): void => { if (!ready && played) tl.progress(1); };
  wheel.addEventListener('keydown', (e: KeyboardEvent) => {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) finishEntrance();
    if (e.key === 'ArrowRight') stepBy(-degree);
    else if (e.key === 'ArrowLeft') stepBy(degree);
    else if (e.key === 'Home') rotateToIndex(0);
    else if (e.key === 'End') rotateToIndex(total - 1);
    else return;
    e.preventDefault();
  });

  // Weight: a flick carries on and settles exactly on a card (InertiaPlugin snap), and the
  // front card leans into the turn with the wheel's speed. Reduced motion: a plain snap.
  const notch = (v: number): number => Math.round(v / degree) * degree;
  const lean = (): void => {
    if (prevBest < 0) return;
    const v = InertiaPlugin.getVelocity(itemsEl, 'rotation') || 0;   // deg/s
    cardOf(prevBest).style.setProperty('--lean', `${Math.max(-4, Math.min(4, -v / 90)).toFixed(2)}deg`);
  };
  const moving = (): void => { updateFocus(); if (!reduceMotion) lean(); };
  if (!reduceMotion) InertiaPlugin.track(itemsEl, 'rotation');
  Draggable.create(itemsEl, {
    type: 'rotation',
    inertia: !reduceMotion,
    snap: notch,
    minDuration: 0.3,
    maxDuration: 1.4,
    onPress() { dragged = false; keyTarget = null; finishEntrance(); },
    onDragStart() { dragged = true; },
    onDrag: moving,
    onThrowUpdate: moving,
    onThrowComplete() {
      updateFocus();
      if (prevBest >= 0) cardOf(prevBest).style.removeProperty('--lean');
      settle(true);
    },
    onDragEnd(this: Draggable) {
      if (reduceMotion) {   // no throw: land on the nearest card straight away
        gsap.to(itemsEl, { rotation: notch(this.rotation), duration: 0, onUpdate: updateFocus, onComplete() { settle(true); } });
      }
      // clear the drag flag shortly after so genuine clicks work next time
      setTimeout(() => { dragged = false; }, 0);
    },
  });

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduceMotion) {
    if (fine) initFoil(wheel);
    else if (window.matchMedia('(hover: none)').matches) initTilt(wheel, document.getElementById('deckTilt') as HTMLButtonElement | null);
  }

  let ready = false, pending = -1;   // set once the entrance has assembled the wheel

  // Scroll-trigger: play the entrance once when section enters view.
  let played = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !played) {
        played = true;
        // reduced motion, or arriving for a named card: skip the fly-in and show it now
        if (reduceMotion || pending >= 0) { tl.progress(1); assembled(); }
        else { tl.play(); tl.eventCallback('onComplete', assembled); }
      }
    });
  }, { threshold: 0.35 });
  io.observe(wheel);

  // Summoning: deep links (#card=reaper), hash edits, and the séance's `summon`.
  function assembled(): void {
    if (!ready && !reduceMotion && fine && window.innerWidth >= 768) {
      // real light on the front card: desktop only, loaded once the deck is up
      import('./light')
        .then(m => m.initLight(wheel!, () => gsap.isTweening(itemsEl)))
        .catch(() => { /* no WebGL / chunk failed: the CSS foil carries on */ });
    }
    ready = true;
    updateFocus();
    if (pending >= 0) { rotateToIndex(pending); pending = -1; }
  }
  function summon(i: number): void {
    if (opts.scrollTo) opts.scrollTo(wheel!);
    else wheel!.scrollIntoView?.({ block: 'center' });
    if (ready) rotateToIndex(i);
    else { pending = i; finishEntrance(); }   // entrance under way: finish it at once
  }
  summonByName = name => {
    const i = CARDS.findIndex(c => c.name === name.trim().toLowerCase());
    if (i < 0) return false;
    summon(i);
    // the visitor asked for the deck: take focus there, or the next key typed in the
    // séance scrolls the page straight back down to the prompt
    wheel!.focus({ preventScroll: true });
    return true;
  };
  const linked = cardFromHash();
  if (linked >= 0) summon(linked);
  window.addEventListener('hashchange', () => { const i = cardFromHash(); if (i >= 0) summon(i); });
}
