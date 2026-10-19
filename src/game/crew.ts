// One crew member in the world: sprite, label, status, progress bar and a
// tiny movement/animation state machine. Decisions live in the director.

import Phaser from 'phaser';
import type { Agent } from '../core/types';
import { CLASSES } from '../agents/classes';
import { P, hex } from './palette';
import type { Facing, Spot } from './map';
import { TILE } from './map';
import type { Pt } from './astar';

const SPEED = 56; // px per second
const WALK_FPS = 10;

export type Pose = 'stand' | 'walk' | 'sit' | 'type' | 'cheer';

const STATUS_COLOR: Record<string, number> = {
  WORKING: hex(P.glow),
  IDLE: hex(P.steel3),
  DONE: hex(P.amber3),
  ERROR: hex(P.red),
};

export class Crew {
  readonly c: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.BitmapText;
  private barBg: Phaser.GameObjects.Image;
  private barFill: Phaser.GameObjects.Image;
  private dot: Phaser.GameObjects.Image;
  private bang: Phaser.GameObjects.Image;
  readonly crate: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;

  tile: Pt;
  facing: Facing = 0;
  pose: Pose = 'stand';
  path: Pt[] = [];
  private onArrive: (() => void) | null = null;
  private animT = 0;
  private shownProgress = 0;
  targetProgress = 0;
  status: Agent['status'] = 'IDLE';
  /** what the director is doing with this crew member */
  intent = 'idle';
  wait = 0; // seconds until the next idle decision
  spot: Spot | null = null;
  seatOffset = { x: 0, y: 0 };
  frameKey: string;
  selected = false;
  carrying = false;

  constructor(
    scene: Phaser.Scene,
    public agent: Agent,
    frameKey: string,
    tile: Pt,
  ) {
    this.frameKey = frameKey;
    this.tile = { ...tile };
    const x = tile.x * TILE + TILE / 2;
    const y = tile.y * TILE + TILE - 1;
    this.shadow = scene.add.image(0, 0, 'atlas', 'shadow').setOrigin(0.5, 0.5);
    this.ring = scene.add.image(0, 0, 'atlas', 'ring').setOrigin(0.5, 0.5).setVisible(false).setTint(hex(P.glow));
    this.sprite = scene.add.image(0, 0, 'atlas', `${frameKey}_0_0`).setOrigin(0.5, 1);
    this.crate = scene.add.image(0, -34, 'atlas', 'crate').setOrigin(0.5, 1).setVisible(false);
    this.dot = scene.add.image(0, -38, 'atlas', 'dot').setOrigin(0.5, 0.5);
    this.bang = scene.add.image(8, -40, 'atlas', 'bang').setOrigin(0.5, 1).setVisible(false);
    this.barBg = scene.add.image(0, -44, 'atlas', 'barBg').setOrigin(0.5, 0.5).setVisible(false);
    this.barFill = scene.add.image(-9, -44, 'atlas', 'barFill').setOrigin(0, 0.5).setVisible(false);
    this.label = scene.add
      .bitmapText(0, -47, 'pix', agent.name, 7)
      .setOrigin(0.5, 1)
      .setLetterSpacing(-1);
    this.c = scene.add.container(x, y, [this.shadow, this.ring, this.sprite, this.crate, this.dot, this.bang, this.barBg, this.barFill, this.label]);
    this.c.setSize(18, 34);
    this.sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.applyAgent(agent);
  }

  get x() {
    return this.c.x;
  }
  get y() {
    return this.c.y;
  }

  applyAgent(a: Agent) {
    this.agent = a;
    this.label.setText(a.name);
    this.status = a.status;
    this.targetProgress = a.status === 'WORKING' ? a.progress : a.status === 'DONE' ? 1 : 0;
    this.dot.setTint(STATUS_COLOR[a.status] ?? 0xffffff);
    this.bang.setVisible(a.status === 'ERROR');
    const working = a.status === 'WORKING';
    this.barBg.setVisible(working);
    this.barFill.setVisible(working).setTint(hex(CLASSES[a.cls].color));
  }

  setSelected(on: boolean) {
    this.selected = on;
    this.ring.setVisible(on);
  }

  setFrameKey(key: string) {
    this.frameKey = key;
    this.refreshFrame();
  }

  /** Follow a path of tiles, then call onArrive. */
  walk(path: Pt[], onArrive: (() => void) | null) {
    this.leaveSeat();
    this.path = path;
    this.onArrive = onArrive;
    if (!path.length) {
      this.pose = 'stand';
      const cb = onArrive;
      this.onArrive = null;
      cb?.();
    } else {
      this.pose = 'walk';
    }
  }

  stop() {
    this.path = [];
    this.onArrive = null;
    if (this.pose === 'walk') this.pose = 'stand';
  }

  sitAt(dx: number, dy: number, facing: Facing, pose: Pose) {
    this.seatOffset = { x: dx, y: dy };
    this.c.x = this.tile.x * TILE + TILE / 2 + dx;
    this.c.y = this.tile.y * TILE + TILE - 1 + dy;
    this.facing = facing;
    this.pose = pose;
    this.refreshFrame();
  }

  leaveSeat() {
    if (this.seatOffset.x || this.seatOffset.y) {
      this.c.x -= this.seatOffset.x;
      this.c.y -= this.seatOffset.y;
      this.seatOffset = { x: 0, y: 0 };
    }
  }

  setCarrying(on: boolean) {
    this.carrying = on;
    this.crate.setVisible(on);
  }

  update(dt: number, reduced: boolean) {
    this.animT += dt;
    if (this.path.length) {
      const next = this.path[0];
      const tx = next.x * TILE + TILE / 2;
      const ty = next.y * TILE + TILE - 1;
      const dx = tx - this.c.x;
      const dy = ty - this.c.y;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 2 : 3;
      else if (dy !== 0) this.facing = dy < 0 ? 1 : 0;
      const step = SPEED * dt;
      const dist = Math.hypot(dx, dy);
      if (dist <= step) {
        this.c.x = tx;
        this.c.y = ty;
        this.tile = next;
        this.path.shift();
        if (!this.path.length) {
          this.pose = 'stand';
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        this.c.x += (dx / dist) * step;
        this.c.y += (dy / dist) * step;
      }
    }
    this.refreshFrame(reduced);
    // interpolate the progress bar
    this.shownProgress += (this.targetProgress - this.shownProgress) * Math.min(1, dt * 6);
    if (this.barFill.visible) this.barFill.setScale(Math.max(0, Math.round(this.shownProgress * 18)), 1);
    if (!reduced && this.status === 'WORKING') this.dot.setAlpha(0.55 + 0.45 * Math.sin(this.animT * 6));
    else this.dot.setAlpha(1);
    if (this.bang.visible && !reduced) this.bang.y = -40 - (Math.floor(this.animT * 3) % 2);
    this.c.setDepth(this.c.y + (this.pose === 'sit' || this.pose === 'type' ? 2 : 0));
  }

  private refreshFrame(reduced = false) {
    let row: number = this.facing;
    let col = 0;
    if (this.pose === 'walk') {
      col = 1 + (Math.floor(this.animT * WALK_FPS) % 6);
    } else if (this.pose === 'type') {
      row = 4;
      col = reduced ? 0 : Math.floor(this.animT * 5) % 2;
    } else if (this.pose === 'cheer') {
      row = 4;
      col = 2;
    }
    this.sprite.setFrame(`${this.frameKey}_${row}_${col}`);
    // a little bob while carrying
    this.crate.y = -35 - (this.pose === 'walk' && col % 3 === 0 ? 1 : 0);
  }

  destroy() {
    this.c.destroy(true);
  }
}
