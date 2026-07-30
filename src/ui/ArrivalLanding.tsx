/**
 * ArrivalLanding — The Lantern Road
 *
 * <!--
 * THESIS: A cinematic first-run threshold that replaces a wall of zeros with
 * one authored moment of arrival. The category default (dismiss modal → face
 * empty dashboard) is refused; instead the game opens with the road itself,
 * and the road does not cut away — it delivers the player into the UI.
 * OWN-WORLD: Guild Hall Fire seen from outside — cold charred foreground,
 * warm lantern gold receding toward a firelit town. Palette: hall-black,
 * charred-timber, guild-gold, ember-wash. Cinzel display, Source Sans body.
 * STORY: Player reads "Ashes Behind You", understands they are a refugee,
 * and acts with one gesture ("Walk into town") that enters the operating UI.
 * FIRST VIEWPORT: Full-bleed Pixi canvas (road, additive lantern bloom, wet
 * road reflections, town silhouette with lit windows, drifting embers) behind
 * a centered semantic HTML overlay: title, story copy, CTA in the lower third.
 * FORM: Procedural PixiJS threshold (concept-seed key 6ec6403f, index 6).
 *
 * ONE AUTHORED MOMENT — "the walk" (overdrive pass):
 *   1. Arrival: the camera settles down the road on an exponential ease-out
 *      while the title strikes in like an inscription, the beat text follows,
 *      and the CTA lands last. Any input skips to the rest state.
 *   2. Departure: pressing the CTA accelerates the camera into the road —
 *      lanterns sweep past frame, the town's hearth blooms up to fill the
 *      screen — and a same-document View Transition morphs that bloom into
 *      the gold in the operating header. The first number the player sees is
 *      the light they walked toward. No loading seam between story and game.
 * Reduced motion resolves both to their static end state and an instant
 * navigation; nothing about the content or the destination depends on motion.
 * -->
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { dismissStory, isFirstRunArrival } from '../game/story';
import { useGameState, useGameStore } from '../hooks/useGame';
import { useNavigation } from '../hooks/useNavigation';

/** Camera settle after mount. */
const INTRO_MS = 2400;
/** Text choreography length — the point after which `is-entering` is inert. */
const REVEAL_MS = 1700;
/** Camera acceleration into the road, before the handoff. */
const WALK_MS = 950;
/** Hand off slightly before the walk ends, at peak bloom. */
const HANDOFF_MS = 860;

// ---------------------------------------------------------------------------
// Gate: Only render for absolute first-run
// ---------------------------------------------------------------------------

export function ArrivalLanding() {
  const state = useGameState();
  if (!isFirstRunArrival(state)) return null;
  return <LandingScene />;
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

function LandingScene() {
  const store = useGameStore();
  const state = useGameState();
  const navigate = useNavigation();
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const destroyedRef = useRef(false);
  const walkingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [entering, setEntering] = useState(true);
  const [walking, setWalking] = useState(false);

  const reducedMotion =
    state.settings.reducedMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  /** The state change itself — identical on every path, motion or not. */
  const commit = useCallback(() => {
    store.dispatch((s) => dismissStory(s, 'a1-arrival'));
    navigate('town');
  }, [store, navigate]);

  /**
   * Peak bloom → operating UI. The full-screen gold of `.arrival-bloom` and
   * the header's gold amount share one `view-transition-name`, so the browser
   * morphs the first into the second. The name is only attached to the header
   * inside the update callback, so the two never hold it simultaneously.
   */
  const handoff = useCallback(() => {
    const startViewTransition = (
      document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      }
    ).startViewTransition?.bind(document);

    if (!startViewTransition) {
      commit();
      return;
    }
    const transition = startViewTransition(() => {
      flushSync(commit);
      document.documentElement.classList.add('hearth-handoff');
    });
    const clear = () => document.documentElement.classList.remove('hearth-handoff');
    transition.finished.then(clear, clear);
  }, [commit]);

  const handleEnter = useCallback(() => {
    if (walkingRef.current) return;
    if (reducedMotion || !sceneRef.current) {
      commit();
      return;
    }
    walkingRef.current = true;
    sceneRef.current.startWalk();
    setWalking(true);
    window.setTimeout(handoff, HANDOFF_MS);
  }, [reducedMotion, commit, handoff]);

  // Pixi lifecycle
  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;
    destroyedRef.current = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const app = new Application();

    (async () => {
      try {
        await app.init({
          resizeTo: div,
          background: 0x0c0a07,
          antialias: false,
          resolution: dpr,
          autoDensity: true,
          preference: 'webgl',
        });
      } catch {
        setWebglFailed(true);
        return;
      }

      if (destroyedRef.current) {
        app.destroy(true);
        return;
      }

      div.appendChild(app.canvas);
      appRef.current = app;
      sceneRef.current = createScene(app, reducedMotion);
      setReady(true);

      // Pause on hidden. A reduced-motion scene renders once and stays
      // stopped, so returning to the tab must not restart its ticker.
      const onVis = () => {
        if (!appRef.current) return;
        if (document.visibilityState === 'hidden') appRef.current.ticker.stop();
        else if (!reducedMotion) appRef.current.ticker.start();
      };
      document.addEventListener('visibilitychange', onVis);
      (app as unknown as { __visCb?: () => void }).__visCb = onVis;
    })();

    return () => {
      destroyedRef.current = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      if (appRef.current) {
        const visCb = (appRef.current as unknown as { __visCb?: () => void }).__visCb;
        if (visCb) document.removeEventListener('visibilitychange', visCb);
        const canvas = appRef.current.canvas as HTMLElement | null;
        if (canvas?.parentElement) canvas.parentElement.removeChild(canvas);
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The reveal is skippable: any input jumps camera and copy to their rest
  // state. Waiting through an animation you have already read is a tax.
  useEffect(() => {
    if (reducedMotion) {
      setEntering(false);
      return;
    }
    const settle = window.setTimeout(() => setEntering(false), REVEAL_MS);
    const skip = () => {
      window.clearTimeout(settle);
      setEntering(false);
      sceneRef.current?.skipIntro();
    };
    window.addEventListener('pointerdown', skip, { once: true });
    window.addEventListener('keydown', skip, { once: true });
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [reducedMotion]);

  // Pointer parallax (only when motion allowed)
  useEffect(() => {
    if (reducedMotion || !ready) return;
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      sceneRef.current?.setParallax(nx, ny);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [ready, reducedMotion]);

  return (
    <div
      className={[
        'arrival-landing',
        reducedMotion ? 'reduced-motion' : '',
        entering && !reducedMotion ? 'is-entering' : '',
        walking ? 'is-walking' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrival-title"
      aria-describedby="arrival-text"
    >
      {/* Pixi canvas container */}
      <div
        ref={containerRef}
        className="arrival-canvas"
        aria-hidden="true"
      />

      {/* Fallback gradient when WebGL fails */}
      {webglFailed && <div className="arrival-fallback-bg" />}

      {/* Semantic overlay — always present */}
      <div className="arrival-overlay">
        <div className="arrival-content">
          <h1 id="arrival-title" className="arrival-game-title">
            Guild of Second Chances
          </h1>
          <div className="arrival-beat">
            <h2 className="arrival-beat-title">Ashes Behind You</h2>
            <p id="arrival-text" className="arrival-beat-text">
              You arrive with nothing but the road dust on your boots.
              Behind you, smoke on the horizon where home used to be.
              This small town doesn't know you. Work. Earn. Survive.
            </p>
          </div>
          <button
            className="arrival-cta"
            onClick={handleEnter}
            disabled={walking}
            autoFocus
          >
            Walk into town
          </button>
        </div>
      </div>

      {/* The hearth reaching the player — and the View Transition anchor. */}
      {walking && <div className="arrival-bloom" aria-hidden="true" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Procedural scene
// ---------------------------------------------------------------------------

interface SceneHandle {
  /** Jump the camera to its rest position. */
  skipIntro(): void;
  /** Accelerate into the road and bloom the hearth. */
  startWalk(): void;
  setParallax(nx: number, ny: number): void;
  destroy(): void;
}

interface Lantern {
  glow: Sprite;
  core: Sprite;
  reflection: Sprite;
  glowAlpha: number;
  reflectionAlpha: number;
  phase: number;
}

interface Ember {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t));

/**
 * Soft radial falloff, drawn once and reused for every light in the scene.
 * Additive sprites of this texture are what turn flat fills into bloom:
 * overlapping lights accumulate, so the road reads as lit rather than painted.
 */
function makeGlowTexture(): Texture {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // The core is warm cream, never pure white: additive stacking clips the red
  // and green channels first, and a white core leaves the hottest part of the
  // scene reading neutral — cool, even — against the orange around it.
  gradient.addColorStop(0, 'rgba(255,240,202,1)');
  gradient.addColorStop(0.1, 'rgba(255,222,150,0.82)');
  gradient.addColorStop(0.3, 'rgba(255,196,106,0.34)');
  gradient.addColorStop(0.62, 'rgba(255,146,50,0.09)');
  gradient.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/**
 * A vertical smear with soft sides: the shape a lantern makes on wet stone.
 * Fades downward (light loses the road as it recedes from the source) and
 * outward (the reflection has no hard edge on a rough surface).
 */
function makeSmearTexture(): Texture {
  const w = 48;
  const h = 160;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const vertical = ctx.createLinearGradient(0, 0, 0, h);
  vertical.addColorStop(0, 'rgba(255,255,255,0.85)');
  vertical.addColorStop(0.22, 'rgba(255,255,255,0.42)');
  vertical.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  vertical.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const horizontal = ctx.createLinearGradient(0, 0, w, 0);
  horizontal.addColorStop(0, 'rgba(255,255,255,0)');
  horizontal.addColorStop(0.5, 'rgba(255,255,255,1)');
  horizontal.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, w, h);
  return Texture.from(canvas);
}

function createScene(app: Application, reducedMotion: boolean): SceneHandle {
  const glowTexture = makeGlowTexture();
  const smearTexture = makeSmearTexture();

  /** The camera. Everything in the world scales about the vanishing point. */
  const world = new Container();
  app.stage.addChild(world);

  let lanterns: Lantern[] = [];
  let embers: Ember[] = [];
  let townGlow: Sprite | null = null;
  const townGlowAlpha = 0.72;
  let town: Graphics | null = null;
  let pivotX = 0;
  let pivotY = 0;

  let elapsed = 0;
  let introMs = 0;
  let walkMs = 0;
  let walking = false;
  let parallaxX = 0;
  let parallaxY = 0;
  let easedParallaxX = 0;
  let easedParallaxY = 0;

  function clear() {
    for (const child of [...world.children]) {
      world.removeChild(child);
      child.destroy({ children: true });
    }
    lanterns = [];
    embers = [];
    townGlow = null;
    town = null;
  }

  function build() {
    clear();

    const w = app.screen.width;
    const h = app.screen.height;
    // Landscape puts the copy in the vertical middle, so the horizon climbs to
    // keep the lit town clear of the text instead of behind it.
    const landscape = w > h;
    const horizonY = h * (landscape ? 0.3 : 0.4);
    pivotX = w * 0.5;
    pivotY = horizonY;
    world.pivot.set(pivotX, pivotY);
    world.position.set(pivotX, pivotY);

    // The town is a fixed-width silhouette, not a fraction of the viewport: a
    // village that stretches with the window stops reading as a village.
    const townW = Math.min(w * 0.52, 270);
    const townScale = Math.max(Math.min(h / 900, 1.15), 0.82);

    // Sky: warm-black ground the whole scene sits on.
    const sky = new Graphics();
    sky.rect(-w, -h, w * 3, h * 3);
    sky.fill({ color: 0x0c0a07 });
    world.addChild(sky);

    // Town hearth: the light the player is walking toward.
    townGlow = new Sprite(glowTexture);
    townGlow.anchor.set(0.5);
    townGlow.blendMode = 'add';
    townGlow.tint = 0xffb347;
    townGlow.width = townW * 2.1;
    townGlow.height = 200 * townScale;
    townGlow.position.set(w * 0.5, horizonY - 8 * townScale);
    townGlow.alpha = townGlowAlpha;
    world.addChild(townGlow);

    // Town silhouette
    town = new Graphics();
    const buildings = [
      { x: 0.04, bw: 20, bh: 46 },
      { x: 0.2, bw: 15, bh: 62 },
      { x: 0.33, bw: 24, bh: 40 },
      { x: 0.5, bw: 17, bh: 74 },
      { x: 0.63, bw: 21, bh: 50 },
      { x: 0.76, bw: 13, bh: 36 },
      { x: 0.94, bw: 18, bh: 56 },
    ].map((b) => ({
      cx: w * 0.5 - townW / 2 + townW * b.x,
      bw: b.bw * townScale,
      bh: b.bh * townScale,
    }));
    for (const b of buildings) {
      town.rect(b.cx - b.bw / 2, horizonY - b.bh, b.bw, b.bh);
      town.fill({ color: 0x120d08 });
    }
    world.addChild(town);

    // Lit windows: each one is a light leaving a building, not a painted pane.
    const windowLights = new Container();
    for (const b of buildings) {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const wx = b.cx + (Math.random() - 0.5) * b.bw * 0.5;
        const wy = horizonY - b.bh * 0.58 + i * 13 * townScale;

        const bleed = new Sprite(glowTexture);
        bleed.anchor.set(0.5);
        bleed.blendMode = 'add';
        bleed.tint = 0xffd06a;
        bleed.width = 17 * townScale;
        bleed.height = 17 * townScale;
        bleed.alpha = 0.6 + Math.random() * 0.25;
        bleed.position.set(wx, wy);
        windowLights.addChild(bleed);
      }
    }
    world.addChild(windowLights);

    // Road, narrowing to the vanishing point.
    const roadTop = horizonY + 12 * townScale;
    const roadBot = h + 10;
    const road = new Graphics();
    road.moveTo(w * 0.5 - 8, roadTop);
    road.lineTo(w * 0.5 + 8, roadTop);
    road.lineTo(w * 0.68, roadBot);
    road.lineTo(w * 0.32, roadBot);
    road.closePath();
    road.fill({ color: 0x1a150e, alpha: 0.94 });
    road.moveTo(w * 0.5 - 8, roadTop);
    road.lineTo(w * 0.32, roadBot);
    road.stroke({ color: 0x3a3324, width: 1, alpha: 0.4 });
    road.moveTo(w * 0.5 + 8, roadTop);
    road.lineTo(w * 0.68, roadBot);
    road.stroke({ color: 0x3a3324, width: 1, alpha: 0.4 });
    world.addChild(road);

    // Wet stone: the town's light laid down the middle of the road.
    const sheen = new Sprite(smearTexture);
    sheen.anchor.set(0.5, 0);
    sheen.blendMode = 'add';
    sheen.tint = 0xffb347;
    sheen.width = Math.max(w * 0.22, 90);
    sheen.height = (roadBot - roadTop) * 0.82;
    sheen.alpha = 0.2;
    sheen.position.set(w * 0.5, roadTop);
    world.addChild(sheen);

    // Lanterns: pole, bloom, hot core, and the reflection each one casts.
    const lanternLayer = new Container();
    const reflectionLayer = new Container();
    world.addChild(reflectionLayer);
    world.addChild(lanternLayer);

    // A longer road needs more posts before it reads as a road.
    const lanternCount = landscape ? 8 : 6;
    for (let i = 0; i < lanternCount; i++) {
      const t = (i + 1) / (lanternCount + 1); // 0 = far, 1 = near
      const y = roadTop + (roadBot - roadTop) * t * 0.72;
      const spread = 8 + (roadBot - roadTop) * t * 0.2;
      const side = i % 2 === 0 ? -1 : 1;
      const x = w * 0.5 + side * spread;
      const near = 0.4 + t * 1.1; // nearer lanterns are larger and brighter
      const flameY = y - (16 + t * 13) * townScale;

      const pole = new Graphics();
      pole.rect(x - 1 * near, flameY, 2 * near, y - flameY);
      pole.fill({ color: 0x3b3324 });
      lanternLayer.addChild(pole);

      const glow = new Sprite(glowTexture);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = 0xffc65a;
      glow.width = 52 * near;
      glow.height = 52 * near;
      glow.position.set(x, flameY);
      const glowAlpha = 0.62 + t * 0.32;
      glow.alpha = glowAlpha;
      lanternLayer.addChild(glow);

      const core = new Sprite(glowTexture);
      core.anchor.set(0.5);
      core.blendMode = 'add';
      core.tint = 0xfff1c4;
      core.width = 10 * near;
      core.height = 12 * near;
      core.position.set(x, flameY);
      core.alpha = 0.95;
      lanternLayer.addChild(core);

      const reflection = new Sprite(smearTexture);
      reflection.anchor.set(0.5, 0);
      reflection.blendMode = 'add';
      reflection.tint = 0xffb347;
      reflection.width = 18 * near;
      reflection.height = (36 + t * 70) * townScale;
      reflection.position.set(x, y);
      const reflectionAlpha = 0.34 + t * 0.26;
      reflection.alpha = reflectionAlpha;
      reflectionLayer.addChild(reflection);

      lanterns.push({
        glow,
        core,
        reflection,
        glowAlpha,
        reflectionAlpha,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Foreground: the cold ground the player is standing on.
    const foreground = new Graphics();
    foreground.moveTo(0, h * 0.75);
    foreground.lineTo(w * 0.28, h * 0.82);
    foreground.lineTo(0, h);
    foreground.closePath();
    foreground.fill({ color: 0x0a0806, alpha: 0.9 });
    foreground.moveTo(w, h * 0.72);
    foreground.lineTo(w * 0.72, h * 0.84);
    foreground.lineTo(w, h);
    foreground.closePath();
    foreground.fill({ color: 0x0a0806, alpha: 0.9 });
    world.addChild(foreground);

    if (!reducedMotion) {
      const emberLayer = new Container();
      world.addChild(emberLayer);
      for (let i = 0; i < 18; i++) {
        const ember = spawnEmber(emberLayer, w, h);
        ember.life = Math.random() * ember.maxLife;
        embers.push(ember);
      }
      emberLayerRef = emberLayer;
    }
  }

  let emberLayerRef: Container | null = null;

  function spawnEmber(layer: Container, w: number, h: number): Ember {
    const g = new Graphics();
    g.circle(0, 0, 1 + Math.random() * 1.5);
    g.fill({ color: 0xff9d3d, alpha: 0.6 + Math.random() * 0.4 });
    g.x = w * (0.35 + Math.random() * 0.3);
    g.y = h * (0.3 + Math.random() * 0.4);
    layer.addChild(g);
    return {
      g,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.3 + Math.random() * 0.5),
      life: 0,
      maxLife: 120 + Math.random() * 180,
    };
  }

  build();

  // Orientation changes and window resizes rebuild the scene at the new
  // proportions — a road drawn for portrait does not survive landscape.
  let lastW = app.screen.width;
  let lastH = app.screen.height;
  const onResize = () => {
    if (Math.abs(app.screen.width - lastW) < 24 && Math.abs(app.screen.height - lastH) < 24) return;
    lastW = app.screen.width;
    lastH = app.screen.height;
    build();
    if (!app.ticker.started) app.render();
  };
  app.renderer.on('resize', onResize);

  const tick = () => {
    const deltaMs = app.ticker.deltaMS;
    const frames = app.ticker.deltaTime;
    elapsed += deltaMs;
    if (introMs < INTRO_MS) introMs = Math.min(introMs + deltaMs, INTRO_MS);
    if (walking && walkMs < WALK_MS) walkMs = Math.min(walkMs + deltaMs, WALK_MS);

    // Camera: settle in on an exponential ease-out, then accelerate away.
    const settle = easeOutExpo(introMs / INTRO_MS);
    const walkT = walking ? Math.pow(walkMs / WALK_MS, 2.3) : 0;
    const scale = 1 + 0.055 * settle + 2.9 * walkT;
    world.scale.set(scale);

    easedParallaxX += (parallaxX - easedParallaxX) * Math.min(frames * 0.08, 1);
    easedParallaxY += (parallaxY - easedParallaxY) * Math.min(frames * 0.08, 1);
    world.position.set(
      pivotX + easedParallaxX * -8,
      pivotY + easedParallaxY * -5 + 7 * settle + 26 * walkT,
    );

    // Light: the hearth reaches for the player as the distance closes.
    const boost = 1 + 2.2 * walkT;
    for (const lantern of lanterns) {
      const flicker = reducedMotion
        ? 1
        : 0.9 +
          0.07 * Math.sin(elapsed * 0.006 + lantern.phase) +
          0.03 * Math.sin(elapsed * 0.017 + lantern.phase * 2.3);
      lantern.glow.alpha = Math.min(lantern.glowAlpha * flicker * boost, 1);
      lantern.core.alpha = Math.min(0.95 * flicker * boost, 1);
      lantern.reflection.alpha = Math.min(lantern.reflectionAlpha * flicker * boost, 1);
    }
    if (townGlow) {
      // Kept under 1.0: the hearth grows by spreading, not by clipping.
      townGlow.alpha = Math.min(townGlowAlpha * (1 + 0.5 * walkT), 0.95);
      townGlow.scale.set(1 + 1.9 * walkT);
    }
    if (town && !reducedMotion && Math.random() < 0.012) {
      town.alpha = 0.96 + Math.random() * 0.04;
    }

    if (reducedMotion || !emberLayerRef) return;
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life += frames;
      e.g.x += e.vx * frames;
      e.g.y += e.vy * frames;
      e.vx += (Math.random() - 0.5) * 0.02;
      const progress = e.life / e.maxLife;
      e.g.alpha = progress < 0.2 ? progress * 5 : 1 - (progress - 0.2) / 0.8;
      if (e.life >= e.maxLife) {
        emberLayerRef.removeChild(e.g);
        e.g.destroy();
        embers[i] = spawnEmber(emberLayerRef, app.screen.width, app.screen.height);
      }
    }
  };

  if (reducedMotion) {
    // Nothing moves, so nothing needs redrawing: render the rest state once
    // and stop the ticker rather than burning a frame budget on a still frame.
    introMs = INTRO_MS;
    tick();
    app.render();
    app.ticker.stop();
  } else {
    app.ticker.add(tick);
  }

  return {
    skipIntro() {
      introMs = INTRO_MS;
    },
    startWalk() {
      walking = true;
      walkMs = 0;
    },
    setParallax(nx, ny) {
      parallaxX = nx;
      parallaxY = ny;
    },
    destroy() {
      app.ticker.remove(tick);
      app.renderer.off('resize', onResize);
      clear();
    },
  };
}
