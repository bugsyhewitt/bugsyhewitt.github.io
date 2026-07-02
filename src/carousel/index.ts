import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';

gsap.registerPlugin(Draggable);

// front card full color, others greyscale. Flip to false for all-color.
const DESATURATE_SIBLINGS = true;

interface Card { name: string; repo: string; }

const CARDS: Card[] = [
  'autopsy','covenant','doppelganger','embalmer','enshroud','exhumed',
  'ferryman','graverobber','hellhound','mangle','omen','oracle',
  'ossuary','ouija','possession','reaper','seance','tombstone',
  'unearth','wraith'
].map(name => ({ name, repo: `https://github.com/bugsyhewitt/${name}` }));

export function initCarousel(): void {
  const wheel = document.getElementById('carousel');
  const itemsEl = document.getElementById('carouselItems');
  if (!wheel || !itemsEl) return;

  // build cards
  CARDS.forEach(card => {
    const item = document.createElement('div');
    item.className = 'carousel__item';
    item.innerHTML =
      `<a class="carousel__card" href="${card.repo}" target="_blank" rel="noopener" draggable="false">
         <img class="carousel__img" src="/cards/${card.name}.jpg" alt="${card.name}" draggable="false" loading="lazy" decoding="async" />
         <span class="carousel__label">${card.name}</span>
       </a>`;
    itemsEl.appendChild(item);
  });

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
      transformOrigin: 'center 200vh', // wheel pivot — must match .carousel__items transform-origin in index.html
      rotation: index > total / 2 ? -degree * (total - index) : rotationAngle,
      duration: 1,
      ease: 'power1.out',
    }, assembleAt);
  });

  // Desaturate all but the front-most card. Front = the item whose world
  // rotation is closest to 0 (pointing up at the viewer).
  function updateFocus(): void {
    if (!DESATURATE_SIBLINGS) return;
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
    images.forEach((image, i) => image.classList.toggle('is-dim', i !== best));
  }

  // Draggable rotation with snap + focus update.
  Draggable.create(itemsEl, {
    type: 'rotation',
    inertia: false,
    onPress() { dragged = false; },
    onDragStart() { dragged = true; },
    onDrag: updateFocus,
    onDragEnd(this: Draggable) {
      // land on the nearest card — a short drag moves one step, a fling moves several
      const snapped = Math.round(this.rotation / degree) * degree;
      gsap.to(itemsEl, { rotation: snapped, onUpdate: updateFocus });
      // clear the drag flag shortly after so genuine clicks work next time
      setTimeout(() => { dragged = false; }, 0);
    },
  });

  // Scroll-trigger: play the entrance once when section enters view.
  let played = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !played) {
        played = true;
        tl.play();
        tl.eventCallback('onComplete', updateFocus);
      }
    });
  }, { threshold: 0.35 });
  io.observe(wheel);
}
