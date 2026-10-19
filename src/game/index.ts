// Phaser bootstrap: a starfield scene underneath the station scene.

import Phaser from 'phaser';
import { StationScene } from './world';
import { buildStarCanvas } from './atlas';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

class StarsScene extends Phaser.Scene {
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private drift = 0;

  constructor() {
    super('stars');
  }

  create() {
    this.textures.addCanvas('starsFar', buildStarCanvas(256, 140, 7, false));
    this.textures.addCanvas('starsNear', buildStarCanvas(256, 46, 99, true));
    const { width, height } = this.scale;
    this.far = this.add.tileSprite(0, 0, width, height, 'starsFar').setOrigin(0, 0);
    this.near = this.add.tileSprite(0, 0, width, height, 'starsNear').setOrigin(0, 0);
    this.far.setTileScale(2, 2);
    this.near.setTileScale(2, 2);
    this.scale.on('resize', (s: Phaser.Structs.Size) => {
      this.far.setSize(s.width, s.height);
      this.near.setSize(s.width, s.height);
    });
  }

  update(_t: number, dms: number) {
    if (!REDUCED) this.drift += dms / 1000;
    const st = this.scene.get('station') as StationScene;
    const cam = st?.cameras?.main;
    const sx = cam ? cam.scrollX : 0;
    const sy = cam ? cam.scrollY : 0;
    this.far.tilePositionX = sx * 0.08 + this.drift * 1.5;
    this.far.tilePositionY = sy * 0.08;
    this.near.tilePositionX = sx * 0.2 + this.drift * 4;
    this.near.tilePositionY = sy * 0.2;
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#05070f',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    fps: { target: 60, smoothStep: true },
    input: { activePointers: 3 },
    disableContextMenu: true,
    banner: false,
    scene: [StarsScene, StationScene],
  });
  // Pause rendering while hidden; streams keep running because they live outside Phaser.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.loop.sleep();
    else game.loop.wake();
  });
  return game;
}

export function station(game: Phaser.Game): StationScene | null {
  const s = game.scene.getScene('station') as StationScene | null;
  return s && s.sys.isActive() ? s : null;
}
