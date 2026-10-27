# Prompt: Build the Ultimate POS Marketing Website (Next.js, SSR, SEO-first)

> Copy everything below the line into your AI coding tool (Claude Code, v0, Cursor, etc.).
> Replace every `[[PLACEHOLDER]]` before going live.

---

## 1. Role & goal

You are a senior full-stack engineer and technical SEO specialist. Build a **production-grade marketing website for "Ultimate POS"**, a cloud-based, multi-branch Point of Sale and business management system built in Kenya for Kenyan businesses.

The site must:
1. Explain clearly **what Ultimate POS is** and why a Kenyan business owner should choose it.
2. Show **the solutions/features** we provide.
3. Show **the types of businesses** we serve, each with its own landing page.
4. Show **testimonials** from clients.
5. Turn visitors into leads through **Request a Demo**, **Request a Quote**, **Contact** forms (sent by email) and **WhatsApp** chat.
6. Be **fully server-side rendered**, **fully SEO-optimised**, and easy for **Google (Googlebot)** and **Meta (facebookexternalhit, Facebook/Instagram/WhatsApp link previews)** to crawl.
7. Follow modern engineering best practice: performance (Core Web Vitals), accessibility (WCAG 2.2 AA), security, testing, CI/CD.

**Reference site for structure and content patterns:** https://www.simbapos.co.ke/. Borrow its proven *information architecture*: a hero naming the main audience, a "Solutions" menu with one page per industry, a feature/benefit grid, client logos, testimonials, a blog, a pricing CTA, a floating WhatsApp button, and phone numbers kept visible. **Do not copy its text, images or branding.** Improve on its gaps: it has no demo or quote form, no FAQ, no numeric trust stats, dated social links (Google+), and a broken Facebook widget. Our site must have all of the missing pieces and none of the broken ones.

---

## 2. Business facts (single source of truth)

Put these in one typed config file, `src/config/site.ts`, and import them everywhere: header, footer, JSON-LD, emails and WhatsApp links. Never hard-code them anywhere else.

| Field | Value |
|---|---|
| Brand name | Ultimate POS |
| Tagline | `[[e.g. "Run every branch, every sale, every shilling — from one system."]]` |
| Location | Kiambu Road, Kiambu, Kenya. **We have no office for walk-ins**, so treat this as a *service-area business*. Show "Based on Kiambu Road, Kiambu · Serving businesses across Kenya". Never show a street number or invite walk-in visits. |
| Phone | 0720 463 710 → E.164 `+254720463710` → `tel:+254720463710` |
| WhatsApp | Same number → `https://wa.me/254720463710` |
| Sales email (receives leads) | `[[sales@yourdomain.co.ke]]` |
| From address (sends mail) | `[[no-reply@yourdomain.co.ke]]` (domain must be verified with the email provider: SPF, DKIM, DMARC) |
| Domain | `[[https://www.ultimatepos.co.ke]]` |
| Business hours | `[[Mon–Sat 8:00–18:00 EAT]]` |
| Social profiles | `[[Facebook, Instagram, LinkedIn, TikTok, YouTube URLs]]`. Only render the ones that exist. |
| App login URL | `[[https://app.yourdomain.co.ke]]` ("Log in" link in the header) |

---

## 3. Product content: what Ultimate POS actually does

Use **only** these real capabilities. Do not invent features. Group them like this on `/features` and in the homepage feature grid:

**Sell faster**
- Fast POS checkout with barcode scanning, receipts, returns and refunds
- **M-Pesa payments built in**: STK push / payment matching and an M-Pesa payment log
- Product bundles and combo deals
- Customer discounts and rewards
- Cash-up / shift sessions so every till is reconciled at close of day

**Control your stock**
- Real-time stock levels per branch
- Stock adjustments with reasons, and stock transfers between branches with an inbox for incoming transfers
- Batch and expiry tracking, plus expiry reports
- Stock valuation and cost revaluations
- Bulk import of products and categories from Excel/CSV
- Categories, brands and units of measure

**Buy smarter**
- Purchase orders, suppliers, supplier ledgers and payables
- Purchase reports, open orders and **supplier price trends**

**Know your customers**
- Customer accounts, credit sales and receivables (customer aging)
- **Customer buying insights**: who buys what, and how often

**Deliveries and riders**
- Delivery orders, rider assignment, **rider cash-up**, and **trips and fuel tracking**

**Manufacturing and production**
- Production formulas (recipes / bills of materials), production runs, and production cost reports

**Pharmacy**
- Prescription register, and batch and expiry control

**Know your numbers**
- Dashboard, sales reports, profit and loss, profit by product, margins, stock status and movements, expense tracking and expense summary

**Run a multi-branch business safely**
- Multiple branches under one account, with a branch switcher
- Users, **roles and fine-grained permissions**
- Full **audit log** of who did what
- Cloud-based: access from anywhere, with automatic updates and backups `[[confirm backup policy]]`
- Modular licensing: switch on only the modules you need (deliveries, production, pharmacy, bundles, cash-up…)

> `[[CONFIRM before publishing: KRA eTIMS integration? Offline mode? Hardware bundles (printers, scanners, cash drawers)? Android/mobile app? Only mention these if they are true.]]`

---

## 4. Industries we serve (one SEO landing page each)

Route: `/solutions/[slug]`, statically generated with `generateStaticParams`. Each page needs a unique H1, intro, pain points → how Ultimate POS solves them (mapped to the real features above), a relevant feature list, an industry testimonial, an industry FAQ (3–5 Q&As), and Demo/Quote/WhatsApp CTAs. Each page should have 600–1,000 words of unique, useful copy. **No doorway pages with swapped keywords.**

| Slug | Page title target keyword | Key features to highlight |
|---|---|---|
| `supermarket-minimart-pos` | Supermarket & Minimart POS in Kenya | fast checkout, M-Pesa, stock, multi-branch, price trends |
| `retail-shop-pos` | General Retail Shop POS System Kenya | checkout, stock, customer credit, reports |
| `wholesale-distribution-pos` | Wholesale & Distribution Software Kenya | purchasing, receivables, deliveries, riders |
| `pharmacy-chemist-pos` | Pharmacy POS System Kenya | prescription register, batch and expiry, stock valuation |
| `water-refill-delivery-pos` | Water Refilling Station & Delivery POS | refills, bundles, deliveries, rider cash-up, trips and fuel |
| `manufacturing-production-software` | Production & Manufacturing Software Kenya | formulas, production runs, production costing |
| `hardware-shop-pos` | Hardware Store POS Kenya | units of measure, bulk import, credit customers |
| `agrovet-pos` | Agrovet POS System Kenya | batch and expiry, stock, M-Pesa |
| `liquor-wines-spirits-pos` | Wines & Spirits / Liquor Store POS Kenya | stock control, shifts, audit log |
| `cosmetics-beauty-shop-pos` | Cosmetics & Beauty Shop POS Kenya | brands, bundles, customer rewards |
| `multi-branch-business-software` | Multi-Branch Business Management Software | branches, transfers, roles, audit log |

Source content from MDX or typed TS files in `src/content/solutions/`. Do not hard-code it in JSX.

---

## 5. Sitemap / pages

```
/                         Home
/features                 All features (grouped as in §3, with anchor links per group)
/solutions                Industries index → /solutions/[slug]
/pricing                  Plans / "From KES [[x]]/month" or "Get a tailored quote", plus a pricing FAQ
/testimonials             All client stories (also used on the homepage)
/about                    Who we are, mission, why we built it, Kenyan focus
/request-demo             Demo booking form
/request-quote            Quote request form
/contact                  Contact form + phone + WhatsApp + service area (no map pin/office)
/faq                      Global FAQ (FAQPage schema)
/blog, /blog/[slug]       MDX articles for SEO (e.g. "How to choose a POS in Kenya", "M-Pesa till reconciliation guide")
/privacy-policy           Kenya Data Protection Act 2019 compliant
/terms
/thank-you                Post-submit page (noindex). Shows a WhatsApp CTA and fires a conversion event.
not-found.tsx             Helpful 404 with search/links
```

**Homepage sections, in order:**
1. **Hero:** H1 with the value proposition and a "for Kenyan businesses" angle, a sub-headline, primary CTA **Request a Free Demo**, secondary CTA **Chat on WhatsApp**, and a product screenshot/mockup (next/image, `priority`).
2. **Trust strip:** client logos `[[real logos with permission]]` and stats `[[e.g. X businesses, Y branches, Z transactions]]`. Show only real numbers.
3. **What is Ultimate POS:** a short explainer and 3 pillars (Sell · Stock · Insight).
4. **Feature grid:** the groups from §3, linking to `/features#group`.
5. **Industries we serve:** a card grid linking to each `/solutions/[slug]`.
6. **M-Pesa and multi-branch spotlight:** our differentiators.
7. **How it works:** 1 Book a demo → 2 Set up and import your products → 3 Train staff → 4 Go live.
8. **Testimonials:** a carousel or grid. It must be keyboard accessible, with no auto-advance unless it can be paused.
9. **Pricing teaser** with a CTA to the quote form.
10. **FAQ:** 6–8 Q&As as an accordion using `<details>` or an accessible equivalent.
11. **Final CTA band:** Demo, Quote, WhatsApp and Call buttons.
12. **Footer:** NAP (name, "Kiambu Road, Kiambu", phone), hours, solution links, company links, socials, legal links, ©.

**Testimonials rule:** create the data model and UI with clearly marked sample entries (`isSample: true`, which are never rendered in production builds). Real entries need: quote, full name, role, business name, industry, town, an optional photo or logo, and a `consentObtained` flag. **Never publish invented testimonials.**

---

## 6. Tech stack (current stable versions)

- **Next.js (latest stable, App Router)** + **React Server Components** + **TypeScript (`strict`)**
- **Tailwind CSS v4** + accessible headless primitives (Radix UI / shadcn/ui) for the accordion, dialog and menu
- **next/font** (self-hosted, `display: swap`) and **next/image** (AVIF/WebP, explicit width and height)
- Content: **MDX** (`@next/mdx` or `next-mdx-remote`) with typed frontmatter validated by **Zod**
- Forms: **React Hook Form + Zod** on the client, **the same Zod schema re-validated in a Server Action**
- Email: **Resend + React Email** templates (or Nodemailer + SMTP behind the same `sendEmail()` interface)
- Spam protection: **Cloudflare Turnstile** (verify the token server-side), a **honeypot** field, and **rate limiting** (Upstash Ratelimit by IP + email)
- Analytics: **GA4 via `@next/third-parties`**, **Meta Pixel** (optional), and **Vercel Analytics / Speed Insights** for real-user Web Vitals. All non-essential scripts load **only after cookie consent**.
- Errors: **Sentry**
- Hosting: **Vercel** (or a Node server / Docker). Env vars are validated at boot with Zod (`src/env.ts`).

---

## 7. Rendering strategy (SSR requirement)

- **Every page is rendered on the server** and returns complete HTML: content, links, headings, meta tags and JSON-LD all in the initial response. Nothing SEO-relevant may depend on client-side JavaScript.
- Use **Server Components by default**. Add `"use client"` only to small interactive islands: the mobile menu, the form, the consent banner and the carousel.
- Content pages (home, features, solutions, blog) should be **statically pre-rendered at build time with ISR** (`export const revalidate = 3600`). This is still server-rendered HTML, and it is the fastest and most crawlable option. Use dynamic rendering only where request data is genuinely needed.
- Forms must submit through **Server Actions** and **work without JavaScript** (progressive enhancement), with `useActionState` for pending/error/success states.
- Verify with `curl -A "Googlebot" https://site/` and `curl -A "facebookexternalhit/1.1" https://site/`. The full content and the og: tags must appear in the raw HTML.

---

## 8. SEO requirements (non-negotiable)

**Technical**
- Use the **Metadata API** only (`export const metadata` / `generateMetadata`). Do not use `next-seo` or a manual `<Head>`.
- Set `metadataBase` in the root layout and use a title template: `"%s | Ultimate POS Kenya"`.
- Each page needs a unique `title` (≤60 chars), a `description` (≤155 chars) and `alternates.canonical`.
- Add `app/sitemap.ts` with all static pages, every solution and every blog post, each with `lastModified`. Add `app/robots.ts` that allows all, links the sitemap and disallows `/api` and `/thank-you`.
- Set `noindex` on `/thank-you` and on preview/staging deployments (staging is noindex by env).
- Use `lang="en-KE"` on `<html>`, and set the `og:locale` to `en_KE`.
- Use clean, lowercase, hyphenated URLs, one H1 per page, a logical H2/H3 hierarchy, descriptive internal links (not "click here"), and breadcrumbs on deep pages.
- Every image needs meaningful `alt` text and a descriptive file name.
- Return real HTTP status codes: 404 for missing pages, 301 for moved pages via `redirects()` in `next.config`. No soft 404s.
- Don't block CSS/JS/images in robots, and don't put content behind login walls or interstitials.

**Structured data (JSON-LD via a `<JsonLd>` server component, validated with the Rich Results Test)**
- `Organization` (site-wide): name, url, logo, `contactPoint` (telephone `+254720463710`, contactType "sales", areaServed "KE", availableLanguage ["en","sw"]), `sameAs` socials.
- `LocalBusiness` / `ProfessionalService` as a **service-area business**: `address` with `addressLocality: "Kiambu"`, `streetAddress: "Kiambu Road"`, `addressCountry: "KE"` (no unit number), `areaServed: Kenya`, telephone, openingHours.
- `SoftwareApplication` on home and features pages: `applicationCategory: "BusinessApplication"`, `operatingSystem: "Web"`, and `offers` only if real prices are published.
- `FAQPage` on `/faq`, solution pages and the homepage FAQ.
- `BreadcrumbList` on solution and blog pages.
- `BlogPosting` on blog posts (author, datePublished, dateModified, image).
- Testimonials can be marked up as `Review` inside `SoftwareApplication`. **Do not add self-serving aggregate star ratings on Organization/LocalBusiness**, because Google ignores them and can penalise them.

**Meta / social crawlability (Facebook, Instagram, WhatsApp previews)**
- Every page needs `og:title`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:locale`, `og:image` (**1200×630**, under 8 MB, absolute HTTPS URL) **plus `og:image:width`, `og:image:height` and `og:image:alt`**, and Twitter `summary_large_image` tags.
- Generate per-page OG images with `opengraph-image.tsx` (`next/og` ImageResponse) carrying the page title and brand. Use a new URL when an image changes, because Meta caches by URL.
- Optional: `fb:app_id`, and the Meta domain-verification meta tag `[[code]]`.
- Make sure the WAF/hosting does not block the `facebookexternalhit` and `Googlebot` user agents.
- After launch, scrape every key URL in the **Meta Sharing Debugger**, submit the sitemap in **Google Search Console** and **Bing Webmaster Tools**, and create and verify a **Google Business Profile** as a service-area business with the address hidden and the same name and phone.

**Content and local SEO**
- Target Kenyan search intent: "POS system Kenya", "POS software Nairobi", "pharmacy POS Kenya", "M-Pesa POS", "supermarket software Kenya", "POS Kiambu"…
- Keep NAP (name, area, phone) identical across the site, Google Business Profile and social profiles.
- Use KES currency, Kenyan English, and local examples (M-Pesa, branches in towns, etc.).

---

## 9. WhatsApp integration

- Add a **floating WhatsApp button** (bottom-right, every page) linking to `https://wa.me/254720463710?text=<encoded prefilled message>`.
- Build the **prefilled text per page context** with a helper `whatsappLink(context)`. For example, on the pharmacy page: *"Hi Ultimate POS, I run a pharmacy and I'd like to know more about your POS."* For pricing: *"Hi, I'd like a quote for Ultimate POS."*
- Use `target="_blank" rel="noopener noreferrer"`, an `aria-label="Chat with us on WhatsApp"` and a visible label on desktop. It must not cover content or the cookie banner, and must respect `prefers-reduced-motion` (no bouncing).
- Track clicks as a `whatsapp_click` event (GA4 + Meta `Contact`), but only after consent.
- Also add WhatsApp CTAs in the hero, in the final CTA band, on the contact page and on the thank-you page.
- Make `tel:+254720463710` click-to-call links visible in the header on mobile.
- *(Future, optional: WhatsApp Business Cloud API notifications for new leads. Design the `notifyLead()` function so this can be added later.)*

---

## 10. Email: lead forms

**Forms**
1. **Request a Demo:** full name, business name, phone (Kenyan format validation, normalised to +254), email, business type (select from the §4 industries + "Other"), number of branches, preferred date/time, preferred mode (on-site / online / phone), message, and a consent checkbox.
2. **Request a Quote:** name, business, phone, email, business type, number of branches, number of tills/users, modules of interest (multi-select from §3: Deliveries, Production, Pharmacy, Bundles, Cash-up, M-Pesa…), whether hardware is needed (Y/N + list), timeline, and notes.
3. **Contact:** name, phone, email, subject, message.

**Flow (Server Action `submitLead(formType, data)`):**
1. Check the honeypot, verify the Turnstile token server-side, and apply the rate limit (e.g. 5 per hour per IP).
2. Validate with the shared Zod schema and return field errors for inline display.
3. Send an **internal notification email** to `SALES_EMAIL`. The subject is `[Demo Request] {Business} – {Business type}`, with a tidy table of all fields, a `reply-to` set to the customer's email, and one-tap `tel:` and `wa.me` links to the customer's number.
4. Send a **customer auto-reply** (a branded React Email template): "Thanks {name}, we've received your demo request. We'll call you within [[1 business day]]", plus a WhatsApp link and our phone.
5. Optionally save the lead (e.g. to a database, Google Sheet or CRM webhook) behind a `saveLead()` interface, so emails are never the only record.
6. Redirect to `/thank-you?type=demo`, and fire the `generate_lead` (GA4) and `Lead` (Meta Pixel / Conversions API) events.
7. If email sending fails: log to Sentry, still show the user a fallback ("Please WhatsApp us on 0720 463 710"), and never expose stack traces.

- Keep secrets in env only: `RESEND_API_KEY`, `SALES_EMAIL`, `FROM_EMAIL`, `TURNSTILE_SECRET_KEY`, `UPSTASH_*`.
- Escape all user input in emails and strip header-injection characters.
- Forms must be accessible: proper `<label>`s, `aria-describedby` for errors, an error summary, focus moved to the first error, `autocomplete` attributes, `inputmode="tel"`, and large tap targets.

---

## 11. Engineering best practices

**Performance (targets at p75 on mobile 4G):** LCP ≤ 2.5 s, **INP ≤ 200 ms**, CLS ≤ 0.1, and a Lighthouse score of ≥ 95 in every category.
- Server Components first and minimal client JS. Keep the first-load JS budget tight `[[e.g. < 120 KB gz]]`.
- Preload only the hero image (`priority`), lazy-load the rest, and keep image dimensions explicit.
- Load third-party scripts with `next/script` `afterInteractive`/`lazyOnload` and only after consent. No heavy chat widgets.
- Add a **Lighthouse CI** budget check in the pipeline so it fails if a budget is breached.

**Accessibility (WCAG 2.2 AA):**
- Semantic landmarks, a skip-to-content link, visible focus states (focus must not be obscured by the sticky header or the WhatsApp button), and colour contrast ≥ 4.5:1.
- Touch targets ≥ 24×24 px (aim for 44 px), full keyboard navigation, `prefers-reduced-motion`, and no information conveyed by colour alone.
- Run automated **axe** checks in Playwright, plus a manual screen-reader smoke test.

**Security:**
- Security headers via `next.config` / middleware: `Content-Security-Policy` (allow-list GA, Meta, Turnstile, Resend not needed client-side), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `frame-ancestors 'none'`.
- Validate server input with Zod, never trust the client, and keep secrets out of client bundles. Only `NEXT_PUBLIC_*` values may reach the browser.
- Run Dependabot/Renovate and `npm audit` in CI.

**Privacy and compliance (Kenya Data Protection Act, 2019):**
- A cookie consent banner (essential / analytics / marketing) with analytics and pixels off until the user opts in.
- A privacy policy covering what lead data we collect, why, how long we keep it, and how to request deletion. Include a consent checkbox on forms linking to it.

**Code quality and structure:**
```
src/
  app/                  routes (route groups: (marketing), (legal)), sitemap.ts, robots.ts, opengraph-image.tsx
  components/ui/        primitives (Button, Input, Accordion…)
  components/sections/  Hero, FeatureGrid, Testimonials, CtaBand, FaqSection…
  components/seo/       JsonLd, Breadcrumbs
  content/              solutions/*.mdx, blog/*.mdx, testimonials.ts, faqs.ts, features.ts
  config/site.ts        business facts (§2)
  lib/                  whatsapp.ts, email/, leads/, ratelimit.ts, turnstile.ts, schemas.ts
  emails/               React Email templates
  env.ts                Zod-validated env
```
- TypeScript strict, ESLint (next/core-web-vitals + jsx-a11y), Prettier, and Husky + lint-staged.
- **Tests:** Vitest + Testing Library for components, schemas and helpers (`whatsappLink`, phone normalisation, `submitLead` with mocked email). **Playwright** E2E covers: home renders with H1 and JSON-LD, every solution page returns 200 with a unique title and canonical, the demo form succeeds and shows validation errors, the WhatsApp link is correct, and sitemap/robots are valid. An axe check runs on every page.
- **CI (GitHub Actions):** typecheck → lint → unit → build → Playwright → Lighthouse CI. Every PR gets a preview deploy (noindex).
- Monitoring: Sentry, Vercel Speed Insights (real-user Web Vitals), uptime check, and the Search Console coverage report.

---

## 12. Design direction

- Modern, clean, trustworthy SaaS look. Brand colours `[[primary hex / secondary hex]]`, with a logo at `[[/public/logo.svg]]`.
- Mobile-first, because most Kenyan SME owners will visit from a phone. Use a sticky header with Call and WhatsApp on mobile.
- Use real product screenshots from the Ultimate POS app (dashboard, POS screen, M-Pesa payments, stock levels, reports) in device frames. Avoid generic stock photos.
- Support light mode, with optional dark mode via CSS variables.
- Keep copy confident and plain, benefit-led ("Know your stock in every branch, in real time"), with short sentences and Kenyan context.

---

## 13. Deliverables and acceptance criteria

1. A working Next.js repo with all pages in §5, content in §3–§4, and README setup steps (env vars, Resend domain verification, Turnstile keys, deploy).
2. `curl` of any page shows the full content, the title, the meta description, the canonical, the og: tags and the JSON-LD in the raw HTML.
3. `/sitemap.xml` and `/robots.txt` are valid, and every URL in the sitemap returns 200 and is canonical to itself.
4. Rich Results Test passes for Organization, LocalBusiness, FAQPage, BreadcrumbList and SoftwareApplication. The Meta Sharing Debugger shows a correct preview with a 1200×630 image and no missing properties.
5. Demo, quote and contact submissions deliver an internal email and a customer auto-reply, block spam (honeypot, Turnstile, rate limit), and work with JavaScript disabled.
6. The WhatsApp button opens chat with `254720463710` and a context-specific prefilled message on every page.
7. Lighthouse mobile scores ≥ 95 for Performance, Accessibility, Best Practices and SEO, with zero axe violations.
8. No fabricated testimonials, statistics or features. Every `[[PLACEHOLDER]]` is listed in a `LAUNCH_CHECKLIST.md`.

Work iteratively: scaffold → config and layout → home → features and solutions → forms and email → SEO and JSON-LD → tests and CI → polish. Show me the page list and component plan before writing code.
