// Shared defaults. Loaded (in order) by the content scripts, popup, options
// page and the background service worker - keep it dependency-free.

const JPF_DEFAULTS = {
  settings: {
    enabled: true,
    blockedAction: 'hide', // what to do with blocklisted companies: 'hide' | 'dim'
    dupeEnabled: true,
    dupeAction: 'dim', // what to do with already-seen jobs: 'dim' | 'hide'
    dupeThreshold: 2, // treat a job as duplicate from this sighting onward
    seenTtlDays: 5, // forget a job after this many days without seeing it
    revealMode: false, // outline filtered jobs instead of hiding/dimming them
    debug: false, // verbose console logging, prefixed [JPF]
  },

  // The SHIPPED categories - they apply to every user of the extension.
  // To change them for everyone: edit this array, or run
  //   npm run promote -- <category-id> "Company Name"
  // Users can disable whole categories or single entries for themselves, add
  // their own entries, and create fully custom categories - all of that lives
  // in chrome.storage, not here.
  //
  // Matching is EXACT: an entry only blocks a company whose displayed name
  // is identical (whitespace aside). Add one entry per name variant a
  // spammer uses, or use * wildcards for deliberate looser matching
  // (e.g. "Jobright*" - wildcard entries are case-insensitive).
  categories: [
    {
      id: 'job-board',
      name: 'Job boards & cross-posters',
      companies: [
        'Jobright.ai',
        'JobRight.ai',
        'Crossing Hurdles',
        'Jobs via Dice',
        'ZipRecruiter',
        'Hired',
        'Grove Talent',
        'Jobgether',
        'TekRek',
        'Hire Feed',
        'Jack & Jill',
        'Pacer Group',
        'Tech Talent International',
        'Motion Recruitment',
        'Hunter Bond',
        'Kelly',
        'Alliance Search Partners'
      ],
    },
    {
      id: 'ai-labelling',
      name: 'AI data labelling',
      companies: [
        'Mercor',
        'DataAnnotation',
        'Outlier',
        'micro1',
        'Braintrust',
        'Alignerr',
      ],
    },
  ],
};
