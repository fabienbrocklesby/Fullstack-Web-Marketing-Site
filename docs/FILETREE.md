** IT IS VERY IMPORTANT TO NOTE THAT THIS IS SUBJECT TO CHANGE SLIGHTLY AS PROMPTS ARE RAN AND DEVELOPMENTS ARE MADE. USE THIS AS A BASE OF WHAT THE REPO FULLY LOOKS LIKE BUT ALSO IMPLEMENT THE CONTEXT GIVEN TO YOU OVER TIME AND ASSUME SLIGHT CHANGES AS PROMPT ARE EXECUTED. **

# File Tree: Main-Website

**Generated:** 29/01/2026, 15:14:28
**Root Path:** `/Volumes/Samsung T7/LightLane/Development/Main-Website`

```
├── .github
│   ├── agents
│   │   ├── Light Lane AI API.agent.md
│   │   └── Light Lane Website Agent.agent.md
│   ├── instructions
│   │   └── daisyui.instructions.md
│   └── copilot-instructions.md
├── .husky
│   └── pre-commit
├── .pnpm-store
├── backend
│   ├── .strapi
│   │   └── client
│   │       ├── app.js
│   │       └── index.html
│   ├── config
│   │   ├── policies
│   │   │   └── is-authenticated.js
│   │   ├── admin.js
│   │   ├── bootstrap.js
│   │   ├── database.js
│   │   ├── middlewares.js
│   │   ├── plugins.js
│   │   └── server.js
│   ├── database
│   │   └── migrations
│   ├── keys
│   │   ├── private.pem
│   │   └── public.pem
│   ├── public
│   │   └── favicon.ico
│   ├── scripts
│   │   ├── backfill-entitlements.js
│   │   ├── dedupe-entitlements.js
│   │   ├── dev-purge-customers.js
│   │   ├── fix-founders-tier.js
│   │   ├── generate-device-setup-code.js
│   │   ├── generate-request-codes.js
│   │   ├── generate-test-vectors.js
│   │   ├── migrate-legacy-keys-to-entitlements.cjs
│   │   ├── reset-license.js
│   │   ├── sanity-stage2.js
│   │   ├── sanity-stage3.js
│   │   ├── seed-data.js
│   │   └── seed-smoke-test-data.js
│   ├── src
│   │   ├── api
│   │   │   ├── activation-code
│   │   │   │   └── content-types
│   │   │   │       └── activation-code
│   │   │   │           └── schema.json
│   │   │   ├── affiliate
│   │   │   │   ├── content-types
│   │   │   │   │   └── affiliate
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── affiliate.js
│   │   │   │   ├── routes
│   │   │   │   │   ├── affiliate.js
│   │   │   │   │   └── custom.js
│   │   │   │   └── services
│   │   │   │       └── affiliate.js
│   │   │   ├── banner
│   │   │   │   ├── content-types
│   │   │   │   │   └── banner
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── banner.js
│   │   │   │   └── routes
│   │   │   │       └── banner.js
│   │   │   ├── blogpost
│   │   │   │   ├── content-types
│   │   │   │   │   └── blogpost
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── blogpost.js
│   │   │   │   ├── routes
│   │   │   │   │   └── blogpost.js
│   │   │   │   └── services
│   │   │   │       └── blogpost.js
│   │   │   ├── contact-message
│   │   │   │   ├── content-types
│   │   │   │   │   └── contact-message
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── contact-message.js
│   │   │   │   └── routes
│   │   │   │       └── contact-message.js
│   │   │   ├── custom
│   │   │   │   ├── controllers
│   │   │   │   │   └── custom.js
│   │   │   │   └── routes
│   │   │   │       └── custom.js
│   │   │   ├── customer
│   │   │   │   ├── content-types
│   │   │   │   │   └── customer
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── customer.js
│   │   │   │   └── routes
│   │   │   │       └── customer.js
│   │   │   ├── customer-invite
│   │   │   │   ├── content-types
│   │   │   │   │   └── customer-invite
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── customer-invite.js
│   │   │   │   └── routes
│   │   │   │       └── customer-invite.js
│   │   │   ├── device
│   │   │   │   ├── content-types
│   │   │   │   │   └── device
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── device.js
│   │   │   │   ├── routes
│   │   │   │   │   └── device.js
│   │   │   │   └── services
│   │   │   │       └── device.js
│   │   │   ├── enquiry
│   │   │   │   ├── content-types
│   │   │   │   │   └── enquiry
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── enquiry.js
│   │   │   │   └── routes
│   │   │   │       └── enquiry.js
│   │   │   ├── entitlement
│   │   │   │   ├── content-types
│   │   │   │   │   └── entitlement
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── entitlement.js
│   │   │   │   ├── routes
│   │   │   │   │   └── entitlement.js
│   │   │   │   └── services
│   │   │   │       └── entitlement.js
│   │   │   ├── journey-tracker
│   │   │   │   └── services
│   │   │   │       └── journey-tracker.js
│   │   │   ├── lead
│   │   │   │   ├── content-types
│   │   │   │   │   └── lead
│   │   │   │   │       └── schema.json
│   │   │   │   └── controllers
│   │   │   │       └── lead.js
│   │   │   ├── license-key
│   │   │   │   ├── content-types
│   │   │   │   │   └── license-key
│   │   │   │   │       ├── lifecycles.js
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── license-key.js
│   │   │   │   └── routes
│   │   │   │       └── license-key.js
│   │   │   ├── mailing-list-signup
│   │   │   │   ├── content-types
│   │   │   │   │   └── mailing-list-signup
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── mailing-list-signup.js
│   │   │   │   └── routes
│   │   │   │       └── mailing-list-signup.js
│   │   │   ├── offline-challenge
│   │   │   │   ├── content-types
│   │   │   │   │   └── offline-challenge
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── offline-challenge.js
│   │   │   │   ├── routes
│   │   │   │   │   └── offline-challenge.js
│   │   │   │   └── services
│   │   │   │       └── offline-challenge.js
│   │   │   ├── offline-code-use
│   │   │   │   ├── content-types
│   │   │   │   │   └── offline-code-use
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── offline-code-use.js
│   │   │   │   ├── routes
│   │   │   │   │   └── offline-code-use.js
│   │   │   │   └── services
│   │   │   │       └── offline-code-use.js
│   │   │   ├── page
│   │   │   │   ├── content-types
│   │   │   │   │   └── page
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── page.js
│   │   │   │   ├── routes
│   │   │   │   │   └── page.js
│   │   │   │   └── services
│   │   │   │       └── page.js
│   │   │   ├── purchase
│   │   │   │   ├── content-types
│   │   │   │   │   └── purchase
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── purchase.js
│   │   │   │   ├── routes
│   │   │   │   │   └── purchase.js
│   │   │   │   └── services
│   │   │   │       └── purchase.js
│   │   │   ├── release
│   │   │   │   ├── content-types
│   │   │   │   │   └── release
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── release.js
│   │   │   │   └── routes
│   │   │   │       └── release.js
│   │   │   ├── stripe-event
│   │   │   │   ├── content-types
│   │   │   │   │   └── stripe-event
│   │   │   │   │       └── schema.json
│   │   │   │   ├── controllers
│   │   │   │   │   └── stripe-event.js
│   │   │   │   ├── routes
│   │   │   │   │   └── stripe-event.js
│   │   │   │   └── services
│   │   │   │       └── stripe-event.js
│   │   │   └── team
│   │   │       ├── controllers
│   │   │       │   └── team.js
│   │   │       └── routes
│   │   │           └── team.js
│   │   ├── components
│   │   │   ├── blocks
│   │   │   │   ├── content.json
│   │   │   │   ├── cta.json
│   │   │   │   ├── feature-grid.json
│   │   │   │   ├── hero.json
│   │   │   │   ├── pricing.json
│   │   │   │   └── testimonial.json
│   │   │   └── elements
│   │   │       ├── feature-item.json
│   │   │       ├── pricing-plan.json
│   │   │       └── testimonial-item.json
│   │   ├── middlewares
│   │   │   ├── admin-internal.js
│   │   │   ├── ai-auth.js
│   │   │   ├── auth-debug.js
│   │   │   ├── auth-rate-limit.js
│   │   │   ├── customer-auth.js
│   │   │   ├── dev-only.js
│   │   │   ├── invite-rate-limit.js
│   │   │   ├── license-rate-limit.js
│   │   │   ├── rate-limit.js
│   │   │   └── stripe-raw-body.js
│   │   ├── policies
│   │   │   └── is-authenticated.js
│   │   ├── utils
│   │   │   ├── ai-token.js
│   │   │   ├── api-responses.js
│   │   │   ├── audit-logger.js
│   │   │   ├── entitlement-mapping.js
│   │   │   ├── jwt-keys.js
│   │   │   ├── lease-token.js
│   │   │   ├── license-linker.js
│   │   │   ├── mailer.js
│   │   │   ├── offline-codes.js
│   │   │   ├── stripe-pricing.js
│   │   │   └── stripe-webhook-handler.js
│   │   └── index.js
│   ├── tests
│   │   ├── license-linker.test.js
│   │   └── offline-codes.test.js
│   ├── types
│   │   └── generated
│   │       ├── components.d.ts
│   │       └── contentTypes.d.ts
│   ├── .dockerignore
│   ├── :memory:
│   ├── Dockerfile
│   ├── EMAIL_ENV_SAMPLE.txt
│   ├── add-starter-licenses.js
│   ├── clear-visitor-data.js
│   ├── create-activation-codes.js
│   ├── create-licenses.js
│   ├── create-short-licenses.js
│   ├── create-test-affiliate.js
│   ├── favicon.ico
│   ├── generate-keys.sh
│   ├── package.json
│   ├── simple-seed.js
│   ├── test-data-seeder.js
│   └── test-starter-license.js
├── docker
│   └── dev
│       ├── entrypoint.backend.sh
│       └── entrypoint.frontend.sh
├── docs
│   ├── api
│   │   └── http
│   │       ├── shared
│   │       │   ├── entitlements.http
│   │       │   └── login.http
│   │       ├── stage4
│   │       │   ├── activation.http
│   │       │   ├── rate-limit.http
│   │       │   └── smoke-test.sh
│   │       ├── stage5
│   │       │   ├── lease-refresh.http
│   │       │   ├── legacy-retired.http
│   │       │   ├── offline-refresh.http
│   │       │   └── smoke-test.sh
│   │       ├── README.md
│   │       ├── seed-test-customer.sh
│   │       └── use-local-env.sh
│   ├── AI_INTEGRATION.md
│   ├── PORTAL_AI_API_CONTRACT.md
│   ├── PORTAL_AI_API_SCOPE.md
│   ├── PORTAL_AI_API_STAGES.md
│   ├── app-integration-reference.md
│   └── licensing-portal-current-state.md
├── frontend
│   ├── .astro
│   │   ├── collections
│   │   ├── content-assets.mjs
│   │   ├── content-modules.mjs
│   │   ├── content.d.ts
│   │   ├── data-store.json
│   │   ├── settings.json
│   │   └── types.d.ts
│   ├── public
│   │   ├── landing
│   │   │   ├── basicscreen.png
│   │   │   ├── drag&drop.mp4
│   │   │   ├── materials.mp4
│   │   │   ├── preview.mp4
│   │   │   ├── stream.mp4
│   │   │   └── templates.mp4
│   │   ├── AppIcon.ico
│   │   ├── LogoHorizontal.webp
│   │   ├── LogoHorizontalNoBackground.png
│   │   ├── LogoHorizontalSVG.svg
│   │   ├── NotRoundedLogo.png
│   │   ├── api-test.html
│   │   ├── appicon_preview.png
│   │   ├── apple-touch-icon.png
│   │   ├── auth-guard.js
│   │   ├── dashboard-test.html
│   │   ├── favicon.svg
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── journey-tracker.js
│   │   ├── og-lightlane.png
│   │   ├── robots.txt
│   │   ├── simple-test.html
│   │   ├── site.webmanifest
│   │   ├── test-affiliate-debug.js
│   │   ├── test-affiliate-tracking.html
│   │   ├── test-form.html
│   │   ├── test-journey.html
│   │   └── test-tracking.html
│   ├── src
│   │   ├── components
│   │   │   ├── customer
│   │   │   │   ├── dashboard
│   │   │   │   │   ├── ActivationChecklist.astro
│   │   │   │   │   ├── AdvancedDevicesTable.astro
│   │   │   │   │   ├── AirGappedSection.astro
│   │   │   │   │   ├── DashboardIcon.astro
│   │   │   │   │   ├── DashboardModals.astro
│   │   │   │   │   ├── DevicesCard.astro
│   │   │   │   │   ├── HeroSection.astro
│   │   │   │   │   ├── PlansCard.astro
│   │   │   │   │   ├── TrialUrgencyPill.astro
│   │   │   │   │   └── index.ts
│   │   │   │   └── shared
│   │   │   │       └── ResponsiveBadge.astro
│   │   │   ├── icons
│   │   │   │   └── Icon.astro
│   │   │   ├── site-builder
│   │   │   │   ├── CTASection.astro
│   │   │   │   ├── ContentSection.astro
│   │   │   │   ├── FeatureGridSection.astro
│   │   │   │   ├── HeroSection.astro
│   │   │   │   ├── PageRenderer.astro
│   │   │   │   ├── PricingSection.astro
│   │   │   │   └── TestimonialSection.astro
│   │   │   ├── ui
│   │   │   │   ├── LLButton.astro
│   │   │   │   ├── LLCheckbox.astro
│   │   │   │   ├── LLCodeInput.astro
│   │   │   │   ├── LLInput.astro
│   │   │   │   ├── LLRadio.astro
│   │   │   │   ├── LLSelect.astro
│   │   │   │   ├── LLTextarea.astro
│   │   │   │   └── LLToggle.astro
│   │   │   ├── BuyButton.astro
│   │   │   ├── Countdown.astro
│   │   │   ├── DownloadButtons.astro
│   │   │   ├── DownloadModal.astro
│   │   │   ├── EasterEgg.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Header.astro
│   │   │   └── TopBanner.astro
│   │   ├── config
│   │   │   └── strapi.ts
│   │   ├── data
│   │   │   └── pricing.ts
│   │   ├── layouts
│   │   │   ├── Layout.astro
│   │   │   └── PortalLayout.astro
│   │   ├── lib
│   │   │   ├── customer
│   │   │   │   └── dashboard
│   │   │   │       ├── airgapped.ts
│   │   │   │       ├── badge.ts
│   │   │   │       ├── billing.ts
│   │   │   │       ├── checklist.ts
│   │   │   │       ├── data.ts
│   │   │   │       ├── devicesOverview.ts
│   │   │   │       ├── devicesTable.ts
│   │   │   │       ├── dom.ts
│   │   │   │       ├── hero.ts
│   │   │   │       ├── icons.ts
│   │   │   │       ├── index.ts
│   │   │   │       ├── init.ts
│   │   │   │       ├── modals.ts
│   │   │   │       ├── plans.ts
│   │   │   │       ├── state.ts
│   │   │   │       ├── tabs.ts
│   │   │   │       └── urgency-pill.ts
│   │   │   ├── portal
│   │   │   │   ├── api.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── types.ts
│   │   │   ├── validation
│   │   │   │   ├── enquiry.ts
│   │   │   │   └── invite.ts
│   │   │   └── strapi.ts
│   │   ├── pages
│   │   │   ├── blog
│   │   │   │   ├── page
│   │   │   │   │   └── [page].astro
│   │   │   │   ├── [slug].astro
│   │   │   │   ├── index.astro
│   │   │   │   └── rss.xml.ts
│   │   │   ├── customer
│   │   │   │   ├── dashboard.astro
│   │   │   │   ├── download.astro
│   │   │   │   ├── login.astro
│   │   │   │   ├── profile.astro
│   │   │   │   ├── register.astro
│   │   │   │   └── success.astro
│   │   │   ├── internal
│   │   │   │   └── license-generator.astro
│   │   │   ├── 404.astro
│   │   │   ├── [slug].astro
│   │   │   ├── contact.astro
│   │   │   ├── cookies.astro
│   │   │   ├── dashboard.astro
│   │   │   ├── eula.astro
│   │   │   ├── index.astro
│   │   │   ├── join.astro
│   │   │   ├── license-portal.astro
│   │   │   ├── login.astro
│   │   │   ├── pricing.astro
│   │   │   ├── privacy.astro
│   │   │   ├── register.astro
│   │   │   ├── site-editor-new.astro
│   │   │   ├── site-editor.astro
│   │   │   ├── sitemap-blog.xml.ts
│   │   │   ├── sitemap-index.xml.ts
│   │   │   ├── sitemap-pages.xml.ts
│   │   │   ├── sitemap-static.xml.ts
│   │   │   ├── sitemap.xml.ts
│   │   │   ├── success.astro
│   │   │   └── terms.astro
│   │   ├── styles
│   │   │   └── app.css
│   │   ├── types
│   │   │   └── site-editor.ts
│   │   └── utils
│   │       ├── api-helpers.ts
│   │       ├── auth-guard.js
│   │       ├── component-registry.ts
│   │       ├── journey-tracker.js
│   │       ├── sale-dates.ts
│   │       ├── sitemap-data.ts
│   │       └── sitemap.ts
│   ├── .eslintrc.js
│   ├── astro.config.cloudflare.mjs
│   ├── astro.config.mjs
│   ├── package.json
│   ├── postcss.config.cjs
│   ├── tailwind.config.mjs
│   └── wrangler.toml
├── scripts
│   └── check-env.sh
├── .dockerignore
├── .gitignore
├── DOCKER-SETUP.md
├── DOKPLOY-SETUP.md
├── Dockerfile.backend
├── Dockerfile.backend.dev
├── Dockerfile.frontend
├── Dockerfile.frontend.dev
├── Makefile
├── PRE-PUSH-CHECKLIST.md
├── QUICKSTART.md
├── README.md
├── backup-uploads.sh
├── backup.sh
├── docker-compose.dev.yml
├── docker-compose.yml
├── eslint.config.js
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── verify-backups.sh
```

---

_Generated by FileTree Pro Extension_
