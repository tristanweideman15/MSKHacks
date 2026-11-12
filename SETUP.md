# MSK Hacks Physiotherapy: going live with real bookings

This guide takes the website from demo mode to a live site, where patients' bookings are saved in a secure database and only practice staff can open the Practice Portal.

**Time needed:** about 45 minutes. **Cost:** R0 on the free plans (see "Good to know" at the end).
**You need:** an email address for the accounts, and the files in this package.

The package contains:

| Folder / file | What it is |
|---|---|
| `website/` | The finished website, ready to upload. You only edit `website/config.js`. |
| `supabase/schema.sql` | The database setup script you paste into Supabase once. |
| `source/` | The source code, for a developer making changes later. |

---

## Part 1: Create the database (Supabase)

1. Go to **supabase.com** and sign up (for example with the practice email).
2. Click **New project**.
   - **Name:** `msk-hacks`
   - **Database password:** click *Generate*, then save it in a password manager. You won't need it day to day.
   - **Region:** choose the region closest to South Africa from the list.
   - Click **Create new project** and wait a minute or two while it's set up.
3. In the left menu, open **SQL Editor** and click **New query**.
4. Open `supabase/schema.sql` from this package in Notepad (or TextEdit on a Mac), select everything, copy it, paste it into the query box and click **Run**.
   You should see *"Success. No rows returned"*. This creates the booking tables and security rules, and adds the lunch break and public holidays.

## Part 2: Create the staff login(s)

5. Stop strangers creating accounts: open **Authentication → Sign In / Providers** (on some screens **Providers → Email**) and switch **off** *"Allow new users to sign up"*. Save.
   (Even if someone did sign up, they could not see any patient data, because only accounts on the staff list can.)
6. Open **Authentication → Users → Add user → Create new user**.
   - Enter the staff member's email and a strong password.
   - Tick **Auto Confirm User**.
   - Click **Create user**.
7. Put that person on the staff list: go back to **SQL Editor → New query**, paste the lines below, change the email address, and click **Run**:

   ```sql
   insert into public.staff (user_id, display_name)
   select id, 'Mathenjwa' from auth.users where email = 'staff-email@example.com';
   ```

   You should see *"Success. 1 row affected"*. Repeat steps 6 and 7 for each person who needs the portal.

## Part 3: Connect the website to the database

8. In Supabase, click **Connect** at the top of the project, or open **Project Settings → API Keys** / **Data API**. Copy two values:
   - the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - the **anon public** key, called the **publishable** key on newer projects (a long piece of text).

   ⚠️ **Never** use the key labelled *service_role* or *secret*. That one bypasses all the security rules.
9. Open `website/config.js` in Notepad and paste the two values between the quotes:

   ```js
   window.MSK_CONFIG = {
     supabaseUrl: 'https://abcdefgh.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...your-long-key...',
   };
   ```

   Save the file. These two values are safe to be public: they only allow what the security rules allow.

## Part 4: Put the website online (Netlify)

10. Go to **netlify.com**, sign up, and stay **logged in**.
11. Go to **app.netlify.com/drop** and drag the whole **`website`** folder onto the page. After a few seconds you get a live address such as `https://random-name.netlify.app`.
12. Under **Site configuration → Change site name**, you can rename the site, e.g. `mskhacks` → `https://mskhacks.netlify.app`.
13. Back in Supabase, open **Authentication → URL Configuration** and set **Site URL** to your live address. (This makes "Forgot password" emails link back to your site.)

**Using your own domain (optional):** if the practice owns `mskhacksphysio.com`, open Netlify → **Domain management → Add a domain** and follow the steps. Netlify will show the DNS records to set at your domain provider.

## Part 5: Test it (5 minutes)

1. Open the live site and book an appointment with your own email address. Note the reference code.
2. Click **My Bookings**, enter the code and your email, and check that the booking shows. Try rescheduling it.
3. Click **Practice portal** (bottom of the page) and sign in with the staff login. The booking should be there with all the details.
4. In the portal, cancel the test booking.

If the site shows *"Live availability could not be loaded"*, the URL or key in `config.js` is wrong. Fix it and drag the `website` folder onto Netlify again (Netlify → your site → **Deploys** → drag and drop).

---

## Day-to-day use

- **Checking bookings:** open the site → **Practice portal** → sign in. Click **Refresh** to load bookings that came in while the portal was open.
- **Closing for leave, a course or a public holiday:** Portal → *Staff Lunches & Holidays* → add a blocked day or time. Patients can then no longer book it.
- **Phone and walk-in bookings:** Portal → **New Walk-in Booking**.
- **Waitlist:** Portal → *Priority Waitlist*. When a slot opens, book the patient from there and phone them.
- **Forgot password:** on the sign-in screen, type your email and click *Forgot password*. Open the link on the same device and set a new password.
- **Adding or removing staff:** add them as in Part 2. To remove someone, delete them under **Authentication → Users**.
- **Changing hours, services or wording:** these are in the source code (`source/src/data/mockData.ts`). Ask a developer, or ask Claude, to change them and send you a new `website` folder.

## What patients can and cannot see

- Patients can **see which times are taken** (date and time only, never names), **book**, **join the waitlist**, and **manage their own bookings** using their reference code *plus* the email address they booked with.
- Patients **cannot** see anyone else's bookings, the waitlist, or the physio's clinical notes.
- Only accounts on the staff list can see patient details, and only after signing in.

## Good to know

- **Emails:** appointment emails are sent through EmailJS once it is set up. See `EMAILJS-SETUP.md`.
- **Free plan pausing:** Supabase pauses a free project that gets very little activity for a week; regular visits to the site usually keep it awake, but that is not guaranteed. You get a warning email first, and a paused project keeps all its data and can be restored from the dashboard. The paid Pro plan is never paused.
- **Backups:** export the bookings regularly from the portal (**Export CSV**) and keep the file somewhere safe.
- **POPIA:** the booking form asks patients to agree to the practice storing their details, including health information. As the practice you are responsible for this data. Keep staff logins private, remove staff who leave, and consider adding a short privacy notice to the site. (This is general guidance, not legal advice.)
