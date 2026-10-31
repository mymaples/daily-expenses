# QA check

Date: 31 Oct 2026
App: https://mymaples.github.io/daily-expenses/
Supabase project: `daily-expenses` (`qktcdsvhxnjpblmknyxn`)

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

### 1. CSV backup stops at 1,000 rows
`exportCsv` fetches every expense in one request, and Supabase returns at most 1,000 rows per request by default. Past 1,000 expenses (about a year at three a day), the backup silently leaves out the rest.
**Fix:** fetch in pages with `.range()` until a page comes back short.

### 2. Add form date goes stale overnight
`add-date` is set to today only at sign-in and after a save. If the home-screen app stays open overnight and an expense is added the next morning, it is saved under yesterday.
**Fix:** reset the date to today when the app comes back to the foreground, unless it was changed by hand.

### 3. Renamed/removed category stays selected on the Add form
If the selected category on the Add form is renamed or removed in Settings, `state.addCategory` keeps the old name. The chip is no longer highlighted, but the next expense is saved under the old name.
**Fix:** follow a rename and clear the selection on remove.

### 4. Backup download may fail on iPhone Safari
`URL.revokeObjectURL` runs right after `a.click()`, which can cancel the download before Safari starts it.
**Fix:** revoke the URL after a short delay.

### 5. Edit sheet
- The Save button isn't disabled while saving, so a double tap sends two updates.
- When an entry's category was later removed, the old category is shown as an extra chip, but tapping another category re-renders the chips and the old one disappears, so it can't be picked again.
**Fix:** disable Save while saving; keep the old category chip in the list while the sheet is open.

### 6. Category rename isn't all-or-nothing
The category list is saved first and past entries are relabelled second. If the second step fails, past entries keep the old name.
**Fix:** relabel past entries first, then save the category list.

### 7. Leaked password protection is off
Supabase's security advisor warns that passwords known to have leaked online are accepted. This may need a paid plan; risk is low with one user and sign-ups off.
**Fix:** Supabase → Authentication → enable leaked password protection, if the plan allows it. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 8. Deprecated meta tag
The browser warns that `apple-mobile-web-app-capable` is deprecated.
**Fix:** add `<meta name="mobile-web-app-capable" content="yes">` alongside it.

### 9. No offline support
There's no service worker, so the home-screen app needs a connection to open. Not a bug; a possible future feature.

## Verification of fixes
- `node --check app.js` passes; the page loads locally with no console errors or warnings.
- In the browser, with the database calls stubbed:
  - Export of 2,500 rows fetched three pages (0–999, 1000–1999, 2000–2999) and wrote all 2,500 rows.
  - Edit sheet with a removed category "Old": picking "Food" and then "Old" again works.
  - Waking the app moved yesterday's default date to today, and left a hand-picked date alone.
- Not tested against the live database (needs the account's login): category rename/remove and saving from the edit sheet.
