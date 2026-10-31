# Daily Expenses

A lightweight, mobile-first page for recording daily spending (RM) and reviewing it by month.
Plain HTML/CSS/JS hosted on GitHub Pages; data is stored in Supabase so it syncs across devices.

## Screens
- **Sign-in**: email link, or email + password (if one is set in Settings).
- **Add**: Today and This month totals as two tiles at the top, then amount, category, optional note and date
  (note and date sit side by side on wider screens, stacked on phones). Today's entries are listed below.
- **Month**: spent vs. budget with a progress bar and the daily allowance left, a category breakdown
  (name and amount over a bar on one shared scale), and entries grouped by day. Tap an entry to edit or delete it
  in a bottom sheet; ‹ › changes month.
- **Settings**: monthly budget, categories (add / rename / remove), password, and an account card with
  CSV backup and sign out.

The bottom tab bar switches between Add, Month and Settings. The layout is built for phones and centres in a
560px column on larger screens; it follows the system light/dark setting.

Each category has its own light colour, used on its chips, entry labels, breakdown bar and a dot in Settings.
Colours follow the category's position in the list (renaming keeps the colour, removing one shifts those below it);
past entries with a removed category get a colour derived from the label. Dark mode uses darker tints.

## Setup
1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Put the Project URL and anon public key into `config.js`.
3. Supabase → Authentication → URL Configuration: set Site URL to the GitHub Pages URL and add it to Redirect URLs.
4. Sign up once, then turn off "Allow new users to sign up" (Authentication → Sign In / Providers) so nobody else can create an account.

Sign-in uses the email link (free Supabase projects can't customise emails to show a code).
Set a password in Settings to sign in on other devices, or in an iPhone home-screen app, without email.

## Run locally
```
python -m http.server 8765
```
Open http://127.0.0.1:8765.

## Deploy
Push to GitHub, then Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
On your phone, open the Pages URL and use Share → Add to Home Screen.
