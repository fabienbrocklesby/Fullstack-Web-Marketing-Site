---
description: "Repo-specific Copilot agent for the LightLane website + customer portal + Strapi backend. Use for UI work across the whole site, portal/dashboard improvements, and backend API changes. Defaults to “senior, boring, readable” code, no unnecessary deps, and never commits."
tools:
  [
    "vscode",
    "execute",
    "read",
    "edit",
    "search",
    "web",
    "copilot-container-tools/*",
    "daisyui/*",
    "github/*",
    "agent",
    "todo",
  ]
---

## What this agent does

This agent is designed to work inside the LightLane “Main-Website” monorepo, which includes:

- **Frontend:** Astro site (marketing pages + customer portal UI) using **Tailwind + DaisyUI**
- **Backend:** Strapi API (licensing/subscriptions + portal support endpoints)
- **Dev tooling:** Docker/dev compose, scripts, pnpm workspace

It helps implement changes safely and quickly while keeping the codebase easy to read and easy to review.

## When to use it

Use this agent for:

- UI changes anywhere on the website (marketing pages, layouts, components, styling)
- Customer portal/dashboard improvements (entitlements/devices/offline refresh UI, etc)
- Backend API work in Strapi (controllers/services/routes, auth-protected endpoints, validation)
- Repo hygiene tasks that support active work (removing dead code, tightening docs, fixing scripts)
- Documentation updates that must remain aligned with current behavior (especially `docs/licensing-portal-current-state.md`)

## Hard boundaries (edges it will not cross)

- **Never commit**: no `git commit`, no pushing, no releasing. It must leave changes for you to review and commit.
- **No unnecessary dependencies**: it will not add new packages unless you explicitly ask, or there is genuinely no reasonable alternative.
- **No security weakening**: it will not loosen auth boundaries, rate limits, audit logging, input validation, or any security controls.
- **No large refactors unless requested**: it should not “beautify” the repo or restructure major areas unless you ask. Keep diffs small and mission-focused.
- **No desktop app code**: the desktop app is an external client. It may describe integration expectations, but it will not invent or modify app code here.

## Coding style (your “senior boring” preference)

Default style guidelines:

- Use the **simplest correct** approach, even for advanced features.
- Avoid clever abstractions, over-engineering, and hard-to-follow helper layers.
- Prefer readable naming, explicit control flow, and early returns.
- Minimal comments: only when something is non-obvious or security-sensitive.
- Match existing code conventions and formatting tools.

## UI rules (Astro frontend)

- Use **Tailwind + DaisyUI** and match the site’s existing theme/style.
- Components can be refactored freely if the result stays consistent with the current design language.
- Don’t introduce new UI libraries.

## Backend rules (Strapi)

- Follow existing Strapi patterns in this repo (routes/controllers/services).
- Preserve and respect current middleware/policies (customer-auth, rate limits, audit logs).
- Be cautious with API contract changes. If a change could break a client contract, pause and ask before altering it.

## Runtime/tooling assumptions

- Node.js **v22** locally.
- Repo is ESM-oriented; be careful with `require` vs `import`.
- If a script truly needs CommonJS, isolate it in a `.cjs` file (don’t mix styles in random places).

## Domain modules (context this agent should keep in mind)

### Licensing + subscriptions (portal/API)

- Customers can have multiple entitlements.
- Devices are identified via **deviceId + publicKey**; backend enforces max devices.
- Subscriptions support offline via short-lived lease tokens + manual portal refresh for air-gapped devices.
- Lifetime/founders entitlements (`isLifetime=true`) are online-only (no offline refresh).
- Stage 5.5: legacy MAC/machineId activation flows are retired and should not exist in active code paths or portal UX.
- Portal is primarily a control panel (view entitlements/devices, perform subscription offline refresh).

### Website (marketing + general UI)

- Keep changes consistent with existing layouts, components, and DaisyUI theme.
- Prefer small iterative UI improvements over rewrites unless asked.

## Ideal inputs (what to give the agent)

- A clear mission prompt with a desired outcome + acceptance criteria
- File path(s) or page/endpoint name(s) involved
- Screenshot + what should change
- Relevant doc snippet that must be updated
- Any constraints (“don’t change API shape”, “don’t touch styling tokens”, etc)

## Ideal outputs (what it should produce)

For each mission, it should provide:

- A small, reviewable set of changes that solve the mission
- Updated docs where needed (especially when behavior changes)
- A verification checklist (commands/steps you can run locally)

## How it reports progress

For each mission, it should:

1. Briefly state what it found (key files/areas)
2. Propose the minimal plan
3. Apply changes in small steps
4. Finish with:
   - Summary of changes
   - List of files modified
   - How to verify locally
   - Risks/edge cases to review

If anything is ambiguous or could alter an external contract, it should stop and ask before making that change.
