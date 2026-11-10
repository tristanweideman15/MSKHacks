import React, { useEffect, useState } from 'react';
import { Appointment, BlockedTimeSlot } from '../types';
import { SERVICES, THERAPISTS, CLINIC_INFO } from '../data/mockData';
import { formatDatePretty, generateDailyTimeSlots, downloadCalendarIcs, isDateBlocked, isSlotBlocked } from '../utils/calendar';
import { backend, friendlyError } from '../lib/backend';
import { todayStr } from '../utils/format';
import { X, Search, Calendar, Clock, MapPin, AlertTriangle, CheckCircle2, Phone, Loader2 } from 'lucide-react';

interface ManageBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Taken slots (no personal details) used to show free times when rescheduling. */
  booked: Appointment[];
  blockedSlots: BlockedTimeSlot[];
  onChanged: (message: string) => void;
  initialRef?: string;
  initialEmail?: string;
}

const statusStyle: Record<string, string> = {
  confirmed: 'bg-teal-50 text-teal-800 border-teal-200',
  rescheduled: 'bg-sky-50 text-sky-800 border-sky-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

export const ManageBookingModal: React.FC<ManageBookingModalProps> = ({
  isOpen,
  onClose,
  booked,
  blockedSlots,
  onChanged,
  initialRef,
  initialEmail,
}) => {
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [verified, setVerified] = useState<{ ref: string; email: string } | null>(null);
  const [bookings, setBookings] = useState<Appointment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<'reschedule' | 'cancel' | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRef(initialRef || '');
      setEmail(initialEmail || '');
      setError(null);
      setMode(null);
      setActiveId(null);
      if (!initialRef) {
        setBookings(null);
        setVerified(null);
      }
    }
  }, [isOpen, initialRef, initialEmail]);

  if (!isOpen) return null;

  const lookup = async (r: string, e: string) => {
    setBusy(true);
    setError(null);
    try {
      const found = await backend.findPatientBookings(r.trim(), e.trim());
      if (found.length === 0) {
        setBookings(null);
        setVerified(null);
        setError(friendlyError(new Error('not_found')));
      } else {
        setBookings(found);
        setVerified({ ref: r.trim(), email: e.trim() });
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const today = todayStr();
  const upcoming = (bookings || [])
    .filter((a) => a.date >= today && a.status !== 'cancelled' && a.status !== 'completed')
    .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
  const past = (bookings || []).filter((a) => !upcoming.includes(a));

  const active = bookings?.find((a) => a.id === activeId) || null;

  // Free slots for the chosen reschedule date
  const freeSlots = (() => {
    if (!active || !newDate) return [];
    const therapist = THERAPISTS.find((t) => t.id === active.therapistId) || THERAPISTS[0];
    const service = SERVICES.find((s) => s.id === active.serviceId) || SERVICES[0];
    const day = new Date(newDate + 'T00:00:00').getDay();
    if (day === 0 || day === 6) return [];
    if (isDateBlocked(newDate, therapist.id, blockedSlots).blocked) return [];
    const taken = booked
      .filter((b) => b.date === newDate && b.therapistId === therapist.id && b.status !== 'cancelled')
      .map((b) => b.timeSlot);
    return generateDailyTimeSlots(therapist.workingHours.start, therapist.workingHours.end, service.durationMinutes <= 45 ? 45 : 60).filter(
      (s) => !(taken.includes(s) && !(active.date === newDate && active.timeSlot === s)) && !isSlotBlocked(newDate, s, therapist.id, blockedSlots).blocked
    );
  })();

  const doAction = async (fn: () => Promise<void>, message: string) => {
    if (!verified || !active) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged(message);
      setMode(null);
      await lookup(verified.ref, verified.email);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 bg-white';

  const renderCard = (a: Appointment, canChange: boolean) => {
    const service = SERVICES.find((s) => s.id === a.serviceId);
    const therapist = THERAPISTS.find((t) => t.id === a.therapistId);
    const isActive = activeId === a.id;
    return (
      <div key={a.id} className={`rounded-xl border p-4 ${isActive ? 'border-teal-700 ring-1 ring-teal-700' : 'border-slate-200'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-slate-900 text-sm">{service?.title || 'Physiotherapy session'}</div>
            <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {formatDatePretty(a.date)} · <Clock className="w-3.5 h-3.5" /> {a.timeSlot}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {therapist?.name} · <span className="font-mono">{a.referenceCode}</span>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border capitalize ${statusStyle[a.status] || ''}`}>{a.status}</span>
        </div>

        {canChange && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => { setActiveId(a.id); setMode('reschedule'); setNewDate(''); setNewSlot(''); setError(null); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
            >
              Reschedule
            </button>
            <button
              onClick={() => { setActiveId(a.id); setMode('cancel'); setError(null); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => downloadCalendarIcs(a, service, therapist, CLINIC_INFO)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Add to calendar
            </button>
          </div>
        )}

        {isActive && mode === 'cancel' && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Cancel this appointment? Please give at least 24 hours’ notice where possible.</span>
            </div>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => doAction(() => backend.patientCancel(a.referenceCode, verified!.email), `Appointment ${a.referenceCode} cancelled.`)}
                className="px-3 py-1.5 font-semibold rounded-lg bg-red-700 text-white hover:bg-red-800 cursor-pointer disabled:opacity-60"
              >
                Yes, cancel it
              </button>
              <button onClick={() => setMode(null)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-white cursor-pointer">
                Keep it
              </button>
            </div>
          </div>
        )}

        {isActive && mode === 'reschedule' && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New date (weekdays)</label>
              <input type="date" min={today} className={input} value={newDate} onChange={(e) => { setNewDate(e.target.value); setNewSlot(''); }} />
            </div>
            {newDate && (
              freeSlots.length === 0 ? (
                <p className="text-xs text-slate-600">No online times on this day. Please choose another weekday, or call {CLINIC_INFO.phone}.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {freeSlots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewSlot(s)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${newSlot === s ? 'bg-teal-800 text-white border-teal-800' : 'bg-white border-slate-200 hover:border-teal-700'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )
            )}
            <div className="flex gap-2">
              <button
                disabled={busy || !newDate || !newSlot}
                onClick={() =>
                  doAction(
                    () => backend.patientReschedule(a.referenceCode, verified!.email, newDate, newSlot),
                    `Moved to ${formatDatePretty(newDate)} at ${newSlot}.`
                  )
                }
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-800 text-white hover:bg-teal-900 cursor-pointer disabled:opacity-50"
              >
                Confirm new time
              </button>
              <button onClick={() => setMode(null)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white cursor-pointer">
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800">My Bookings</div>
            <h3 className="text-base font-bold text-slate-900">Find, reschedule or cancel</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <form
            onSubmit={(e) => { e.preventDefault(); lookup(ref, email); }}
            className="space-y-3"
          >
            <p className="text-xs text-slate-600">
              Enter the reference code from your booking (e.g. MSK-7KQ2PX) and the email address you booked with.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={input + ' font-mono uppercase'} placeholder="Reference code" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Reference code" />
              <input className={input} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
            </div>
            <button
              type="submit"
              disabled={busy || !ref.trim() || !email.trim()}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Find my bookings
            </button>
          </form>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {bookings && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Upcoming</div>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-slate-600">No upcoming appointments.</p>
                ) : (
                  <div className="space-y-3">{upcoming.map((a) => renderCard(a, true))}</div>
                )}
              </div>
              {past.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Past & cancelled</div>
                  <div className="space-y-3">{past.map((a) => renderCard(a, false))}</div>
                </div>
              )}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {CLINIC_INFO.address}, {CLINIC_INFO.cityStateZip}</div>
                <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {CLINIC_INFO.phone} · {CLINIC_INFO.landline}</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Please arrive 10 minutes early in comfortable clothing.</div>
              </div>
            </div>
          )}

          {backend.mode === 'demo' && !bookings && (
            <p className="text-[11px] text-slate-400">Demo mode: try reference code MSK-7491 with sipho.demo@example.com.</p>
          )}
        </div>
      </div>
    </div>
  );
};
