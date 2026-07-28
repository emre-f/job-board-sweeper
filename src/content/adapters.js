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
    // Logged-in job search / collections cards, plus logged-out "base" cards.
    cardSelector:
      'li[data-occludable-job-id], div.job-card-container[data-job-id], .base-card.base-search-card, li.jobs-search-results__list-item',
    container: (card) => card.closest('li') || card,
    extract(card) {
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
