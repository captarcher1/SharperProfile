# Phase 3 validation checklist — landing page, navigation, and the SharperProfile rename

Use this to walk through everything that shipped today: the new landing page, the stepper back-navigation + autosave rework, and the SharperProfile name. Should take about 15–20 minutes end to end.

## 0. Start the app

Open a terminal in the project folder and run:

```
cd portfolio-website-builder
npm install
npm run dev
```

Wait for `Ready in ...ms`, then open **http://localhost:3001** in your browser. (If port 3001 is already in use from a previous run, stop that process first, or Next will pick the next free port — check the terminal output for the actual URL.)

If anything looks visually broken (missing styles, stale content), stop the server and run `rm -rf .next` (or delete the `.next` folder manually on Windows) before `npm run dev` again — that clears a stale build cache.

---

## 1. Names — is "SharperProfile" showing up everywhere it should?

- [ ] On the landing page (`/`), the top-left header reads **SharperProfile**, not "Portfolio Website Builder."
- [ ] The hero paragraph below the headline reads "SharperProfile drafts every section with the AI provider you choose..."
- [ ] Your browser tab's title (hover over the tab, or check the window title) reads **SharperProfile**.
- [ ] Click **Home** in the top-right of the header from any wizard step — it should take you back to `/`, not into Step 1. (This used to be a bug — worth specifically checking it's fixed.)

---

## 2. The landing page itself

Go to `/` (or click **Home** from anywhere).

- [ ] Hero headline: "Turn your résumé into a live portfolio site — in minutes, without handing your data to anyone." — read it and confirm it feels right to you; this is the one piece of copy I wrote that's genuinely worth your edit if the tone's off.
- [ ] Two buttons under the hero: a solid green **"See how it works"** and an outlined **"Skip ahead — start now →"**.
- [ ] Click **"See how it works"** — the page should smoothly scroll down to the "How it works" section, not jump straight into the wizard.
- [ ] Scroll back up, click **"Skip ahead — start now →"** — this should take you straight to Step 1.

### 3. Logos

Still on the landing page, just above the screenshot section:

- [ ] You should see 5 small gray logos in a row: **Anthropic, Google Gemini, OpenRouter, Ollama, Vercel**.
- [ ] Hover over each one — a small tooltip should name it (Ollama's should say "Ollama (runs fully offline)").
- [ ] Hovering should make that one logo turn slightly darker/more solid — confirms the hover state works.

### 4. Screenshots

- [ ] Three real screenshots of **your own live site** (pranaysrivastava.vercel.app), each in a little browser-window frame with 3 dots at the top: "Overview," "Projects," and "Perspectives & certifications."
- [ ] Click **"View the live site ↗"** below the screenshots — should open your actual site in a new tab.

### 5. Navigation / flow-diagram icons

Scroll to the "How it works" section:

- [ ] Four icons in a row, connected by a line: an upload icon, a sliders/settings icon, a sparkle icon, and a triangle (publish) icon — each labeled Upload résumé / Configure sections / Generate draft / Publish.
- [ ] Watch it for about 10 seconds — each icon in turn should get a blue ring and slightly bold outline for a couple seconds, then fade back, then the next one lights up. It loops continuously.
- [ ] If you have "reduce motion" turned on in your OS accessibility settings, this animation should stay off (frozen, no pulsing) — the four steps are still fully readable as plain text either way.

### 6. Benefit cards + closing CTA

- [ ] Three cards: "Minutes, not weekends" (lightning icon), "Your keys, your data" (lock icon), "It's really yours" (person icon).
- [ ] Bottom of the page: "Ready to see yours?" with a **"Start building your portfolio"** button — should also go to Step 1.
- [ ] Very bottom: "Not sure where to start? Read the help guide" — the link should go to `/wizard/help`.

---

## 7. Help page

- [ ] From the link above, or by navigating to `/wizard/help` directly, confirm the page loads with sections: What this is, Is this safe, What you'll need, Getting started, Updating your site later.
- [ ] "Back to the wizard" link at the bottom works.

---

## 8. Full wizard flow — the actual site-building functionality

This is the core test: build a portfolio site start to finish.

**Step 1 — Upload:**
- [ ] Click **"Try it with an example"** (fastest way to test without a real résumé) — or upload your own résumé PDF/Word file.
- [ ] Click **Continue to Step 2**.

**Step 2 — Sections:**
- [ ] You'll see a list of sections with checkboxes, some tagged "AI-written" and some "Auto-filled."
- [ ] Toggle the **download button** checkbox on — this should feel instant (no separate save step needed).
- [ ] Uncheck a section that already has content — you should immediately see a warning ("This will leave existing content behind...") before anything is actually removed. Click **Cancel** — the checkbox should re-check itself. Uncheck it again and click **Confirm** this time — now it should actually be removed.
- [ ] Click **Continue to Step 3**.

**Step 3 — Generate:**
- [ ] Click **Generate** (if any section needs AI, you'll need a provider key configured first — the example resume's auto-filled sections don't need one).
- [ ] Edit a field in one of the generated sections, then **immediately** click something else (like the stepper at the top) without waiting. Come back to Step 3 — your edit should still be there. This is the autosave feature: it saves automatically about a second after you stop typing, and flushes immediately if you navigate away mid-edit.
- [ ] Watch for the small "Saving…" / "Saved." text under a field after you edit it — confirms autosave status is visible.

**Step 4 — Publish:**
- [ ] Enter a Vercel token (or skip this if you don't want to actually publish right now) and confirm the page loads correctly either way.

---

## 9. UX enhancements — stepper back-navigation

This is the headline change from today, worth testing deliberately:

- [ ] From Step 3 or Step 4, look at the numbered steps at the top of the page. Steps you've already completed should show a **checkmark** and look clickable (cursor changes to a pointer on hover, slight highlight).
- [ ] Click on a completed step (e.g. click "Sections & photo" while you're on Step 3) — it should take you straight there, with everything you entered still in place.
- [ ] The **current** step and any step you haven't reached yet should NOT be clickable — hovering over them shouldn't do anything.
- [ ] Look at the toolbar just below the stepper (Help / Save-Export / Import) — it should look visually quieter/more muted than the stepper itself (smaller, lower-contrast), not competing with it for attention.

---

## If something looks wrong

Most visual issues trace back to a stale `.next` build cache — stop the server, delete the `.next` folder, and run `npm run dev` again. If a specific behavior doesn't match what's described above, that's worth flagging directly — everything in this checklist was verified with an automated browser test before delivery, but your own real click-through is the check that actually matters.
