/**
 * Data layer for the MSK Hacks site.
 *
 * - LIVE mode (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set): bookings are stored in Supabase.
 *   Patients can only create bookings, see which times are taken, and manage their own booking
 *   with reference code + email. Only signed-in staff can see patient details.
 * - DEMO mode (no Supabase settings): everything is kept in this browser only, with sample data.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Appointment, BlockedTimeSlot, WaitlistEntry } from '../types';
import {
  INITIAL_APPOINTMENTS,
  INITIAL_BLOCKED_SLOTS,
  INITIAL_WAITLIST,
} from '../data/mockData';
import { generateReferenceCode, generateWaitlistCode, isSlotBlocked } from '../utils/calendar';

export type NewBooking = Pick<Appointment, 'serviceId' | 'therapistId' | 'date' | 'timeSlot' | 'intake'>;
export type NewWaitlist = Omit<WaitlistEntry, 'id' | 'referenceCode' | 'status' | 'createdAt'>;

export interface StaffUser {
  email: string;
}

export interface StaffData {
  appointments: Appointment[];
  waitlist: WaitlistEntry[];
  blockedSlots: BlockedTimeSlot[];
}

export interface Backend {
  mode: 'live' | 'demo';
  loadPublic(): Promise<{ booked: Appointment[]; blockedSlots: BlockedTimeSlot[] }>;
  createBooking(b: NewBooking): Promise<Appointment>;
  joinWaitlist(w: NewWaitlist): Promise<WaitlistEntry>;
  findPatientBookings(ref: string, email: string): Promise<Appointment[]>;
  patientCancel(ref: string, email: string): Promise<void>;
  patientReschedule(ref: string, email: string, date: string, timeSlot: string): Promise<void>;

  getStaffUser(): Promise<StaffUser | null>;
  onAuthChange(cb: (event: string) => void): () => void;
  signIn(email: string, password: string): Promise<StaffUser>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  signOut(): Promise<void>;

  loadStaff(): Promise<StaffData>;
  staffCreateAppointment(b: NewBooking & { status?: Appointment['status']; clinicalNotes?: string }): Promise<Appointment>;
  staffUpdateAppointment(a: Appointment): Promise<void>;
  staffAddBlock(b: BlockedTimeSlot): Promise<void>;
  staffRemoveBlock(id: string): Promise<void>;
  staffUpdateWaitlist(w: WaitlistEntry): Promise<void>;
  staffRemoveWaitlist(id: string): Promise<void>;
}

/** Turns database error codes into messages a patient can act on. */
export function friendlyError(err: unknown): string {
  const raw = (err as { message?: string })?.message || String(err);
  const map: Record<string, string> = {
    slot_taken: 'Sorry, that time has just been booked by someone else. Please choose another time.',
    slot_blocked: 'That time is not available (the practice is closed or on a break). Please choose another time.',
    date_out_of_range: 'Please choose a date from tomorrow onwards.',
    closed_on_weekends: 'Online booking is for weekdays only. For Saturdays, please phone the practice.',
    invalid_slot: 'Please choose a valid appointment time.',
    missing_details: 'Please fill in your name, a valid email address and a phone number.',
    too_long: 'Some of the text is too long. Please shorten your description.',
    too_many_bookings: 'You already have several upcoming bookings. Please phone the practice to book more.',
    not_found: 'We could not find a booking with that reference code and email address.',
    'Invalid login credentials': 'Incorrect email or password.',
    not_staff: 'This account is not on the practice staff list.',
  };
  for (const key of Object.keys(map)) if (raw.includes(key)) return map[key];
  if (/Failed to fetch|NetworkError/i.test(raw)) return 'Could not reach the booking system. Please check your internet connection and try again.';
  return 'Something went wrong. Please try again, or phone the practice on 075 611 6949.';
}

// ---------------------------------------------------------------------------
// LIVE (Supabase)
// ---------------------------------------------------------------------------
type ApptRow = {
  id: string;
  reference_code: string;
  service_id: string;
  therapist_id: string;
  appt_date: string;
  time_slot: string;
  status: Appointment['status'];
  intake: Appointment['intake'];
  clinical_notes?: string | null;
  created_at: string;
};

const rowToAppt = (r: ApptRow): Appointment => ({
  id: r.id,
  referenceCode: r.reference_code,
  serviceId: r.service_id,
  therapistId: r.therapist_id,
  date: r.appt_date,
  timeSlot: r.time_slot,
  status: r.status,
  intake: r.intake,
  clinicalNotes: r.clinical_notes || undefined,
  createdAt: r.created_at,
});

const blankIntake: Appointment['intake'] = {
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  painLocation: '',
  painLevel: 0,
  injuryDuration: 'acute',
  hasReferral: false,
  insuranceType: 'self-pay',
  symptomsDescription: '',
};

type BlockRow = {
  id: string;
  title: string;
  type: BlockedTimeSlot['type'];
  therapist_id: string;
  block_date: string | null;
  start_date: string | null;
  end_date: string | null;
  time_slots: string[] | null;
  is_full_day: boolean;
  recurring_daily: boolean;
  notes: string | null;
  created_at: string;
};

const rowToBlock = (r: BlockRow): BlockedTimeSlot => ({
  id: r.id,
  title: r.title,
  type: r.type,
  therapistId: r.therapist_id,
  date: r.block_date || undefined,
  startDate: r.start_date || undefined,
  endDate: r.end_date || undefined,
  timeSlots: r.time_slots || undefined,
  isFullDay: r.is_full_day,
  recurringDaily: r.recurring_daily,
  notes: r.notes || undefined,
  createdAt: r.created_at,
});

type WaitRow = {
  id: string;
  reference_code: string;
  patient_name: string;
  email: string;
  phone: string;
  service_id: string;
  therapist_id: string;
  preferred_date: string;
  preferred_time_of_day: WaitlistEntry['preferredTimeOfDay'];
  pain_location: string | null;
  notes: string | null;
  status: WaitlistEntry['status'];
  created_at: string;
};

const rowToWait = (r: WaitRow): WaitlistEntry => ({
  id: r.id,
  referenceCode: r.reference_code,
  patientName: r.patient_name,
  email: r.email,
  phone: r.phone,
  serviceId: r.service_id,
  therapistId: r.therapist_id,
  preferredDate: r.preferred_date,
  preferredTimeOfDay: r.preferred_time_of_day,
  painLocation: r.pain_location || '',
  notes: r.notes || undefined,
  status: r.status,
  createdAt: r.created_at,
});

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function liveBackend(sb: SupabaseClient): Backend {
  const must = <T>(res: { data: T; error: unknown }): T => {
    if (res.error) throw res.error;
    return res.data;
  };

  const checkStaff = async (): Promise<StaffUser | null> => {
    const { data: s } = await sb.auth.getSession();
    const session = s.session;
    if (!session) return null;
    const { data, error } = await sb.rpc('is_staff');
    if (error || data !== true) return null;
    return { email: session.user.email || '' };
  };

  return {
    mode: 'live',

    async loadPublic() {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();
      to.setDate(to.getDate() + 180);
      const [booked, blocks] = await Promise.all([
        sb.rpc('get_booked_slots', { p_from: ymd(from), p_to: ymd(to) }),
        sb.from('blocked_slots').select('*'),
      ]);
      const bookedRows = must(booked) as { appt_date: string; time_slot: string; therapist_id: string }[];
      return {
        booked: bookedRows.map((r, i) => ({
          id: `slot-${i}`,
          referenceCode: '',
          serviceId: '',
          therapistId: r.therapist_id,
          date: r.appt_date,
          timeSlot: r.time_slot,
          status: 'confirmed' as const,
          intake: blankIntake,
          createdAt: '',
        })),
        blockedSlots: (must(blocks) as BlockRow[]).map(rowToBlock),
      };
    },

    async createBooking(b) {
      const rows = must(
        await sb.rpc('create_booking', {
          p_service_id: b.serviceId,
          p_therapist_id: b.therapistId,
          p_date: b.date,
          p_time_slot: b.timeSlot,
          p_intake: b.intake,
        })
      ) as { id: string; reference_code: string; created_at: string }[];
      const r = rows[0];
      return { ...b, id: r.id, referenceCode: r.reference_code, createdAt: r.created_at, status: 'confirmed' };
    },

    async joinWaitlist(w) {
      const rows = must(
        await sb.rpc('join_waitlist', {
          p_patient_name: w.patientName,
          p_email: w.email,
          p_phone: w.phone,
          p_service_id: w.serviceId,
          p_therapist_id: w.therapistId,
          p_preferred_date: w.preferredDate,
          p_preferred_time_of_day: w.preferredTimeOfDay,
          p_pain_location: w.painLocation,
          p_notes: w.notes || '',
        })
      ) as { id: string; reference_code: string; created_at: string }[];
      const r = rows[0];
      return { ...w, id: r.id, referenceCode: r.reference_code, createdAt: r.created_at, status: 'active' };
    },

    async findPatientBookings(ref, email) {
      const rows = must(await sb.rpc('patient_bookings', { p_ref: ref, p_email: email })) as ApptRow[];
      return rows.map(rowToAppt);
    },

    async patientCancel(ref, email) {
      const ok = must(await sb.rpc('patient_cancel', { p_ref: ref, p_email: email }));
      if (!ok) throw new Error('not_found');
    },

    async patientReschedule(ref, email, date, timeSlot) {
      const ok = must(
        await sb.rpc('patient_reschedule', { p_ref: ref, p_email: email, p_date: date, p_time_slot: timeSlot })
      );
      if (!ok) throw new Error('not_found');
    },

    getStaffUser: checkStaff,

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => cb(event));
      return () => data.subscription.unsubscribe();
    },

    async signIn(email, password) {
      const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const staff = await checkStaff();
      if (!staff) {
        await sb.auth.signOut();
        throw new Error('not_staff');
      }
      return staff;
    },

    async sendPasswordReset(email) {
      must(await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }));
    },

    async updatePassword(newPassword) {
      const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async loadStaff() {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const [a, w, b] = await Promise.all([
        sb.from('appointments').select('*').gte('appt_date', ymd(since)).order('appt_date', { ascending: false }),
        sb.from('waitlist').select('*').order('created_at', { ascending: false }),
        sb.from('blocked_slots').select('*').order('created_at', { ascending: false }),
      ]);
      return {
        appointments: (must(a) as ApptRow[]).map(rowToAppt),
        waitlist: (must(w) as WaitRow[]).map(rowToWait),
        blockedSlots: (must(b) as BlockRow[]).map(rowToBlock),
      };
    },

    async staffCreateAppointment(b) {
      const rows = must(
        await sb
          .from('appointments')
          .insert({
            service_id: b.serviceId,
            therapist_id: b.therapistId,
            appt_date: b.date,
            time_slot: b.timeSlot,
            status: b.status || 'confirmed',
            intake: b.intake,
            clinical_notes: b.clinicalNotes || null,
          })
          .select('*')
      ) as ApptRow[];
      return rowToAppt(rows[0]);
    },

    async staffUpdateAppointment(a) {
      must(
        await sb
          .from('appointments')
          .update({
            service_id: a.serviceId,
            therapist_id: a.therapistId,
            appt_date: a.date,
            time_slot: a.timeSlot,
            status: a.status,
            intake: a.intake,
            clinical_notes: a.clinicalNotes || null,
          })
          .eq('id', a.id)
      );
    },

    async staffAddBlock(b) {
      must(
        await sb.from('blocked_slots').insert({
          title: b.title,
          type: b.type,
          therapist_id: b.therapistId,
          block_date: b.date || null,
          start_date: b.startDate || null,
          end_date: b.endDate || null,
          time_slots: b.timeSlots || null,
          is_full_day: !!b.isFullDay,
          recurring_daily: !!b.recurringDaily,
          notes: b.notes || null,
        })
      );
    },

    async staffRemoveBlock(id) {
      must(await sb.from('blocked_slots').delete().eq('id', id));
    },

    async staffUpdateWaitlist(w) {
      must(
        await sb
          .from('waitlist')
          .update({
            patient_name: w.patientName,
            email: w.email,
            phone: w.phone,
            service_id: w.serviceId,
            therapist_id: w.therapistId,
            preferred_date: w.preferredDate,
            preferred_time_of_day: w.preferredTimeOfDay,
            pain_location: w.painLocation,
            notes: w.notes || null,
            status: w.status,
          })
          .eq('id', w.id)
      );
    },

    async staffRemoveWaitlist(id) {
      must(await sb.from('waitlist').delete().eq('id', id));
    },
  };
}

// ---------------------------------------------------------------------------
// DEMO (this browser only)
// ---------------------------------------------------------------------------
const KEYS = {
  appointments: 'msk_hacks_demo_appointments_v3',
  blocks: 'msk_hacks_demo_blocks_v3',
  waitlist: 'msk_hacks_demo_waitlist_v3',
};

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}
function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function demoBackend(): Backend {
  let appointments: Appointment[] = readLS(KEYS.appointments, INITIAL_APPOINTMENTS);
  let blocks: BlockedTimeSlot[] = readLS(KEYS.blocks, INITIAL_BLOCKED_SLOTS);
  let waitlist: WaitlistEntry[] = readLS(KEYS.waitlist, INITIAL_WAITLIST);
  const save = () => {
    writeLS(KEYS.appointments, appointments);
    writeLS(KEYS.blocks, blocks);
    writeLS(KEYS.waitlist, waitlist);
  };
  const slotTaken = (therapistId: string, date: string, slot: string, exceptId?: string) =>
    appointments.some(
      (a) => a.id !== exceptId && a.status !== 'cancelled' && a.therapistId === therapistId && a.date === date && a.timeSlot === slot
    );
  const findOwn = (ref: string, email: string) =>
    appointments.find(
      (a) =>
        a.referenceCode.toUpperCase() === ref.trim().toUpperCase() &&
        a.intake.email.trim().toLowerCase() === email.trim().toLowerCase()
    );

  return {
    mode: 'demo',
    async loadPublic() {
      return { booked: appointments, blockedSlots: blocks };
    },
    async createBooking(b) {
      if (slotTaken(b.therapistId, b.date, b.timeSlot)) throw new Error('slot_taken');
      if (isSlotBlocked(b.date, b.timeSlot, b.therapistId, blocks).blocked) throw new Error('slot_blocked');
      const appt: Appointment = {
        ...b,
        id: `apt-${Date.now()}`,
        referenceCode: generateReferenceCode(),
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };
      appointments = [appt, ...appointments];
      save();
      return appt;
    },
    async joinWaitlist(w) {
      const entry: WaitlistEntry = {
        ...w,
        id: `wait-${Date.now()}`,
        referenceCode: generateWaitlistCode(),
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      waitlist = [entry, ...waitlist];
      save();
      return entry;
    },
    async findPatientBookings(ref, email) {
      const own = findOwn(ref, email);
      if (!own) return [];
      const e = own.intake.email.trim().toLowerCase();
      return appointments.filter((a) => a.intake.email.trim().toLowerCase() === e).map((a) => ({ ...a, clinicalNotes: undefined }));
    },
    async patientCancel(ref, email) {
      const own = findOwn(ref, email);
      if (!own) throw new Error('not_found');
      appointments = appointments.map((a) => (a.id === own.id ? { ...a, status: 'cancelled' } : a));
      save();
    },
    async patientReschedule(ref, email, date, timeSlot) {
      const own = findOwn(ref, email);
      if (!own) throw new Error('not_found');
      if (slotTaken(own.therapistId, date, timeSlot, own.id)) throw new Error('slot_taken');
      if (isSlotBlocked(date, timeSlot, own.therapistId, blocks).blocked) throw new Error('slot_blocked');
      appointments = appointments.map((a) => (a.id === own.id ? { ...a, date, timeSlot, status: 'rescheduled' } : a));
      save();
    },
    async getStaffUser() {
      return { email: 'demo' };
    },
    onAuthChange() {
      return () => {};
    },
    async signIn() {
      return { email: 'demo' };
    },
    async sendPasswordReset() {},
    async updatePassword() {},
    async signOut() {},
    async loadStaff() {
      return { appointments, waitlist, blockedSlots: blocks };
    },
    async staffCreateAppointment(b) {
      if (slotTaken(b.therapistId, b.date, b.timeSlot)) throw new Error('slot_taken');
      const appt: Appointment = {
        ...b,
        id: `apt-${Date.now()}`,
        referenceCode: generateReferenceCode(),
        status: b.status || 'confirmed',
        createdAt: new Date().toISOString(),
      };
      appointments = [appt, ...appointments];
      save();
      return appt;
    },
    async staffUpdateAppointment(a) {
      appointments = appointments.map((x) => (x.id === a.id ? a : x));
      save();
    },
    async staffAddBlock(b) {
      blocks = [b, ...blocks];
      save();
    },
    async staffRemoveBlock(id) {
      blocks = blocks.filter((b) => b.id !== id);
      save();
    },
    async staffUpdateWaitlist(w) {
      waitlist = waitlist.map((x) => (x.id === w.id ? w : x));
      save();
    },
    async staffRemoveWaitlist(id) {
      waitlist = waitlist.filter((w) => w.id !== id);
      save();
    },
  };
}

// ---------------------------------------------------------------------------
// Settings come from public/config.js (edit that file after building), or from build-time env vars.
const runtime = (window as unknown as { MSK_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string } }).MSK_CONFIG || {};
const url = (runtime.supabaseUrl || (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '').trim();
const anonKey = (runtime.supabaseAnonKey || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '').trim();

export const backend: Backend =
  url && anonKey ? liveBackend(createClient(url, anonKey)) : demoBackend();
