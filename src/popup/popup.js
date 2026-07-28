const $ = (s) => document.querySelector(s);

async function getSync() {
  return chrome.storage.sync.get({
    jpfSettings: JPF_DEFAULTS.settings,
    jpfCategoryState: {},
  });
}

async function patchCategoryState(mutate) {
  const { jpfCategoryState } = await getSync();
  mutate(jpfCategoryState);
  await chrome.storage.sync.set({ jpfCategoryState: jpfCategoryState });
  refresh();
}

function renderList(cs) {
  const cats = jpfCategoryList(cs);
  const ul = $('#blocklist');
  ul.textContent = '';
  let total = 0;

  for (const cat of cats) {
    const dis = new Set(cat.disabled.map(jpfKey));
    const shippedNorm = new Set(cat.shippedCompanies.map(jpfKey));
    const entries = [
      ...cat.shippedCompanies
        .filter((c) => !dis.has(jpfKey(c)))
        .map((name) => ({ name, kind: 'default' })),
      ...cat.added
        .filter((c) => !shippedNorm.has(jpfKey(c)))
        .map((name) => ({ name, kind: 'personal' })),
    ].sort((a, b) => a.name.localeCompare(b.name));
    total += cat.enabled ? entries.length : 0;

    const head = document.createElement('li');
    head.className = 'group-head' + (cat.enabled ? '' : ' off');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = cat.enabled;
    toggle.title = `Enable/disable “${cat.name}”`;
    toggle.addEventListener('change', () =>
      patchCategoryState((s) => {
        s[cat.id] = s[cat.id] || {};
        s[cat.id].enabled = toggle.checked;
        if (!cat.shipped) s[cat.id].name = cat.name;
      })
    );
    const label = document.createElement('span');
    label.textContent = cat.name;
    const count = document.createElement('em');
    count.className = 'tag';
    count.textContent = `${entries.length}`;
    head.append(toggle, label, count);
    ul.appendChild(head);

    for (const { name, kind } of entries) {
      const li = document.createElement('li');
      li.className = cat.enabled ? '' : 'off';
      const span = document.createElement('span');
      span.textContent = name;
      span.title = name;
      const tag = document.createElement('em');
      tag.className = 'tag';
      tag.textContent = kind === 'personal' ? 'you' : 'default';
      const btn = document.createElement('button');
      btn.textContent = '✕';
      btn.title = kind === 'personal' ? `Remove ${name}` : `Disable ${name} for you`;
      btn.addEventListener('click', () =>
        patchCategoryState((s) => {
          const st = (s[cat.id] = s[cat.id] || {});
          if (kind === 'personal') {
            st.added = (st.added || []).filter((x) => jpfKey(x) !== jpfKey(name));
          } else {
            st.disabled = [...(st.disabled || []), name];
          }
        })
      );
      li.append(span, tag, btn);
      ul.appendChild(li);
    }
  }
  $('#listCount').textContent = `${total} blocked compan${total === 1 ? 'y' : 'ies'} active`;
}

function renderCategorySelect(cs) {
  const sel = $('#categorySelect');
  const prev = sel.value;
  sel.textContent = '';
  for (const cat of jpfCategoryList(cs)) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

async function refresh() {
  const { jpfSettings, jpfCategoryState } = await getSync();
  $('#enabled').checked = !!jpfSettings.enabled;
  $('#reveal').checked = !!jpfSettings.revealMode;
  renderCategorySelect(jpfCategoryState);
  renderList(jpfCategoryState);
}

async function refreshStats() {
  const status = $('#status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'jpf-getStats' });
    if (res && res.ok) {
      status.textContent =
        `${res.host} - ${res.stats.blocked} blocked · ${res.stats.scanned} scanned`;
      return;
    }
  } catch (e) {
    // No content script in this tab - not a supported site.
  }
  status.textContent = 'Open LinkedIn, Indeed or Jobright to start filtering.';
}

async function patchSettings(patch) {
  const { jpfSettings } = await getSync();
  await chrome.storage.sync.set({ jpfSettings: { ...jpfSettings, ...patch } });
}

async function addCompany() {
  const input = $('#companyInput');
  const name = input.value.trim();
  const catId = $('#categorySelect').value;
  if (!name || !catId) return;
  const n = jpfKey(name);
  await patchCategoryState((s) => {
    const st = (s[catId] = s[catId] || {});
    const def = JPF_DEFAULTS.categories.find((c) => c.id === catId);
    if (def && def.companies.some((c) => jpfKey(c) === n)) {
      // Shipped entry - make sure it isn't disabled instead of duplicating.
      st.disabled = (st.disabled || []).filter((x) => jpfKey(x) !== n);
    } else if (!(st.added || []).some((x) => jpfKey(x) === n)) {
      st.added = [...(st.added || []), name];
    }
  });
  input.value = '';
}

async function startPicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { type: 'jpf-start-picker' });
    window.close();
  } catch (e) {
    $('#status').textContent = 'Picker only works on a supported job-site tab.';
  }
}

$('#enabled').addEventListener('change', (e) => patchSettings({ enabled: e.target.checked }));
$('#reveal').addEventListener('change', (e) => patchSettings({ revealMode: e.target.checked }));
$('#addBtn').addEventListener('click', addCompany);
$('#companyInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addCompany();
});
$('#pickBtn').addEventListener('click', startPicker);
$('#optionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('#version').textContent = 'v' + chrome.runtime.getManifest().version;
refresh();
refreshStats();
setInterval(refreshStats, 1500);
