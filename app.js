"use strict";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // PKCE: the email link returns a one-time ?code= instead of tokens in the URL.
  auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce" },
});

const DEFAULT_CATEGORIES = ["Food", "Transport", "Groceries", "Shopping", "Bills", "Health", "Fun", "Other"];
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  settings: { monthly_budget: null, categories: DEFAULT_CATEGORIES },
  viewMonth: firstOfMonth(new Date()),
  addCategory: null,
  addDateDefault: null, // the "today" the Add form's date was last reset to
  editing: null, // expense row being edited
  editCategory: null,
};

// ---------- dates ----------
function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function monthName(d) { return d.toLocaleDateString("en-MY", { month: "long", year: "numeric" }); }
function dayName(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" });
}

// ---------- ui helpers ----------
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}
function showError(err) {
  console.error(err);
  const offline = !navigator.onLine || /fetch|network/i.test(err?.message || "");
  toast(offline
    ? "Can't reach server. If unused for a week, the Supabase project may be paused."
    : err?.message || "Something went wrong");
}
function parseAmount(v) {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function renderChips(container, selected, onPick, list = state.settings.categories) {
  container.replaceChildren(...list.map((c) => {
    const b = el("button", "chip" + (c === selected ? " selected" : ""), c);
    b.type = "button";
    b.onclick = () => onPick(c);
    return b;
  }));
}
function entryRow(x) {
  const li = el("li", "entry");
  li.append(el("span", "cat", x.category), el("span", "note", x.note || ""), el("span", "amt", money.format(x.amount)));
  li.onclick = () => openEdit(x);
  return li;
}

// ---------- data ----------
async function listRange(from, to) {
  const { data, error } = await db.from("expenses")
    .select("*")
    .gte("spent_on", ymd(from))
    .lt("spent_on", ymd(to))
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((x) => ({ ...x, amount: Number(x.amount) }));
}
const listMonth = (m) => listRange(m, addMonths(m, 1));

async function addExpense(row) {
  const { error } = await db.from("expenses").insert(row);
  if (error) throw error;
}
async function updateExpense(id, row) {
  const { error } = await db.from("expenses").update(row).eq("id", id);
  if (error) throw error;
}
async function deleteExpense(id) {
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
async function getSettings() {
  const { data, error } = await db.from("settings").select("*").maybeSingle();
  if (error) throw error;
  if (data) return { ...data, monthly_budget: data.monthly_budget == null ? null : Number(data.monthly_budget) };
  const { data: created, error: e2 } = await db.from("settings").insert({}).select().single();
  if (e2) throw e2;
  return created;
}
async function saveSettings(patch) {
  const { error } = await db.from("settings").update(patch).eq("user_id", state.user.id);
  if (error) throw error;
  Object.assign(state.settings, patch);
}

// ---------- views ----------
function showView(name) {
  for (const v of ["add", "month", "settings"]) $("view-" + v).hidden = v !== name;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  if (name === "add") refreshAdd();
  if (name === "month") refreshMonth();
  if (name === "settings") renderSettings();
  window.scrollTo(0, 0);
}

async function refreshAdd() {
  const now = new Date();
  $("add-month").textContent = now.toLocaleDateString("en-MY", { month: "short", year: "numeric" });
  const pick = (c) => { state.addCategory = c; renderChips($("add-cats"), c, pick); };
  renderChips($("add-cats"), state.addCategory, pick);
  try {
    const rows = await listMonth(firstOfMonth(now));
    const today = ymd(now);
    const todays = rows.filter((x) => x.spent_on === today);
    $("today-total").textContent = money.format(todays.reduce((s, x) => s + x.amount, 0));
    $("month-total").textContent = money.format(rows.reduce((s, x) => s + x.amount, 0));
    $("today-list").replaceChildren(...(todays.length ? todays.map(entryRow) : [el("li", "empty", "Nothing yet today.")]));
  } catch (e) { showError(e); }
}

async function refreshMonth() {
  const m = state.viewMonth;
  $("month-label").textContent = monthName(m);
  $("next-month").disabled = m >= firstOfMonth(new Date());
  let rows;
  try { rows = await listMonth(m); } catch (e) { return showError(e); }

  const total = rows.reduce((s, x) => s + x.amount, 0);
  $("m-spent").textContent = money.format(total);

  const budget = state.settings.monthly_budget;
  $("budget-block").hidden = !budget;
  if (budget) {
    const pct = total / budget * 100;
    $("m-budget").textContent = money.format(budget);
    const bar = $("m-bar");
    bar.style.width = Math.min(pct, 100) + "%";
    bar.className = pct > 100 ? "over" : pct >= 80 ? "warn" : "";
    const left = budget - total;
    let msg = left >= 0 ? `${money.format(left)} left (${Math.round(pct)}% used)` : `${money.format(-left)} over budget`;
    const now = new Date();
    if (m.getTime() === firstOfMonth(now).getTime() && left > 0) {
      const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
      msg += ` · ${money.format(left / daysLeft)}/day for ${daysLeft} day${daysLeft > 1 ? "s" : ""}`;
    }
    $("m-left").textContent = msg;
  }

  const byCat = new Map();
  for (const x of rows) byCat.set(x.category, (byCat.get(x.category) || 0) + x.amount);
  const cats = [...byCat].sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 0;
  $("m-cats").replaceChildren(...(cats.length ? cats.map(([c, v]) => {
    const row = el("div", "row");
    const track = el("div", "track");
    const fill = el("div", "fill");
    fill.style.width = (v / max * 100) + "%";
    track.append(fill);
    row.append(el("span", "name", c), track, el("span", "val", `${money.format(v)} · ${Math.round(v / total * 100)}%`));
    return row;
  }) : [el("p", "empty", "No expenses this month.")]));

  const byDay = new Map();
  for (const x of rows) (byDay.get(x.spent_on) || byDay.set(x.spent_on, []).get(x.spent_on)).push(x);
  $("m-days").replaceChildren(...[...byDay].map(([d, xs]) => {
    const box = el("div", "day");
    const head = el("div", "day-head");
    head.append(el("span", null, dayName(d)), el("span", null, money.format(xs.reduce((s, x) => s + x.amount, 0))));
    const ul = el("ul", "entries");
    ul.append(...xs.map(entryRow));
    box.append(head, ul);
    return box;
  }));
}

function renderSettings() {
  $("budget").value = state.settings.monthly_budget ?? "";
  $("who").textContent = state.user?.email || "";
  $("cat-list").replaceChildren(...state.settings.categories.map((c, i) => {
    const li = el("li");
    const rename = el("button", "btn", "Rename");
    const remove = el("button", "btn danger", "Remove");
    rename.onclick = async () => {
      const name = prompt("Rename category", c)?.trim();
      if (!name || name === c) return;
      if (state.settings.categories.includes(name)) return toast("That category already exists");
      const next = [...state.settings.categories];
      next[i] = name;
      try {
        // Relabel past entries first: if this fails, the list still has the old name.
        const { error } = await db.from("expenses").update({ category: name }).eq("category", c);
        if (error) throw error;
        await saveSettings({ categories: next });
        if (state.addCategory === c) state.addCategory = name;
        renderSettings();
      } catch (e) { showError(e); }
    };
    remove.onclick = async () => {
      if (state.settings.categories.length <= 1) return toast("Keep at least one category");
      if (!confirm(`Remove "${c}"? Past entries keep this label.`)) return;
      try {
        await saveSettings({ categories: state.settings.categories.filter((x) => x !== c) });
        if (state.addCategory === c) state.addCategory = null;
        renderSettings();
      } catch (e) { showError(e); }
    };
    li.append(el("span", null, c), rename, remove);
    return li;
  }));
}

// ---------- edit sheet ----------
function openEdit(x) {
  state.editing = x;
  state.editCategory = x.category;
  $("edit-amount").value = x.amount.toFixed(2);
  $("edit-note").value = x.note || "";
  $("edit-date").value = x.spent_on;
  // A renamed/removed category still shows, and stays pickable, so the entry isn't silently changed.
  const cats = state.settings.categories;
  const list = cats.includes(x.category) ? cats : [x.category, ...cats];
  const pick = (c) => { state.editCategory = c; renderChips($("edit-cats"), c, pick, list); };
  renderChips($("edit-cats"), x.category, pick, list);
  $("sheet").hidden = false;
}
function closeEdit() { $("sheet").hidden = true; state.editing = null; }
function resetAddDate() {
  state.addDateDefault = ymd(new Date());
  $("add-date").value = state.addDateDefault;
}
function refreshCurrent() {
  if (!$("view-month").hidden) refreshMonth(); else refreshAdd();
}

// ---------- events ----------
function wireEvents() {
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => showView(b.dataset.view)));

  $("add-form").onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseAmount($("add-amount").value);
    if (!amount) return toast("Enter an amount");
    if (!state.addCategory) return toast("Pick a category");
    const btn = e.submitter; btn.disabled = true;
    try {
      await addExpense({
        amount,
        category: state.addCategory,
        note: $("add-note").value.trim() || null,
        spent_on: $("add-date").value || ymd(new Date()),
      });
      toast(`Saved ${money.format(amount)} · ${state.addCategory}`);
      $("add-amount").value = "";
      $("add-note").value = "";
      resetAddDate();
      state.addCategory = null;
      refreshAdd();
    } catch (err) { showError(err); }
    finally { btn.disabled = false; }
  };

  $("prev-month").onclick = () => { state.viewMonth = addMonths(state.viewMonth, -1); refreshMonth(); };
  $("next-month").onclick = () => { state.viewMonth = addMonths(state.viewMonth, 1); refreshMonth(); };

  $("edit-close").onclick = closeEdit;
  $("sheet").onclick = (e) => { if (e.target === $("sheet")) closeEdit(); };
  $("edit-form").onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseAmount($("edit-amount").value);
    if (!amount) return toast("Enter an amount");
    const btn = e.submitter; btn.disabled = true;
    try {
      await updateExpense(state.editing.id, {
        amount,
        category: state.editCategory,
        note: $("edit-note").value.trim() || null,
        spent_on: $("edit-date").value || state.editing.spent_on,
      });
      closeEdit();
      toast("Updated");
      refreshCurrent();
    } catch (err) { showError(err); }
    finally { btn.disabled = false; }
  };
  $("edit-delete").onclick = async () => {
    if (!confirm("Delete this expense?")) return;
    try {
      await deleteExpense(state.editing.id);
      closeEdit();
      toast("Deleted");
      refreshCurrent();
    } catch (err) { showError(err); }
  };

  $("budget-form").onsubmit = async (e) => {
    e.preventDefault();
    const raw = $("budget").value.trim();
    const value = raw ? parseAmount(raw) : null;
    if (raw && !value) return toast("Enter a valid amount");
    try { await saveSettings({ monthly_budget: value }); toast("Budget saved"); } catch (err) { showError(err); }
  };
  $("cat-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = $("new-cat").value.trim();
    if (!name) return;
    if (state.settings.categories.includes(name)) return toast("That category already exists");
    try {
      await saveSettings({ categories: [...state.settings.categories, name] });
      $("new-cat").value = "";
      renderSettings();
    } catch (err) { showError(err); }
  };
  $("export").onclick = exportCsv;
  $("signout").onclick = async () => { await db.auth.signOut(); location.reload(); };

  // Sign-in. Free Supabase can't put a code in the email, so the email carries
  // a link back to this page; supabase-js picks the session up from the URL.
  $("signin-form").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("email").value.trim();
    $("signin-msg").textContent = "Sending…";
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname },
    });
    // Same message whether or not the account exists, so the page doesn't reveal which emails have one.
    if (error) console.warn(error);
    $("signin-msg").textContent = error && /rate limit/i.test(error.message)
      ? "Too many emails sent. Wait a few minutes and try again."
      : `If ${email} has an account, a sign-in link is on its way. Open it on this device, in this browser.`;
  };
  $("password-signin").onclick = async () => {
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) return ($("signin-msg").textContent = "Enter your email and password.");
    $("signin-msg").textContent = "Signing in…";
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn(error);
      $("signin-msg").textContent = "Wrong email or password, or no password set yet.";
    }
  };
  $("password-form").onsubmit = async (e) => {
    e.preventDefault();
    const password = $("new-password").value;
    if (password.length < 6) return toast("Use at least 6 characters");
    const { error } = await db.auth.updateUser({ password });
    if (error) return showError(error);
    $("new-password").value = "";
    toast("Password set");
  };

  // Totals, and the Add form's date, may be stale after the phone wakes the app up.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !state.user) return;
    if ($("add-date").value === state.addDateDefault) resetAddDate(); // leave a hand-picked date alone
    refreshCurrent();
  });
}

async function exportCsv() {
  try {
    // Supabase caps each response at 1,000 rows, so fetch in pages.
    const PAGE = 1000;
    const data = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await db.from("expenses")
        .select("spent_on,category,amount,note")
        .order("spent_on").order("created_at").order("id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      data.push(...page);
      if (page.length < PAGE) break;
    }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["date,category,amount,note", ...data.map((x) => [x.spent_on, x.category, x.amount, x.note].map(esc).join(","))].join("\n");
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `expenses-${ymd(new Date())}.csv`;
    a.click();
    // Revoking straight away can cancel the download in iOS Safari.
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) { showError(e); }
}

// ---------- boot ----------
async function onSignedIn(user) {
  state.user = user;
  if (location.search || location.hash) history.replaceState(null, "", location.pathname); // drop the sign-in code from the URL
  $("signin").hidden = true;
  $("app").hidden = false;
  resetAddDate();
  try { state.settings = await getSettings(); } catch (e) { showError(e); }
  showView("add");
}
function onSignedOut() {
  state.user = null;
  $("app").hidden = true;
  $("signin").hidden = false;
  // An expired or already-used email link comes back with ?error=... or #error=...
  // Show a fixed message rather than echoing URL text, which anyone can craft.
  const params = new URLSearchParams(location.search + "&" + location.hash.slice(1));
  if (params.get("error") || params.get("code")) {
    $("signin-msg").textContent = "That sign-in link has expired or was opened in a different browser. Send a new link.";
    history.replaceState(null, "", location.pathname);
  }
}

wireEvents();
// Defer work out of the auth callback: supabase-js deadlocks if it awaits
// other client calls from inside it.
db.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    if (session?.user && !state.user) onSignedIn(session.user);
    else if (!session) onSignedOut();
  }, 0);
});
