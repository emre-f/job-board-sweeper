const $ = (s) => document.querySelector(s);

async function getSync() {
  return chrome.storage.sync.get({
    jpfSettings: JPF_DEFAULTS.settings,
    jpfCategoryState: {},
  });
}

function flash(text) {
  const el = $('#flash');
  el.textContent = text;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => (el.textContent = ''), 2500);
}

async function refreshSeenCount() {
  const { jpfSeen } = await chrome.storage.local.get({ jpfSeen: {} });
  $('#seenCount').textContent = `${Object.keys(jpfSeen).length} jobs remembered.`;
}

async function patchCategoryState(mutate) {
  const { jpfCategoryState } = await getSync();
  mutate(jpfCategoryState);
  await chrome.storage.sync.set({ jpfCategoryState: jpfCategoryState });
  renderCategories(jpfCategoryState);
}

function renderCategories(cs) {
  const wrap = $('#categories');
  wrap.textContent = '';

  for (const cat of jpfCategoryList(cs)) {
    const box = document.createElement('div');
    box.className = 'cat-box' + (cat.enabled ? '' : ' off');

    // header: enable toggle, name, shipped/custom tag, rename/delete
    const head = document.createElement('div');
    head.className = 'cat-head';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = cat.enabled;
    toggle.title = 'Enable/disable this category';
    toggle.addEventListener('change', () =>
      patchCategoryState((s) => {
        s[cat.id] = s[cat.id] || {};
        s[cat.id].enabled = toggle.checked;
        if (!cat.shipped) s[cat.id].name = cat.name;
      })
    );
    const name = document.createElement('strong');
    name.textContent = cat.name;
    const tag = document.createElement('span');
    tag.className = 'cat-tag';
    tag.textContent = cat.shipped ? `shipped · id: ${cat.id}` : 'custom - only you';
    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    head.append(toggle, name, tag, spacer);

    if (!cat.shipped) {
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.textContent = 'Rename';
      rename.addEventListener('click', () => {
        const v = prompt('New category name:', cat.name);
        if (v && v.trim()) {
          patchCategoryState((s) => {
            s[cat.id] = s[cat.id] || {};
            s[cat.id].name = v.trim();
          });
        }
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (confirm(`Delete category “${cat.name}” and its ${cat.added.length} entries?`)) {
          patchCategoryState((s) => delete s[cat.id]);
          flash(`Deleted “${cat.name}”`);
        }
      });
      head.append(rename, del);
    }
    box.appendChild(head);

    // shipped entries as checkboxes (unchecking disables just for this user)
    if (cat.shippedCompanies.length) {
      const dis = new Set(cat.disabled.map(jpfKey));
      const grid = document.createElement('div');
      grid.className = 'defaults-grid';
      for (const company of cat.shippedCompanies) {
        const label = document.createElement('label');
        label.className = 'def-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !dis.has(jpfKey(company));
        cb.addEventListener('change', () =>
          patchCategoryState((s) => {
            const st = (s[cat.id] = s[cat.id] || {});
            st.disabled = cb.checked
              ? (st.disabled || []).filter((x) => jpfKey(x) !== jpfKey(company))
              : [...(st.disabled || []), company];
          })
        );
        const span = document.createElement('span');
        span.textContent = company;
        label.append(cb, span);
        grid.append(label);
      }
      box.appendChild(grid);
    }

    // the user's own additions as removable chips
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const company of cat.added) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const span = document.createElement('span');
      span.textContent = company;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '✕';
      rm.title = `Remove ${company}`;
      rm.addEventListener('click', () =>
        patchCategoryState((s) => {
          const st = s[cat.id];
          if (st) st.added = (st.added || []).filter((x) => x !== company);
        })
      );
      chip.append(span, rm);
      chips.append(chip);
    }
    if (cat.added.length) box.appendChild(chips);

    // inline add
    const addRow = document.createElement('div');
    addRow.className = 'cat-add';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Add a company to “${cat.name}”…`;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      const n = jpfKey(v);
      patchCategoryState((s) => {
        const st = (s[cat.id] = s[cat.id] || {});
        if (cat.shippedCompanies.some((c) => jpfKey(c) === n)) {
          st.disabled = (st.disabled || []).filter((x) => jpfKey(x) !== n);
        } else if (!(st.added || []).some((x) => jpfKey(x) === n)) {
          st.added = [...(st.added || []), v];
        }
        if (!cat.shipped) st.name = st.name || cat.name;
      });
    };
    addBtn.addEventListener('click', add);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') add();
    });
    addRow.append(input, addBtn);
    box.appendChild(addRow);

    wrap.appendChild(box);
  }
}

async function load() {
  const { jpfSettings: s, jpfCategoryState } = await getSync();
  $('#enabled').checked = !!s.enabled;
  $('#blockedAction').value = s.blockedAction;
  $('#revealMode').checked = !!s.revealMode;
  $('#dupeEnabled').checked = !!s.dupeEnabled;
  $('#dupeAction').value = s.dupeAction;
  $('#dupeThreshold').value = s.dupeThreshold;
  $('#seenTtlDays').value = s.seenTtlDays;
  $('#debug').checked = !!s.debug;
  renderCategories(jpfCategoryState);
  refreshSeenCount();
}

async function saveSettings() {
  const settings = {
    enabled: $('#enabled').checked,
    blockedAction: $('#blockedAction').value,
    revealMode: $('#revealMode').checked,
    dupeEnabled: $('#dupeEnabled').checked,
    dupeAction: $('#dupeAction').value,
    dupeThreshold: Math.max(2, parseInt($('#dupeThreshold').value, 10) || 2),
    seenTtlDays: Math.max(1, parseInt($('#seenTtlDays').value, 10) || 5),
    debug: $('#debug').checked,
  };
  await chrome.storage.sync.set({ jpfSettings: settings });
  flash('Settings saved');
}

document
  .querySelectorAll('#settingsForm input, #settingsForm select')
  .forEach((el) => el.addEventListener('change', saveSettings));

$('#addCategory').addEventListener('click', async () => {
  const input = $('#newCatName');
  const name = input.value.trim();
  if (!name) return;
  const id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await patchCategoryState((s) => {
    s[id] = { name: name, enabled: true, added: [] };
  });
  input.value = '';
  flash(`Created category “${name}”`);
});

$('#clearSeen').addEventListener('click', async () => {
  await chrome.storage.local.set({ jpfSeen: {} });
  refreshSeenCount();
  flash('Seen-job history cleared');
});

$('#export').addEventListener('click', async () => {
  const data = await getSync();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'job-board-sweeper-settings.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const patch = {};
    if (data.jpfCategoryState && typeof data.jpfCategoryState === 'object') {
      patch.jpfCategoryState = data.jpfCategoryState;
    }
    // Legacy pre-0.3 exports: flat lists → a custom category.
    const legacy = Array.isArray(data.jpfPersonal)
      ? data.jpfPersonal
      : Array.isArray(data.jpfBlocklist)
        ? data.jpfBlocklist
        : null;
    if (legacy && legacy.length && !patch.jpfCategoryState) {
      patch.jpfCategoryState = {
        'custom-imported': { name: 'Imported', enabled: true, added: legacy.map(String) },
      };
    }
    if (data.jpfSettings && typeof data.jpfSettings === 'object') {
      patch.jpfSettings = { ...JPF_DEFAULTS.settings, ...data.jpfSettings };
    }
    if (!Object.keys(patch).length) throw new Error('no recognized keys in file');
    await chrome.storage.sync.set(patch);
    await load();
    flash('Imported');
  } catch (err) {
    flash('Import failed: ' + err.message);
  }
  e.target.value = '';
});

load();
