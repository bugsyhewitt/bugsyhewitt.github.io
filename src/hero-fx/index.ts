import * as THREE from 'three';
import { GPGPU } from './GPGPU';
import { PlaneMesh } from './PlaneMesh';

export interface HeroFXOptions {
  imageSrc: string;
  scrollGate?: number;
}

export function initHeroFX(canvas: HTMLCanvasElement, opts: HeroFXOptions): void {
  const scrollGate = opts.scrollGate ?? 4;

  /* ── Guards ─────────────────────────────────────────────────── */
  if (window.innerWidth < 768) return;
  if (!window.matchMedia('(hover: hover)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const heroEl = document.getElementById('hero');
  if (!heroEl) return;

  /* ── All setup in try/catch; any failure leaves photo intact ── */
  try {
    let animId = 0;
    let killed = false;
    let revealed = false;

    const clock = new THREE.Clock();

    /* ── Preload image ──────────────────────────────────────────── */
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onerror = () => { /* canvas stays hidden; static photo shows */ };

    img.onload = () => {
      try {
        setup(img);
      } catch {
        /* WebGL setup failed — canvas stays hidden */
      }
    };

    img.src = opts.imageSrc;

    /* ── Three.js setup ─────────────────────────────────────────── */
    function canvasDims() {
      return [canvas.clientWidth || canvas.offsetWidth, canvas.clientHeight || canvas.offsetHeight] as const;
    }

    function setup(loadedImg: HTMLImageElement): void {
      let [w, h] = canvasDims();
      if (w === 0 || h === 0) {
        requestAnimationFrame(() => setup(loadedImg));
        return;
      }

      /* Renderer */
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(0xf7f7f7, 1);

      /* Scene */
      const scene = new THREE.Scene();

      /* Texture — built from already-decoded Image to avoid a second network fetch */
      const texture = new THREE.Texture(loadedImg);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.format = THREE.RGBAFormat;
      texture.needsUpdate = true;

      /* GPGPU */
      const gpgpu = new GPGPU(renderer);

      /* Plane with cover UV */
      const planeMesh = new PlaneMesh(scene, texture, loadedImg.naturalWidth, loadedImg.naturalHeight, w, h);

      /* ── Event handlers ─────────────────────────────────────── */
      /* Cache hero bounds; updated on resize to avoid per-mousemove reflow */
      let heroRect = heroEl!.getBoundingClientRect();
      const mouseUV = new THREE.Vector2();

      function onMouseMove(e: MouseEvent): void {
        mouseUV.set(
          (e.clientX - heroRect.left) / heroRect.width,
          1.0 - (e.clientY - heroRect.top) / heroRect.height
        );
        gpgpu.updateMouse(mouseUV);
      }

      function onResize(): void {
        const [nw, nh] = canvasDims();
        heroRect = heroEl!.getBoundingClientRect();
        renderer.setSize(nw, nh);
        planeMesh.onResize(nw, nh);
      }

      function kill(): void {
        if (killed) return;
        killed = true;
        cancelAnimationFrame(animId);
        heroEl!.classList.remove('gl-on');
        canvas.classList.remove('live');
        window.removeEventListener('scroll', onScroll);
        heroEl!.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
        gpgpu.dispose();
        planeMesh.dispose();
        texture.dispose();
        renderer.dispose();
        /* Release WebGL context */
        const gl = renderer.getContext();
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }

      function onScroll(): void {
        if (window.scrollY > scrollGate) kill();
      }

      /* Scroll already past gate at init (e.g. hash link) → bail immediately */
      if (window.scrollY > scrollGate) return;

      heroEl!.addEventListener('mousemove', onMouseMove);
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);

      /* ── Render loop ────────────────────────────────────────── */
      let frameCount = 0;
      function tick(): void {
        if (killed) return;

        const elapsed = clock.getElapsedTime();
        gpgpu.render(elapsed);
        planeMesh.setGridTexture(gpgpu.getTexture());
        renderer.render(scene, planeMesh.camera);

        /* Reveal after 2 real frames so the texture has uploaded to the GPU */
        frameCount++;
        if (!revealed && frameCount >= 2) {
          revealed = true;
          heroEl!.classList.add('gl-on');
          canvas.classList.add('live');
        }

        animId = requestAnimationFrame(tick);
      }

      animId = requestAnimationFrame(tick);
    }

  } catch {
    /* Outer safety net — canvas stays hidden */
  }
}
