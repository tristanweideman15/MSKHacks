/**
 * Appointment emails through EmailJS (https://www.emailjs.com).
 *
 * Settings live in public/config.js → window.MSK_CONFIG.emailjs. If they are empty, no emails are sent
 * and the site works exactly as before.
 *
 * Two EmailJS templates are used (the free plan allows two):
 *   - patientTemplateId  → the patient (booking confirmed / moved / cancelled)
 *   - practiceTemplateId → the practice inbox (new booking / moved / cancelled, with intake details)
 * The HTML for both is in /email-templates.
 */
import emailjs from '@emailjs/browser';
import { Appointment } from '../types';
import { SERVICES, THERAPISTS, CLINIC_INFO } from '../data/mockData';

export type EmailEvent = 'confirmed' | 'rescheduled' | 'cancelled';

interface EmailJsConfig {
  publicKey?: string;
  serviceId?: string;
  patientTemplateId?: string;
  practiceTemplateId?: string;
  practiceEmail?: string;
  siteUrl?: string;
  origin?: string; // only for testing
}

const cfg: EmailJsConfig =
  ((window as unknown as { MSK_CONFIG?: { emailjs?: EmailJsConfig } }).MSK_CONFIG?.emailjs) || {};

const clean = (v?: string) => (v || '').trim();

export const emailEnabled = !!(clean(cfg.publicKey) && clean(cfg.serviceId) && clean(cfg.patientTemplateId));

if (emailEnabled) {
  emailjs.init({
    publicKey: clean(cfg.publicKey),
    blockHeadless: true,
    ...(cfg.origin ? { origin: cfg.origin } : {}),
  });
}

const validEmail = (e?: string) => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

/** "02:15 PM" -> "14:15" */
const time24 = (slot: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!m) return slot;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

const prettyDate = (ymd: string) =>
  new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${ymd}T00:00:00Z`)
  );

const siteUrl = () => (clean(cfg.siteUrl) || window.location.origin).replace(/\/+$/, '');

const COPY: Record<EmailEvent, {
  subject: (when: string) => string;
  heading: string;
  status: string;
  statusColor: string;
  intro: string;
  closing: string;
  button: string;
  hint: string;
  practiceEvent: string;
}> = {
  confirmed: {
    subject: (when) => `Appointment confirmed: ${when}`,
    heading: 'Your appointment is confirmed',
    status: 'Confirmed',
    statusColor: '#0f766e',
    intro: 'Thank you for booking with MSK Hacks Physiotherapy. Here are your appointment details:',
    closing:
      'Please arrive 10 minutes early and wear comfortable, loose clothing. Bring any referral letters, X-rays or scan reports, and your medical aid card if you plan to claim.',
    button: 'Manage my booking',
    hint: 'To reschedule or cancel, open the website, click My Bookings and enter your reference code and this email address. Please give at least 24 hours’ notice.',
    practiceEvent: 'New booking',
  },
  rescheduled: {
    subject: (when) => `Appointment moved: ${when}`,
    heading: 'Your appointment has been moved',
    status: 'Rescheduled',
    statusColor: '#0369a1',
    intro: 'Your appointment has been rescheduled. Your new appointment details are:',
    closing: 'Please arrive 10 minutes early and wear comfortable, loose clothing.',
    button: 'Manage my booking',
    hint: 'To reschedule or cancel, open the website, click My Bookings and enter your reference code and this email address. Please give at least 24 hours’ notice.',
    practiceEvent: 'Booking moved',
  },
  cancelled: {
    subject: (when) => `Appointment cancelled: ${when}`,
    heading: 'Your appointment has been cancelled',
    status: 'Cancelled',
    statusColor: '#be123c',
    intro: 'The appointment below has been cancelled.',
    closing: 'If this was a mistake, or you would like a new time, you are welcome to book again online or give us a call.',
    button: 'Book a new appointment',
    hint: 'Choose a new date and time online in a few clicks.',
    practiceEvent: 'Booking cancelled',
  },
};

function baseParams(a: Appointment, event: EmailEvent) {
  const service = SERVICES.find((s) => s.id === a.serviceId);
  const therapist = THERAPISTS.find((t) => t.id === a.therapistId);
  const when = `${prettyDate(a.date)} at ${time24(a.timeSlot)}`;
  const c = COPY[event];
  return {
    subject: c.subject(when),
    heading: c.heading,
    status_label: c.status,
    status_color: c.statusColor,
    intro: c.intro,
    closing_note: c.closing,
    button_label: c.button,
    button_hint: c.hint,
    first_name: a.intake.fullName.trim().split(/\s+/)[0] || 'there',
    patient_name: a.intake.fullName.trim(),
    appointment_date: prettyDate(a.date),
    appointment_time: time24(a.timeSlot),
    service: service?.title || 'Physiotherapy appointment',
    physio: therapist?.name || 'Mathenjwa SK',
    reference: a.referenceCode,
    clinic_name: CLINIC_INFO.name,
    clinic_address: `${CLINIC_INFO.address}, ${CLINIC_INFO.cityStateZip}`,
    clinic_phone: CLINIC_INFO.phone,
    clinic_landline: CLINIC_INFO.landline || '',
    clinic_email: clean(cfg.practiceEmail) || CLINIC_INFO.email,
    instagram: CLINIC_INFO.instagramHandle,
    site_url: siteUrl(),
    site_label: siteUrl().replace(/^https?:\/\//, ''),
    logo_url: `${siteUrl()}/email-logo.png`,
  };
}

export interface EmailResult {
  patient: 'sent' | 'skipped' | 'failed';
  practice: 'sent' | 'skipped' | 'failed';
}

/**
 * Sends the patient email (and optionally the practice copy). Never throws: the booking is already saved,
 * so a failed email only changes what we tell the patient.
 */
export async function sendAppointmentEmails(
  a: Appointment,
  event: EmailEvent,
  opts: { patient?: boolean; practice?: boolean } = {}
): Promise<EmailResult> {
  const result: EmailResult = { patient: 'skipped', practice: 'skipped' };
  if (!emailEnabled) return result;
  const params = baseParams(a, event);
  const service = clean(cfg.serviceId);

  if (opts.patient !== false && validEmail(a.intake.email)) {
  try {
    await emailjs.send(service, clean(cfg.patientTemplateId), {
      ...params,
      to_email: a.intake.email.trim(),
      to_name: a.intake.fullName.trim(),
      reply_to: params.clinic_email,
    }, { publicKey: cfg.publicKey });
    result.patient = 'sent';
  } catch (e) {
    const err = e as { status?: number; text?: string };
    console.warn('Patient email failed', err.status, err.text, e);
    result.patient = 'failed';
  }
}
  const practiceTo = clean(cfg.practiceEmail);
  if (opts.practice !== false && clean(cfg.practiceTemplateId) && validEmail(practiceTo)) {
    const i = a.intake;
    const pay = i.insuranceType === 'in-network' ? 'Medical aid' : i.insuranceType === 'hsa-fsa' ? 'Card / EFT' : 'Private (cash)';
    try {
      await emailjs.send(service, clean(cfg.practiceTemplateId), {
        ...params,
        subject: `${COPY[event].practiceEvent}: ${i.fullName.trim() || 'patient'} – ${params.appointment_date} ${params.appointment_time}`,
        event_label: COPY[event].practiceEvent,
        to_email: practiceTo,
        reply_to: validEmail(i.email) ? i.email.trim() : practiceTo,
        patient_email: i.email || '—',
        patient_phone: i.phone || '—',
        patient_dob: i.dateOfBirth || '—',
        pain_location: i.painLocation || '—',
        pain_level: i.painLevel ? `${i.painLevel}/10` : '—',
        payment: pay,
        medical_aid: i.insuranceProvider || '—',
        referral: i.hasReferral ? 'Yes' : 'No',
        symptoms: i.symptomsDescription || '—',
      });
      result.practice = 'sent';
    } catch (e) {
      console.warn('Practice email failed', e);
      result.practice = 'failed';
    }
  }
  return result;
}
