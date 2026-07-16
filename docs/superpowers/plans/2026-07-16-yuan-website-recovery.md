# YUAN Website Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the maintainable YUAN website source to the local Mac and restore the public website without disrupting YUAN Academy.

**Architecture:** Treat source recovery and production recovery as separate checkpoints. First create and verify a clean local source copy; then start only the existing `yuan-website` PM2 application, verify each network boundary, and save PM2 state only after every health check passes.

**Tech Stack:** Next.js 14, Node.js/npm, rsync over SSH, PM2, Nginx

## Global Constraints

- Local destination is exactly `/Users/vv/Documents/YUAN开发/yuan-website`.
- Production source remains `/var/www/yuan-website` and public port remains `3002`.
- Do not modify Nginx or the `yuan-academy` process.
- Do not overwrite a pre-existing local destination.
- Exclude server-generated `node_modules` and `.next` from the local copy.
- Save PM2 state only after the website and Academy checks pass.

---

### Task 1: Recover and verify the local source

**Files:**
- Create: `/Users/vv/Documents/YUAN开发/yuan-website/` (source tree copied from production)
- Read: `/var/www/yuan-website/` (remote source tree)

**Interfaces:**
- Consumes: SSH access to `root@120.79.162.27:/var/www/yuan-website/`
- Produces: a clean local Next.js source tree with no copied Linux dependencies or build output

- [x] **Step 1: Confirm the destination does not already exist**

Run:

```bash
test ! -e '/Users/vv/Documents/YUAN开发/yuan-website'
```

Expected: exit code 0 and no output. If it exists, stop before synchronization and inspect it.

- [x] **Step 2: Synchronize maintainable source files**

Run:

```bash
rsync -avz --exclude='node_modules/' --exclude='.next/' --exclude='.git/' root@120.79.162.27:/var/www/yuan-website/ '/Users/vv/Documents/YUAN开发/yuan-website/'
```

Expected: rsync exits 0 and reports the copied source and public asset files.

- [x] **Step 3: Verify the source-copy boundary**

Run:

```bash
test -f '/Users/vv/Documents/YUAN开发/yuan-website/package.json'
test -f '/Users/vv/Documents/YUAN开发/yuan-website/ecosystem.config.js'
test ! -e '/Users/vv/Documents/YUAN开发/yuan-website/node_modules'
test ! -e '/Users/vv/Documents/YUAN开发/yuan-website/.next'
```

Expected: all four checks exit 0.

- [x] **Step 4: Install the locked dependency graph**

Run from `/Users/vv/Documents/YUAN开发/yuan-website`:

```bash
npm ci
```

Expected: exit code 0 with dependencies installed from the existing lock file and no lock-file rewrite.

- [x] **Step 5: Build the recovered source**

Run from `/Users/vv/Documents/YUAN开发/yuan-website`:

```bash
npm run build
```

Expected: exit code 0 and Next.js reports a successful production build.

### Task 2: Restore the production website process

**Files:**
- Read: `/var/www/yuan-website/ecosystem.config.js`
- Modify runtime state: PM2 application list only

**Interfaces:**
- Consumes: the existing server build and `ecosystem.config.js`
- Produces: one `yuan-website` PM2 process listening on `127.0.0.1:3002`

- [x] **Step 1: Record the pre-change state and reproduce the failure**

Run:

```bash
ssh root@120.79.162.27 "pm2 describe yuan-website >/dev/null 2>&1; echo pm2_present=\$?; ss -lnt 'sport = :3002'; curl -sS -o /dev/null -w 'public=%{http_code}\n' --max-time 8 https://yuanshowroom.cn/"
```

Expected before the fix: `pm2_present=1`, no listener on 3002, and `public=502`.

- [x] **Step 2: Start only the website process**

Run:

```bash
ssh root@120.79.162.27 "cd /var/www/yuan-website && pm2 start ecosystem.config.js --only yuan-website"
```

Expected: PM2 reports `yuan-website` as `online`; `yuan-academy` remains online and is not restarted.

- [x] **Step 3: Check immediate startup logs**

Run:

```bash
ssh root@120.79.162.27 "pm2 logs yuan-website --lines 40 --nostream"
```

Expected: Next.js reports ready on port 3002 with no fatal startup error.

- [x] **Step 4: Roll back if startup fails (not required; startup succeeded)**

Run this step only if Step 2 or Step 3 fails:

```bash
ssh root@120.79.162.27 "pm2 delete yuan-website"
```

Expected: the failed website process is removed and `yuan-academy` remains online. Stop execution and return to root-cause investigation.

### Task 3: Verify every boundary and persist the recovery

**Files:**
- Modify runtime state: `/root/.pm2/dump.pm2` through `pm2 save`

**Interfaces:**
- Consumes: an online `yuan-website` process on port 3002
- Produces: healthy local/public responses and PM2 restart persistence

- [x] **Step 1: Verify the website origin directly**

Run:

```bash
ssh root@120.79.162.27 "curl -sS -o /dev/null -w 'origin=%{http_code}\n' --max-time 8 http://127.0.0.1:3002/"
```

Expected: `origin=200` or an intentional 3xx response.

- [x] **Step 2: Verify both public website hostnames**

Run:

```bash
curl -sS -o /dev/null -w 'apex=%{http_code}\n' --max-time 10 https://yuanshowroom.cn/
curl -sS -o /dev/null -w 'www=%{http_code}\n' --max-time 10 https://www.yuanshowroom.cn/
```

Expected: both responses are 200 or an intentional 3xx; neither is 502.

- [x] **Step 3: Verify Academy was not disrupted**

Run:

```bash
curl -sS -o /dev/null -w 'academy=%{http_code}\n' --max-time 10 https://academy.yuanshowroom.cn/login
```

Expected: Academy returns 200 or its expected authentication redirect, not 5xx.

- [x] **Step 4: Save the validated PM2 state**

Run:

```bash
ssh root@120.79.162.27 "pm2 save"
```

Expected: PM2 reports that the process list was successfully saved.

- [x] **Step 5: Capture the final status**

Run:

```bash
ssh root@120.79.162.27 "pm2 jlist | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const p of JSON.parse(s)) console.log(p.name+' | '+p.pm2_env.status+' | '+p.pm2_env.pm_cwd)})\"; ss -lnt 'sport = :3001 or sport = :3002'"
```

Expected: both `yuan-academy` and `yuan-website` are online, with listeners on ports 3001 and 3002.
