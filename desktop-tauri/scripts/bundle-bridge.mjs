/**
 * Bundle bridge + cli/lib into a single ESM for production.
 * Dev mode keeps using bridge/server.mjs with live cli/lib imports.
 */
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const outFile = path.join(root, 'src-tauri/resources/bridge/server.mjs');

fs.mkdirSync(path.dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'bridge/server-bundled.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: outFile,
  target: 'node20',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
  // Inline dynamic import() from desktop-cli / skill-md
  splitting: false,
  banner: {
    js: "import { createRequire as __skbCreateRequire } from 'module'; const require = __skbCreateRequire(import.meta.url);"
  },
  // cli/lib uses .mjs + .js; resolve from repo root
  absWorkingDir: repoRoot
});

console.log(`bridge bundled → ${outFile}`);
