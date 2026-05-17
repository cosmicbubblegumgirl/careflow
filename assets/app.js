const CAREFLOW = {
  slug: "careflow",
  demoUsers: [
    { id: "u-1", name: "Simone Govender", email: "simone@careflow.demo", password: "demo123", role: "Product designer" },
    { id: "u-2", name: "Nurse Lead", email: "nurse.lead@careflow.demo", password: "triage123", role: "Triage coordinator" }
  ],
  outcomes: ["Monitor", "Review", "Escalate"]
};

const keys = {
  theme: "careflow-theme",
  session: "careflow-session",
  saved: "careflow-saved-escalations",
  db: "careflow-local-db"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}

function priorityFor(score) {
  const value = Number(score) || 0;
  if (value >= 78) return "high";
  if (value >= 60) return "medium";
  return "low";
}

function priorityLabel(score) {
  return { high: "Escalate", medium: "Review", low: "Monitor" }[priorityFor(score)];
}

function getTheme() {
  return localStorage.getItem(keys.theme) || "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = $("[data-theme-toggle]");
  if (button) button.textContent = theme === "dark" ? "Light" : "Dark";
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(keys.session) || "null");
  } catch {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem(keys.session, JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    signedInAt: new Date().toISOString()
  }));
  renderSession();
}

function clearSession() {
  localStorage.removeItem(keys.session);
  renderSession();
}

function renderSession() {
  const session = getSession();
  $$("[data-session-pill]").forEach((item) => {
    item.textContent = session ? session.name : "Guest mode";
  });
  $$("[data-session-detail]").forEach((item) => {
    item.innerHTML = session
      ? `<p><strong>${escapeHtml(session.name)}</strong><br>${escapeHtml(session.role)}<br>${escapeHtml(session.email)}</p>`
      : "<p>No active session.</p>";
  });
  $$("[data-auth-required]").forEach((item) => {
    item.classList.toggle("is-locked", !session);
  });
}

async function fetchData() {
  const response = await fetch("api/data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load CareFlow data");
  return response.json();
}

function savedRecords() {
  try {
    return JSON.parse(localStorage.getItem(keys.saved) || "[]");
  } catch {
    return [];
  }
}

function setSavedRecords(records) {
  localStorage.setItem(keys.saved, JSON.stringify(records.slice(0, 12)));
}

function localDb() {
  try {
    return JSON.parse(localStorage.getItem(keys.db) || "[]");
  } catch {
    return [];
  }
}

function setLocalDb(records) {
  localStorage.setItem(keys.db, JSON.stringify(records));
}

function normalizeRecord(record, index = 0) {
  const score = Number(record.score || 70);
  return {
    id: record.id || `careflow-local-${Date.now()}-${index}`,
    title: record.title || "Clinical case",
    status: record.status || priorityLabel(score),
    owner: record.owner || "Command nurse",
    score,
    trend: record.trend || priorityLabel(score),
    updated: record.updated || "just now",
    demoSeed: record.demoSeed === true
  };
}

function recordCard(record) {
  const row = normalizeRecord(record);
  const level = priorityFor(row.score);
  return `<article class="triage-card ${level}">
    <header><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.updated)}</small></header>
    <p>${escapeHtml(row.status)} assigned to ${escapeHtml(row.owner)}.</p>
    <progress max="100" value="${row.score}"></progress>
    <div class="tags"><span>${priorityLabel(row.score)}</span><span>${row.score}% acuity</span><span>${escapeHtml(row.trend)}</span></div>
  </article>`;
}

function renderKpis(data) {
  const metrics = [
    { label: "Active cases", value: String((data.records || []).length), delta: "100 seeded" },
    { label: "Escalations", value: String((data.records || []).filter((item) => Number(item.score) >= 78).length), delta: "high acuity" },
    { label: "Avg acuity", value: `${Math.round((data.records || []).reduce((sum, item) => sum + Number(item.score || 0), 0) / Math.max(1, (data.records || []).length))}%`, delta: "live model" },
    { label: "Backend", value: "Hybrid", delta: "Pages + Node" }
  ];
  $$("[data-kpis]").forEach((target) => {
    target.innerHTML = metrics.map((metric) => `<article class="metric-card"><span>${metric.label}</span><strong>${metric.value}</strong><p>${metric.delta}</p></article>`).join("");
  });
}

function renderCapacity(records) {
  const high = records.filter((item) => Number(item.score) >= 78).length;
  const medium = records.filter((item) => Number(item.score) >= 60 && Number(item.score) < 78).length;
  const low = records.length - high - medium;
  const capacity = [
    { label: "Emergency beds", value: Math.min(96, 54 + high) },
    { label: "Triage nurses", value: Math.min(100, 62 + Math.round(medium / 2)) },
    { label: "Imaging queue", value: Math.min(100, 34 + low) }
  ];
  $$("[data-capacity]").forEach((target) => {
    target.innerHTML = capacity.map((item) => `<article class="capacity-meter"><strong>${item.label}<span>${item.value}%</span></strong><progress max="100" value="${item.value}"></progress></article>`).join("");
  });
  $$("[data-bed-map]").forEach((target) => {
    target.innerHTML = Array.from({ length: 16 }, (_, index) => `<span style="--fill:${25 + ((index * 9 + high) % 70)}%"></span>`).join("");
  });
}

function renderRecords(records) {
  const sorted = [...records].map(normalizeRecord).sort((a, b) => Number(b.score) - Number(a.score));
  $$("[data-records]").forEach((target) => {
    target.dataset.records = JSON.stringify(sorted);
    target.innerHTML = sorted.slice(0, 12).map(recordCard).join("");
  });
  const lanes = {
    high: sorted.filter((item) => priorityFor(item.score) === "high"),
    medium: sorted.filter((item) => priorityFor(item.score) === "medium"),
    low: sorted.filter((item) => priorityFor(item.score) === "low")
  };
  Object.entries(lanes).forEach(([lane, items]) => {
    $$(`[data-lane="${lane}"]`).forEach((target) => {
      target.innerHTML = items.slice(0, 9).map(recordCard).join("");
    });
  });
}

function renderActivity(data) {
  const activity = data.activity || [];
  $$("[data-live-panel]").forEach((target) => {
    target.innerHTML = activity.map((item) => `<article class="activity-card"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.kind)} updated ${escapeHtml(item.time)} ago</p></article>`).join("");
  });
}

function renderChart(records) {
  const top = [...records].map(normalizeRecord).sort((a, b) => b.score - a.score).slice(0, 14);
  $$("[data-chart]").forEach((target) => {
    target.innerHTML = top.map((item) => `<div class="chart-bar" style="width:${Math.max(28, item.score)}%">${item.score}% ${escapeHtml(item.title)}</div>`).join("");
  });
}

function renderApiPreview(data) {
  const preview = {
    product: "CareFlow",
    backend: {
      githubPages: "api/data.json and api/users.json",
      localNode: "server/server.js exposes /api/health, /api/login, and /api/records"
    },
    database: "careflow_triage_cases",
    records: (data.records || []).slice(0, 3)
  };
  $$("[data-api-preview]").forEach((target) => {
    target.textContent = JSON.stringify(preview, null, 2);
  });
}

function renderVitals(records) {
  const top = [...records].map(normalizeRecord).sort((a, b) => b.score - a.score)[0];
  const second = [...records].map(normalizeRecord).sort((a, b) => b.score - a.score)[1];
  const third = [...records].map(normalizeRecord).sort((a, b) => b.score - a.score)[2];
  if ($("[data-vital-one]")) $("[data-vital-one]").textContent = top ? `${top.score}% acuity` : "Stable";
  if ($("[data-vital-two]")) $("[data-vital-two]").textContent = second ? second.status : "Missing context";
  if ($("[data-vital-three]")) $("[data-vital-three]").textContent = third ? third.owner : "Command nurse";
}

function ensureDb(records) {
  if (!localStorage.getItem(keys.db)) {
    setLocalDb(records.map(normalizeRecord));
  }
}

function renderDb() {
  const body = $("[data-db-rows]");
  if (!body) return;
  let records = localDb().map(normalizeRecord);
  const query = ($("[data-db-search]")?.value || "").toLowerCase();
  const sort = $("[data-db-sort]")?.value || "score";
  if (query) {
    records = records.filter((item) => `${item.id} ${item.title} ${item.status} ${item.owner}`.toLowerCase().includes(query));
  }
  records.sort((a, b) => {
    if (sort === "score") return b.score - a.score;
    if (sort === "title") return a.title.localeCompare(b.title);
    return a.status.localeCompare(b.status);
  });
  body.innerHTML = records.slice(0, 100).map((item) => `<tr>
    <td>${escapeHtml(item.id)}</td>
    <td><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.updated)}</small></td>
    <td>${escapeHtml(item.status)}</td>
    <td>${escapeHtml(item.owner)}</td>
    <td>${item.score}%</td>
    <td><button type="button" data-delete-record="${escapeHtml(item.id)}">Delete</button></td>
  </tr>`).join("");
  $$("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!getSession()) {
        const status = $("[data-db-form-status]");
        if (status) status.textContent = "Sign in before deleting records.";
        return;
      }
      setLocalDb(localDb().filter((item) => item.id !== button.dataset.deleteRecord));
      renderDb();
    });
  });
}

function renderSaved() {
  $$("[data-saved-records]").forEach((target) => {
    const rows = savedRecords();
    target.innerHTML = rows.length ? rows.map(recordCard).join("") : "<p>No saved escalations yet.</p>";
  });
}

function calculateDemo() {
  const inputs = $$("[data-demo-input]");
  if (!inputs.length) return;
  const average = Math.round(inputs.reduce((sum, input) => sum + Number(input.value), 0) / inputs.length);
  const result = $("[data-demo-result]");
  const outcome = $("[data-outcome]");
  if (result) result.textContent = `${average}%`;
  if (outcome) outcome.textContent = priorityLabel(average);
}

function setupForms(data) {
  $$("[data-demo-input]").forEach((input) => input.addEventListener("input", calculateDemo));
  calculateDemo();

  const triageForm = $("[data-triage-form]");
  if (triageForm) {
    triageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const average = Math.round($$("[data-demo-input]").reduce((sum, input) => sum + Number(input.value), 0) / 3);
      const row = normalizeRecord({
        id: `careflow-escalation-${Date.now()}`,
        title: "Command center escalation",
        status: priorityLabel(average),
        owner: getSession()?.name || "Guest command user",
        score: average,
        trend: average >= 78 ? "High attention" : "In progress",
        updated: "saved locally"
      });
      setSavedRecords([row, ...savedRecords()]);
      renderSaved();
      const status = $("[data-form-status]");
      if (status) status.textContent = "Escalation saved to browser storage.";
    });
  }

  const dbForm = $("[data-db-form]");
  if (dbForm) {
    dbForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!getSession()) {
        const status = $("[data-db-form-status]");
        if (status) status.textContent = "Sign in before saving database records.";
        return;
      }
      const form = new FormData(dbForm);
      const score = Number(form.get("score") || 80);
      const row = normalizeRecord({
        id: `careflow-custom-${String(Date.now()).slice(-6)}`,
        title: form.get("title"),
        status: form.get("status"),
        owner: form.get("owner"),
        score,
        trend: priorityLabel(score),
        updated: "just now",
        demoSeed: false
      });
      setLocalDb([row, ...localDb()]);
      dbForm.reset();
      dbForm.score.value = 88;
      const status = $("[data-db-form-status]");
      if (status) status.textContent = "Case saved to local database.";
      renderDb();
      renderRecords(localDb());
    });
  }

  $$("[data-db-search], [data-db-sort]").forEach((item) => item.addEventListener("input", renderDb));
  $("[data-db-reset]")?.addEventListener("click", () => {
    localStorage.removeItem(keys.db);
    ensureDb(data.records || []);
    renderDb();
  });
  $("[data-db-export]")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(localDb(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "careflow-triage-database.json";
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

function setupSearch() {
  $$("[data-record-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const target = $("[data-records]");
      if (!target) return;
      const rows = JSON.parse(target.dataset.records || "[]");
      const query = input.value.toLowerCase();
      const filtered = rows.filter((item) => `${item.title} ${item.status} ${item.owner} ${item.trend}`.toLowerCase().includes(query));
      target.innerHTML = filtered.slice(0, 12).map(recordCard).join("") || "<p>No cases match that search.</p>";
    });
  });
}

function setupLogin() {
  $$("[data-demo-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = $("[data-login-form]");
      if (!form) return;
      form.email.value = button.dataset.demoUser;
      form.password.value = button.dataset.demoPassword;
    });
  });
  $("[data-login-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const user = CAREFLOW.demoUsers.find((item) => item.email.toLowerCase() === form.email.value.trim().toLowerCase() && item.password === form.password.value);
    const status = $("[data-login-status]");
    if (!user) {
      if (status) status.textContent = "No matching demo account. Use one of the listed credentials.";
      return;
    }
    setSession(user);
    if (status) status.textContent = `Signed in as ${user.name}.`;
  });
  $$("[data-logout]").forEach((button) => button.addEventListener("click", () => {
    clearSession();
    const status = $("[data-login-status]");
    if (status) status.textContent = "Session cleared.";
  }));
}

function setupClock() {
  const tick = () => {
    const now = new Date();
    $$("[data-clock]").forEach((target) => {
      target.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    });
  };
  tick();
  setInterval(tick, 1000);
}

async function checkBackend() {
  if (!["localhost", "127.0.0.1"].includes(location.hostname)) return "Published mode: static API and browser database";
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json();
    return data.ok ? "Local Node API online" : "Static mode";
  } catch {
    return "Static mode: run npm start for local API";
  }
}

async function init() {
  applyTheme(getTheme());
  $("[data-theme-toggle]")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(keys.theme, next);
    applyTheme(next);
  });
  renderSession();
  setupLogin();
  setupClock();

  try {
    const data = await fetchData();
    const records = (data.records || []).map(normalizeRecord);
    ensureDb(records);
    renderKpis(data);
    renderCapacity(records);
    renderRecords(records);
    renderActivity(data);
    renderChart(records);
    renderVitals(records);
    renderApiPreview(data);
    renderDb();
    renderSaved();
    setupForms(data);
    setupSearch();
    const mode = await checkBackend();
    $$("[data-api-preview]").forEach((target) => {
      const preview = JSON.parse(target.textContent || "{}");
      preview.backendStatus = mode;
      target.textContent = JSON.stringify(preview, null, 2);
    });
  } catch (error) {
    console.error(error);
  }
}

init();
