// Company-name matching + category resolution.
//
// Matching is EXACT by design: an entry blocks a company only when the
// displayed name is identical (after trimming and collapsing whitespace).
// No case-folding, no punctuation-stripping, no prefix matching - so
// look-alike companies are never blocked by accident. For deliberately
// looser matching, put * wildcards in an entry (e.g. "Jobright*");
// wildcard entries match case-insensitively.
//
// Requires constants.js to be loaded first.

// Canonical form for exact comparison: trim + collapse whitespace only.
function jpfKey(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Loose normalization - used ONLY for seen-job keys (duplicate detection),
// never for blocklist matching.
function jpfNormalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Resolve the user's category state (chrome.storage `jpfCategoryState`,
// shape { [id]: { name?, enabled?, disabled?: [], added?: [] } }) against
// the shipped categories into a uniform list:
//   [{ id, name, shipped, enabled, shippedCompanies, disabled, added }]
// Shipped categories always appear (customized by their state entry, if
// any); state entries with unknown ids are the user's custom categories.
function jpfCategoryList(stateObj) {
  const out = [];
  const known = new Set();
  for (const def of JPF_DEFAULTS.categories) {
    const st = (stateObj && stateObj[def.id]) || {};
    known.add(def.id);
    out.push({
      id: def.id,
      name: def.name,
      shipped: true,
      enabled: st.enabled !== false,
      shippedCompanies: def.companies,
      disabled: st.disabled || [],
      added: st.added || [],
    });
  }
  for (const [id, st] of Object.entries(stateObj || {})) {
    if (known.has(id) || !st || typeof st !== 'object') continue;
    out.push({
      id,
      name: st.name || 'Custom',
      shipped: false,
      enabled: st.enabled !== false,
      shippedCompanies: [],
      disabled: [],
      added: st.added || [],
    });
  }
  return out;
}

// Flatten enabled categories into blocklist entries, deduped by exact key:
// (shipped companies − disabled ones) + the user's additions.
function jpfEffectiveEntries(stateObj) {
  const out = [];
  const seen = new Set();
  for (const cat of jpfCategoryList(stateObj)) {
    if (!cat.enabled) continue;
    const dis = new Set(cat.disabled.map(jpfKey));
    const companies = [
      ...cat.shippedCompanies.filter((c) => !dis.has(jpfKey(c))),
      ...cat.added,
    ];
    for (const c of companies) {
      const k = jpfKey(c);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ raw: c, cat: cat.name, catId: cat.id });
    }
  }
  return out;
}

// Compile blocklist entries (strings or {raw, cat, catId} objects).
function jpfCompile(entries) {
  const out = [];
  for (const e of entries || []) {
    const raw = typeof e === 'string' ? e : e.raw;
    const cat = typeof e === 'string' ? '' : e.cat || '';
    const catId = typeof e === 'string' ? '' : e.catId || '';
    const key = jpfKey(raw);
    if (!key) continue;
    if (key.includes('*')) {
      const parts = key.split('*').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      out.push({
        raw: key,
        cat,
        catId,
        key: null,
        regex: new RegExp('^' + parts.join('.*') + '$', 'i'),
      });
    } else {
      out.push({ raw: key, cat, catId, key, regex: null });
    }
  }
  return out;
}

// Match a company's displayed name against compiled entries.
// Returns the first matching entry, or null.
function jpfMatch(companyName, compiled) {
  const key = jpfKey(companyName);
  if (!key) return null;
  for (const e of compiled) {
    if (e.regex) {
      if (e.regex.test(key)) return e;
    } else if (key === e.key) {
      return e;
    }
  }
  return null;
}
