import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import './styles.css';

import { bus, load, state } from './core/store';
import { CLASSES } from './agents/classes';
import { assignTask, runPipeline, scheduler } from './app';
import { mountShell } from './ui/shell';
import type Phaser from 'phaser';

let game: Phaser.Game | null = null;
let stationMod: typeof import('./game') | null = null;

async function boot() {
  await load();
  const root = document.getElementById('app')!;
  const shell = mountShell(root, {
    onZoom: (d) => game && stationMod?.station(game)?.zoomBy(d),
    onFocus: (id) => game && stationMod?.station(game)?.focus(id),
  });

  // The world (Phaser) is the heavy part: load it after the HUD is up.
  stationMod = await import('./game');
  game = stationMod.createGame(shell.world);
  bus.once('world:ready', () => {
    const b = document.getElementById('boot');
    b?.classList.add('gone');
    setTimeout(() => b?.remove(), 500);
  });

  startAutopilot();
  // handy for debugging and for the Playwright screenshot script
  (window as any).__starnet = { bus, state, assignTask, runPipeline, scheduler, game };
}

/** Demo mode: idle crew pick up sample tasks so the station feels alive. */
function startAutopilot() {
  let first = true;
  const tick = () => {
    const s = state.settings;
    if (s.mode === 'demo' && s.autopilot && !document.hidden) {
      const working = state.agents.filter((a) => a.status === 'WORKING').length;
      const idle = state.agents.filter((a) => a.status === 'IDLE' && !scheduler.isBusy(a.id));
      const want = first ? 3 : 1;
      for (let i = 0; i < want && working + i < 4 && idle.length; i++) {
        const a = idle.splice((Math.random() * idle.length) | 0, 1)[0];
        assignTask(a.id, CLASSES[a.cls].samplePrompt);
      }
      first = false;
    }
    setTimeout(tick, 9000 + Math.random() * 7000);
  };
  setTimeout(tick, 2500);
}

boot().catch((err) => {
  console.error(err);
  const b = document.getElementById('boot');
  if (b) b.querySelector('.boot-sub')!.textContent = 'BOOT FAILED. RELOAD TO RETRY.';
});
