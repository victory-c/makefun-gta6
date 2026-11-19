// Palmera Bay: Sunset Heat — make.fun gta6-01 entrypoint (Node 22, no dependencies).
// The game itself lives in game/ as static files (index.html + ES modules + vendored three.js).
// This program hands it in: game/ and screenshots/ go to the output folder, then the judge's
// dossier is written with the kit's unchanged vendor/makefun-game.ts.
//   local run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn(): void {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
  const shotsOut = join(outDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(root, 'screenshots');
  if (existsSync(shotsIn)) {
    for (const name of readdirSync(shotsIn)) {
      if (/\.(png|jpe?g)$/i.test(name)) cpSync(join(shotsIn, name), join(shotsOut, name));
    }
  }
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
