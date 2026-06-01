# Skill Base Promo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and render a polished 16:9 Skill Base launch reel in a dedicated `promo-video/` Remotion workspace using real product screenshots, real CLI captures, the existing logo, and English copy aligned with `README.md`.

**Architecture:** Keep the promo implementation as a small isolated Remotion app. Use a single timeline data file to define scene order, copy, durations, and asset paths; implement each scene as a focused React component; keep reusable motion helpers tiny and explicit. Product assets are captured once into stable filenames and then imported by the composition.

**Tech Stack:** Remotion, React, TypeScript, Vitest, local screenshots/captures from the existing Skill Base web app and CLI

---

## File Structure

### New workspace

- `promo-video/package.json` — isolated promo workspace scripts and dependencies
- `promo-video/tsconfig.json` — TypeScript config for Remotion code
- `promo-video/remotion.config.ts` — render config
- `promo-video/src/index.ts` — Remotion entry
- `promo-video/src/Root.tsx` — composition registry
- `promo-video/src/compositions/SkillBaseLaunchReel.tsx` — top-level 16:9 reel composition
- `promo-video/src/data/timeline.ts` — scene timing, copy, and asset references
- `promo-video/src/data/timeline.test.ts` — targeted tests for duration and required assets
- `promo-video/src/theme.ts` — colors, typography, layout constants
- `promo-video/src/lib/motion.ts` — small timing helpers
- `promo-video/src/scenes/BrandIntro.tsx`
- `promo-video/src/scenes/WebProof.tsx`
- `promo-video/src/scenes/CliFlow.tsx`
- `promo-video/src/scenes/CrossAgent.tsx`
- `promo-video/src/scenes/BrandOutro.tsx`
- `promo-video/public/assets/logo.svg` — copied logo for stable render input
- `promo-video/public/captures/*.png` — real UI and terminal captures used in the reel
- `promo-video/out/skill-base-launch.mp4` — rendered output

### Existing files to inspect but not change unless needed

- `README.md`
- `web/package.json`
- `web/src/assets/logo.svg`
- `web/src/views/*.vue`
- `cli/bin/skb.js`
- `cli/package.json`

### Task 1: Scaffold the isolated Remotion workspace

**Files:**
- Create: `promo-video/package.json`
- Create: `promo-video/tsconfig.json`
- Create: `promo-video/remotion.config.ts`
- Create: `promo-video/src/index.ts`
- Create: `promo-video/src/Root.tsx`

- [ ] **Step 1: Write the failing test**

Create `promo-video/src/data/timeline.test.ts` first with the contract the later code must satisfy:

```ts
import {describe, expect, it} from 'vitest';
import {FPS, TOTAL_FRAMES, sceneTimeline} from './timeline';

describe('promo timeline contract', () => {
  it('keeps the reel at least ten seconds long', () => {
    expect(TOTAL_FRAMES / FPS).toBeGreaterThanOrEqual(10);
  });

  it('defines a non-empty ordered scene timeline', () => {
    expect(sceneTimeline.length).toBeGreaterThanOrEqual(5);
    expect(sceneTimeline[0]?.id).toBe('brand-intro');
    expect(sceneTimeline.at(-1)?.id).toBe('brand-outro');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd promo-video && pnpm test`

Expected: FAIL because `package.json`, `vitest`, and `src/data/timeline.ts` do not exist yet.

- [ ] **Step 3: Create the workspace files and install the minimal toolchain**

Create `promo-video/package.json`:

```json
{
  "name": "skill-base-promo-video",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "remotion studio src/index.ts",
    "render": "remotion render src/index.ts SkillBaseLaunchReel out/skill-base-launch.mp4",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "remotion": "^4.0.366"
  },
  "devDependencies": {
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

Create `promo-video/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals"],
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "remotion.config.ts"]
}
```

Create `promo-video/remotion.config.ts`:

```ts
import {Config} from 'remotion';

Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
```

Create `promo-video/src/index.ts`:

```ts
import {registerRoot} from 'remotion';
import {Root} from './Root';

registerRoot(Root);
```

Create `promo-video/src/Root.tsx`:

```tsx
import {Composition} from 'remotion';
import {SkillBaseLaunchReel} from './compositions/SkillBaseLaunchReel';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './data/timeline';

export const Root = () => {
  return (
    <Composition
      id="SkillBaseLaunchReel"
      component={SkillBaseLaunchReel}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
```

Install dependencies:

```bash
cd promo-video
pnpm install
```

- [ ] **Step 4: Run the test and typecheck**

Run:

```bash
cd promo-video
pnpm test
pnpm typecheck
```

Expected: `pnpm test` still fails because `timeline.ts` and the composition do not exist; `pnpm typecheck` fails for the same reason. That is correct at this stage.

### Task 2: Lock down timeline data, theme tokens, and a tiny motion helper layer

**Files:**
- Create: `promo-video/src/data/timeline.ts`
- Create: `promo-video/src/theme.ts`
- Create: `promo-video/src/lib/motion.ts`
- Modify: `promo-video/src/data/timeline.test.ts`

- [ ] **Step 1: Extend the failing test to cover asset and copy contracts**

Update `promo-video/src/data/timeline.test.ts` to this:

```ts
import {describe, expect, it} from 'vitest';
import {FPS, TOTAL_FRAMES, sceneTimeline} from './timeline';

describe('promo timeline contract', () => {
  it('keeps the reel at least ten seconds long', () => {
    expect(TOTAL_FRAMES / FPS).toBeGreaterThanOrEqual(10);
  });

  it('defines the approved scene order', () => {
    expect(sceneTimeline.map((scene) => scene.id)).toEqual([
      'brand-intro',
      'web-proof',
      'cli-flow',
      'cross-agent',
      'brand-outro',
    ]);
  });

  it('uses real asset paths for all scenes that need media', () => {
    for (const scene of sceneTimeline) {
      if ('assets' in scene) {
        expect(scene.assets.length).toBeGreaterThan(0);
        for (const asset of scene.assets) {
          expect(asset).toMatch(/^\\/((assets|captures)\\/).+/);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it still fails**

Run: `cd promo-video && pnpm test`

Expected: FAIL because `timeline.ts` is still missing.

- [ ] **Step 3: Implement the minimal timeline, theme, and helper modules**

Create `promo-video/src/data/timeline.ts`:

```ts
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const FPS = 30;

export type SceneDefinition = {
  id: 'brand-intro' | 'web-proof' | 'cli-flow' | 'cross-agent' | 'brand-outro';
  startFrame: number;
  durationInFrames: number;
  headline: string;
  subline?: string;
  assets: string[];
};

export const sceneTimeline: SceneDefinition[] = [
  {
    id: 'brand-intro',
    startFrame: 0,
    durationInFrames: 54,
    headline: 'Skill Base',
    subline: 'Stop stuffing Agent Skills into source repositories.',
    assets: ['/assets/logo.svg'],
  },
  {
    id: 'web-proof',
    startFrame: 54,
    durationInFrames: 96,
    headline: 'Browse. Search. Ship team knowledge.',
    assets: ['/captures/web-home.png', '/captures/web-detail.png'],
  },
  {
    id: 'cli-flow',
    startFrame: 150,
    durationInFrames: 90,
    headline: 'Install. Update. Publish.',
    assets: ['/captures/cli-search.png', '/captures/cli-install.png'],
  },
  {
    id: 'cross-agent',
    startFrame: 240,
    durationInFrames: 84,
    headline: 'One skill base. Multiple agents.',
    assets: ['/assets/logo.svg'],
  },
  {
    id: 'brand-outro',
    startFrame: 324,
    durationInFrames: 66,
    headline: 'Publish once. Install anywhere.',
    subline: 'Update with control.',
    assets: ['/assets/logo.svg', '/captures/web-home.png', '/captures/cli-install.png'],
  },
];

export const TOTAL_FRAMES = sceneTimeline.reduce(
  (max, scene) => Math.max(max, scene.startFrame + scene.durationInFrames),
  0,
);
```

Create `promo-video/src/theme.ts`:

```ts
export const theme = {
  colors: {
    accent: '#00FFA3',
    accentSoft: '#00E592',
    bg: '#09090b',
    panel: '#13141a',
    border: '#27272a',
    text: '#f4f4f5',
    textMuted: '#a1a1aa',
    logoGreen: '#41b883',
    logoSlate: '#34495e',
  },
  spacing: {
    outer: 72,
    panel: 28,
  },
  radius: {
    panel: 28,
    media: 24,
  },
  shadow: {
    glow: '0 0 80px rgba(0, 255, 163, 0.18)',
    panel: '0 40px 120px rgba(0, 0, 0, 0.45)',
  },
};
```

Create `promo-video/src/lib/motion.ts`:

```ts
import {Easing, interpolate, spring} from 'remotion';

export const fadeUp = (frame: number, fps: number) => {
  const progress = spring({frame, fps, durationInFrames: 18});
  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [24, 0], {
      easing: Easing.out(Easing.cubic),
    }),
  };
};

export const reveal = (frame: number, start: number, end: number) => {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
cd promo-video
pnpm test
pnpm typecheck
```

Expected: tests pass; typecheck still fails because scene and composition files are still missing.

### Task 3: Capture stable product assets from the running app and CLI

**Files:**
- Create: `promo-video/public/assets/logo.svg`
- Create: `promo-video/public/captures/web-home.png`
- Create: `promo-video/public/captures/web-detail.png`
- Create: `promo-video/public/captures/cli-search.png`
- Create: `promo-video/public/captures/cli-install.png`

- [ ] **Step 1: Copy the real logo into the promo workspace**

Run:

```bash
mkdir -p promo-video/public/assets promo-video/public/captures
cp web/src/assets/logo.svg promo-video/public/assets/logo.svg
```

Expected: `promo-video/public/assets/logo.svg` exists and matches the real app logo.

- [ ] **Step 2: Start the web app and the main server locally**

Run in separate terminals:

```bash
npm run dev
cd web && pnpm dev --host 127.0.0.1 --port 4173
```

Expected:
- the API server is reachable on its default port
- the Vite app is reachable on `http://127.0.0.1:4173`

- [ ] **Step 3: Capture web screenshots from real pages**

Use the browser tool or Playwright to capture exact files:

```text
promo-video/public/captures/web-home.png
promo-video/public/captures/web-detail.png
```

Target pages:
- landing/home page for the overall product frame
- skill detail or publish page for a denser in-product frame

Expected:
- captures are 16:9-friendly and readable when scaled down
- no browser chrome in the exported files

- [ ] **Step 4: Capture real CLI stills**

Run real commands and capture terminal stills into:

```text
promo-video/public/captures/cli-search.png
promo-video/public/captures/cli-install.png
```

Commands to display:

```bash
node cli/bin/skb.js search vue
node cli/bin/skb.js install vue-best-practices --agent universal
```

Expected:
- terminal theme is dark enough to match the video
- the command and the useful output are both visible in a single frame

### Task 4: Build focused scene components

**Files:**
- Create: `promo-video/src/scenes/BrandIntro.tsx`
- Create: `promo-video/src/scenes/WebProof.tsx`
- Create: `promo-video/src/scenes/CliFlow.tsx`
- Create: `promo-video/src/scenes/CrossAgent.tsx`
- Create: `promo-video/src/scenes/BrandOutro.tsx`

- [ ] **Step 1: Implement `BrandIntro.tsx`**

Create:

```tsx
import {AbsoluteFill, Img, interpolate, useCurrentFrame} from 'remotion';
import {fadeUp} from '../lib/motion';
import {theme} from '../theme';

export const BrandIntro = () => {
  const frame = useCurrentFrame();
  const title = fadeUp(frame, 30);
  const logoScale = interpolate(frame, [0, 24], [0.82, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg, color: theme.colors.text}}>
      <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <Img src="/assets/logo.svg" style={{width: 180, transform: `scale(${logoScale})`, filter: 'drop-shadow(0 0 40px rgba(0,255,163,0.22))'}} />
          <div style={{marginTop: 28, opacity: title.opacity, transform: `translateY(${title.translateY}px)`}}>
            <div style={{fontSize: 84, fontWeight: 700}}>Skill Base</div>
            <div style={{marginTop: 16, fontSize: 30, color: theme.colors.textMuted}}>
              Stop stuffing Agent Skills into source repositories.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Implement `WebProof.tsx`**

Create:

```tsx
import {AbsoluteFill, Img, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

export const WebProof = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 90], [1, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg, color: theme.colors.text}}>
      <div style={{padding: 72}}>
        <div style={{fontSize: 56, fontWeight: 700}}>Browse. Search. Ship team knowledge.</div>
        <div style={{marginTop: 32, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24}}>
          <div style={{background: theme.colors.panel, border: `1px solid ${theme.colors.border}`, borderRadius: 28, overflow: 'hidden', boxShadow: theme.shadow.panel}}>
            <Img src="/captures/web-home.png" style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`}} />
          </div>
          <div style={{background: theme.colors.panel, border: `1px solid ${theme.colors.border}`, borderRadius: 28, overflow: 'hidden', boxShadow: theme.shadow.panel}}>
            <Img src="/captures/web-detail.png" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Implement `CliFlow.tsx`, `CrossAgent.tsx`, and `BrandOutro.tsx`**

Create `CliFlow.tsx`:

```tsx
import {AbsoluteFill, Img} from 'remotion';
import {theme} from '../theme';

export const CliFlow = () => {
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg, color: theme.colors.text, padding: 72}}>
      <div style={{fontSize: 56, fontWeight: 700}}>Install. Update. Publish.</div>
      <div style={{marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24}}>
        <Img src="/captures/cli-search.png" style={{width: '100%', borderRadius: 24, border: `1px solid ${theme.colors.border}`}} />
        <Img src="/captures/cli-install.png" style={{width: '100%', borderRadius: 24, border: `1px solid ${theme.colors.border}`}} />
      </div>
    </AbsoluteFill>
  );
};
```

Create `CrossAgent.tsx`:

```tsx
import {AbsoluteFill, Img} from 'remotion';
import {theme} from '../theme';

const agents = ['Cursor', 'Claude Code', 'Copilot', 'Windsurf', 'Qoder'];

export const CrossAgent = () => {
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg, color: theme.colors.text, padding: 72}}>
      <div style={{fontSize: 56, fontWeight: 700}}>One skill base. Multiple agents.</div>
      <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'grid', gap: 18}}>
          {agents.map((agent) => (
            <div key={agent} style={{padding: '18px 24px', borderRadius: 18, border: `1px solid ${theme.colors.border}`, background: theme.colors.panel}}>
              {agent}
            </div>
          ))}
        </div>
        <Img src="/assets/logo.svg" style={{width: 220, filter: 'drop-shadow(0 0 48px rgba(0,255,163,0.20))'}} />
      </div>
    </AbsoluteFill>
  );
};
```

Create `BrandOutro.tsx`:

```tsx
import {AbsoluteFill, Img} from 'remotion';
import {theme} from '../theme';

export const BrandOutro = () => {
  return (
    <AbsoluteFill style={{backgroundColor: theme.colors.bg, color: theme.colors.text}}>
      <div style={{display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
        <Img src="/assets/logo.svg" style={{width: 160}} />
        <div style={{marginTop: 28, fontSize: 68, fontWeight: 700}}>Publish once. Install anywhere.</div>
        <div style={{marginTop: 18, fontSize: 30, color: theme.colors.textMuted}}>Update with control.</div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Run typecheck**

Run: `cd promo-video && pnpm typecheck`

Expected: FAIL because the top-level composition is still missing.

### Task 5: Compose the reel and verify a real render

**Files:**
- Create: `promo-video/src/compositions/SkillBaseLaunchReel.tsx`
- Modify: `promo-video/src/Root.tsx`

- [ ] **Step 1: Write the composition implementation**

Create `promo-video/src/compositions/SkillBaseLaunchReel.tsx`:

```tsx
import {AbsoluteFill, Sequence} from 'remotion';
import {sceneTimeline} from '../data/timeline';
import {BrandIntro} from '../scenes/BrandIntro';
import {BrandOutro} from '../scenes/BrandOutro';
import {CliFlow} from '../scenes/CliFlow';
import {CrossAgent} from '../scenes/CrossAgent';
import {WebProof} from '../scenes/WebProof';

const sceneMap = {
  'brand-intro': BrandIntro,
  'web-proof': WebProof,
  'cli-flow': CliFlow,
  'cross-agent': CrossAgent,
  'brand-outro': BrandOutro,
} as const;

export const SkillBaseLaunchReel = () => {
  return (
    <AbsoluteFill>
      {sceneTimeline.map((scene) => {
        const Scene = sceneMap[scene.id];
        return (
          <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
            <Scene />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Run full local verification**

Run:

```bash
cd promo-video
pnpm test
pnpm typecheck
pnpm render
```

Expected:
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm render` writes `out/skill-base-launch.mp4`

- [ ] **Step 3: Review the render against the approved design**

Check these points manually:

```text
1. Duration is at least 10 seconds.
2. Logo is visible in intro and outro.
3. Web section uses real captured product UI.
4. CLI section uses real terminal captures.
5. Accent green is visible but not blown out.
6. Final frame holds long enough for a thumbnail.
```

- [ ] **Step 4: If the render fails visual review, do one focused polish pass**

Allowed changes for the polish pass:
- tighten headline sizes
- adjust screenshot crop and panel spacing
- increase or reduce glow strength
- rebalance scene durations without changing the scene order

Do not add new scenes, new formats, or audio in this pass.

## Self-Review

### Spec coverage

- Uses the real logo: covered in Task 3.
- Uses real web and CLI visuals: covered in Task 3 and Task 4.
- Builds a 16:9 launch reel at least 10 seconds long: covered in Task 2 and Task 5.
- Keeps the implementation small and data-driven: covered in Task 1, Task 2, and Task 5.

### Placeholder scan

- No `TODO`, `TBD`, or “figure it out later” steps remain.
- Asset filenames, scene order, and verification commands are explicit.

### Type consistency

- Scene IDs are defined once in `timeline.ts` and reused in the composition map.
- Width, height, FPS, and total frames are exported from `timeline.ts` and consumed by `Root.tsx`.
