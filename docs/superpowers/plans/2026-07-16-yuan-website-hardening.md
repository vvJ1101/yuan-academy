# YUAN Website Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct and harden the existing YUAN public website while preserving its content, visual identity, public URLs, and isolation from YUAN Academy.

**Architecture:** Keep the website as a static-content Next.js application. Move page-wide browser state into a small navigation client component, render content sections without unnecessary client animation code, enforce site contracts through Node built-in tests, and deploy only after a local production build and a reversible server backup.

**Tech Stack:** Next.js 14.2.x, React 18.3, TypeScript 5.4, Tailwind CSS 3.4, Node built-in test runner, PM2, Nginx

## Global Constraints

- Modify only `/Users/vv/Documents/YUAN开发/yuan-website`; do not modify YUAN Academy business code.
- Do not add a cooperation form, database flow, email notification, CMS, or third-party analytics.
- Keep `https://yuanshowroom.cn/`, `https://www.yuanshowroom.cn/`, and server port `3002` unchanged.
- Do not modify Nginx.
- Delete `._*` files; back up unused or duplicate public assets before removing them.
- Do not use `npm audit fix --force` or cross a framework major-version boundary without a new explicit approval.
- Every production deployment must have a timestamped server backup and a verified rollback command.

---

### Task 1: Establish repository hygiene and executable site contracts

**Files:**
- Create: `/Users/vv/Documents/YUAN开发/yuan-website/.gitignore`
- Create: `/Users/vv/Documents/YUAN开发/yuan-website/tests/site-contracts.test.mjs`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/package.json`

**Interfaces:**
- Consumes: website source files and Node 20
- Produces: `npm test`, `npm run typecheck`, and `npm run check` quality gates

- [ ] **Step 1: Write failing source-contract tests**

Create `tests/site-contracts.test.mjs` with Node `node:test` cases that read source files and assert:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('sitemap publishes only the canonical homepage', async () => {
  const sitemap = await read('public/sitemap.xml')
  assert.match(sitemap, /<loc>https:\/\/yuanshowroom\.cn\/<\/loc>/)
  assert.doesNotMatch(sitemap, /\/showroom/)
  assert.equal((sitemap.match(/<url>/g) ?? []).length, 1)
})

test('404 returns to the canonical homepage', async () => {
  const source = await read('src/app/not-found.tsx')
  assert.match(source, /href="\/"/)
  assert.doesNotMatch(source, /href="\/showroom"/)
})

test('metadata contains no verification placeholder', async () => {
  const source = await read('src/app/layout.tsx')
  assert.doesNotMatch(source, /Your360VerificationCode/)
})

test('Next configuration disables disclosure and defines security headers', async () => {
  const source = await read('next.config.js')
  assert.match(source, /poweredByHeader:\s*false/)
  for (const header of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.match(source, new RegExp(header))
  }
})

test('mobile navigation exposes expanded state and keyboard close', async () => {
  const source = await read('src/components/home/site-navigation.tsx')
  assert.match(source, /aria-expanded=/)
  assert.match(source, /aria-controls=/)
  assert.match(source, /event\.key === 'Escape'/)
})

test('source has no TypeScript any escape or AppleDouble metadata', async () => {
  const plus = await read('src/components/home/section-plus.tsx')
  assert.doesNotMatch(plus, /as any/)
})
```

- [ ] **Step 2: Run the contract test and verify the red state**

Run:

```bash
node --test tests/site-contracts.test.mjs
```

Expected: failures for the old sitemap URL, old 404 URL, placeholder verification, missing security headers, missing navigation component, and `as any`.

- [ ] **Step 3: Add repository hygiene and scripts**

Create `.gitignore`:

```gitignore
node_modules/
.next/
out/
*.log
.DS_Store
._*
coverage/
```

Add these scripts to `package.json` without changing runtime dependencies:

```json
"test": "node --test tests/*.test.mjs",
"typecheck": "tsc --noEmit",
"check": "npm run test && npm run typecheck && npm run build"
```

- [ ] **Step 4: Verify the new commands are callable**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck passes; contract tests remain red until Tasks 2–5 implement the required behavior.

### Task 2: Correct SEO, 404 behavior, and security headers

**Files:**
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/public/sitemap.xml`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/app/not-found.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/app/layout.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/next.config.js`
- Test: `/Users/vv/Documents/YUAN开发/yuan-website/tests/site-contracts.test.mjs`

**Interfaces:**
- Consumes: canonical origin `https://yuanshowroom.cn`
- Produces: correct discovery documents and response headers for every route

- [ ] **Step 1: Replace sitemap contents with the canonical homepage**

Use exactly one `<url>` entry:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yuanshowroom.cn/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 2: Correct page metadata and 404 navigation**

Change the 404 link to `href="/"`. Remove only the fake `360-site-verification` entry from `metadata.other`; retain the real Baidu verification and the existing canonical, Open Graph, Twitter, and Organization data.

- [ ] **Step 3: Add conservative static-site security headers**

Set `poweredByHeader: false` and add an async `headers()` rule for `/(.*)` in `next.config.js`. Define:

```js
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
]
```

Keep the existing image configuration. Join the CSP onto one line so Node does not reject the header value.

- [ ] **Step 4: Run the focused contracts**

Run:

```bash
npm test
```

Expected: sitemap, 404, metadata, and header tests pass; navigation and `any` tests remain red.

### Task 3: Isolate navigation state and repair mobile accessibility

**Files:**
- Create: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/site-navigation.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/app/page.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/app/globals.css`
- Test: `/Users/vv/Documents/YUAN开发/yuan-website/tests/site-contracts.test.mjs`

**Interfaces:**
- Consumes: the existing section anchor IDs
- Produces: a focused client component for navigation and back-to-top behavior; a server page shell

- [ ] **Step 1: Extract browser state into `SiteNavigation`**

Move `menuOpen`, `showTop`, `scrolled`, the scroll listener, navigation arrays, mobile drawer, and back-to-top button from `page.tsx` into `site-navigation.tsx`. Keep visual classes and anchor destinations unchanged.

Add:

```tsx
const menuButtonRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
  if (!menuOpen) return
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [menuOpen])
```

On the button set `ref={menuButtonRef}`, `aria-expanded={menuOpen}`, and `aria-controls="mobile-navigation"`. Set the drawer `id="mobile-navigation"` and `aria-hidden={!menuOpen}`.

- [ ] **Step 2: Convert the page shell to a server component**

Remove `'use client'`, React hooks, and `next/link` from `page.tsx`. Render `<SiteNavigation />`, the existing content sections, footer, and no local back-to-top button.

- [ ] **Step 3: Add visible focus and reduced-motion rules**

Append to `globals.css`:

```css
:focus-visible {
  outline: 2px solid #c8a46e;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Run accessibility contracts and type checking**

Run:

```bash
npm test
npm run typecheck
```

Expected: navigation contract passes and TypeScript reports no error.

### Task 4: Remove unsafe typing and reduce unnecessary motion payload

**Files:**
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/data/home.ts`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-plus.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-hero.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-about.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-bsi.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-brands.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-contact.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-cta.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-services.tsx`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/src/components/home/section-showroom.tsx`
- Test: `/Users/vv/Documents/YUAN开发/yuan-website/tests/site-contracts.test.mjs`

**Interfaces:**
- Consumes: typed `omniChannel.ecommerce` and `omniChannel.retail` data
- Produces: no `any` escape and fewer hydrated animation components

- [ ] **Step 1: Define a type guard for optional platforms**

In `section-plus.tsx`, derive the item type and guard it:

```tsx
type ChannelItem = typeof omniChannel.ecommerce | typeof omniChannel.retail

function hasPlatforms(item: ChannelItem): item is typeof omniChannel.ecommerce {
  return 'platforms' in item
}
```

Replace both `(item as any).platforms` expressions with `hasPlatforms(item)` and `item.platforms`.

- [ ] **Step 2: Remove nonessential viewport animations**

Replace `motion.div` wrappers in below-the-fold content sections with semantic `div` elements and remove unused `framer-motion` imports. Keep the hero entrance animation only; its CSS reduced-motion override from Task 3 suppresses it when requested.

- [ ] **Step 3: Verify types, contracts, and build-size output**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all contracts pass, no `any` remains in application source, and the build succeeds. Record the homepage First Load JS value for comparison with the 152KB baseline.

### Task 5: Audit, back up, and optimize public assets

**Files:**
- Create: `/Users/vv/Documents/YUAN开发/yuan-website/scripts/audit-assets.mjs`
- Create outside project: `/Users/vv/Documents/YUAN开发/yuan-website-assets-backup-20260716/`
- Modify: image files under `/Users/vv/Documents/YUAN开发/yuan-website/public/images/`
- Delete: `._*` files under `/Users/vv/Documents/YUAN开发/yuan-website/`

**Interfaces:**
- Consumes: string image references in `src/**/*.{ts,tsx}` and files under `public/images`
- Produces: `used`, `unused`, `missing`, and duplicate-hash reports before any removal

- [ ] **Step 1: Create a deterministic asset audit script**

Create the script with this complete implementation:

```js
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

async function filesUnder(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    return entry.isDirectory() ? filesUnder(relativePath) : [relativePath]
  }))
  return files.flat().sort()
}

const sourceFiles = (await filesUnder('src')).filter((file) => /\.(ts|tsx)$/.test(file))
const referenced = new Set()
for (const file of sourceFiles) {
  const source = await readFile(path.join(root, file), 'utf8')
  for (const match of source.matchAll(/["'](\/images\/[^"']+)["']/g)) referenced.add(match[1])
}

const publicFiles = (await filesUnder('public/images')).filter((file) => !path.basename(file).startsWith('._'))
const published = new Set(publicFiles.map((file) => `/${file.replace(/^public\//, '')}`))
const used = [...referenced].filter((file) => published.has(file)).sort()
const missing = [...referenced].filter((file) => !published.has(file)).sort()
const unused = [...published].filter((file) => !referenced.has(file)).sort()
const hashes = new Map()

for (const file of publicFiles) {
  const digest = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')
  const paths = hashes.get(digest) ?? []
  paths.push(`/${file.replace(/^public\//, '')}`)
  hashes.set(digest, paths)
}

const duplicates = [...hashes.values()].filter((paths) => paths.length > 1).map((paths) => paths.sort())
console.log(JSON.stringify({ used, unused, missing, duplicates }, null, 2))
if (missing.length > 0) process.exitCode = 1
```

- [ ] **Step 2: Run the audit before removal**

Run:

```bash
node scripts/audit-assets.mjs
```

Expected: `missing` is empty; unused and duplicate groups are printed for review.

- [ ] **Step 3: Create an external backup before cleanup**

Run:

```bash
mkdir -p '/Users/vv/Documents/YUAN开发/yuan-website-assets-backup-20260716'
rsync -a '/Users/vv/Documents/YUAN开发/yuan-website/public/' '/Users/vv/Documents/YUAN开发/yuan-website-assets-backup-20260716/public/'
```

Expected: backup size and file count match the original public directory before deletion.

- [ ] **Step 4: Remove metadata and confirmed unused assets**

Use the audit output as the exact deletion list. Delete all `._*` files. Remove only assets in the reported `unused` list; for duplicate groups, retain any referenced path and remove only unreferenced duplicates.

- [ ] **Step 5: Optimize oversized referenced images without changing paths**

For each referenced raster above 1MB, first copy it to the external backup, then run:

```bash
sips -Z 2560 '/absolute/path/to/referenced-image' --out '/tmp/optimized-image'
sips -g pixelWidth -g pixelHeight '/tmp/optimized-image'
```

Expected: `sips` exits 0 and reports nonzero dimensions. Compare `stat -f '%z'` before and after; replace the original only when `/tmp/optimized-image` is smaller and decodes successfully. Preserve the original extension and path.

- [ ] **Step 6: Re-run audit and production build**

Run:

```bash
node scripts/audit-assets.mjs
npm run build
find . -name '._*' -type f -print
```

Expected: `missing` is empty, build passes, and the final `find` prints nothing.

### Task 6: Resolve compatible dependency advisories and add lint

**Files:**
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/package.json`
- Modify: `/Users/vv/Documents/YUAN开发/yuan-website/package-lock.json`
- Create: `/Users/vv/Documents/YUAN开发/yuan-website/.eslintrc.json`

**Interfaces:**
- Consumes: npm registry advisory data and Next.js 14 compatibility range
- Produces: a reproducible lock file, lint command, and zero compatible-range advisories

- [ ] **Step 1: Capture advisories and compatible available versions**

Run:

```bash
npm audit
npm view next@14 version --json
npm view eslint-config-next@14 version --json
```

Expected: exact affected packages and the newest 14.2.x release are recorded. If an advisory has no fix within Next 14/React 18, stop and request approval for a framework-major migration rather than forcing it.

- [ ] **Step 2: Install compatible security and lint versions**

Install the newest available compatible Next.js 14.2.x and matching `eslint-config-next`, plus ESLint 8.57.1 required by the Next 14 lint configuration:

```bash
npm install next@14.2.35
npm install --save-dev eslint@8.57.1 eslint-config-next@14.2.35
```

If Step 1 reports a newer 14.2.x, substitute that exact version for both Next packages. Do not change React major versions.

- [ ] **Step 3: Configure and run lint**

Create `.eslintrc.json`:

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"]
}
```

Add `"lint": "next lint"` and change `check` to `npm run test && npm run lint && npm run typecheck && npm run build`.

Run:

```bash
npm run lint
npm audit
```

Expected: lint passes. Compatible-range advisories are zero; if npm still reports an advisory whose only fix is a major upgrade, record it as the explicit migration blocker from Step 1.

### Task 7: Full local verification and version-control handoff

**Files:**
- Review all changed files under `/Users/vv/Documents/YUAN开发/yuan-website`

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: a locally verified release candidate and exact change manifest

- [ ] **Step 1: Run the complete quality gate from a clean dependency install**

Run:

```bash
rm -rf node_modules .next
npm ci
npm run check
node scripts/audit-assets.mjs
```

Expected: install, tests, lint, typecheck, build, and asset audit all pass.

- [ ] **Step 2: Start locally and verify HTTP contracts**

Run:

```bash
npm start -- -p 3002
```

In another shell verify `/`, `/robots.txt`, `/sitemap.xml`, and a nonexistent path. Expected: 200, 200, 200, and 404 respectively; homepage headers include the configured security headers and omit `X-Powered-By`.

- [ ] **Step 3: Present the local change manifest before production deployment**

Report exact modified/deleted files, asset backup path, build-size comparison, audit result, test result, and rollback method. Obtain explicit deployment approval before any server write.

### Task 8: Back up, deploy, verify, and preserve rollback

**Files:**
- Create on server: `/var/backups/yuan-website-20260716-HHMMSS/`
- Modify on server: `/var/www/yuan-website/`

**Interfaces:**
- Consumes: the verified local release candidate
- Produces: a healthy `yuan-website` PM2 process on port 3002 with a complete rollback snapshot

- [ ] **Step 1: Create and verify a timestamped server backup**

Copy `/var/www/yuan-website` excluding `node_modules` into the timestamped backup, and copy the current `.next` directory. Verify the backup contains `package.json`, `src`, `public`, and `.next/BUILD_ID` before deployment.

- [ ] **Step 2: Synchronize source without touching runtime data**

Use rsync to `/var/www/yuan-website/`, excluding local `node_modules`, `.next`, `.git`, the external asset backup, and macOS metadata. Do not use an unreviewed `--delete`; remove only files listed in the approved manifest.

- [ ] **Step 3: Install, build, and atomically restart only the website**

Run on the server:

```bash
cd /var/www/yuan-website
npm ci
npm run check
pm2 restart yuan-website
```

Expected: quality gate passes before restart; `yuan-academy` is not restarted.

- [ ] **Step 4: Verify origin, public hosts, headers, SEO, 404, and Academy**

Verify port 3002, both website hostnames, security headers, robots, sitemap contents, a 404 path, and `https://academy.yuanshowroom.cn/login`. Expected: all website success routes return 200, missing path returns 404, headers match, and Academy returns 200.

- [ ] **Step 5: Save PM2 only after all checks pass**

Run `pm2 save`. If any check fails, restore the timestamped backup, run `npm ci`, restart only `yuan-website`, and repeat the health checks.
