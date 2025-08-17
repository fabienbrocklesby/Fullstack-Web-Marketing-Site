git checkout <commit>

# Frontend Deployment & PM2 (Astro SSR)

Production runs the built Node adapter server (`dist/server/entry.mjs`). **Do not** use `astro preview` in production.

---

## 1. First-Time Setup (or after deleting the process)

From repo root:

```
git pull
pnpm install --frozen-lockfile   # only if deps changed
pnpm --filter frontend build
pm2 start ecosystem.config.cjs --only astro-frontend
pm2 logs astro-frontend --lines 25   # verify it started
pm2 save   # persist for reboot (optional but recommended)
```

If backend also needs starting (first time):

```
pm2 start ecosystem.config.cjs --only strapi-backend
pm2 save
```

---

## 2. Standard Deployment (frontend only)

```
git pull
pnpm --filter frontend build
pm2 restart astro-frontend --update-env
```

If backend changed:

```
pm2 restart strapi-backend --update-env
```

Persist (optional):

```
pm2 save
```

### When `pm2 restart astro-frontend` Fails with "not found"

Start it instead:

```
pm2 start ecosystem.config.cjs --only astro-frontend
```

---

## 3. (Optional) Faster Restarts

Edit `ecosystem.config.cjs` and change astro-frontend args to:

```
args: ["-c", "node ./dist/server/entry.mjs"],
```

Then deployments are:

```
git pull
pnpm --filter frontend build
pm2 restart astro-frontend --update-env
```

No duplicate build during restart.

---

## 4. Verifying a Fresh Build

```
pm2 logs astro-frontend --lines 40
pm2 describe astro-frontend
curl -I http://localhost:4321/pricing
```

Add a temporary HTML comment (e.g. `<!-- deploy test -->`) to a page, rebuild, view page source in browser to confirm.

---

## 5. Cloudflare / Tunnel

- Tunnel normally does **not** require restart if port (4321) unchanged.
- If public site shows old code, purge Cloudflare cache or hit a cache-busting URL: `/pricing?cb=TIMESTAMP`.

---

## 6. Rollback

```
git log --oneline | head   # find commit
git checkout <commit>
pnpm --filter frontend build
pm2 restart astro-frontend --update-env
```

Return to main later:

```
git checkout main
```

---

## 7. Common Issues

| Symptom                        | Cause                     | Fix                                                        |
| ------------------------------ | ------------------------- | ---------------------------------------------------------- |
| `Process not found` on restart | Process never started     | Use `pm2 start ecosystem.config.cjs --only astro-frontend` |
| Changes not visible            | Old process / cached HTML | Confirm running `entry.mjs`, purge cache                   |
| 404 hashed assets              | Dist stale                | Rebuild then restart                                       |
| Port in use                    | Orphan process            | `lsof -i :4321` then kill PID, restart                     |
| Modal not working              | Old JS asset served       | Hard reload / purge cache                                  |

---

## 8. PM2 Command Reference

```
pm2 list
pm2 logs astro-frontend --lines 100
pm2 restart astro-frontend --update-env
pm2 start ecosystem.config.cjs --only astro-frontend
pm2 delete astro-frontend
pm2 save
pm2 resurrect      # load last saved list
pm2 startup        # generate boot script (run once, then follow instructions)
```

`pm2 save` only snapshots the CURRENT process list for resurrection. It does **not** freeze code; new builds replace files immediately on restart.

---

## 9. Environment Variables

Update and propagate:

```
pm2 restart astro-frontend --update-env
```

If you add/remove env vars in `ecosystem.config.cjs`, restart with `--update-env` or delete + start.

---

Document version: 2025-08-18 (rev2)
