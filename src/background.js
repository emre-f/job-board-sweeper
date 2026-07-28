// Background service worker: seeds defaults on install, registers the
// right-click context menu, and shows a per-tab badge with the filtered count.

importScripts('common/constants.js', 'common/matcher.js');

const JPF_SITES = [
  'https://www.linkedin.com/*',
  'https://linkedin.com/*',
  'https://*.indeed.com/*',
  'https://jobright.ai/*',
  'https://www.jobright.ai/*',
];

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.sync.get([
    'jpfSettings',
    'jpfCategoryState',
    'jpfPersonal',
    'jpfDisabledDefaults',
  ]);
  const patch = {};
  if (!cur.jpfSettings) patch.jpfSettings = { ...JPF_DEFAULTS.settings };

  if (!cur.jpfCategoryState) {
    // Migrate the pre-0.3 flat personal/disabled lists into category state.
    const cs = {};
    if (Array.isArray(cur.jpfPersonal) && cur.jpfPersonal.length) {
      cs['custom-mylist'] = { name: 'My blocklist', enabled: true, added: cur.jpfPersonal };
    }
    for (const name of cur.jpfDisabledDefaults || []) {
      const n = jpfKey(name);
      for (const cat of JPF_DEFAULTS.categories) {
        if (cat.companies.some((c) => jpfKey(c) === n)) {
          cs[cat.id] = cs[cat.id] || {};
          cs[cat.id].disabled = [...(cs[cat.id].disabled || []), name];
        }
      }
    }
    patch.jpfCategoryState = cs;
  }
  if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
  await chrome.storage.sync.remove(['jpfBlocklist', 'jpfPersonal', 'jpfDisabledDefaults']);
  // Seen-job tracking was removed in 0.4 - drop any leftover history.
  await chrome.storage.local.remove('jpfSeen');

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'jpf-block',
      title: 'Label this company (Job Board Sweeper)',
      contexts: ['all'],
      documentUrlPatterns: JPF_SITES,
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'jpf-block' && tab && tab.id != null) {
    chrome.tabs
      .sendMessage(tab.id, { type: 'jpf-context-block', selection: info.selectionText || '' })
      .catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'jpf-stats' && sender.tab && sender.tab.id != null) {
    const n = msg.stats.blocked || 0;
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: n ? String(n) : '' });
  }
});

chrome.action.setBadgeBackgroundColor({ color: '#f0b429' });
chrome.action.setBadgeTextColor({ color: '#111827' });
