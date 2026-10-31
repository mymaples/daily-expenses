# Daily Expenses

A lightweight, mobile-first page for recording daily spending (RM) and reviewing it by month.
Plain HTML/CSS/JS hosted on GitHub Pages; data is stored in Supabase so it syncs across devices.

## Screens
- **Add**: amount, category, optional note and date. Today's and this month's totals at the top.
- **Month**: spent vs. budget, category breakdown, entries by day (tap to edit/delete), ‹ › to change month.
- **Settings**: monthly budget, categories, CSV backup, sign out.

## Setup
1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Put the Project URL and anon public key into `config.js`.
3. Supabase → Authentication → Emails: make the "Magic Link" template include `{{ .Token }}` so the email contains the 6-digit code.
4. Supabase → Authentication → URL Configuration: set Site URL to the GitHub Pages URL.
5. Sign in once, then turn off "Allow new users to sign up" (Authentication → Sign In / Providers) so nobody else can create an account.

## Run locally
```
python -m http.server 8765
```
Open http://127.0.0.1:8765.

## Deploy
Push to GitHub, then Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
On your phone, open the Pages URL and use Share → Add to Home Screen.
