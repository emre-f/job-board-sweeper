const $ = (s) => document.querySelector(s);

async function getSync() {
  return chrome.storage.sync.get({
    jpfSettings: JPF_DEFAULTS.settings,
    jpfCategoryState: {},
    jpfTimeouts: {},
  });
}

function flash(text) {
  const el = $('#flash');
  el.textContent = text;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => (el.textContent = ''), 2500);
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

// ---------- timeout bucket ----------

async function patchTimeouts(mutate) {
  const { jpfTimeouts } = await getSync();
  const next = mutate(jpfTimeouts) || jpfTimeouts;
  try {
    await chrome.storage.sync.set({ jpfTimeouts: next });
  } catch (err) {
    flash('Could not save: ' + err.message);
  }
  renderTimeouts((await getSync()).jpfTimeouts);
}

function renderTimeouts(timeouts) {
  const wrap = $('#timeouts');
  wrap.textContent = '';
  const now = Date.now();
  const entries = Object.entries(timeouts)
    .filter(([, exp]) => exp > now)
    .sort((a, b) => a[1] - b[1]);
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No companies in timeout.';
    wrap.appendChild(empty);
    return;
  }
  for (const [company, exp] of entries) {
    const row = document.createElement('div');
    row.className = 'timeout-row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = company;
    name.title = company;
    // Days left is editable: changing it moves the end date to now + N days.
    const days = document.createElement('input');
    days.type = 'number';
    days.min = '1';
    days.max = '1825';
    days.value = String(jpfDaysLeft(exp, now));
    days.title = 'Days left - change to extend or shorten';
    days.addEventListener('change', () => {
      const d = jpfCleanDays(days.value, 0);
      if (!d) return renderTimeouts(timeouts);
      patchTimeouts((t) => {
        delete t[company];
        return jpfSetTimeout(t, company, d);
      });
    });
    const unit = document.createElement('span');
    unit.textContent = 'days left';
    const until = document.createElement('span');
    until.className = 'until';
    until.textContent = 'until ' + new Date(exp).toLocaleDateString();
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = 'Remove';
    rm.title = `End the timeout for ${company}`;
    rm.addEventListener('click', () => patchTimeouts((t) => void delete t[company]));
    row.append(name, days, unit, until, rm);
    wrap.appendChild(row);
  }
}

function addTimeout() {
  const input = $('#timeoutName');
  const company = input.value.trim();
  if (!company) return;
  const d = jpfCleanDays($('#timeoutAddDays').value, jpfCleanDays($('#timeoutDays').value, 90));
  patchTimeouts((t) => jpfSetTimeout(t, company, d));
  input.value = '';
  flash(`“${company}” is in timeout for ${d} days`);
}

// The timeout add-row lives inside #settingsForm - never let Enter submit it.
$('#settingsForm').addEventListener('submit', (e) => e.preventDefault());
$('#timeoutAdd').addEventListener('click', addTimeout);
$('#timeoutName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTimeout();
});
for (const d of JPF_DEFAULTS.timeoutPresets) {
  const o = document.createElement('option');
  o.value = String(d);
  $('#timeoutPresets').appendChild(o);
}

async function load() {
  const sync = await getSync();
  const s = { ...JPF_DEFAULTS.settings, ...sync.jpfSettings };
  $('#enabled').checked = !!s.enabled;
  $('#blockedAction').value = s.blockedAction;
  $('#revealMode').checked = !!s.revealMode;
  $('#timeoutDays').value = String(jpfCleanDays(s.timeoutDays, 90));
  $('#timeoutAddDays').value = $('#timeoutDays').value;
  $('#debug').checked = !!s.debug;
  renderCategories(sync.jpfCategoryState);
  const { timeouts, changed } = jpfPruneTimeouts(sync.jpfTimeouts);
  if (changed) await chrome.storage.sync.set({ jpfTimeouts: timeouts });
  renderTimeouts(timeouts);
}

async function saveSettings() {
  const timeoutDays = jpfCleanDays($('#timeoutDays').value, JPF_DEFAULTS.settings.timeoutDays);
  $('#timeoutDays').value = String(timeoutDays);
  $('#timeoutAddDays').value = String(timeoutDays);
  const settings = {
    enabled: $('#enabled').checked,
    blockedAction: $('#blockedAction').value,
    revealMode: $('#revealMode').checked,
    timeoutDays,
    debug: $('#debug').checked,
  };
  await chrome.storage.sync.set({ jpfSettings: settings });
  flash('Settings saved');
}

document
  .querySelectorAll('#settingsForm input:not(.cat-add input), #settingsForm select')
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
    // jpfTimeouts is new in 0.5 - older exports simply don't have it.
    if (data.jpfTimeouts && typeof data.jpfTimeouts === 'object') {
      patch.jpfTimeouts = jpfPruneTimeouts(data.jpfTimeouts).timeouts;
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
