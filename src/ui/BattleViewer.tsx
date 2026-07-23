import { useCallback, useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { BattleLogEntry, BattleOutcome } from '../game/combat';
import type { AdventurerClass } from '../game/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIGHTER_W = 28;
const FIGHTER_H = 34;
// Champions render 30% smaller than monsters to help distinguish the two sides.
const PARTY_W = Math.round(FIGHTER_W * 0.7);
const PARTY_H = Math.round(FIGHTER_H * 0.7);
const HP_BAR_H = 4;
const HP_BAR_W = 26;
const HP_TEXT_SIZE = 7;
// Cooldown bar: thinner, sits directly under the HP bar, only on party
// sprites (every champion carries exactly one active skill — see combat.ts).
const CD_BAR_H = 3;
const CD_BAR_W = HP_BAR_W;
const BAR_GAP = 2;
const BODY_MARGIN = 4;
const GAP = 14;
const LUNGE_DIST = 40;
const LUNGE_MS = 180;
const IMPACT_MS = 120;
const RECOVER_MS = 160;
const DAMAGE_FLOAT_MS = 700;
const SHAKE_INTENSITY = 4;
const PARTICLE_COUNT = 8;

const CLASS_COLORS: Record<AdventurerClass, number> = {
  warrior: 0xd4533a,
  ranger: 0x3a8c3a,
  mage: 0x3a5ccc,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zoneBgColor(tier: number): number {
  const colors = [0x1a2a1a, 0x1a222e, 0x1a1a1a, 0x221a2a, 0x0d1a2e, 0x2a1a1a];
  return colors[Math.min(tier, colors.length) - 1] ?? 0x1a1a2e;
}

function monsterColor(tier: number): number {
  const colors = [0x7cb342, 0xffb300, 0xe65100, 0x7b1fa2, 0x283593, 0xb71c1c];
  return colors[Math.min(tier, colors.length) - 1] ?? 0x888888;
}

function monsterShape(key: string): 'circle' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' {
  if (/wolf|boar|frog|leech|bear/i.test(key)) return 'circle';
  if (/bandit|kobold|guardian|raider/i.test(key)) return 'triangle';
  if (/wraith|spirit|ghost|shade/i.test(key)) return 'diamond';
  if (/spider|crawler|scarab/i.test(key)) return 'pentagon';
  return 'hexagon';
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// FighterSprite — a container with shape, name, and HP bar
// ---------------------------------------------------------------------------

interface FighterSpriteData {
  /** Champion id — set on party sprites only, used to key cooldownProgress. */
  advId?: number;
  container: Container;
  nameText: Text;
  hpText: Text;
  hpFill: Graphics;
  hpBg: Graphics;
  hpBarY: number;
  /** Cooldown bar graphics — present only on party sprites (see CD_BAR_H). */
  cdFill?: Graphics;
  cdBg?: Graphics;
  cdBarY: number;
  body: Graphics;
  flashOverlay: Graphics;
  baseX: number;
  baseY: number;
  offsetX: number;
  offsetY: number;
  alpha: number;
  scale: number;
  height: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  defeated: boolean;
}

function createFighterSprite(
  name: string,
  x: number,
  y: number,
  maxHp: number,
  isParty: boolean,
  tier: number,
  className: string,
  targetId: string,
  hasSkill: boolean,
): FighterSpriteData {
  const container = new Container();
  container.x = x;
  container.y = y;

  const w = isParty ? PARTY_W : FIGHTER_W;
  const h = isParty ? PARTY_H : FIGHTER_H;

  const body = new Graphics();
  const color = isParty ? CLASS_COLORS[className as AdventurerClass] ?? 0x888888 : monsterColor(tier);

  if (isParty) {
    body.roundRect(-w / 2, -h / 2, w, h, 8).fill({ color });
  } else {
    const shape = monsterShape(targetId);
    const cx = 0;
    const cy = 0;
    const r = Math.min(w, h) / 2 - 4;
    switch (shape) {
      case 'circle':
        body.circle(cx, cy, r).fill({ color });
        break;
      case 'triangle': {
        const h = r * 1.5;
        body.moveTo(cx, cy - h * 0.6).lineTo(cx + r, cy + h * 0.4).lineTo(cx - r, cy + h * 0.4).closePath().fill({ color });
        break;
      }
      case 'diamond':
        body.moveTo(cx, cy - r).lineTo(cx + r * 0.7, cy).lineTo(cx, cy + r).lineTo(cx - r * 0.7, cy).closePath().fill({ color });
        break;
      case 'pentagon': {
        const pts = 5;
        for (let i = 0; i < pts; i++) {
          const a = (Math.PI * 2 * i) / pts - Math.PI / 2;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (i === 0) body.moveTo(px, py);
          else body.lineTo(px, py);
        }
        body.closePath().fill({ color });
        break;
      }
      case 'hexagon': {
        const pts = 6;
        for (let i = 0; i < pts; i++) {
          const a = (Math.PI * 2 * i) / pts - Math.PI / 2;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (i === 0) body.moveTo(px, py);
          else body.lineTo(px, py);
        }
        body.closePath().fill({ color });
        break;
      }
    }
  }
  container.addChild(body);

  const flashOverlay = new Graphics();
  flashOverlay.rect(-w / 2, -h / 2, w, h).fill({ color: 0xffffff, alpha: 1 });
  flashOverlay.alpha = 0;
  container.addChild(flashOverlay);

  const nameStyle = new TextStyle({ fill: 0xffffff, fontSize: 7, fontFamily: 'monospace' });
  const nameText = new Text({ text: name, style: nameStyle });
  nameText.anchor.set(0.5, 0);
  nameText.y = h / 2 + 4;
  container.addChild(nameText);

  // The cooldown bar sits directly under the HP bar, so when present the HP
  // bar is pushed up to make room; the body margin is preserved for whichever
  // bar ends up closest to the sprite.
  const cdBarY = -h / 2 - BODY_MARGIN - CD_BAR_H;
  const hpBarY = hasSkill ? cdBarY - BAR_GAP - HP_BAR_H : -h / 2 - HP_BAR_H - BODY_MARGIN;

  const hpBg = new Graphics();
  hpBg.roundRect(-HP_BAR_W / 2, hpBarY, HP_BAR_W, HP_BAR_H, 2).fill({ color: 0x333333 });
  container.addChild(hpBg);

  const hpFill = new Graphics();
  hpFill.roundRect(-HP_BAR_W / 2, hpBarY, HP_BAR_W, HP_BAR_H, 2).fill({ color: 0x44cc44 });
  container.addChild(hpFill);

  let cdBg: Graphics | undefined;
  let cdFill: Graphics | undefined;
  if (hasSkill) {
    cdBg = new Graphics();
    cdBg.roundRect(-CD_BAR_W / 2, cdBarY, CD_BAR_W, CD_BAR_H, 1.5).fill({ color: 0x333333 });
    container.addChild(cdBg);

    cdFill = new Graphics();
    // Starts half-filled: skills enter battle at 50% cooldown (see combat.ts).
    cdFill.roundRect(-CD_BAR_W / 2, cdBarY, CD_BAR_W * 0.5, CD_BAR_H, 1.5).fill({ color: 0x4a9fe0 });
    container.addChild(cdFill);
  }

  const hpTextStyle = new TextStyle({ fill: 0xffffff, fontSize: HP_TEXT_SIZE, fontFamily: 'monospace' });
  const hpText = new Text({ text: String(maxHp), style: hpTextStyle });
  hpText.anchor.set(0.5, 1);
  hpText.y = hpBarY - 1;
  container.addChild(hpText);

  return {
    container,
    nameText,
    hpText,
    hpFill,
    hpBg,
    hpBarY,
    cdFill,
    cdBg,
    cdBarY,
    body,
    flashOverlay,
    baseX: x,
    baseY: y,
    offsetX: 0,
    offsetY: 0,
    alpha: 1,
    scale: 1,
    height: h,
    hp: maxHp,
    maxHp,
    hitFlash: 0,
    defeated: false,
  };
}

function updateHpBar(sprite: FighterSpriteData): void {
  const pct = Math.max(0, sprite.hp / sprite.maxHp);
  const w = HP_BAR_W * pct;
  const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xccaa44 : 0xcc4444;
  sprite.hpFill.clear();
  if (w > 0) {
    sprite.hpFill.roundRect(-HP_BAR_W / 2, sprite.hpBarY, w, HP_BAR_H, 2).fill({ color });
  }
  sprite.hpText.text = String(Math.max(0, Math.round(sprite.hp)));
}

/** `progress`: 0 = just cast, 1 = ready. Full bar = "the skill is ready". */
function updateCdBar(sprite: FighterSpriteData, progress: number): void {
  if (!sprite.cdFill) return;
  const pct = Math.max(0, Math.min(1, progress));
  const w = CD_BAR_W * pct;
  sprite.cdFill.clear();
  if (w > 0) {
    const color = pct >= 1 ? 0x5ad06a : 0x4a9fe0;
    sprite.cdFill.roundRect(-CD_BAR_W / 2, sprite.cdBarY, w, CD_BAR_H, 1.5).fill({ color });
  }
}

// ---------------------------------------------------------------------------
// Floating damage number
// ---------------------------------------------------------------------------

interface Floater {
  text: Text;
  startY: number;
  elapsed: number;
}

function createFloater(x: number, y: number, label: string, color = 0xffdd44, size = 16): Floater {
  const style = new TextStyle({ fill: color, fontSize: size, fontFamily: 'monospace', fontWeight: 'bold' });
  const text = new Text({ text: label, style });
  text.anchor.set(0.5, 0.5);
  text.x = x;
  text.y = y;
  return { text, startY: y, elapsed: 0 };
}

/** buff/status/dot log lines are non-lunge "casts"; basic/skill hits lunge. */
function isCast(entry: BattleLogEntry): boolean {
  return entry.kind === 'buff' || entry.kind === 'status' || entry.kind === 'dot';
}

// Floater colors: crits pop red, buffs green, statuses purple, DoT ticks orange.
const CRIT_COLOR = 0xff5a3c;
const BUFF_COLOR = 0x5ad06a;
const STATUS_COLOR = 0xb06ad0;
const DOT_COLOR = 0xe08a3a;
const SKILL_LABEL_COLOR = 0xffffff;
const CAST_MS = 360;

// ---------------------------------------------------------------------------
// Particle
// ---------------------------------------------------------------------------

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
}

function spawnParticles(color: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const g = new Graphics();
    const size = 2 + Math.random() * 3;
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
    const speed = 1.5 + Math.random() * 2.5;
    g.circle(0, 0, size).fill({ color });
    particles.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 0,
      maxLife: 400 + Math.random() * 200,
      color,
    });
  }
  return particles;
}

// ---------------------------------------------------------------------------
// Animation scene state
// ---------------------------------------------------------------------------

interface SceneState {
  partySprites: FighterSpriteData[];
  monsterSprites: FighterSpriteData[];
  floaters: Floater[];
  particles: Particle[];
  shakeX: number;
  shakeY: number;
  shakeDecay: number;
  logIndex: number;
  animPhase: 'idle' | 'lunging' | 'impact' | 'recovering' | 'waiting' | 'casting';
  phaseTimer: number;
  currentEntry: BattleLogEntry | null;
  attackerSprite: FighterSpriteData | null;
  defenderSprite: FighterSpriteData | null;
  lungeFromX: number;
  lungeToX: number;
  scene: Container;
  floatLayer: Container;
  particleLayer: Container;
  /** Guards onFinish so it fires exactly once per scene. Without this, every
   * tick after the fight resolves calls onFinish again — harmless on its own
   * since it's idempotent for *this* scene, but a stray tick from this scene's
   * ticker callback can land after the next fight's scene has already been
   * built and land on the new scene's onFinish closure instead (it always
   * points at the latest one), instantly closing a fight that hasn't played
   * yet. See BattleModal's "Continue" bug. */
  finished: boolean;
}

function buildScene(app: Application, result: BattleOutcome, tier: number, w: number, h: number): SceneState {
  const scene = new Container();
  app.stage.addChild(scene);
  const floatLayer = new Container();
  app.stage.addChild(floatLayer);
  const particleLayer = new Container();
  app.stage.addChild(particleLayer);

  const partySprites: FighterSpriteData[] = [];
  const monsterSprites: FighterSpriteData[] = [];
  const marginX = 70;
  const partyX = marginX;
  const monsterX = w - marginX;

  const partyCount = result.party.length;
  const monsterCount = result.monsters.length;
  const totalH = partyCount > 1 ? (partyCount - 1) * (PARTY_H + GAP + 20) : 0;
  const partyStartY = (h - totalH) / 2;

  result.party.forEach((p, i) => {
    // Every champion is generated with exactly one active skill (see
    // combat.ts/adventurers.ts), so party sprites always show a cooldown bar.
    const sprite = createFighterSprite(p.name, partyX, partyStartY + i * (PARTY_H + GAP + 20), p.maxHp, true, tier, p.className, '', true);
    sprite.advId = p.advId;
    partySprites.push(sprite);
    scene.addChild(sprite.container);
  });

  const totalHm = monsterCount > 1 ? (monsterCount - 1) * (FIGHTER_H + GAP + 20) : 0;
  const monsterStartY = (h - totalHm) / 2;

  result.monsters.forEach((m, i) => {
    const sprite = createFighterSprite(m.name, monsterX, monsterStartY + i * (FIGHTER_H + GAP + 20), m.maxHp, false, tier, '', m.targetId, false);
    monsterSprites.push(sprite);
    scene.addChild(sprite.container);
  });

  // Initial HP
  partySprites.forEach((s) => { s.hp = s.maxHp; updateHpBar(s); });
  monsterSprites.forEach((s) => { s.hp = s.maxHp; updateHpBar(s); });

  return {
    partySprites,
    monsterSprites,
    floaters: [],
    particles: [],
    shakeX: 0,
    shakeY: 0,
    shakeDecay: 0,
    logIndex: 0,
    animPhase: 'idle',
    phaseTimer: 0,
    currentEntry: null,
    attackerSprite: null,
    defenderSprite: null,
    lungeFromX: 0,
    lungeToX: 0,
    scene,
    floatLayer,
    particleLayer,
    finished: false,
  };
}

function clearScene(app: Application, st: SceneState): void {
  for (const s of [...st.partySprites, ...st.monsterSprites]) {
    s.container.destroy({ children: true });
  }
  for (const f of st.floaters) {
    f.text.destroy();
  }
  for (const p of st.particles) {
    p.g.destroy();
  }
  app.stage.removeChild(st.scene);
  app.stage.removeChild(st.floatLayer);
  app.stage.removeChild(st.particleLayer);
  st.scene.destroy({ children: true });
  st.floatLayer.destroy({ children: true });
  st.particleLayer.destroy({ children: true });
}

// ---------------------------------------------------------------------------
// BattleViewer — PixiJS canvas battle playback
// ---------------------------------------------------------------------------

export function BattleViewer({
  result,
  tier,
  skip: initialSkip,
  onFinish,
}: {
  result: BattleOutcome;
  tier: number;
  skip: boolean;
  onFinish: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const [ready, setReady] = useState(false);
  const skipRef = useRef(initialSkip);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const findSprite = useCallback(
    (side: 'party' | 'monsters', name: string): FighterSpriteData | undefined => {
      const st = sceneRef.current;
      if (!st) return;
      const list = side === 'party' ? st.partySprites : st.monsterSprites;
      return list.find((s) => s.nameText.text === name);
    },
    [],
  );

  // Effect 1: Create PixiJS app once on mount, destroy on unmount
  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;

    const w = div.clientWidth || 500;
    const h = div.clientHeight || 280;
    let destroyed = false;

    const app = new Application();

    (async () => {
      await app.init({
        width: w,
        height: h,
        background: zoneBgColor(tier),
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) { app.destroy(); return; }

      div.appendChild(app.canvas);
      appRef.current = app;
      setReady(true);
    })();

    return () => {
      destroyed = true;
      if (appRef.current) {
        const canvas = appRef.current.canvas as HTMLElement | null;
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // Effect 2: Rebuild scene when result changes (never destroy the app)
  useEffect(() => {
    if (!appRef.current || !ready) return;

    const div = containerRef.current;
    const w = div?.clientWidth || 500;
    const h = div?.clientHeight || 280;
    const app = appRef.current;

    // Clear old scene
    if (sceneRef.current) {
      clearScene(app, sceneRef.current);
    }

    // Reset stage position
    app.stage.x = 0;
    app.stage.y = 0;

    // Build new scene
    const st = buildScene(app, result, tier, w, h);
    sceneRef.current = st;

    // Reset skip
    skipRef.current = initialSkip;
  }, [result, tier, ready]);

  // Effect 3: Animation ticker
  useEffect(() => {
    if (!ready || !appRef.current || !sceneRef.current) return;

    const app = appRef.current;
    const ticker = app.ticker;

    let logEntryTimer = 0;
    const LOG_DELAY = 500;

    function advanceLog() {
      const st = sceneRef.current;
      if (!st) return;

      if (st.logIndex >= result.log.length) {
        if (!st.finished) {
          st.finished = true;
          onFinishRef.current();
        }
        return;
      }

      const entry = result.log[st.logIndex];
      st.currentEntry = entry;
      st.logIndex++;

      // cooldownProgress is a full snapshot of every skill-bearing party
      // member as of this entry, so refresh every party cd bar in one pass.
      if (entry.cooldownProgress) {
        for (const s of st.partySprites) {
          if (s.advId === undefined) continue;
          const progress = entry.cooldownProgress[s.advId];
          if (progress !== undefined) updateCdBar(s, progress);
        }
      }

      const attacker = findSprite(entry.attackerSide, entry.attackerName);
      const defender = findSprite(entry.defenderSide, entry.defenderName);
      if (!attacker || !defender) {
        advanceLog();
        return;
      }

      st.attackerSprite = attacker;
      st.defenderSprite = defender;

      // Buffs / statuses / DoT ticks don't lunge — flash the target in place,
      // float a label (or the DoT damage), and apply any HP change immediately.
      if (isCast(entry)) {
        defender.hitFlash = 1;
        st.shakeDecay = entry.kind === 'dot' ? 140 : 0;
        const isDot = entry.kind === 'dot';
        const color = isDot ? DOT_COLOR : entry.kind === 'buff' ? BUFF_COLOR : STATUS_COLOR;
        const label = isDot ? `-${entry.damage}` : entry.effectLabel ?? entry.skillName ?? '•';
        const floater = createFloater(
          defender.container.x,
          defender.container.y - defender.height / 2 - 10,
          label,
          color,
          isDot ? 14 : 12,
        );
        st.floaters.push(floater);
        st.floatLayer.addChild(floater.text);
        defender.hp = entry.defenderHpAfter;
        defender.maxHp = entry.defenderMaxHp;
        updateHpBar(defender);
        st.animPhase = 'casting';
        st.phaseTimer = 0;
        return;
      }

      st.lungeFromX = attacker.baseX + attacker.offsetX;
      const dir = attacker.container.x < defender.container.x ? 1 : -1;
      st.lungeToX = st.lungeFromX + dir * LUNGE_DIST;
      st.animPhase = 'lunging';
      st.phaseTimer = 0;
    }

    function processPhase(dt: number) {
      const st = sceneRef.current;
      if (!st) return;

      if (st.shakeDecay > 0) {
        st.shakeDecay = Math.max(0, st.shakeDecay - dt);
        const intensity = (st.shakeDecay / 300) * SHAKE_INTENSITY;
        st.shakeX = (Math.random() - 0.5) * intensity * 2;
        st.shakeY = (Math.random() - 0.5) * intensity * 2;
      } else {
        st.shakeX = 0;
        st.shakeY = 0;
      }

      for (let i = st.floaters.length - 1; i >= 0; i--) {
        const f = st.floaters[i];
        f.elapsed += dt;
        if (f.elapsed >= DAMAGE_FLOAT_MS) {
          st.floatLayer.removeChild(f.text);
          f.text.destroy();
          st.floaters.splice(i, 1);
        } else {
          const t = f.elapsed / DAMAGE_FLOAT_MS;
          f.text.y = f.startY - 30 * t;
          f.text.alpha = 1 - t;
        }
      }

      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          st.particleLayer.removeChild(p.g);
          p.g.destroy();
          st.particles.splice(i, 1);
        } else {
          p.g.x += p.vx;
          p.g.y += p.vy;
          p.vy += 0.05;
          p.g.alpha = 1 - p.life / p.maxLife;
        }
      }

      const breathe = Math.sin(performance.now() / 400) * 1.5;
      for (const s of st.partySprites) {
        if (!s.defeated) s.container.y = s.baseY + s.offsetY + breathe;
      }
      for (const s of st.monsterSprites) {
        if (!s.defeated) s.container.y = s.baseY + s.offsetY + breathe;
      }

      app.stage.x = st.shakeX;
      app.stage.y = st.shakeY;

      if (st.animPhase === 'idle') {
        if (skipRef.current) {
          // Find the last snapshot recorded for each champion so the cooldown
          // bar still lands in its true end-of-battle state when skipping.
          const lastCooldowns: Record<number, number> = {};
          for (const e of result.log) {
            if (!e.cooldownProgress) continue;
            Object.assign(lastCooldowns, e.cooldownProgress);
          }
          for (const s of st.partySprites) {
            const pr = result.party.find((p) => p.name === s.nameText.text);
            if (pr) {
              s.hp = pr.finalHp;
              s.defeated = pr.knockedOut;
              s.container.alpha = pr.knockedOut ? 0.3 : 1;
              updateHpBar(s);
            }
            if (s.advId !== undefined && lastCooldowns[s.advId] !== undefined) {
              updateCdBar(s, lastCooldowns[s.advId]);
            }
          }
          for (const s of st.monsterSprites) {
            const lastEntry = result.log[result.log.length - 1];
            if (lastEntry && lastEntry.defenderName === s.nameText.text) {
              s.hp = lastEntry.defenderHpAfter;
              s.defeated = lastEntry.defenderDefeated;
              s.container.alpha = lastEntry.defenderDefeated ? 0.3 : 1;
              updateHpBar(s);
            }
          }
          if (!st.finished) {
            st.finished = true;
            onFinishRef.current();
          }
          return;
        }
        logEntryTimer += dt;
        if (logEntryTimer >= LOG_DELAY && st.logIndex < result.log.length) {
          logEntryTimer = 0;
          advanceLog();
        } else if (st.logIndex >= result.log.length) {
          if (!st.finished) {
            st.finished = true;
            onFinishRef.current();
          }
        }
        return;
      }

      st.phaseTimer += dt;

      if (st.animPhase === 'casting') {
        // Non-lunge cast: hold briefly while the flash/floater plays, then, if
        // the target was a DoT that dropped it, burst it like any other death.
        if (st.defenderSprite) {
          st.defenderSprite.hitFlash = Math.max(0, 1 - st.phaseTimer / CAST_MS);
        }
        if (st.phaseTimer >= CAST_MS) {
          if (st.defenderSprite && st.currentEntry?.defenderDefeated && !st.defenderSprite.defeated) {
            st.defenderSprite.defeated = true;
            const color = st.defenderSprite.body.fill;
            const particles = spawnParticles(typeof color === 'number' ? color : 0x888888);
            for (const p of particles) {
              p.g.x = st.defenderSprite.container.x;
              p.g.y = st.defenderSprite.container.y;
              st.particles.push(p);
              st.particleLayer.addChild(p.g);
            }
          }
          st.animPhase = 'idle';
          st.phaseTimer = 0;
          st.currentEntry = null;
          st.attackerSprite = null;
          st.defenderSprite = null;
          logEntryTimer = 0;
        }
        return;
      }

      if (st.animPhase === 'lunging') {
        if (!st.attackerSprite) return;
        const t = Math.min(1, st.phaseTimer / LUNGE_MS);
        const et = easeOutCubic(t);
        st.attackerSprite.container.x = lerp(st.lungeFromX, st.lungeToX, et);
        if (t >= 1) {
          st.animPhase = 'impact';
          st.phaseTimer = 0;
          if (st.defenderSprite) {
            st.defenderSprite.hitFlash = 1;
            const entry = st.currentEntry;
            const dmg = entry?.damage ?? 0;
            const crit = !!entry?.crit;
            const floater = createFloater(
              st.defenderSprite.container.x,
              st.defenderSprite.container.y - st.defenderSprite.height / 2 - 10,
              crit ? `${dmg}!` : String(dmg),
              crit ? CRIT_COLOR : 0xffdd44,
              crit ? 22 : 16,
            );
            st.floaters.push(floater);
            st.floatLayer.addChild(floater.text);
            // Name the skill above the attacker so a cast reads clearly.
            if (entry?.skillName && st.attackerSprite) {
              const label = createFloater(
                st.attackerSprite.container.x,
                st.attackerSprite.container.y - st.attackerSprite.height / 2 - 14,
                entry.skillName,
                SKILL_LABEL_COLOR,
                10,
              );
              st.floaters.push(label);
              st.floatLayer.addChild(label.text);
            }
            st.shakeDecay = crit ? 320 : 200;
            if (entry) {
              st.defenderSprite.hp = entry.defenderHpAfter;
              updateHpBar(st.defenderSprite);
            }
          }
        }
      } else if (st.animPhase === 'impact') {
        if (!st.attackerSprite || !st.defenderSprite) return;
        const t = Math.min(1, st.phaseTimer / IMPACT_MS);
        st.defenderSprite.hitFlash = Math.max(0, 1 - t * 2);
        if (t >= 1) {
          st.animPhase = 'recovering';
          st.phaseTimer = 0;
          st.defenderSprite.hitFlash = 0;
        }
      } else if (st.animPhase === 'recovering') {
        if (!st.attackerSprite) return;
        const t = Math.min(1, st.phaseTimer / RECOVER_MS);
        const et = easeInCubic(t);
        st.attackerSprite.container.x = lerp(st.lungeToX, st.lungeFromX, et);
        if (t >= 1) {
          st.attackerSprite.container.x = st.lungeFromX;
          if (st.defenderSprite && st.currentEntry?.defenderDefeated) {
            st.defenderSprite.defeated = true;
            const color = st.defenderSprite.body.fill;
            const particles = spawnParticles(typeof color === 'number' ? color : 0x888888);
            for (const p of particles) {
              p.g.x = st.defenderSprite.container.x;
              p.g.y = st.defenderSprite.container.y;
              st.particles.push(p);
              st.particleLayer.addChild(p.g);
            }
          }
          st.animPhase = 'idle';
          st.phaseTimer = 0;
          st.currentEntry = null;
          st.attackerSprite = null;
          st.defenderSprite = null;
          logEntryTimer = 0;
        }
      }

      for (const s of [...st.partySprites, ...st.monsterSprites]) {
        s.flashOverlay.alpha = s.hitFlash > 0 ? s.hitFlash * 0.5 : 0;
      }
    }

    const fn = (tickerDt: { elapsedMS: number }) => {
      processPhase(tickerDt.elapsedMS);
    };
    ticker.add(fn);

    return () => {
      // If Effect 1's cleanup already destroyed the app (component unmounting
      // rather than just re-rendering), its ticker is destroyed too — calling
      // remove() on it throws and crashes the whole React tree. Only the app
      // itself unmounting nulls appRef.current, so this guard is safe.
      if (appRef.current === app) {
        ticker.remove(fn);
      }
    };
  }, [ready, result, findSprite]);

  // Skip handler
  useEffect(() => {
    skipRef.current = initialSkip;
    if (initialSkip && sceneRef.current) {
      sceneRef.current.animPhase = 'idle';
    }
  }, [initialSkip]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 280,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
      }}
    />
  );
}