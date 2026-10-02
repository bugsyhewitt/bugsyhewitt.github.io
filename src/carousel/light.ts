// Real light on the front card (desktop, full motion, WebGL2). The CSS foil fakes a
// glare; this lights the cover properly: a point light at the pointer, silver
// specular only where the cover would be foil-stamped (its mask), etched-line normals
// so the stamping glints, and a slight 2.5D parallax from the cover's depth map
// (lettering and paper sit on the focal plane, so they never move).
//
// One canvas lives inside the front card, so it inherits the wheel's rotation, the
// tilt and the clipping. It renders only when the pointer moves, hides while the wheel
// turns, and gives its GPU context back when the deck leaves the screen. Anything
// going wrong leaves the CSS foil in charge.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uCover, uDepth, uFoil;
uniform vec2 uCoverScale;   // object-fit: cover, matching the DOM image
uniform vec2 uPointer;      // pointer in card uv (y up)
uniform float uAspect;      // card width / height
uniform float uParallax;    // max shift, fraction of the card
uniform float uLight;       // 0..1
varying vec2 vUv;

const float ETCH = 230.0;   // etched lines across the card
const vec2 ETCH_DIR = vec2(0.4226, 0.9063);   // 115 degrees

void main() {
  vec2 uv = (vUv - 0.5) * uCoverScale + 0.5;
  float depth = texture2D(uDepth, uv).r - 0.5;                       // focal plane = 0
  vec2 suv = clamp(uv - (uPointer - 0.5) * depth * uParallax, 0.0, 1.0);
  vec3 col = texture2D(uCover, suv).rgb;
  float foil = texture2D(uFoil, suv).a;

  // etched foil: tilt the normal across fine diagonal grooves where stamped
  float groove = sin(dot(suv * vec2(uAspect, 1.0), ETCH_DIR) * ETCH);
  vec3 n = normalize(vec3(ETCH_DIR * groove * 0.45 * foil, 1.0));
  // point light just above the card at the pointer; orthographic viewer
  vec3 frag = vec3(suv.x * uAspect, suv.y, 0.0);
  vec3 lightPos = vec3(uPointer.x * uAspect, uPointer.y, 0.55);
  vec3 L = normalize(lightPos - frag);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, H), 0.0);
  float spec = pow(nh, 90.0) * 1.5 + pow(nh, 10.0) * 0.22;
  col += vec3(1.0, 0.985, 0.95) * spec * foil * uLight;
  gl_FragColor = vec4(col, 1.0);
}`;

const COVER_ASPECT = 848 / 1264;

interface Maps { depth: THREE.Texture; foil: THREE.Texture; }

/** `turning()` reports whether the wheel is moving (the carousel owns its tweens). */
export function initLight(wheel: HTMLElement, turning: () => boolean): void {
  let renderer: THREE.WebGLRenderer | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let card: HTMLElement | null = null;
  let cover: THREE.Texture | null = null;
  let disabled = false, held = false, raf = 0, px = 0.5, py = 0.5, ready = false;
  const released = new WeakSet<EventTarget>();   // canvases we let go of ourselves
  const maps = new Map<string, Promise<Maps>>();
  const loader = new THREE.TextureLoader();

  // a fresh canvas per context: one whose context was released can't be reused
  let canvas = document.createElement('canvas');

  const tex = (t: THREE.Texture): THREE.Texture => {
    t.colorSpace = THREE.NoColorSpace;   // raw values: byte-identical to the DOM image
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  };
  const load = (url: string): Promise<THREE.Texture> =>
    new Promise((ok, fail) => loader.load(url, t => ok(tex(t)), undefined, fail));
  const mapsFor = (name: string): Promise<Maps> => {
    let m = maps.get(name);
    if (!m) {
      m = Promise.all([load(`/cards/fx/${name}-depth.webp`), load(`/cards/fx/${name}-foil.webp`)])
        .then(([depth, foil]) => ({ depth, foil }));
      maps.set(name, m);
    }
    return m;
  };

  function boot(): boolean {
    if (renderer) return true;
    if (disabled) return false;
    canvas = document.createElement('canvas');
    canvas.className = 'carousel__light';
    canvas.setAttribute('aria-hidden', 'true');
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
    } catch {
      disabled = true;   // no WebGL2: CSS foil only
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uCover: { value: null }, uDepth: { value: null }, uFoil: { value: null },
        uCoverScale: { value: new THREE.Vector2(1, 1) }, uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uAspect: { value: 1 }, uParallax: { value: 0.06 }, uLight: { value: 0 },
      },
    });
    scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    camera = new THREE.Camera();
    // a real loss (GPU reset) ends real light for this visit; our own release doesn't
    // (the event arrives asynchronously, so it's recognised by its canvas)
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      if (!released.has(e.target!)) { disabled = true; teardown(); }
    }, { once: true });
    return true;
  }

  function hide(): void {
    canvas.classList.remove('is-lit');
    card?.classList.remove('has-light');
  }

  function teardown(): void {
    hide();
    cancelAnimationFrame(raf); raf = 0;
    cover?.dispose(); cover = null;
    maps.forEach(p => p.then(m => { m.depth.dispose(); m.foil.dispose(); }).catch(() => {}));
    maps.clear();
    material?.dispose();
    released.add(canvas);
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer = null; material = null; scene = null; camera = null;
    card = null; ready = false;
    canvas.remove();
  }

  /** Move the canvas onto the current front card and load its maps. */
  function attach(next: HTMLElement): void {
    hide();
    card = next; ready = false;
    const img = next.querySelector<HTMLImageElement>('.carousel__img');
    const name = /\/cards\/([\w-]+?)(?:-\d+)?\.jpg/.exec(img?.currentSrc || img?.src || '')?.[1];
    if (!img || !name || !boot()) return;
    next.appendChild(canvas);
    const w = next.clientWidth, h = next.clientHeight;
    renderer!.setSize(w, h, false);
    const boxAspect = w / h;
    material!.uniforms.uAspect.value = boxAspect;
    material!.uniforms.uCoverScale.value.set(
      Math.min(1, boxAspect / COVER_ASPECT), Math.min(1, COVER_ASPECT / boxAspect));
    cover?.dispose();
    cover = tex(new THREE.Texture(img));
    material!.uniforms.uCover.value = cover;
    const forCard = next;
    mapsFor(name).then(m => {
      if (card !== forCard || !material) return;
      material.uniforms.uDepth.value = m.depth;
      material.uniforms.uFoil.value = m.foil;
      ready = true;
      schedule();
    }).catch(() => { /* maps missing: stay on CSS foil for this card */ });
  }

  function frame(): void {
    raf = 0;
    if (!renderer || !material || !scene || !camera || !card || !ready) return;
    const inside = px >= 0 && px <= 1 && py >= 0 && py <= 1;
    if (!inside || held || turning()) { hide(); return; }
    material.uniforms.uPointer.value.set(px, 1 - py);
    material.uniforms.uLight.value = Math.min(1, 0.55 + Math.hypot(px - 0.5, py - 0.5) * 0.9);
    renderer.render(scene, camera);
    canvas.classList.add('is-lit');
    card.classList.add('has-light');
  }
  const schedule = (): void => { if (!raf) raf = requestAnimationFrame(frame); };

  wheel.addEventListener('pointermove', e => {
    if (disabled) return;
    const front = wheel.querySelector<HTMLElement>('.carousel__item.is-front .carousel__card');
    if (!front) return;
    if (front !== card) attach(front);
    const r = front.getBoundingClientRect();
    px = (e.clientX - r.left) / r.width;
    py = (e.clientY - r.top) / r.height;
    schedule();
  });
  wheel.addEventListener('pointerleave', hide);
  wheel.addEventListener('pointerdown', () => { held = true; hide(); });
  window.addEventListener('pointerup', () => { held = false; });

  // off screen: give the GPU context back; it's rebuilt on the next pointer move
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && renderer) teardown(); }).observe(wheel);
}
