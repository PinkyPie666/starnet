// The station scene: map, props, crew, camera controls and the "director"
// that turns agent state changes into walking, sitting, typing and delivering.

import Phaser from 'phaser';
import type { Agent, Task } from '../core/types';
import { bus, getAgent, state } from '../core/store';
import { CLASSES } from '../agents/classes';
import { AtlasBuilder, FONT_CELL_H, FONT_CELL_W, FONT_CHARS, FONT_PER_ROW, buildFontCanvas, paintProps } from './atlas';
import { Cell, MAP_H, MAP_W, ROOMS, TILE, buildMap, idx, walkable, type Spot, type StationMap } from './map';
import { findPath, nearestPassable, type Pt } from './astar';
import { Crew } from './crew';
import { P, hex } from './palette';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface DeskView {
  screen: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  chair: Phaser.GameObjects.Image;
  owner: string | null;
  mode: 'idle' | 'work' | 'ok' | 'err';
}

export class StationScene extends Phaser.Scene {
  atlas!: AtlasBuilder;
  private atlasTex!: Phaser.Textures.CanvasTexture;
  private baseA!: ImageData;
  private baseB!: ImageData;
  map!: StationMap;
  crew = new Map<string, Crew>();
  private desks: DeskView[] = [];
  private stations: { screen: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; owner: string | null }[] = [];
  private conveyor: Phaser.GameObjects.Image[] = [];
  private racks: Phaser.GameObjects.Image[] = [];
  private consoleScreens: Phaser.GameObjects.Image[] = [];
  private fish: { s: Phaser.GameObjects.Image; t: number; speed: number; y: number }[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private time0 = 0;
  private selected: string | null = null;
  private dragging = false;
  private dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  private pinchDist = 0;
  private pinchZoom = 2;
  private unsub: (() => void)[] = [];
  private pendingDone = new Map<string, Task>();
  private occupiedSpots = new Map<Spot, string>();

  constructor() {
    super({ key: 'station', active: true });
  }

  preload() {
    this.load.image('labTiles', 'assets/lab-tileset.png');
    this.load.image('crewA', 'assets/crew-base-a.png');
    this.load.image('crewB', 'assets/crew-base-b.png');
  }

  create() {
    this.buildAtlas();
    this.map = buildMap();
    this.drawStatic();
    this.placeProps();
    this.setupCamera();
    this.sparks = this.add.particles(0, 0, 'atlas', {
      frame: 'px',
      lifespan: 700,
      speed: { min: 20, max: 70 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [hex(P.glow), hex(P.amber3), hex(P.white)],
      emitting: false,
    });
    this.sparks.setDepth(100000);

    for (const a of state.agents) this.addCrew(a, false);

    this.unsub.push(
      bus.on('agent:add', (a) => this.addCrew(a, true)),
      bus.on('agent:remove', ({ id }) => this.removeCrew(id)),
      bus.on('agent:update', (a) => this.onAgent(a)),
      bus.on('task:done', (t) => this.pendingDone.set(t.agentId, t)),
      bus.on('ui:select', ({ agentId }) => this.select(agentId, true)),
    );
    this.events.once('shutdown', () => this.unsub.forEach((u) => u()));
    this.scale.on('resize', () => this.clampCamera());
    bus.emit('world:ready', undefined);
  }

  // ---------------------------------------------------------------- art ----

  private buildAtlas() {
    this.atlas = new AtlasBuilder();
    const tiles = this.textures.get('labTiles').getSourceImage() as HTMLImageElement;
    this.atlas.addTileset(tiles, 240, 176);
    paintProps(this.atlas);
    this.baseA = imageData(this.textures.get('crewA').getSourceImage() as HTMLImageElement);
    this.baseB = imageData(this.textures.get('crewB').getSourceImage() as HTMLImageElement);
    this.atlasTex = this.textures.addCanvas('atlas', this.atlas.canvas)!;
    this.syncFrames();
    // bitmap font
    const font = buildFontCanvas();
    this.textures.addCanvas('pixFont', font);
    const cfg = {
      image: 'pixFont',
      width: FONT_CELL_W,
      height: FONT_CELL_H,
      chars: FONT_CHARS,
      charsPerRow: FONT_PER_ROW,
      spacing: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      lineSpacing: 1,
    };
    this.cache.bitmapFont.add('pix', Phaser.GameObjects.RetroFont.Parse(this, cfg as any));
  }

  private syncFrames() {
    for (const [name, f] of Object.entries(this.atlas.frames)) {
      if (!this.atlasTex.has(name)) this.atlasTex.add(name, 0, f.x, f.y, f.w, f.h);
    }
  }

  crewFrameKey(a: Agent): string {
    const key = `crew-${a.id}`;
    const base = a.look.body === 'b' ? this.baseB : this.baseA;
    this.atlas.addCrew(key, base, a.look, CLASSES[a.cls].color);
    this.syncFrames();
    this.atlasTex.refresh();
    return key;
  }

  private drawStatic() {
    const m = this.map;
    const canvas = document.createElement('canvas');
    canvas.width = MAP_W * TILE;
    canvas.height = MAP_H * TILE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const src = this.atlas.canvas;
    const tile = (n: number | string, tx: number, ty: number) => {
      const f = this.atlas.frames[typeof n === 'number' ? `t${n}` : n];
      ctx.drawImage(src, f.x, f.y, f.w, f.h, tx * TILE, ty * TILE, f.w, f.h);
    };
    const cell = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? Cell.Void : m.cells[idx(x, y)]);
    const isWall = (x: number, y: number) => cell(x, y) === Cell.Wall;
    const decorAt = new Map<string, number>();
    for (const d of m.decor)
      for (let r = 0; r < 2; r++) for (let c = 0; c < d.w; c++) decorAt.set(`${d.x + c},${d.y + r}`, d.tiles[r][c]);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const c = cell(x, y);
        if (c === Cell.Floor) {
          const inCarpet = x >= m.carpet.x && y >= m.carpet.y && x < m.carpet.x + m.carpet.w && y < m.carpet.y + m.carpet.h;
          if (inCarpet) tile(y === m.carpet.y ? 'carpetEdge' : 'carpet0', x, y);
          else {
            const room = ROOMS.find((r) => x >= r.rect.x && y >= r.rect.y && x < r.rect.x + r.rect.w && y < r.rect.y + r.rect.h);
            const h = (x * 7 + y * 13) % 11;
            let t = h === 0 ? 139 : h === 1 ? 140 : 137;
            if (room?.id === 'factory' && y === m.conveyor.y + 1) t = 122 + (x % 3);
            else if (room?.id === 'factory' && (y === 13 || y === 14) && x >= 36 && x <= 39) t = 108 + ((x - 36) % 4);
            else if (room?.id === 'ops' && x >= 39 && x <= 43 && y >= 23 && y <= 27) t = 137;
            else if (!room) t = y % 2 ? 123 : 124; // doorway hazard stripes
            tile(t, x, y);
          }
        } else if (c === Cell.Wall) {
          const below = cell(x, y + 1);
          const below2 = cell(x, y + 2);
          const d = decorAt.get(`${x},${y}`);
          if (d !== undefined && (below === Cell.Floor || (below === Cell.Wall && below2 === Cell.Floor))) tile(d, x, y);
          else if (below === Cell.Floor) tile(x % 2 ? 34 : 33, x, y);
          else if (below === Cell.Wall && below2 === Cell.Floor) tile(x % 2 ? 19 : 18, x, y);
          else if (below === Cell.Void) tile(x % 2 ? 132 : 131, x, y);
          else if (below === Cell.Wall && below2 === Cell.Void) tile(x % 2 ? 117 : 116, x, y);
          else {
            const up = !isWall(x, y - 1);
            const left = !isWall(x - 1, y);
            const right = !isWall(x + 1, y);
            let t = (x + y) % 2 ? 57 : 56;
            if (up && left) t = 25;
            else if (up && right) t = 28;
            else if (up) t = x % 2 ? 27 : 26;
            else if (left) t = y % 2 ? 70 : 55;
            else if (right) t = y % 2 ? 73 : 58;
            tile(t, x, y);
          }
        }
      }
    }
    this.textures.addCanvas('mapStatic', canvas);
    this.add.image(0, 0, 'mapStatic').setOrigin(0, 0).setDepth(-10);

    // room name plates on the wall faces
    for (const r of ROOMS) {
      const px = r.rect.x * TILE + 4;
      const py = (r.rect.y - 2) * TILE + 3;
      const t = this.add.bitmapText(px + 3, py + 2, 'pix', r.name, 7).setLetterSpacing(-1).setDepth(-5).setTint(hex(P.amber3));
      const g = this.add.graphics().setDepth(-6);
      g.fillStyle(0x000000, 1).fillRect(px, py, t.width + 6, 11);
      g.fillStyle(hex(P.ink), 1).fillRect(px + 1, py + 1, t.width + 4, 9);
    }
  }

  private placeProps() {
    const m = this.map;
    for (const p of m.props) {
      const img = this.add.image(p.x, p.y, 'atlas', p.frame).setOrigin(0, 1);
      img.setDepth(p.depthY ?? p.y);
      if (p.id === 'rack') {
        this.racks.push(this.add.image(p.x, p.y, 'atlas', 'rackL0').setOrigin(0, 1).setDepth(img.depth + 0.1));
      }
      if (p.id === 'tank') this.addFish(p.x, p.y - 32);
      if (p.id === 'console') {
        for (const dx of [2, 18]) {
          this.consoleScreens.push(this.add.image(p.x + dx, p.y - 20, 'atlas', 'scr0').setOrigin(0, 0).setDepth(img.depth + 0.1));
        }
      }
      if (p.id === 'outbox') {
        this.add.bitmapText(p.x + 8, p.y - 31, 'pix', 'OUT', 7).setLetterSpacing(-1).setDepth(img.depth + 0.1).setTint(hex(P.amber3));
      }
    }
    // desks
    m.desks.forEach((d) => {
      const x = d.x * TILE;
      const bottom = (d.y + 1) * TILE + 4;
      this.add.image(x, bottom, 'atlas', 'desk').setOrigin(0, 1).setDepth(d.y * TILE + 8);
      const screen = this.add.image(x + 10, bottom - 22, 'atlas', 'scr_idle').setOrigin(0, 0).setDepth(d.y * TILE + 8.1);
      const glow = this.add
        .image(x + 16, bottom - 19, 'atlas', 'glow')
        .setDepth(d.y * TILE + 8.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(hex(P.glow))
        .setAlpha(0)
        .setScale(1.2, 0.8);
      const chair = this.add.image(x + 16, (d.y + 2) * TILE + 1, 'atlas', 'chair').setOrigin(0.5, 1);
      chair.setDepth((d.y + 2) * TILE + 6);
      this.desks.push({ screen, glow, chair, owner: null, mode: 'idle' });
    });
    // factory stations
    for (const s of m.stations) {
      const x = s.x * TILE;
      const top = s.y * TILE;
      const screen = this.add.image(x + 10, top + 12, 'atlas', 'scr_idle').setOrigin(0, 0).setDepth((s.y + 2) * TILE + 0.1);
      const glow = this.add
        .image(x + 16, top + 15, 'atlas', 'glow')
        .setDepth((s.y + 2) * TILE + 0.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(hex(P.amber3))
        .setAlpha(0);
      this.stations.push({ screen, glow, owner: null });
    }
    // conveyor
    for (let x = m.conveyor.x0; x <= m.conveyor.x1; x++) {
      this.conveyor.push(this.add.image(x * TILE, m.conveyor.y * TILE, 'atlas', 'conv0').setOrigin(0, 0).setDepth(m.conveyor.y * TILE));
    }
    // summon pad glow
    const padGlow = this.add
      .image(m.pad.x, m.pad.y, 'atlas', 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(hex(P.glow))
      .setScale(1.6, 0.8)
      .setAlpha(0.35)
      .setDepth(1);
    if (!REDUCED) this.tweens.add({ targets: padGlow, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const sign = this.add.bitmapText(m.pad.x, m.pad.y + 22, 'pix', 'RECRUIT BAY', 7).setOrigin(0.5, 0).setLetterSpacing(-1).setTint(hex(P.glow)).setDepth(2);
    const sg = this.add.graphics().setDepth(1.5);
    sg.fillStyle(0x000000, 0.85).fillRect(Math.round(sign.x - sign.width / 2 - 3), sign.y - 2, Math.round(sign.width) + 6, 11);
    sg.lineStyle(1, hex(P.teal2), 1).strokeRect(Math.round(sign.x - sign.width / 2 - 3) + 0.5, sign.y - 1.5, Math.round(sign.width) + 5, 10);
  }

  private addFish(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const s = this.add.image(x + 8 + i * 6, y + 8 + i * 3, 'atlas', i % 2 ? 'fishB' : 'fishA').setDepth(21 * TILE + 0.5);
      this.fish.push({ s, t: i * 2.1, speed: 0.5 + i * 0.17, y: y + 7 + i * 3 });
    }
    this.fishBox = { x: x + 3, w: 25 };
  }
  private fishBox = { x: 0, w: 0 };

  // -------------------------------------------------------------- camera ---

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    const mobile = this.scale.width < 700;
    cam.setZoom(mobile ? 2 : this.scale.width > 1500 ? 3 : 2);
    this.pinchZoom = cam.zoom;
    cam.centerOn(mobile ? 14 * TILE : 26 * TILE, mobile ? 10 * TILE : 15 * TILE);
    this.clampCamera();
    this.input.addPointer(1);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = false;
      this.dragStart = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDist === 0) {
          this.pinchDist = d;
          this.pinchZoom = cam.zoom;
        } else {
          cam.setZoom(Phaser.Math.Clamp((this.pinchZoom * d) / this.pinchDist, 1, 6));
          this.clampCamera();
        }
        this.dragging = true;
        return;
      }
      if (!p.isDown) return;
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (!this.dragging && Math.hypot(dx, dy) > 5) this.dragging = true;
      if (this.dragging) {
        cam.scrollX = this.dragStart.sx - dx / cam.zoom;
        cam.scrollY = this.dragStart.sy - dy / cam.zoom;
        this.clampCamera();
      }
    });
    this.input.on('pointerup', () => {
      if (this.pinchDist) {
        this.pinchDist = 0;
        this.zoomTo(Math.round(cam.zoom));
      }
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomTo(Phaser.Math.Clamp(Math.round(cam.zoom) + (dy > 0 ? -1 : 1), 1, 6));
    });
    this.input.on('gameobjectup', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      if (this.dragging) return;
      for (const [id, c] of this.crew) if (c.sprite === obj) bus.emit('ui:select', { agentId: id });
    });
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!this.dragging && over.length === 0 && this.selected) bus.emit('ui:select', { agentId: null });
    });
  }

  zoomTo(z: number) {
    const cam = this.cameras.main;
    if (REDUCED) {
      cam.setZoom(z);
      this.clampCamera();
      return;
    }
    this.tweens.add({ targets: cam, zoom: z, duration: 180, ease: 'Sine.easeOut', onUpdate: () => this.clampCamera() });
  }

  zoomBy(d: number) {
    this.zoomTo(Phaser.Math.Clamp(Math.round(this.cameras.main.zoom) + d, 1, 6));
  }

  private clampCamera() {
    const cam = this.cameras.main;
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const pad = 48;
    const minX = vw > W ? (W - vw) / 2 : -pad;
    const maxX = vw > W ? (W - vw) / 2 : W - vw + pad;
    const minY = vh > H ? (H - vh) / 2 : -pad;
    const maxY = vh > H ? (H - vh) / 2 : H - vh + pad;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, minX - (cam.width - vw) / 2, maxX - (cam.width - vw) / 2);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, minY - (cam.height - vh) / 2, maxY - (cam.height - vh) / 2);
  }

  focus(agentId: string) {
    const c = this.crew.get(agentId);
    if (!c) return;
    const cam = this.cameras.main;
    if (REDUCED) cam.centerOn(c.x, c.y - 16);
    else cam.pan(c.x, c.y - 16, 450, 'Sine.easeInOut');
  }

  private select(agentId: string | null, pan: boolean) {
    if (this.selected) this.crew.get(this.selected)?.setSelected(false);
    this.selected = agentId;
    if (agentId) {
      this.crew.get(agentId)?.setSelected(true);
      if (pan) this.focus(agentId);
    }
  }

  // ---------------------------------------------------------------- crew ---

  private passable = (x: number, y: number) => walkable(this.map, x, y);

  private addCrew(a: Agent, summoned: boolean) {
    if (this.crew.has(a.id)) return;
    const key = this.crewFrameKey(a);
    const start = summoned
      ? { x: Math.floor(this.map.pad.x / TILE), y: Math.floor(this.map.pad.y / TILE) }
      : this.randomFloor(['lounge', 'work', 'ops']);
    const c = new Crew(this, a, key, start);
    this.crew.set(a.id, c);
    c.wait = Math.random() * 2;
    if (summoned) this.summonFx(c);
    if (a.status === 'WORKING') this.goWork(c);
  }

  refreshLook(a: Agent) {
    const c = this.crew.get(a.id);
    if (!c) return;
    this.crewFrameKey(a);
    c.setFrameKey(`crew-${a.id}`);
  }

  private removeCrew(id: string) {
    const c = this.crew.get(id);
    if (!c) return;
    this.releaseDesk(id);
    this.releaseSpot(id);
    this.atlas.freeCrew(`crew-${id}`);
    c.destroy();
    this.crew.delete(id);
  }

  private summonFx(c: Crew) {
    c.c.setAlpha(0);
    if (REDUCED) {
      c.c.setAlpha(1);
      return;
    }
    const beam = this.add
      .rectangle(c.x, c.y - 40, 14, 80, hex(P.glow), 0.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(c.y + 5);
    this.tweens.add({ targets: beam, scaleX: { from: 0.1, to: 1.6 }, alpha: { from: 0.9, to: 0 }, duration: 900, onComplete: () => beam.destroy() });
    this.tweens.add({ targets: c.c, alpha: 1, duration: 700, delay: 250 });
    this.sparks.explode(24, c.x, c.y - 16);
    this.cameras.main.flash(160, 46, 232, 192, false);
  }

  private onAgent(a: Agent) {
    const c = this.crew.get(a.id);
    if (!c) return;
    const prev = c.status;
    c.applyAgent(a);
    if (prev === a.status) return;
    if (a.status === 'WORKING') this.goWork(c);
    else if (a.status === 'DONE') this.goDeliver(c);
    else if (a.status === 'ERROR') this.onError(c);
    else if (a.status === 'IDLE') {
      this.setDeskMode(a.id, 'idle');
      if (c.intent === 'work' || c.intent === 'error') this.goIdle(c, 0.5);
    }
  }

  private deskFor(agentId: string): number {
    let i = this.desks.findIndex((d) => d.owner === agentId);
    if (i < 0) {
      // prefer the agent's roster index so seating is stable
      const pref = state.agents.findIndex((a) => a.id === agentId) % this.desks.length;
      i = this.desks[pref]?.owner === null ? pref : this.desks.findIndex((d) => d.owner === null);
      if (i >= 0) this.desks[i].owner = agentId;
    }
    return i;
  }

  private releaseDesk(agentId: string) {
    for (const d of this.desks) if (d.owner === agentId) d.owner = null;
    for (const s of this.stations) if (s.owner === agentId) s.owner = null;
  }

  private releaseSpot(agentId: string) {
    for (const [s, id] of this.occupiedSpots) if (id === agentId) this.occupiedSpots.delete(s);
  }

  private setDeskMode(agentId: string, mode: DeskView['mode']) {
    const d = this.desks.find((x) => x.owner === agentId);
    if (d) d.mode = mode;
    const s = this.stations.find((x) => x.owner === agentId);
    if (s) {
      s.screen.setFrame(mode === 'work' ? 'scr0' : mode === 'ok' ? 'scr_ok' : mode === 'err' ? 'scr_err' : 'scr_idle');
      s.glow.setAlpha(mode === 'work' ? 0.5 : 0);
      if (mode === 'idle') s.owner = null;
    }
  }

  private currentTask(agentId: string): Task | undefined {
    const a = getAgent(agentId);
    return a?.taskId ? state.tasks.find((t) => t.id === a.taskId) : undefined;
  }

  private goWork(c: Crew) {
    this.releaseSpot(c.agent.id);
    c.intent = 'work';
    c.setCarrying(false);
    const task = this.currentTask(c.agent.id);
    // pipeline steps run at the factory stations when one is free
    if (task?.pipelineId) {
      const si = task.step % this.stations.length;
      const st = this.stations[si];
      if (!st.owner || st.owner === c.agent.id) {
        st.owner = c.agent.id;
        const pos = this.map.stations[si];
        this.walkTo(c, { x: pos.x, y: pos.y + 2 }, () => {
          if (c.intent !== 'work') return;
          c.sitAt(8, 0, 1, 'type');
          this.setDeskMode(c.agent.id, 'work');
        });
        return;
      }
    }
    const di = this.deskFor(c.agent.id);
    if (di < 0) return;
    const desk = this.map.desks[di];
    this.walkTo(c, { x: desk.x, y: desk.y + 1 }, () => {
      if (c.intent !== 'work') return;
      c.sitAt(8, 1, 1, 'type');
      this.setDeskMode(c.agent.id, 'work');
    });
  }

  private goDeliver(c: Crew) {
    const task = this.pendingDone.get(c.agent.id);
    this.pendingDone.delete(c.agent.id);
    this.setDeskMode(c.agent.id, 'ok');
    this.sparks.explode(REDUCED ? 0 : 10, c.x, c.y - 30);
    const pipeline = task?.pipelineId ? state.pipelines.find((p) => p.id === task.pipelineId) : undefined;
    const intermediate = !!pipeline && task!.step < pipeline.steps.length - 1;
    c.intent = 'deliver';
    c.setCarrying(true);
    c.pose = 'cheer';
    this.time.delayedCall(REDUCED ? 0 : 450, () => {
      if (c.intent !== 'deliver') return;
      if (intermediate) {
        // drop the crate on the conveyor, it rides to the next station
        const si = task!.step % this.stations.length;
        const from = this.map.stations[si];
        this.walkTo(c, { x: from.x + 1, y: this.map.conveyor.y - 1 }, () => {
          c.facing = 0;
          c.setCarrying(false);
          this.sendCrate(from.x + 1, this.map.stations[(si + 1) % this.stations.length].x + 1);
          this.goIdle(c, 1);
        });
      } else {
        const ob = this.map.outbox;
        this.walkTo(c, { x: ob.x + (Math.random() < 0.5 ? 0 : 1), y: ob.y + 2 }, () => {
          c.facing = 1;
          c.setCarrying(false);
          this.deliverFx();
          const res = state.results.filter((r) => r.agentId === c.agent.id).pop();
          bus.emit('world:delivered', { agentId: c.agent.id, resultId: res?.id ?? '' });
          this.goIdle(c, 1.5);
        });
      }
    });
  }

  private sendCrate(fromTileX: number, toTileX: number) {
    const y = this.map.conveyor.y * TILE + 11;
    const crate = this.add.image(fromTileX * TILE, y, 'atlas', 'crate').setOrigin(0.5, 1).setDepth(this.map.conveyor.y * TILE + 1);
    const dist = Math.abs(toTileX - fromTileX) * TILE;
    this.tweens.add({
      targets: crate,
      x: toTileX * TILE,
      duration: REDUCED ? 10 : (dist / 24) * 1000,
      onComplete: () => {
        this.sparks.explode(REDUCED ? 0 : 8, crate.x, crate.y - 4);
        crate.destroy();
      },
    });
  }

  private deliverFx() {
    const ob = this.map.outbox;
    this.sparks.explode(REDUCED ? 0 : 14, ob.x * TILE + 16, ob.y * TILE + 16);
  }

  private onError(c: Crew) {
    c.intent = 'error';
    this.setDeskMode(c.agent.id, 'err');
    c.stop();
    c.pose = 'stand';
  }

  private goIdle(c: Crew, delay: number) {
    c.intent = 'idle';
    c.wait = delay;
    if (c.pose === 'type' || c.pose === 'sit' || c.pose === 'cheer' || c.pose === 'sitFront') {
      c.leaveSeat();
      c.pose = 'stand';
    }
  }

  private idleDecide(c: Crew) {
    this.releaseSpot(c.agent.id);
    const r = Math.random();
    const free = this.map.spots.filter((s) => !this.occupiedSpots.has(s));
    if (r < 0.6 && free.length) {
      const s = free[(Math.random() * free.length) | 0];
      this.occupiedSpots.set(s, c.agent.id);
      this.walkTo(c, s, () => {
        if (c.intent !== 'idle') return;
        c.sitAt(s.dx ?? 0, s.dy ?? 0, s.face, s.kind === 'sofa' ? 'sitFront' : 'stand');
        c.wait = 4 + Math.random() * 8;
      });
      c.wait = 999;
    } else {
      const t = this.randomFloor(['lounge', 'ops', 'work', 'factory']);
      this.walkTo(c, t, () => {
        if (c.intent === 'idle') c.wait = 1.5 + Math.random() * 4;
      });
      c.wait = 999;
    }
  }

  private walkTo(c: Crew, target: Pt, onArrive: () => void) {
    c.leaveSeat();
    const goal = nearestPassable(MAP_W, MAP_H, this.passable, target) ?? target;
    const from = this.passable(c.tile.x, c.tile.y) ? c.tile : nearestPassable(MAP_W, MAP_H, this.passable, c.tile) ?? c.tile;
    const path = findPath(MAP_W, MAP_H, this.passable, from, goal);
    if (!path) {
      // unreachable: teleport-free fallback, just act in place
      onArrive();
      return;
    }
    if (from !== c.tile) path.unshift(from);
    c.walk(path, onArrive);
  }

  private randomFloor(rooms: string[]): Pt {
    for (let i = 0; i < 50; i++) {
      const r = ROOMS.filter((x) => rooms.includes(x.id))[(Math.random() * rooms.length) | 0] ?? ROOMS[0];
      const x = r.rect.x + ((Math.random() * r.rect.w) | 0);
      const y = r.rect.y + ((Math.random() * r.rect.h) | 0);
      if (this.passable(x, y)) return { x, y };
    }
    return { x: 13, y: 22 };
  }

  // -------------------------------------------------------------- update ---

  update(time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.time0 = time / 1000;
    for (const c of this.crew.values()) {
      c.update(dt, REDUCED);
      if (c.intent === 'idle' && c.path.length === 0) {
        c.wait -= dt;
        if (c.wait <= 0) this.idleDecide(c);
      }
    }
    // screens, glows and machines
    const frame = Math.floor(this.time0 * 6) % 4;
    for (const d of this.desks) {
      const key = d.mode === 'work' ? `scr${frame}` : d.mode === 'ok' ? 'scr_ok' : d.mode === 'err' ? 'scr_err' : 'scr_idle';
      if (d.screen.frame.name !== key) d.screen.setFrame(key);
      const target = d.mode === 'work' ? 0.35 + (REDUCED ? 0 : 0.12 * Math.sin(this.time0 * 4 + d.screen.x)) : d.mode === 'ok' ? 0.25 : 0;
      d.glow.setAlpha(target);
      d.glow.setTint(d.mode === 'ok' ? hex(P.amber3) : d.mode === 'err' ? hex(P.red) : hex(P.glow));
    }
    for (const s of this.stations) if (s.owner && s.screen.frame.name.startsWith('scr') && /scr\d/.test(s.screen.frame.name)) s.screen.setFrame(`scr${frame}`);
    const anyPipeline = this.stations.some((s) => s.owner) || state.pipelines.some((p) => p.status === 'running');
    const convFrame = REDUCED ? 0 : Math.floor(this.time0 * (anyPipeline ? 12 : 3)) % 4;
    if (this.conveyor[0]?.frame.name !== `conv${convFrame}`) for (const s of this.conveyor) s.setFrame(`conv${convFrame}`);
    this.consoleScreens.forEach((sc, i) => {
      const f = `scr${(Math.floor(this.time0 * 2) + i) % 4}`;
      if (sc.frame.name !== f) sc.setFrame(f);
    });
    const rackFrame = Math.floor(this.time0 * 2) % 2;
    for (const r of this.racks) if (r.frame.name !== `rackL${rackFrame}`) r.setFrame(`rackL${rackFrame}`);
    if (!REDUCED) {
      for (const f of this.fish) {
        f.t += dt * f.speed;
        const u = (Math.sin(f.t) + 1) / 2;
        f.s.x = Math.round(this.fishBox.x + u * (this.fishBox.w - 5));
        f.s.y = Math.round(f.y + Math.sin(f.t * 2.3) * 1.5);
        f.s.setFlipX(Math.cos(f.t) < 0);
      }
    }
  }
}

function imageData(img: HTMLImageElement): ImageData {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}
