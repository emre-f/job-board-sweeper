// Site adapters. Each adapter knows how to find job cards on a site and
// extract the fields the filter needs (company, title, job id).
//
// Selectors are the part most likely to rot when sites ship redesigns -
// if a site stops filtering, this is the file to fix. Turn on Debug in the
// extension options and watch the [JPF] console output to see what's being
// extracted.

// Return the first non-empty trimmed text among the given selectors.
const jpfText = (root, selectors) => {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const t = el && el.textContent && el.textContent.trim();
    if (t) return t.replace(/\s+/g, ' ');
  }
  return '';
};

const JPF_ADAPTERS = [
  {
    id: 'linkedin',
    match: (h) => h === 'linkedin.com' || h.endsWith('.linkedin.com'),
    // Three generations of markup:
    //  - 2026 "AI job search" UI: every class name is hashed, the only stable
    //    hook is componentkey="job-card-component-ref-<jobid>" (the outer,
    //    clickable card carries role="button"; an inner div repeats the key
    //    and is skipped by core.js's nested-owner check).
    //  - classic logged-in job search / collections cards
    //  - logged-out "base" cards
    cardSelector:
      'div[role="button"][componentkey^="job-card-component-ref-"], ' +
      '[componentkey^="job-card-component-ref-"], ' +
      'li[data-occludable-job-id], div.job-card-container[data-job-id], .base-card.base-search-card, li.jobs-search-results__list-item',
    container: (card) =>
      card.hasAttribute('componentkey') ? card : card.closest('li') || card,
    extract(card) {
      const ck = card.getAttribute('componentkey') || '';
      const ckMatch = ck.match(/^job-card-component-ref-(\w+)/);
      if (ckMatch) {
        // New UI has no semantic classes - go by structure. Card paragraphs
        // are ordered: [0] title, [1] company, [2] location, then meta rows.
        // The title <p> holds a visually-hidden a11y span (with extra text
        // like "(Verified job)") plus an aria-hidden span with the visible
        // title - prefer the latter.
        const ps = card.querySelectorAll('p');
        const titleVis = ps[0] && ps[0].querySelector('span[aria-hidden="true"]');
        const titleEl = titleVis || ps[0];
        const clean = (el) =>
          (el && el.textContent ? el.textContent.trim().replace(/\s+/g, ' ') : '');
        return { id: ckMatch[1], company: clean(ps[1]), title: clean(titleEl) };
      }
      const idEl = card.matches('[data-occludable-job-id], [data-job-id]')
        ? card
        : card.querySelector('[data-occludable-job-id], [data-job-id]');
      const id =
        idEl && (idEl.getAttribute('data-occludable-job-id') || idEl.getAttribute('data-job-id'));
      const company = jpfText(card, [
        '.artdeco-entity-lockup__subtitle',
        '.job-card-container__primary-description',
        '.job-card-container__company-name',
        '.base-search-card__subtitle',
      ]);
      const title = jpfText(card, [
        '.job-card-list__title--link',
        '.job-card-list__title',
        'a.job-card-container__link',
        '.base-search-card__title',
      ]);
      return { id: id || null, company, title };
    },
  },

  {
    id: 'indeed',
    match: (h) => h === 'indeed.com' || h.endsWith('.indeed.com'),
    cardSelector: 'div.job_seen_beacon, li div.cardOutline',
    container: (card) => card.closest('li') || card,
    extract(card) {
      const link = card.querySelector('a[data-jk], h2.jobTitle a');
      const id = (link && link.getAttribute('data-jk')) || null;
      const company = jpfText(card, ['[data-testid="company-name"]', '.companyName']);
      const title = jpfText(card, [
        'h2.jobTitle span[title]',
        'h2.jobTitle a',
        'h2 a span',
        '[data-testid="jobTitle"]',
      ]);
      return { id, company, title };
    },
  },

  {
    id: 'jobright',
    match: (h) => h === 'jobright.ai' || h.endsWith('.jobright.ai'),
    // Jobright uses hashed CSS-module class names, so match on the stable
    // fragment of the class name. Best-effort - expect to tweak these.
    cardSelector: '[class*="job-card"], [class*="jobCard"], [class*="job_card"]',
    container: (card) => card,
    extract(card) {
      const link = card.querySelector('a[href*="/jobs/info/"]');
      const m = link && (link.getAttribute('href') || '').match(/\/jobs\/info\/([\w-]+)/);
      const company = jpfText(card, [
        '[class*="company-name"]',
        '[class*="companyName"]',
        '[class*="company_name"]',
        '[class*="company"]',
      ]);
      const title = jpfText(card, [
        '[class*="job-title"]',
        '[class*="jobTitle"]',
        '[class*="job_title"]',
        'h2',
        'h3',
      ]);
      return { id: m ? m[1] : null, company, title };
    },
  },
];
