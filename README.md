# <img src="icons/icon128.png" width="36" alt="" align="top" /> Job Board Sweeper

A Chrome extension that cleans up job boards by hiding spam companies such as:
- Job cross-posters (i.e. Jobright)
- AI data-labelling jobs (i.e. Outlier)
- *any* other custom category or company you want GONE

Works on **LinkedIn**, **Indeed**, and **Jobright** (More might be added later!).

## Why

Job boards are drowning in spam, For every 100 job postings I come across maybe 60 of them I wish I wouldn't even come across. The boards' own tools don't
really help: LinkedIn lets you filter with `NOT "Company ABC"` in the search
box, but it has to be retyped constantly. Also it is unreliable since it seems to break down once you exclude more than a handful of companies.

I wanted something **easier and persistent**: block a company once, with one
click, and never see it again... across every job site.

## Install (developer mode)

1. Clone this repo.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the repo folder.
5. Open LinkedIn/Indeed/Jobright and enjoy the silence.

After pulling changes, hit the ↻ reload button on the extension card and refresh
your job-site tabs.

## Features

- **Category-based blocklist**
  - Ships with two categories (in
    [`src/common/constants.js`](src/common/constants.js)): **Job boards &
    cross-posters** and **AI data labelling**. Shipped categories apply to every
    user of the extension.
  - Each category can be **enabled/disabled** per user (popup or options), single
    entries can be disabled, and you can add your own entries to any category.
  - You can create fully **custom categories** (e.g. "Consulting") - from the
    options page or right in the label dialog. Custom categories can be renamed
    and deleted; they live in your Chrome profile, never in the repo.
  - To move a company into a shipped category for everyone:
    `npm run promote -- <category-id> "Company Name"` (e.g.
    `npm run promote -- job-board "Some Spammer"`), or just edit `constants.js`.
- **Three ways to label a company, always with confirmation** - the extension
  shows you the exact detected company name and lets you pick the category to
  block it under (or create a new one on the spot):
  - hover any job card → **Label company** button;
  - **right-click** a job card → *Label this company* (also works on selected
    text if the card can't be detected);
  - popup → **Pick a job on the page** → click a card (Esc cancels).
  Every block shows an Undo toast.
- **Reveal mode** - outlines filtered jobs in red instead of hiding them, so you can
  audit what the filter is doing.
- **Badge counter** - the toolbar icon shows how many jobs were blocked on the
  current tab; the popup shows a breakdown.
- **Sync** - your personal list and settings sync via your Chrome profile
  (`chrome.storage.sync`).
- **Private** - no network requests, no analytics, nothing leaves your browser.

## How matching works

Matching is **exact by design**, so no company ever gets blocked by accident:

- A plain entry blocks a company only when the displayed name is **identical**
  (whitespace aside - case and punctuation must match). `JobRight AI` does *not*
  block "Jobright.ai" or "Jobright"; add one entry per name variant a spammer
  uses.
- Entries with `*` are the deliberate opt-in for looser matching and are
  case-insensitive: `Jobright*` blocks anything starting with "jobright";
  `*staffing*` blocks any company containing "staffing".

Manage everything in the popup (quick add with category picker, per-category
toggles) or the options page (full category manager, import/export as JSON).

## Debugging

- **Options → Debug** logs every filter decision to the page's DevTools console,
  prefixed `[JPF]` (what was extracted from each card, which rule matched).
- **Reveal mode** (popup or options) shows filtered cards with a red outline and a
  badge explaining why they matched, instead of hiding them.
- Popup shows live per-page stats: blocked / total scanned. If
  "scanned" is 0 on a job page, the site's selectors have probably changed - see below.

## Contributing / fixing broken selectors

Job sites redesign constantly; the selectors live in one place:
[`src/content/adapters.js`](src/content/adapters.js). Each site adapter declares:

- `cardSelector` - CSS selector(s) finding job cards,
- `container(card)` - the element to hide/dim,
- `extract(card)` - pulls `{ id, company, title }` out of a card.

To fix a site: open DevTools on the job list, find the card element and the
company-name element, and update the selectors (they're ordered fallback lists,
so append rather than replace when possible). PRs welcome.

The default blocklist lives in [`src/common/constants.js`](src/common/constants.js).

## License

MIT - see [LICENSE](LICENSE).
