# QA check

Date: 31 Oct 2026
App: https://mymaples.github.io/daily-expenses/
Supabase project: `daily-expenses` (`qktcdsvhxnjpblmknyxn`)
Fix commit: `4e864a0` "Fix QA issues: full CSV backup, stale add date, category edits" (pushed to `main`)

How it was checked: read all the code, checked the live Supabase project (security and performance advisors, row-level security policies), and loaded the live page in a browser. The signed-in screens were not tested in a browser because that needs the account's login.

## Passed
- **Data access is locked down.** Row-level security is on for `expenses` (select/insert/update/delete) and `settings` (select/insert/update), and matches `supabase/schema.sql`. A request with only the public key returned `[]` while the table holds one row.
- **The live page loads cleanly:** no console errors. The Supabase library is loaded with an integrity checksum.
- **Supabase performance advisor:** no issues.

## Issues

| # | Severity | Issue | Where | Status |
|---|----------|-------|-------|--------|
| 1 | High | CSV backup stops at 1,000 rows | `app.js` `exportCsv` | Fixed |
| 2 | Medium | Add form date goes stale overnight | `app.js` `onSignedIn`, `visibilitychange` | Fixed |
| 3 | Low | Renamed/removed category stays selected on the Add form | `app.js` `renderSettings` | Fixed |
| 4 | Low | Backup download may fail on iPhone Safari | `app.js` `exportCsv` | Fixed |
| 5 | Low | Edit sheet: Save can be tapped twice; a removed category can't be picked again | `app.js` `openEdit`, `edit-form` | Fixed |
| 6 | Low | Category rename isn't all-or-nothing | `app.js` `renderSettings` | Fixed |
| 7 | Low | Leaked password protection is off | Supabase Auth settings | Open (dashboard setting, not code) |
| 8 | Info | Deprecated `apple-mobile-web-app-capable` meta tag | `index.html` | Fixed |
| 9 | Info | No offline support | — | Not planned |

---

## 1. CSV backup stops at 1,000 rows — Fixed

**Problem.** Settings → "Download backup (CSV)" calls `exportCsv`, which fetched every expense in one request:
```js
const { data, error } = await db.from("expenses").select("spent_on,category,amount,note").order("spent_on");
```
Supabase's API returns at most 1,000 rows per request by default (the project's "Max rows" setting). It doesn't report an error when it cuts the list short. So once there are more than 1,000 expenses (about a year at three a day), the backup silently leaves out the newest ones, and the gap would only be found when the backup is needed.

**Fix steps** (`app.js`, `exportCsv`):
1. Added a page size constant `PAGE = 1000`, matching Supabase's cap.
2. Replaced the single request with a loop that asks for one page at a time using `.range(from, from + PAGE - 1)`, starting at `from = 0` and moving forward by 1,000 each time.
3. Each page's rows are appended to one `data` array.
4. The loop stops when a page comes back with fewer than 1,000 rows, which means it was the last page.
5. Made the sort order fully fixed with `.order("spent_on").order("created_at").order("id")`. With only `spent_on`, rows on the same day have no fixed order, so separate page requests could skip or repeat a row at the page boundary. `id` is unique, so the order is always the same.
6. If any page fails, the error is thrown as before and shown as a toast, so a partial backup is never downloaded.
7. The CSV-building code below the loop is unchanged.

Code after the fix:
```js
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
```

**Verified.** In the browser, the database call was replaced with a fake that holds 2,500 rows. `exportCsv` requested three pages (rows 0–999, 1000–1999, 2000–2999) and the CSV had 2,501 lines (header + 2,500 rows).

---

## 2. Add form date goes stale overnight — Fixed

**Problem.** The Add form's date field (`add-date`) was set to today in only two places: at sign-in (`onSignedIn`) and after saving an expense. A home-screen app on a phone is often never closed, only put in the background. If it was last used in the evening and reopened the next morning, the date field still showed yesterday, and a new expense was saved under yesterday.

**Fix steps** (`app.js`):
1. Added `addDateDefault` to `state`. It remembers which "today" the date field was last set to automatically.
2. Added a helper `resetAddDate()`, which sets both `state.addDateDefault` and the field to today's date:
   ```js
   function resetAddDate() {
     state.addDateDefault = ymd(new Date());
     $("add-date").value = state.addDateDefault;
   }
   ```
3. Replaced the two existing `$("add-date").value = ymd(new Date());` lines, in `onSignedIn` and in the Add form's save handler, with `resetAddDate()`.
4. Changed the `visibilitychange` listener, which runs when the app comes back to the screen:
   - If the field still holds the automatic date (`$("add-date").value === state.addDateDefault`), call `resetAddDate()` to move it to today.
   - If the field holds a different date, it was picked by hand (for example, entering last week's receipt), so it is left alone.
   - Then refresh the totals as before.
   ```js
   document.addEventListener("visibilitychange", () => {
     if (document.visibilityState !== "visible" || !state.user) return;
     if ($("add-date").value === state.addDateDefault) resetAddDate(); // leave a hand-picked date alone
     refreshCurrent();
   });
   ```

**Verified.** In the browser, with the default date set to 30 Oct and the field showing 30 Oct, firing the "app visible" event moved the field to 31 Oct. With the field set by hand to 15 Oct, the same event left it at 15 Oct.

---

## 3. Renamed/removed category stays selected on the Add form — Fixed

**Problem.** The Add form keeps the picked category in `state.addCategory`. If that category was renamed or removed in Settings before saving:
- The chips were redrawn from the new category list, so no chip looked selected.
- `state.addCategory` still held the old name, so Save went through without asking for a category and stored the expense under a name that no longer existed in the list.

**Fix steps** (`app.js`, `renderSettings`):
1. In the **Rename** button handler, after the rename is saved: if the Add form's picked category was the renamed one, switch it to the new name:
   ```js
   if (state.addCategory === c) state.addCategory = name;
   ```
2. In the **Remove** button handler, after the removal is saved: if the Add form's picked category was the removed one, clear it, so Save asks "Pick a category" again:
   ```js
   if (state.addCategory === c) state.addCategory = null;
   ```
3. Both changes run only after the save succeeds, so a failed save leaves the selection as it was.

**Verified.** Code review only; this needs a signed-in session to try in the browser (see "Still to check on the phone").

---

## 4. Backup download may fail on iPhone Safari — Fixed

**Problem.** `exportCsv` builds the CSV as an in-memory file (`URL.createObjectURL`), clicks a hidden link to download it, then immediately deleted the in-memory file with `URL.revokeObjectURL`. iOS Safari starts the download slightly after the click, so the file could already be gone and the download would fail or be empty.

**Fix steps** (`app.js`, `exportCsv`):
1. Replaced the immediate `URL.revokeObjectURL(a.href);` with a one-second delay, which gives Safari time to start the download while still freeing the memory:
   ```js
   a.click();
   // Revoking straight away can cancel the download in iOS Safari.
   setTimeout(() => URL.revokeObjectURL(a.href), 1000);
   ```

**Verified.** Code review; the stubbed export test in issue 1 ran through this code without errors. A real download on an iPhone hasn't been tried yet.

---

## 5. Edit sheet: double save, and a removed category can't be picked again — Fixed

**Problem A: Save can be tapped twice.** The edit sheet's Save button stayed active while the update was being sent, so a double tap sent two updates. The Add form already disabled its button while saving; the edit sheet didn't.

**Problem B: a removed category disappears.** When editing an entry whose category had since been removed from Settings, the sheet added that old category as an extra chip in front of the list so the entry wasn't silently changed. But the chip was added outside the normal chip drawing, with no click handler. Tapping any other category redrew the chips from the Settings list only, so the old chip vanished and couldn't be picked again without closing the sheet.

**Fix steps** (`app.js`):
1. **`renderChips`:** added an optional fourth parameter, `list`, which defaults to `state.settings.categories`. Other callers (the Add form) are unchanged because they don't pass it.
   ```js
   function renderChips(container, selected, onPick, list = state.settings.categories) {
     container.replaceChildren(...list.map((c) => { ... }));
   }
   ```
2. **`openEdit`:** removed the code that prepended a separate, unclickable chip. Instead, build the chip list once when the sheet opens: the Settings categories, plus the entry's own category at the front if it is no longer in Settings:
   ```js
   const cats = state.settings.categories;
   const list = cats.includes(x.category) ? cats : [x.category, ...cats];
   ```
3. Passed that same `list` both when first drawing the chips and every time a chip is picked, so the old category stays in the list and stays clickable while the sheet is open:
   ```js
   const pick = (c) => { state.editCategory = c; renderChips($("edit-cats"), c, pick, list); };
   renderChips($("edit-cats"), x.category, pick, list);
   ```
4. **Edit form submit handler:** disabled the Save button (`e.submitter`) before sending the update and re-enabled it in a `finally` block, so it comes back even if the save fails. This matches how the Add form already works:
   ```js
   const btn = e.submitter; btn.disabled = true;
   try { ... } catch (err) { showError(err); }
   finally { btn.disabled = false; }
   ```

**Verified.** In the browser, with Settings categories `Food, Transport`, opening an entry with category `Old` showed `Old*, Food, Transport` (`*` = selected). Picking Food showed `Old, Food*, Transport`; picking Old again showed `Old*, Food, Transport`, and `state.editCategory` was `Old`. The disabled Save button wasn't tested against the live database.

---

## 6. Category rename isn't all-or-nothing — Fixed

**Problem.** Renaming a category did two separate saves, in this order:
1. Save the new category list to `settings`.
2. Relabel past expenses from the old name to the new one.

If step 2 failed (for example, the connection dropped), the list showed the new name but past entries kept the old one. Retrying the rename didn't help, because the old name was no longer in the list to rename.

**Fix steps** (`app.js`, `renderSettings`, Rename handler):
1. Swapped the order: relabel past expenses first, then save the category list.
   ```js
   // Relabel past entries first: if this fails, the list still has the old name.
   const { error } = await db.from("expenses").update({ category: name }).eq("category", c);
   if (error) throw error;
   await saveSettings({ categories: next });
   ```
2. Now, if relabelling fails, nothing else has changed: the list still shows the old name, an error toast appears, and the rename can simply be tried again.
3. If relabelling succeeds but saving the list fails, retrying the rename relabels zero rows (already done) and then saves the list, so a retry fully recovers.
4. The Add form's picked-category update from issue 3 runs after both steps succeed.

**Verified.** Code review only; this needs a signed-in session (see "Still to check on the phone").

---

## 7. Leaked password protection is off — Open

**Problem.** Supabase's security advisor warns that leaked password protection is disabled, so a password known to have leaked online (checked against HaveIBeenPwned) would be accepted in Settings → Password. Risk is low: one user, sign-ups are off.

**Not fixed in code**, because it's a Supabase project setting. **Steps to fix it yourself:**
1. Open the Supabase dashboard → project `daily-expenses`.
2. Go to **Authentication → Sign In / Providers → Email** (or **Authentication → Policies / Password security**, depending on the dashboard version).
3. Turn on **Prevent use of leaked passwords**, then save.
4. If the option is locked, it needs a paid plan; leave it off.
5. Re-run the security advisor (Advisors → Security Advisor) to confirm the warning is gone.

Docs: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 8. Deprecated meta tag — Fixed

**Problem.** Loading the live page logged a browser warning: `<meta name="apple-mobile-web-app-capable" content="yes"> is deprecated. Please include <meta name="mobile-web-app-capable" content="yes">`.

**Fix steps** (`index.html`, `<head>`):
1. Added the standard tag directly above the Apple one:
   ```html
   <meta name="mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-capable" content="yes">
   ```
2. Kept the Apple tag, because older iPhones still use it to open the home-screen app full screen.

**Verified.** The page loaded locally with no console warnings.

---

## 9. No offline support — Not planned

**Problem.** There's no service worker, so the home-screen app needs a connection to open. This isn't a bug; it's a possible future feature. Adding it would mean caching the page files and queueing expenses entered offline until the connection returns.

---

## Overall verification
1. `node --check app.js`: no syntax errors.
2. Served the project locally (`python -m http.server 8765`) and opened http://127.0.0.1:8765 in a browser: the page loaded with no console errors or warnings.
3. Ran the in-browser tests described under issues 1, 2 and 5, with the database calls faked: all passed.
4. Committed as `4e864a0` and pushed to `main`; GitHub Pages redeploys the live site from there.

## Still to check on the phone
These need the real account, so they weren't tested:
1. **Rename a category** that has past entries (Settings → Rename). Check the Month view shows those entries under the new name.
2. **Rename the category picked on the Add form**: pick a category on Add, rename it in Settings, go back to Add and save. The entry should be saved under the new name.
3. **Remove the category picked on the Add form**: pick it, remove it in Settings, go back and tap Save. It should ask "Pick a category".
4. **Edit an entry and tap Save quickly twice**: only one "Updated" toast, and the entry changes once.
5. **Download the backup on the iPhone**: the CSV should download and open with all entries.
6. **Leave the home-screen app open overnight**, open it the next morning: the Add form's date should show today.
