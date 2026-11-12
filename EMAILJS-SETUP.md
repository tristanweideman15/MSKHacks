# Appointment emails with EmailJS

Once this is set up, the website sends these emails automatically:

| When | Patient gets | Practice inbox gets |
|---|---|---|
| A patient books online | Confirmation | New booking, with intake details |
| A patient moves or cancels in **My Bookings** | Booking moved / cancelled | Booking moved / cancelled |
| Staff cancel or move a booking in the Practice Portal | Booking moved / cancelled | — |
| Staff add a walk-in or phone booking that has an email address | Confirmation | — |

**Time needed:** about 30 minutes. Everything happens in the EmailJS website and on GitHub; you don't need to install anything.

---

## Part 1: Set up EmailJS

1. Go to **emailjs.com** and sign up (the free plan is fine to start).

2. **Connect the practice mailbox:** open **Email Services → Add New Service**.
   - If info@mskhacksphysio.com runs on **Google Workspace**, choose **Gmail**. On **Microsoft 365**, choose **Outlook 365**. On another host (e.g. Afrihost, xneelo, Domains.co.za mail), choose **SMTP server** and enter the mail server, port, username and password that your host gives you for that mailbox.
   - Sign in or enter the details, then click **Create Service**.
   - Copy the **Service ID** (looks like `service_ab12cd3`).

   Sending from the practice's own mailbox means emails come from info@… and are much less likely to land in spam. If your host's mail setup guide lists SPF/DKIM DNS records, make sure they are in place.

3. **Create the patient template:** open **Email Templates → Create New Template**.
   - **Subject:** `{{subject}}`
   - **Content:** switch the editor to **code / HTML** view, delete what's there, and paste the whole of `email-templates/patient-appointment.html`.
   - On the right-hand side (or the **Settings** tab):
     - **To Email:** `{{to_email}}`
     - **From Name:** `MSK Hacks Physiotherapy`
     - **From Email:** leave as the default (your connected mailbox)
     - **Reply To:** `{{reply_to}}`
   - Click **Save**, then copy the **Template ID** (looks like `template_x1y2z3`).

4. **Create the practice template** the same way, using `email-templates/practice-notification.html`, with the same Subject, To Email, From Name and Reply To settings. Save and copy its Template ID.
   (Skip this step if you only want patient emails. See "Monthly limit" below.)

5. Open **Account → General** and copy your **Public Key**.

6. Open **Account → Security**:
   - If there is an option to only allow requests from your own website (allowed origins / domains), add your site address, e.g. `https://mskhacks.netlify.app` (and your own domain if you use one).
   - Leave **"Use Private Key"** switched **off**, otherwise the website can't send.
   - Do **not** switch on reCAPTCHA for these templates: the website doesn't include it, so every email would fail.

## Part 2: Update the website on GitHub

7. **Upload the new files.** In your GitHub repository click **Add file → Upload files**. Open the `upload-to-github` folder from this package, select **everything inside it**, and drag it onto the GitHub page. GitHub keeps the folders, so files land in the right places and replace the old versions. Click **Commit changes**.

   This does **not** include `public/config.js`, so your Supabase settings are safe.

8. **Add the EmailJS settings to `public/config.js`.** On GitHub, open `public/config.js` and click the pencil icon. Just above the last line (`};`), add this block and fill in your values:

   ```js
     // --- EmailJS (appointment emails) ---
     emailjs: {
       publicKey: 'YOUR_PUBLIC_KEY',
       serviceId: 'service_xxxxxxx',
       patientTemplateId: 'template_xxxxxxx',
       practiceTemplateId: 'template_yyyyyyy',   // or '' for no practice copy
       practiceEmail: 'info@mskhacksphysio.com',
       siteUrl: 'https://mskhacks.netlify.app',   // your live site address
     },
   ```

   Make sure the line above the block (your `supabaseAnonKey: '...'` line) ends with a comma. Click **Commit changes**.

   The public key is meant to be public, so it's fine in this file. Never paste an EmailJS **private key** here.

9. Netlify rebuilds the site automatically after each commit. It takes a minute or two; you can watch it under **Netlify → Deploys**.

## Part 3: Test (5 minutes)

1. Book an appointment on the live site using **your own** email address.
   The confirmation screen should say **"Confirmation email sent"**.
2. Check your inbox (and spam) for the confirmation, and the practice inbox for the "New booking" copy.
3. Open **My Bookings**, move the test booking, then cancel it. You should get a "moved" and then a "cancelled" email.
4. In EmailJS, **Email History** shows every email sent and any errors.

If the screen says **"We couldn't send your confirmation email"**, the booking is still saved. Check the Service ID, Template IDs and Public Key in `config.js`, and look at EmailJS **Email History** for the error.

---

## Good to know

- **Monthly limit:** the EmailJS free plan allows about 200 emails a month. Each online booking uses 2 (patient + practice copy), and a move or cancellation uses 2 more. If you run low, set `practiceTemplateId: ''` in `config.js` (staff still see every booking in the Practice Portal), or upgrade to a paid EmailJS plan.
- **No automatic reminders:** EmailJS sends from the visitor's browser at the moment something happens, so it cannot send a "see you tomorrow" email the day before. That would need a server-side service.
- **Waitlist sign-ups** are not emailed; staff see them in the Practice Portal.
- **Changing the wording or design:** edit the template in EmailJS. The wording that changes per email (heading, intro, button text) is in `src/lib/email.ts`.
- **Spam protection:** the site blocks automated browsers from sending, and the allowed-domains setting in step 6 stops other websites using your EmailJS account.
- **Patient information:** the practice copy contains health details from the intake form, so keep that inbox private. Patient emails contain only the appointment details, no health information.

### Template placeholders

Patient template: `subject`, `heading`, `status_label`, `status_color`, `intro`, `closing_note`, `button_label`, `button_hint`, `first_name`, `appointment_date`, `appointment_time`, `service`, `physio`, `reference`, `clinic_address`, `clinic_phone`, `clinic_landline`, `clinic_email`, `instagram`, `site_url`, `site_label`, `logo_url`, `clinic_name`, `to_email`, `reply_to`.

The practice template also uses: `event_label`, `patient_name`, `patient_email`, `patient_phone`, `patient_dob`, `payment`, `medical_aid`, `pain_location`, `pain_level`, `referral`, `symptoms`.
