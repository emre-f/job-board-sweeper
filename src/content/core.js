// Content script entry point - runs on supported job sites.
// Depends on constants.js, matcher.js and adapters.js being loaded first
// (order is set in manifest.json).

(() => {
  'use strict';

  const adapter =
    typeof JPF_ADAPTERS !== 'undefined'
      ? JPF_ADAPTERS.find((a) => a.match(location.hostname))
      : null;
  if (!adapter) return;

  const state = {
    settings: { ...JPF_DEFAULTS.settings },
    categoryState: {}, // user's per-category customizations (jpfCategoryState)
    compiled: [], // compiled effective blocklist
    picking: false,
    scanTimer: null,
    statsTimer: null,
  };

  const log = (...args) => {
    if (state.settings.debug) console.log('[JPF]', ...args);
  };

  // ---------- storage ----------

  function recompile() {
    state.compiled = jpfCompile(jpfEffectiveEntries(state.categoryState));
  }

  async function loadState() {
    const sync = await chrome.storage.sync.get({
      jpfSettings: JPF_DEFAULTS.settings,
      jpfCategoryState: {},
    });
    state.settings = { ...JPF_DEFAULTS.settings, ...sync.jpfSettings };
    state.categoryState = sync.jpfCategoryState || {};
    recompile();
    log('loaded', {
      effectiveEntries: state.compiled.length,
      settings: state.settings,
    });
  }

  // False once the extension is reloaded/updated while this content script is
  // still injected - chrome.* calls from such an orphaned script throw
  // "Extension context invalidated".
  const contextAlive = () => Boolean(chrome.runtime && chrome.runtime.id);

  // ---------- DOM decoration ----------

  function cleanCard(el) {
    el.classList.remove('jpf-hidden', 'jpf-dim', 'jpf-reveal');
    delete el.dataset.jpfKind;
    el.querySelectorAll('.jpf-badge, .jpf-block-btn').forEach((n) => n.remove());
  }

  function addBadge(el, label, withShow) {
    const badge = document.createElement('div');
    badge.className = 'jpf-badge';
    const span = document.createElement('span');
    span.textContent = label;
    span.title = label;
    badge.appendChild(span);
    if (withShow) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Show';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('jpf-dim');
        el.dataset.jpfKind = 'restored';
        badge.remove();
        pushStats();
      });
      badge.appendChild(btn);
    }
    el.appendChild(badge);
  }

  function decorate(el, kind, label, action) {
    el.dataset.jpfKind = kind;
    if (state.settings.revealMode) {
      el.classList.add('jpf-reveal');
      addBadge(el, label + ' - reveal mode', false);
      return;
    }
    if (action === 'hide') {
      el.classList.add('jpf-hidden');
      return;
    }
    el.classList.add('jpf-dim');
    addBadge(el, label, true);
  }

  function addBlockButton(el, company) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'jpf-block-btn';
    btn.textContent = 'Label company';
    btn.title = `Block “${company}” under a category`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmAndLabel(company);
    });
    el.appendChild(btn);
  }

  // ---------- labeling (block under a category) ----------

  // In-page modal: confirms the exact detected name and lets the user pick
  // which category to block it under (or create a new category on the spot).
  // Built from divs with explicit colors - host-site styles for p/h tags
  // would otherwise bleed in (e.g. white text on LinkedIn's dark theme).
  // Resolves to { catId } | { newCatName } | null (cancelled).
  function jpfLabelModal(company) {
    return new Promise((resolve) => {
      document.querySelectorAll('.jpf-modal-backdrop').forEach((n) => n.remove());
      const backdrop = document.createElement('div');
      backdrop.className = 'jpf-modal-backdrop';
      const modal = document.createElement('div');
      modal.className = 'jpf-modal';
      const title = document.createElement('div');
      title.className = 'jpf-modal-title';
      title.textContent = 'Label this company';
      const name = document.createElement('div');
      name.className = 'jpf-modal-name';
      name.textContent = company;
      name.title = company;
      const text = document.createElement('div');
      text.className = 'jpf-modal-text';
      text.textContent = 'Pick a category - all of its jobs get blocked under it. Undo anytime.';

      const done = (v) => {
        backdrop.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(v);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          done(null);
        }
      };

      const cats = document.createElement('div');
      cats.className = 'jpf-modal-cats';
      for (const cat of jpfCategoryList(state.categoryState)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'jpf-cat-btn';
        b.textContent = cat.name + (cat.enabled ? '' : ' (category disabled)');
        b.addEventListener('click', () => done({ catId: cat.id }));
        cats.appendChild(b);
      }
      // "New category" - swaps itself for an inline name input.
      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.className = 'jpf-cat-btn';
      newBtn.textContent = '＋ New category…';
      newBtn.addEventListener('click', () => {
        const rowEl = document.createElement('div');
        rowEl.className = 'jpf-cat-new';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Category name (e.g. Consulting)';
        const create = document.createElement('button');
        create.type = 'button';
        create.className = 'jpf-cat-btn jpf-cat-create';
        create.textContent = 'Create';
        const submit = () => {
          const v = input.value.trim();
          if (v) done({ newCatName: v });
        };
        create.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') done(null);
        });
        rowEl.append(input, create);
        newBtn.replaceWith(rowEl);
        input.focus();
      });
      cats.appendChild(newBtn);

      const row = document.createElement('div');
      row.className = 'jpf-modal-btns';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => done(null));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) done(null);
      });
      document.addEventListener('keydown', onKey, true);
      row.append(cancel);
      modal.append(title, name, text, cats, row);
      backdrop.append(modal);
      document.body.append(backdrop);
    });
  }

  async function confirmAndLabel(company) {
    company = (company || '').trim();
    if (!company) {
      showToast('Could not detect a company name here', null);
      return;
    }
    const hit = jpfMatch(company, state.compiled);
    if (hit) {
      showToast(`“${company}” is already blocked under ${hit.cat || 'your blocklist'}`, null);
      return;
    }
    const choice = await jpfLabelModal(company);
    if (choice) labelCompany(company, choice);
  }

  async function labelCompany(company, choice) {
    const { jpfCategoryState } = await chrome.storage.sync.get({ jpfCategoryState: {} });
    const cs = jpfCategoryState;
    let id = choice.catId;
    let catName;
    if (choice.newCatName) {
      id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      cs[id] = { name: choice.newCatName, enabled: true, added: [company] };
      catName = choice.newCatName;
    } else {
      const def = JPF_DEFAULTS.categories.find((c) => c.id === id);
      const st = (cs[id] = cs[id] || {});
      catName = (def && def.name) || st.name || 'category';
      const n = jpfKey(company);
      if (def && def.companies.some((c) => jpfKey(c) === n)) {
        // It's a shipped entry the user had disabled - re-enable it instead
        // of duplicating it in the additions.
        st.disabled = (st.disabled || []).filter((x) => jpfKey(x) !== n);
      } else if (!(st.added || []).some((x) => jpfKey(x) === n)) {
        st.added = [...(st.added || []), company];
      }
    }
    await chrome.storage.sync.set({ jpfCategoryState: cs });
    // storage.onChanged triggers the rescan that actually hides the cards.
    showToast(`Blocked “${company}” under ${catName}`, async () => {
      const cur = (await chrome.storage.sync.get({ jpfCategoryState: {} })).jpfCategoryState;
      if (choice.newCatName) {
        delete cur[id];
      } else if (cur[id]) {
        cur[id].added = (cur[id].added || []).filter((x) => x !== company);
      }
      await chrome.storage.sync.set({ jpfCategoryState: cur });
    });
  }

  let toastEl = null;
  let toastTimer = null;
  function showToast(text, onUndo, duration = 6000) {
    if (toastEl) toastEl.remove();
    clearTimeout(toastTimer);
    toastEl = document.createElement('div');
    toastEl.className = 'jpf-toast';
    const span = document.createElement('span');
    span.textContent = text;
    toastEl.appendChild(span);
    if (onUndo) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Undo';
      btn.addEventListener('click', () => {
        onUndo();
        toastEl.remove();
      });
      toastEl.appendChild(btn);
    }
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(() => toastEl && toastEl.remove(), duration);
  }

  // ---------- context-menu blocking ----------

  // Remember where the user last right-clicked so the background's context
  // menu click can be resolved back to a job card.
  let lastContextTarget = null;
  document.addEventListener(
    'contextmenu',
    (e) => {
      lastContextTarget = e.target;
    },
    true
  );

  function handleContextBlock(selectionText) {
    const card =
      lastContextTarget && lastContextTarget.closest
        ? lastContextTarget.closest('[data-jpf-key]')
        : null;
    const company = (card && card.dataset.jpfCompany) || (selectionText || '').trim();
    if (company) confirmAndLabel(company);
    else showToast('Right-click on a job card, or select the company name first', null);
  }

  // ---------- picker mode ----------

  function startPicker() {
    if (state.picking) return;
    state.picking = true;
    showToast('Click a job to block its company - Esc to cancel', null, 20000);
    let hovered = null;
    const over = (e) => {
      const card = e.target.closest ? e.target.closest('[data-jpf-key]') : null;
      if (card === hovered) return;
      if (hovered) hovered.classList.remove('jpf-pick-hover');
      hovered = card;
      if (hovered) hovered.classList.add('jpf-pick-hover');
    };
    const click = (e) => {
      const card = e.target.closest ? e.target.closest('[data-jpf-key]') : null;
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      stop();
      confirmAndLabel(card.dataset.jpfCompany || '');
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        stop();
      }
    };
    const stop = () => {
      state.picking = false;
      if (hovered) hovered.classList.remove('jpf-pick-hover');
      document.removeEventListener('mouseover', over, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      if (toastEl) toastEl.remove();
    };
    document.addEventListener('mouseover', over, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
  }

  // ---------- scanning ----------

  function processCard(card) {
    const container = adapter.container ? adapter.container(card) : card;
    // Skip nested matches inside a card we already track (broad selectors on
    // sites with hashed class names can match inner elements too).
    const owner = container.parentElement && container.parentElement.closest('[data-jpf-key]');
    if (owner) return;

    const info = adapter.extract(card) || {};
    if (!info.company && !info.title) return;

    const normCompany = jpfNormalize(info.company);
    const key = `${adapter.id}:${info.id || `${normCompany}|${jpfNormalize(info.title)}`}`;
    if (container.dataset.jpfKey === key) return; // already processed

    cleanCard(container); // virtualized lists reuse elements for new jobs
    container.dataset.jpfKey = key;
    container.dataset.jpfCompany = info.company || '';
    container.classList.add('jpf-card');
    if (info.company) addBlockButton(container, info.company);

    if (!state.settings.enabled) return;

    const hit = info.company ? jpfMatch(info.company, state.compiled) : null;
    if (hit) {
      log('blocked:', info.company, '(rule:', hit.raw, '· category:', hit.cat + ')', info.title);
      decorate(
        container,
        'blocked',
        `${info.company} - ${hit.cat || 'blocked'} (rule “${hit.raw}”)`,
        state.settings.blockedAction
      );
    }
  }

  function scan() {
    document.querySelectorAll(adapter.cardSelector).forEach(processCard);
    pushStats();
  }

  function queueScan() {
    clearTimeout(state.scanTimer);
    state.scanTimer = setTimeout(scan, 300);
  }

  function reprocessAll() {
    document.querySelectorAll('[data-jpf-key]').forEach((el) => {
      delete el.dataset.jpfKey;
      cleanCard(el);
    });
    scan();
  }

  // ---------- stats / messaging ----------

  function computeStats() {
    return {
      scanned: document.querySelectorAll('[data-jpf-key]').length,
      blocked: document.querySelectorAll('[data-jpf-kind="blocked"]').length,
    };
  }

  function pushStats() {
    clearTimeout(state.statsTimer);
    state.statsTimer = setTimeout(() => {
      if (!contextAlive()) return;
      chrome.runtime.sendMessage({ type: 'jpf-stats', stats: computeStats() }).catch(() => {});
    }, 400);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'jpf-getStats') {
      sendResponse({
        ok: true,
        site: adapter.id,
        host: location.hostname,
        stats: computeStats(),
      });
    } else if (msg.type === 'jpf-context-block') {
      handleContextBlock(msg.selection);
    } else if (msg.type === 'jpf-start-picker') {
      startPicker();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.jpfSettings) {
      state.settings = { ...JPF_DEFAULTS.settings, ...changes.jpfSettings.newValue };
    }
    if (changes.jpfCategoryState) state.categoryState = changes.jpfCategoryState.newValue || {};
    recompile();
    log('settings/blocklist changed - reprocessing');
    reprocessAll();
  });

  // ---------- init ----------

  // Process new cards synchronously inside the observer callback: it runs
  // after the DOM change but BEFORE the next paint, so blocked cards are
  // hidden before they ever become visible (no flash while scrolling).
  let ready = false;

  function processAddedNode(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(adapter.cardSelector)) processCard(node);
    node.querySelectorAll(adapter.cardSelector).forEach(processCard);
    // Content streamed into an existing/reused card (virtualized lists swap
    // a card's innards without re-adding the card element itself).
    const host = node.closest(adapter.cardSelector);
    if (host) processCard(host);
  }

  const observer = new MutationObserver((mutations) => {
    if (!ready) return;
    for (const m of mutations) {
      if (m.type === 'childList') m.addedNodes.forEach(processAddedNode);
    }
    queueScan(); // debounced safety net for anything the sync path missed
  });
  // Observe from document_start so no insertion is missed; processing is
  // gated on `ready` and the initial scan() covers anything from before.
  observer.observe(document.documentElement, { childList: true, subtree: true });

  loadState().then(() => {
    ready = true;
    scan();
    log('active on', location.hostname, '- adapter:', adapter.id);
  });
})();
