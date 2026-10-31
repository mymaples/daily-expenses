# Month view updates: what was changed and how

Date: 31 Oct 2026
App: https://mymaples.github.io/daily-expenses/

## Update 1: removed the repeated amount under Entries

**Problem:** In **Month → Entries**, each day shows its total in the day header. When a day had only one
entry, the same amount appeared again on that entry's row, so it was shown twice.

**What I did:**
1. Found the Entries list: `<div id="m-days">` in `index.html`, filled in by `refreshMonth()` in `app.js`.
   Each day is a header (`day-head`: day name and total) followed by its entry rows, each built by `entryRow()`.
2. After the rows are built, if the day has exactly **one** entry, the row's amount (`.amt`) is removed, so
   only the day total at the top is shown.
3. Days with **several** entries still show each row's amount, because the day total alone doesn't tell you
   what each item cost.
4. Checked that `app.js` still parses (`node --check app.js`).
5. Committed and pushed to `main`: commit `b9b4186`, "Hide repeated amount on single-entry days in Month view".

## Update 2: budget bar coloured by category

**Request:** The spend progress bar in **Month** should use the category colours.

**What I did:**
1. **`app.js` (`refreshMonth()`):**
   - Moved the per-category totals so they are worked out before the budget bar is drawn (the
     "By category" section below uses the same totals).
   - The bar's fill is now split into one section per category, biggest first. Each section's width is that
     category's share of the month's spending, so the overall fill still shows the % of budget used.
   - Each section uses the category's own colour, the same as in "By category", and hovering it shows the
     category name and amount.
2. **`style.css` (`.bar`):**
   - The fill lays its sections out side by side, with a thin gap between them.
   - The whole bar used to turn amber at 80% of the budget and red when over. The category colours now cover
     it, so the warning is shown as a **ring around the bar** instead: amber from 80%, red when over budget.
     This uses the CSS `:has()` selector, which recent phone browsers support; an older browser just shows no ring.
   - The "left / over budget" text under the bar is unchanged.
3. **`README.md`:** updated the Month description and the category colour list to mention the split bar
   and the warning ring.
4. Checked that `app.js` still parses (`node --check app.js`).
5. Committed and pushed to `main` together with this file.

**Not done yet:** I haven't looked at the new bar in the running app.

## Files changed

| File | Update 1 | Update 2 |
|---|---|---|
| `app.js` | Hides the row amount on days with one entry | Category sections in the budget bar |
| `style.css` | none | Section layout and warning ring |
| `README.md` | none | Mentions the split bar and ring |
