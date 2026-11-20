// Leonida Legend entrypoint: hands the guide in by copying app/ and screenshots/
// from beside this file into the output directory and writing dossier.json there
// with the vendored make.fun library (vendor/makefun-frontend.ts, left unchanged).
// Run it as `MAKEFUN_OUTPUT_DIR=out node main.ts`; in the grader MAKEFUN_OUTPUT_DIR
// is unset and /output is used instead. Node standard library only, no build step.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The repository root is the folder holding this file; the output folder comes
// from the environment outside the grader, and defaults to /output in it.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output tree if it is missing. Never delete it: the grader runs
// read-only, so a destructive clean here would fail there outright.
mkdirSync(outputDir, { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });

// app/ must be present or there is nothing to hand in; fail loudly instead of
// writing a dossier for an empty guide.
if (!existsSync(join(repoRoot, 'app'))) {
  throw new Error('app/ is missing beside main.ts — nothing to hand in');
}
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse anyway —
// more than 4 screenshots, one over 256 KiB, or app/ past 993 entries / 48 MiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
// A partial write would hand the scorer a dossier that no longer matches what
// buildDossier computed, so read it back and refuse to report success unless
// the bytes on disk are exactly the ones just computed.
const written = readFileSync(join(outputDir, 'dossier.json'));
if (!written.equals(Buffer.from(dossier, 'utf8'))) {
  throw new Error('dossier.json on disk does not match the computed dossier — refusing to report success');
}
console.log(`Leonida Legend handed in: ${outputDir} (dossier.json ${dossier.length} bytes)`);
