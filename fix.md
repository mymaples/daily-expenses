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

## What to do going forward
- **Change the temporary password** in **Settings → Password** if you haven't already. It was shown in chat, so treat it as used.
- **Sign in with email and password.** Use the email link only if you forget the password, tap it once, and open it on the same phone and browser.
- **If the app says it can't reach the server** after a week without use, the free Supabase project has paused. Open the Supabase dashboard and click **Restore**.
