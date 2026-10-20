# Leisure City

**A mobile-first feedback survey that turns every answer into a light switched on in a night-time city.**

Built for the university project *Events and Leisure* (leisure society and cultural differences). Guests scan a QR code at the event, pick their country, answer 10 questions, and watch a dark city light up one leisure venue at a time. The student team then follows the results live in a private admin dashboard.

- **Live survey:** https://luigikings.github.io/leisuresocietyfeedback/
- **Admin dashboard:** https://luigikings.github.io/leisuresocietyfeedback/admin/ (login required)

> Please don't submit test answers on the live survey: it collects real feedback for the event.

---

## Highlights

- **No framework, no build step.** Plain HTML, CSS and ES modules served as static files from GitHub Pages. The whole app is readable in the browser's "view source".
- **Game-show feel, built from scratch.** A Jeopardy-style intro stage drawn in inline SVG, CSS animations, and screen transitions using the Web Animations API, with a time gate so double taps and fast "Back" presses can't skip a screen.
- **The city is the progress bar.** 10 questions map to 10 leisure venues (park, concert hall, museum, theatre, cinema, fairground, town square, food market, nightclub, stadium). Each answer lights exactly one, and a HUD shows the percentage.
- **No answer is lost.** Every answer is saved the moment it is given, into one row per participant (not only at the end). If the network drops, the full state is queued on the device with an increasing sequence number and synced once the connection comes back. The server ignores stale updates.
- **Resumable.** Reloading or coming back later resumes at the right question. Browser/Android "Back" behaves like the in-app "Back". People who already finished see the final screen, which avoids duplicates.
- **Accessible.** Real radio and checkbox semantics with keyboard support, literal text for screen readers where the design uses uppercase, measured contrast ratios, `prefers-reduced-motion` respected (animations collapse into short fades), and no horizontal scroll from 320 px up.
- **Fast on phones.** Self-hosted, subset WOFF2 fonts (SIL OFL) with `font-display: optional`. Supabase's client library is lazy-loaded only when there is something to send. Long tasks are kept under 50 ms during the animated intro.
- **Admin dashboard.** Login with Supabase Auth, statistics per question with bars and percentages, country and status filters, a searchable list of responses and comments, and CSV export (UTF-8 BOM, CRLF and formula-injection protection, so it opens cleanly in Excel).

## Architecture

```
Phone (QR) ──► GitHub Pages (static HTML/CSS/JS)
                    │
                    │  supabase-js (anon key, public)
                    ▼
              Supabase Postgres
              ├─ RPC save_response  (security definer) ◄── public survey: write only
              └─ table responses    (RLS on)           ◄── /admin: read only, authenticated admins
```

The anon key is public by design, so security lives entirely in the database:

- The public role has **no privileges on any table**. It can only call the `save_response` RPC, which validates every field and writes the caller's own row. A random UUID v4 generated in the browser is the participant's secret.
- Only authenticated users listed in `public.admins` can read responses (Row Level Security). Public sign-up is disabled.
- The `service_role` key never leaves Supabase. The admin page sets a strict Content Security Policy.
- No personal data is collected: only the country and the answers.

## Code structure

```
index.html               Survey (single page, screens swapped in place)
admin/index.html         Admin dashboard
css/                     survey.css, admin.css
js/content.js            Questions, countries and content version
js/lib/                  Pure logic: no DOM, no network, no clock (fully unit-tested)
js/app/                  DOM, network and screens (intro, country, question, final)
js/app/admin/            Dashboard views, auth, data loading, downloads
assets/                  Flags (SVG), icons, self-hosted fonts + licences
supabase/migrations/     SQL: tables, RLS policies and the save_response RPC
scripts/                 serve.mjs (local static server), check-db.mjs (live DB checks)
tests/                   node:test suites
specs/, docs/            Specifications, plans, tasks and setup guide (Spanish)
```

The core rule of the codebase is that **logic and UI are separate**. Survey state, validation, sync queue, city layout, statistics and CSV generation are pure functions in `js/lib/`. The UI only renders and delegates. This keeps the logic trivially testable without a browser.

## Running locally

Requirements: [Node.js](https://nodejs.org/) 24+ (only for the dev server and tests; no `npm install` needed, there are no dependencies).

```bash
node scripts/serve.mjs
```

Then open http://localhost:8080 (the dashboard is at http://localhost:8080/admin/). A different port can be passed as an argument.

Run the test suite (Node's built-in test runner, 660+ tests):

```bash
node --test
```

To run against your own database, create a free Supabase project, apply `supabase/migrations/001_survey.sql` and then `002_q3_multiple.sql`, and set the project URL and publishable key in `js/config.js`. The full step-by-step guide (in Spanish) is in [`docs/supabase.md`](docs/supabase.md).

## How it was built: spec-driven development

The project follows a spec-driven workflow with AI coding agents:

1. A **constitution** ([`docs/constitution.md`](docs/constitution.md)) sets the non-negotiable rules: minimal free stack, logic separated from UI, tests for all logic, anonymous and protected data, mobile-first and accessible.
2. Each feature has a **spec** with numbered requirements in EARS style (`RF-…`/`RNF-…`), a technical **plan** and a list of **tasks** under [`specs/`](specs/): `001-survey` (the public survey) and `002-admin` (the dashboard).
3. Every task is implemented test-first, then validated requirement by requirement, including in a real browser at phone sizes (375×667 and 320×568) with Chrome DevTools: accessibility tree, performance traces, reduced motion, offline mode and blocked fonts.
4. Requirement changes go through the spec first. For example, question 3 later became multiple choice (stored as ordered letters such as `AC`), which meant a new migration, updated stats and CSV, and a new validation pass.

The specs and project docs are written in Spanish; code, UI and this README are in English.

## Tech stack

HTML · CSS · JavaScript (ES modules) · SVG · Web Animations API · Supabase (Postgres, Row Level Security, Auth, RPC) · GitHub Pages · Node.js test runner

## Credits

- University project for the course *Events and Leisure*, by a team of four students. Development by [@luigikings](https://github.com/luigikings).
- Fonts: [Big Shoulders Display](https://fonts.google.com/specimen/Big+Shoulders+Display) and [Figtree](https://fonts.google.com/specimen/Figtree), under the SIL Open Font License (licences in `assets/fonts/`).
- The intro is inspired by the quiz-show format of the event's theme. No logos, music or other assets from real TV shows are used.
