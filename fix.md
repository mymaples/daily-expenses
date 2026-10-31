# Sign-in fix: what went wrong and what was changed

Date: 31 Oct 2026
App: https://mymaples.github.io/daily-expenses/
Supabase project: `daily-expenses` (`qktcdsvhxnjpblmknyxn`), owned by chris.goh@mymaples.com

## Problem 1: the email had no code

**Symptom:** The app asked for a 6-digit code, but the email only had a "Confirm your email address" link.

**Cause:**
- The first sign-in on a new email sends Supabase's **Confirm signup** email, not the sign-in email, and neither one includes a code by default.
- To fix it, I tried to add a code to the email templates, but Supabase refused: *"Email template modification is not available for free tier projects using the default email provider."* So on the free plan the email can never show a code.

**Fix:**
1. **Supabase settings** (changed through the dashboard after you logged in there):
   - Site URL set to `https://mymaples.github.io/daily-expenses/`. It was `http://localhost:3000`, so email links led to a broken page.
   - Redirect URLs allowed: `https://mymaples.github.io/daily-expenses/**` and `http://127.0.0.1:8765/**` (for local testing).
   - **New sign-ups turned off**, so nobody else can create an account.
   - Email code length set to 6.
2. **App changes** (commit `927d48b`):
   - The sign-in screen now says **"Email me a sign-in link"**. Tapping the link in the email opens the app already signed in, so no code is needed.
   - Added **Sign in with password**.
   - Added **Settings → Password**, so you can set a password and sign in on other devices (or the iPhone home-screen app) without email.

## Problem 2: security check findings

An automatic security check flagged four sign-in issues. Three are fixed (commit `c699d42`):
- **Sign-in links:** they now use a one-time code (PKCE), so no login secrets appear in the web address. A link only works in the same browser where it was requested.
- **Error messages:** the app shows its own fixed wording instead of text taken from the web address, which anyone could craft.
- **Hidden accounts:** sending a link shows the same message whether or not the email has an account, so the page doesn't reveal who is registered.

**Not fixed, by choice:** changing the password doesn't ask you to confirm who you are first. Fixing that needs an emailed code, which the free plan can't send. The risk is low because the app has one user and sign-ups are off.

## Problem 3: "Too many emails sent"

**Symptom:** Tapping "Email me a sign-in link" on the phone showed *"Too many emails sent. Wait a few minutes and try again."*

**Cause:**
- Supabase's free email service only allows a few emails per hour, and several sign-in emails had already gone out between 9:03 and 9:09am (Malaysia time).
- Each new request also cancels the earlier links.
- The logs also showed **two accounts**, chris.goh@mymaples.com and tkgoh228@gmail.com, both created before sign-ups were turned off.

**Fix:**
1. Kept **chris.goh@mymaples.com** as the only account and deleted **tkgoh228@gmail.com**, which had no expenses.
2. Set a temporary password on chris.goh@mymaples.com directly in the database and tested that it signs in.
3. You signed in on your phone with the password. ✅

## Problem 4: Date box ran over the edge of the Add card

**Symptom:** On the phone, the **Date** box in the Add section stuck out past the right edge of the white card.

**Cause:**
- The layout update (commit `9d85d54`) put **Note** and **Date** side by side to make the form shorter, with Date in a fixed column 10.5em (about 168px) wide.
- Phone browsers, iOS Safari especially, give a date box a built-in minimum width and ignore "fill the column" (`width: 100%`). The date box stayed wider than its column and pushed past the card.
- It didn't show up when I first tested in desktop Chrome, which shrinks date boxes more readily than a phone does.

**How I found and fixed it** (commit `1f49479`, `style.css` only):
1. **Reproduced it.** I ran the app locally (`python -m http.server 8765`) with fake data standing in for Supabase, opened it in Chrome at phone widths, and measured where the Date box ended compared with the card's edge.
2. **Let the date box shrink.** I added a rule for `input[type="date"]`: `appearance: none`, `min-width: 0`, `max-width: 100%` and `display: block`. This turns off the browser's built-in sizing so the box fits its column, and `::-webkit-date-and-time-value { text-align: left }` keeps the date text left-aligned on iOS once that styling is off.
3. **Tried two equal columns.** I changed the row from "Note fills the space + Date 10.5em" to two equal halves. At 320px wide the date was no longer overflowing, but the date text itself was cut off ("10/31/20…"), and at 375px it only just fitted.
4. **Stacked on phones instead.** A date box needs about 160px, which is more than half of a narrow card. So the row is now:
   - **under 440px wide (phones):** Note and Date each on their own full-width line;
   - **440px and wider:** side by side in two equal columns.
5. **Checked it.** At 320, 375 and 500px wide the Date box ended inside the card each time (17px in from the edge, the card's padding), and the page had no sideways scroll. The same row is used in the **Edit expense** sheet, so that is fixed too.
6. **Deployed and confirmed.** I pushed to `main`, GitHub Pages redeployed, and you confirmed it now looks right on your phone. ✅

## What to do going forward
- **Change the temporary password** in **Settings → Password** if you haven't already. It was shown in chat, so treat it as used.
- **Sign in with email and password.** Use the email link only if you forget the password, tap it once, and open it on the same phone and browser.
- **If the app says it can't reach the server** after a week without use, the free Supabase project has paused. Open the Supabase dashboard and click **Restore**.
