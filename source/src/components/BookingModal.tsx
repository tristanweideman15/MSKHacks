import { formatPrice } from '../utils/format';
import React, { useState, useEffect } from 'react';
import { NewBooking, NewWaitlist, friendlyError } from '../lib/backend';
import {
  SERVICES,
  THERAPISTS,
  CLINIC_INFO,
} from '../data/mockData';
import { TherapyService, Therapist, Appointment, PatientIntake, BlockedTimeSlot, EmailNotification, WaitlistEntry } from '../types';
import {
  generateDailyTimeSlots,
  formatDatePretty,
  downloadCalendarIcs,
  isDateBlocked,
  isSlotBlocked,
  createBookingEmails,
  createWaitlistEmails,
} from '../utils/calendar';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  User,
  Shield,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  MapPin,
  ChevronRight,
  Mail,
  Eye,
  Bell,
  Check,
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedServiceId?: string;
  preSelectedTherapistId?: string;
  preSelectedDate?: string;
  preSelectedSlot?: string;
  initialMode?: 'booking' | 'waitlist';
  existingAppointments: Appointment[];
  blockedSlots: BlockedTimeSlot[];
  /** Saves the booking and returns it with its real reference code. Throws on failure. */
  onSaveAppointment: (booking: NewBooking) => Promise<{ appointment: Appointment; patientEmail: EmailNotification; practiceEmail: EmailNotification }>;
  onSaveWaitlistEntry?: (entry: NewWaitlist) => Promise<{ entry: WaitlistEntry; patientEmail: EmailNotification; practiceEmail: EmailNotification }>;
  onOpenEmailPreview?: (patientEmail: EmailNotification, practiceEmail: EmailNotification) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  preSelectedServiceId,
  preSelectedTherapistId,
  preSelectedDate,
  preSelectedSlot,
  initialMode,
  existingAppointments,
  blockedSlots,
  onSaveAppointment,
  onSaveWaitlistEntry,
  onOpenEmailPreview,
}) => {
  // Step tracking: 1: Service, 2: Provider, 3: Date & Slot, 4: Intake Details, 5: Confirmation
  const [step, setStep] = useState<number>(1);

  // Form selections
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preSelectedServiceId || SERVICES[0].id
  );
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(
    preSelectedTherapistId || 'any'
  );
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  // Waitlist Mode State
  const [isWaitlistFlow, setIsWaitlistFlow] = useState<boolean>(initialMode === 'waitlist');
  const [waitlistIntake, setWaitlistIntake] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredTimeOfDay: 'any' as 'morning' | 'afternoon' | 'any',
    painLocation: 'Lower Back & Spine',
    notes: '',
  });
  const [createdWaitlist, setCreatedWaitlist] = useState<WaitlistEntry | null>(null);

  // Intake State
  const [intake, setIntake] = useState<PatientIntake>({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    painLocation: 'Lower Back & Spine',
    painLevel: 5,
    injuryDuration: 'subacute',
    hasReferral: false,
    insuranceType: 'in-network',
    insuranceProvider: '',
    symptomsDescription: '',
  });

  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);
  const [createdEmails, setCreatedEmails] = useState<{ patientEmail: EmailNotification; practiceEmail: EmailNotification } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      if (preSelectedServiceId) setSelectedServiceId(preSelectedServiceId);
      if (preSelectedTherapistId) setSelectedTherapistId(preSelectedTherapistId);
      
      if (preSelectedDate) {
        setSelectedDate(preSelectedDate);
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 1);
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        setSelectedDate(`${yyyy}-${mm}-${dd}`);
      }

      if (preSelectedSlot) {
        setSelectedSlot(preSelectedSlot);
      }

      setIsWaitlistFlow(initialMode === 'waitlist');
      setCreatedWaitlist(null);
      setCreatedAppointment(null);
      setCreatedEmails(null);
      setSubmitError(null);
      setSubmitting(false);
      setConsent(false);

      // Auto-prefill contact details from saved patient profile if available
      try {
        const savedProfileStr = localStorage.getItem('msk_hacks_patient_profile_v1');
        if (savedProfileStr) {
          const profile = JSON.parse(savedProfileStr);
          if (profile.fullName || profile.email || profile.phone) {
            setIntake((prev) => ({
              ...prev,
              fullName: profile.fullName || prev.fullName,
              email: profile.email || prev.email,
              phone: profile.phone || prev.phone,
              dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
              painLocation: profile.painLocation || prev.painLocation,
              insuranceType: profile.insuranceType || prev.insuranceType,
              insuranceProvider: profile.insuranceProvider || prev.insuranceProvider,
              emergencyContactName: profile.emergencyContactName || prev.emergencyContactName,
              emergencyContactPhone: profile.emergencyContactPhone || prev.emergencyContactPhone,
            }));
            setWaitlistIntake((prev) => ({
              ...prev,
              fullName: profile.fullName || prev.fullName,
              email: profile.email || prev.email,
              phone: profile.phone || prev.phone,
              painLocation: profile.painLocation || prev.painLocation,
            }));
          }
        }
      } catch (err) {
        console.warn('Could not read saved profile in BookingModal', err);
      }

      if (initialMode === 'waitlist') {
        // Waitlist mode directly
      } else if (preSelectedSlot && preSelectedDate) {
        setStep(4);
      } else if (preSelectedServiceId) {
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [isOpen, preSelectedServiceId, preSelectedTherapistId, preSelectedDate, preSelectedSlot, initialMode]);

  if (!isOpen) return null;

  const currentService = SERVICES.find((s) => s.id === selectedServiceId) || SERVICES[0];
  const activeTherapist = THERAPISTS.find((t) => t.id === selectedTherapistId);

  // Compute available dates (next 21 days excluding Sundays)
  const availableDates: { dateStr: string; dayName: string; dayNum: number; monthName: string; isHoliday: boolean }[] = [];
  const today = new Date();
  for (let i = 1; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // Weekend closed for online booking
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    const holiday = isDateBlocked(dateStr, selectedTherapistId, blockedSlots);
    availableDates.push({
      dateStr,
      dayName: d.toLocaleDateString('en-ZA', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('en-ZA', { month: 'short' }),
      isHoliday: holiday.blocked,
    });
  }

  // Generate slots for selected date & therapist
  const allDailySlots = generateDailyTimeSlots(
    activeTherapist?.workingHours.start || THERAPISTS[0].workingHours.start,
    activeTherapist?.workingHours.end || THERAPISTS[0].workingHours.end,
    currentService.durationMinutes <= 45 ? 45 : 60
  );

  // Filter slots already booked or blocked by staff lunch / holidays
  const bookedSlotsForDate = existingAppointments
    .filter((a) => {
      if (a.date !== selectedDate || a.status === 'cancelled') return false;
      if (selectedTherapistId !== 'any' && a.therapistId !== selectedTherapistId) return false;
      return true;
    })
    .map((a) => a.timeSlot);

  const availableSlots = allDailySlots.filter((slot) => {
    if (bookedSlotsForDate.includes(slot)) return false;
    const block = isSlotBlocked(selectedDate, slot, selectedTherapistId, blockedSlots);
    return !block.blocked;
  });

  const selectedDateIsHoliday = isDateBlocked(selectedDate, selectedTherapistId, blockedSlots);

  // Validation
  const validateIntake = () => {
    const errors: { [key: string]: string } = {};
    if (!intake.fullName.trim()) errors.fullName = 'Full legal name is required';
    if (!intake.email.trim() || !intake.email.includes('@')) errors.email = 'Valid email is required';
    if (!intake.phone.trim() || intake.phone.length < 7) errors.phone = 'Valid phone number is required';
    if (!intake.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    if (!intake.symptomsDescription.trim()) {
      errors.symptomsDescription = 'Please briefly describe your pain or limitation';
    }
    if (!consent) errors.consent = 'Please tick the box to agree to us keeping your details';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmBooking = async () => {
    if (!validateIntake() || submitting) return;

    // Determine therapist if 'any'
    let assignedTherapistId = selectedTherapistId;
    if (assignedTherapistId === 'any') {
      assignedTherapistId = THERAPISTS[0].id;
    }
    const assignedTherapist = THERAPISTS.find((t) => t.id === assignedTherapistId) || THERAPISTS[0];

    void assignedTherapist;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { appointment, patientEmail, practiceEmail } = await onSaveAppointment({
        serviceId: selectedServiceId,
        therapistId: assignedTherapistId,
        date: selectedDate,
        timeSlot: selectedSlot,
        intake: { ...intake, fullName: intake.fullName.trim(), email: intake.email.trim(), phone: intake.phone.trim() },
      });
      setCreatedAppointment(appointment);
      setCreatedEmails({ patientEmail, practiceEmail });
      setStep(5);
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const validateWaitlist = () => {
    const errors: { [key: string]: string } = {};
    if (!waitlistIntake.fullName.trim()) errors.waitlistFullName = 'Full legal name is required';
    if (!waitlistIntake.email.trim() || !waitlistIntake.email.includes('@')) {
      errors.waitlistEmail = 'Valid email address is required';
    }
    if (!waitlistIntake.phone.trim() || waitlistIntake.phone.length < 7) {
      errors.waitlistPhone = 'Valid phone number is required for SMS/call alerts';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmWaitlist = async () => {
    if (!validateWaitlist() || submitting) return;

    let assignedTherapistId = selectedTherapistId;
    if (assignedTherapistId === 'any') {
      assignedTherapistId = THERAPISTS[0].id;
    }
    setSubmitting(true);
    setSubmitError(null);
    const newWaitlist: NewWaitlist = {
      patientName: waitlistIntake.fullName.trim(),
      email: waitlistIntake.email.trim(),
      phone: waitlistIntake.phone.trim(),
      serviceId: selectedServiceId,
      therapistId: assignedTherapistId,
      preferredDate: selectedDate,
      preferredTimeOfDay: waitlistIntake.preferredTimeOfDay,
      painLocation: waitlistIntake.painLocation,
      notes: waitlistIntake.notes.trim() || undefined,
    };

    try {
      if (!onSaveWaitlistEntry) return;
      const { entry, patientEmail, practiceEmail } = await onSaveWaitlistEntry(newWaitlist);
      setCreatedWaitlist(entry);
      setCreatedEmails({ patientEmail, practiceEmail });
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const painScaleDescriptions = [
    'No discomfort at all',
    'Very mild noticeability',
    'Mild ache; doesn’t stop activities',
    'Tolerable; distracting at times',
    'Moderate; limits vigorous activity',
    'Noticeable pain; restricts daily tasks',
    'Significant pain; difficult to concentrate',
    'Severe; restricts normal movement',
    'Intense; impairs sleep and basic mobility',
    'Very severe; barely able to move',
    'Extreme pain requiring emergency medical care',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
              {isWaitlistFlow ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-800">Priority Patient Waitlist</span>
                </>
              ) : (
                <span>Online Appointment Booking</span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isWaitlistFlow ? (
                createdWaitlist ? (
                  'Waitlist Confirmation'
                ) : (
                  `Join Waitlist for ${formatDatePretty(selectedDate)}`
                )
              ) : (
                <>
                  {step === 1 && 'Step 1: Choose a service'}
                  {step === 2 && 'Step 2: Your physiotherapist'}
                  {step === 3 && 'Step 3: Select Date & Available Time'}
                  {step === 4 && 'Step 4: Patient Intake & Health Details'}
                  {step === 5 && 'Appointment Confirmed'}
                </>
              )}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close booking modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator (Steps 1-4, regular flow only) */}
        {!isWaitlistFlow && step < 5 && (
          <div className="px-6 pt-3 pb-2 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className={step >= 1 ? 'font-semibold text-teal-800' : ''}>1. Service</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className={step >= 2 ? 'font-semibold text-teal-800' : ''}>2. Physio</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className={step >= 3 ? 'font-semibold text-teal-800' : ''}>3. Time Slot</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className={step >= 4 ? 'font-semibold text-teal-800' : ''}>4. Intake</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 text-sm">
          {/* WAITLIST FLOW */}
          {isWaitlistFlow ? (
            createdWaitlist ? (
              /* Waitlist Confirmation Screen */
              <div className="text-center py-4 space-y-6">
                <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <Bell className="w-8 h-8 text-amber-700" />
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                    Added to Priority Waitlist
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    You're in line, {createdWaitlist.patientName.split(' ')[0]}!
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                    Our front desk has received your request. We actively monitor schedule shifts throughout the day and will reach out the moment a cancellation occurs.
                  </p>
                </div>

                {/* Reference Card */}
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-left max-w-lg mx-auto space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <span className="text-xs text-slate-500">Waitlist Confirmation Code:</span>
                    <span className="font-mono font-bold text-amber-900 text-base tabular-nums bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
                      {createdWaitlist.referenceCode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Service:</span>
                      <div className="font-semibold text-slate-900">{currentService.title}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Provider:</span>
                      <div className="font-semibold text-slate-900">
                        {THERAPISTS.find((t) => t.id === createdWaitlist.therapistId)?.name || 'Mathenjwa SK'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Target Date:</span>
                      <div className="font-semibold text-slate-900">
                        {formatDatePretty(createdWaitlist.preferredDate)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Time Preference:</span>
                      <div className="font-semibold text-slate-900 capitalize">
                        {createdWaitlist.preferredTimeOfDay} slots
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Confirmation Dispatched Badge */}
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-left max-w-lg mx-auto flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-teal-900">Waitlist summary</div>
                      <div className="text-teal-700 text-[11px]">
                        We will contact you if a slot opens
                      </div>
                    </div>
                  </div>

                  {createdEmails && onOpenEmailPreview && (
                    <button
                      onClick={() =>
                        onOpenEmailPreview(createdEmails.patientEmail, createdEmails.practiceEmail)
                      }
                      className="px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-teal-800 font-semibold hover:bg-teal-100 transition-colors cursor-pointer text-xs flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Emails</span>
                    </button>
                  )}
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Close &amp; Return to Home
                  </button>
                </div>
              </div>
            ) : (
              /* Waitlist Intake Form */
              <div className="space-y-5">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-700" />
                    <span>Priority Waitlist for {formatDatePretty(selectedDate)}</span>
                  </div>
                  <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                    Leave your contact details below. When an appointment opens up on this date, you will receive priority notification.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Naledi Mokoena"
                      value={waitlistIntake.fullName}
                      onChange={(e) => setWaitlistIntake({ ...waitlistIntake, fullName: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                        formErrors.waitlistFullName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.waitlistFullName && (
                      <div className="text-[11px] text-rose-600 mt-1">{formErrors.waitlistFullName}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Phone (for instant SMS alert) *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 082 123 4567"
                      value={waitlistIntake.phone}
                      onChange={(e) => setWaitlistIntake({ ...waitlistIntake, phone: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                        formErrors.waitlistPhone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.waitlistPhone && (
                      <div className="text-[11px] text-rose-600 mt-1">{formErrors.waitlistPhone}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      placeholder="naledi@example.com"
                      value={waitlistIntake.email}
                      onChange={(e) => setWaitlistIntake({ ...waitlistIntake, email: e.target.value })}
                      className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                        formErrors.waitlistEmail ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.waitlistEmail && (
                      <div className="text-[11px] text-rose-600 mt-1">{formErrors.waitlistEmail}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Preferred Time of Day
                    </label>
                    <select
                      value={waitlistIntake.preferredTimeOfDay}
                      onChange={(e) =>
                        setWaitlistIntake({
                          ...waitlistIntake,
                          preferredTimeOfDay: e.target.value as 'morning' | 'afternoon' | 'any',
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="any">Any available time</option>
                      <option value="morning">Morning (08:00 – 12:30)</option>
                      <option value="afternoon">Afternoon (13:15 – 17:00)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Service
                    </label>
                    <select
                      value={selectedServiceId}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      {SERVICES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Area of Pain / Condition
                    </label>
                    <select
                      value={waitlistIntake.painLocation}
                      onChange={(e) => setWaitlistIntake({ ...waitlistIntake, painLocation: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="Lower Back & Spine">Lower Back & Spine / Sciatica</option>
                      <option value="Neck & Upper Back">Neck & Upper Back / Posture</option>
                      <option value="Shoulder & Rotator Cuff">Shoulder & Rotator Cuff</option>
                      <option value="Knee & ACL/Meniscus">Knee & ACL / Meniscus</option>
                      <option value="Hip & Pelvis">Hip & Pelvis</option>
                      <option value="Ankle & Foot">Ankle & Foot / Plantar Fasciitis</option>
                      <option value="Post-Surgical Joint">Post-Surgical Joint Rehabilitation</option>
                      <option value="Other">Other Condition</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Schedule Notes / Symptoms (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Need appointment before 10 AM or after 3 PM. Sudden lower back flare-up."
                    value={waitlistIntake.notes}
                    onChange={(e) => setWaitlistIntake({ ...waitlistIntake, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                {/* Waitlist Form Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsWaitlistFlow(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    ← Back to Regular Schedule
                  </button>

                  {submitError && <span className="text-xs text-red-700 max-w-xs">{submitError}</span>}
                  <button
                    type="button"
                    onClick={handleConfirmWaitlist}
                    disabled={submitting}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 active:scale-[0.98] rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Submit Priority Waitlist Request</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              {/* STEP 1: Select Service */}
              {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 mb-2">
                Every session is one-on-one with your physiotherapist.
              </p>
              <div className="space-y-3">
                {SERVICES.map((service) => {
                  const isSelected = selectedServiceId === service.id;
                  return (
                    <div
                      key={service.id}
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/40 shadow-sm ring-1 ring-teal-700'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{service.title}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{service.shortDescription}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {service.durationMinutes} min
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-900">{formatPrice(service.price)}</span>
                            <span aria-hidden="true">·</span>
                            <span>Medical aid or private</span>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                            isSelected ? 'border-teal-700 bg-teal-700' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Select Provider */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 mb-3">
                All sessions are with Mathenjwa SK (BSc Physiotherapy).
              </p>

              <div className="space-y-3">
                {/* Any Provider Option */}
                <div
                  onClick={() => setSelectedTherapistId('any')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedTherapistId === 'any'
                      ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold text-xs border border-slate-200">
                      ⚡ Any
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">Earliest available appointment</div>
                      <div className="text-xs text-slate-500">Shows the first open slot</div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedTherapistId === 'any' ? 'border-teal-700 bg-teal-700' : 'border-slate-300'
                    }`}
                  >
                    {selectedTherapistId === 'any' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>

                {/* Specific Therapists */}
                {THERAPISTS.map((therapist) => {
                  const isSelected = selectedTherapistId === therapist.id;
                  return (
                    <div
                      key={therapist.id}
                      onClick={() => setSelectedTherapistId(therapist.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={therapist.imageUrl}
                          alt={therapist.name}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{therapist.name}</div>
                          <div className="text-xs text-teal-800 font-medium">{therapist.specialty}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{therapist.yearsExperience} yrs experience · 1-on-1 care</div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-teal-700 bg-teal-700' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Select Date & Available Time */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  1. Choose Date
                </label>
                {/* Horizontal scrollable date buttons */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {availableDates.map((item) => {
                    const isSelected = selectedDate === item.dateStr;
                    return (
                      <button
                        key={item.dateStr}
                        onClick={() => {
                          setSelectedDate(item.dateStr);
                          setSelectedSlot('');
                        }}
                        className={`p-2.5 rounded-xl border text-center min-w-[70px] shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-800 text-white border-teal-800 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-[10px] uppercase font-semibold opacity-80">{item.dayName}</div>
                        <div className="text-base font-bold my-0.5 tabular-nums">{item.dayNum}</div>
                        <div className="text-[10px] opacity-80">{item.monthName}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Select Available Time Slot
                  </label>
                  <span className="text-xs text-slate-500">
                    {formatDatePretty(selectedDate)}
                  </span>
                </div>

                {availableSlots.length === 0 ? (
                  <div className="p-5 rounded-xl bg-teal-50/80 border border-teal-200 text-center text-xs space-y-3">
                    <div className="w-9 h-9 rounded-full bg-teal-800 text-white flex items-center justify-center mx-auto">
                      <Bell className="w-4 h-4 text-teal-200" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">All Slots Fully Booked on this Date</div>
                      <p className="text-slate-600 text-[11px] mt-1 max-w-sm mx-auto">
                        No openings remaining on {formatDatePretty(selectedDate)}. Join our Priority Waitlist — our clinical team will contact you the moment an opening appears.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsWaitlistFlow(true)}
                      className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs flex items-center justify-center gap-1.5 mx-auto shadow-sm"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Join Priority Waitlist for {formatDatePretty(selectedDate)}</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer tabular-nums text-center ${
                              isSelected
                                ? 'bg-teal-800 text-white border-teal-800 shadow-sm'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-teal-700 hover:bg-teal-50/30'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-1 text-[11px] text-slate-500">
                      <span>Can't find a time that works?</span>
                      <button
                        type="button"
                        onClick={() => setIsWaitlistFlow(true)}
                        className="font-semibold text-teal-800 hover:text-teal-950 underline cursor-pointer"
                      >
                        Join Priority Waitlist
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Patient Intake Details */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Summary strip */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 gap-2">
                <div>
                  <span className="font-semibold text-slate-900">{currentService.title}</span>
                  <div className="text-slate-500 mt-0.5">
                    {formatDatePretty(selectedDate)} at {selectedSlot} · {activeTherapist?.name || 'Mathenjwa SK'}
                  </div>
                </div>
                <div className="font-semibold text-slate-900">{formatPrice(currentService.price)}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patient Full Legal Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Naledi Mokoena"
                    value={intake.fullName}
                    onChange={(e) => setIntake({ ...intake, fullName: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                      formErrors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.fullName && <div className="text-[11px] text-rose-600 mt-1">{formErrors.fullName}</div>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={intake.dateOfBirth}
                    onChange={(e) => setIntake({ ...intake, dateOfBirth: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                      formErrors.dateOfBirth ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.dateOfBirth && <div className="text-[11px] text-rose-600 mt-1">{formErrors.dateOfBirth}</div>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email address *
                  </label>
                  <input
                    type="email"
                    placeholder="naledi@example.com"
                    value={intake.email}
                    onChange={(e) => setIntake({ ...intake, email: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                      formErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.email && <div className="text-[11px] text-rose-600 mt-1">{formErrors.email}</div>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile number *
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 082 123 4567"
                    value={intake.phone}
                    onChange={(e) => setIntake({ ...intake, phone: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                      formErrors.phone ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.phone && <div className="text-[11px] text-rose-600 mt-1">{formErrors.phone}</div>}
                </div>
              </div>

              {/* Clinical questions */}
              <div className="pt-2 border-t border-slate-100 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="font-semibold text-slate-700">
                      Current Pain / Discomfort Scale: <span className="text-teal-800 font-bold tabular-nums">{intake.painLevel}/10</span>
                    </label>
                    <span className="text-slate-500 text-[11px]">{painScaleDescriptions[intake.painLevel]}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={intake.painLevel}
                    onChange={(e) => setIntake({ ...intake, painLevel: parseInt(e.target.value, 10) })}
                    className="w-full accent-teal-700 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Area of Discomfort
                    </label>
                    <select
                      value={intake.painLocation}
                      onChange={(e) => setIntake({ ...intake, painLocation: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="Lower Back & Spine">Lower Back & Spine / Sciatica</option>
                      <option value="Neck & Upper Back">Neck & Upper Back / Posture</option>
                      <option value="Shoulder & Rotator Cuff">Shoulder & Rotator Cuff</option>
                      <option value="Knee & ACL/Meniscus">Knee & ACL / Meniscus</option>
                      <option value="Hip & Pelvis">Hip & Pelvis</option>
                      <option value="Ankle & Foot">Ankle & Foot / Plantar Fasciitis</option>
                      <option value="Post-Surgical Joint">Post-Surgical Joint Rehabilitation</option>
                      <option value="Running Gait & Biomechanics">Running Gait & Athletic Tune-up</option>
                      <option value="Other">Other condition</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      How long have you had this issue?
                    </label>
                    <select
                      value={intake.injuryDuration}
                      onChange={(e) =>
                        setIntake({ ...intake, injuryDuration: e.target.value as 'acute' | 'subacute' | 'chronic' })
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="acute">Recent acute injury (&lt; 2 weeks)</option>
                      <option value="subacute">Subacute issue (2 to 8 weeks)</option>
                      <option value="chronic">Chronic / persistent pain (&gt; 2 months)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Describe your pain or mobility goals *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Pain flares when standing up from desk or bending to tie shoes. Want to return to running."
                    value={intake.symptomsDescription}
                    onChange={(e) => setIntake({ ...intake, symptomsDescription: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-teal-700 ${
                      formErrors.symptomsDescription ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.symptomsDescription && (
                    <div className="text-[11px] text-rose-600 mt-1">{formErrors.symptomsDescription}</div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment method
                    </label>
                    <select
                      value={intake.insuranceType}
                      onChange={(e) =>
                        setIntake({
                          ...intake,
                          insuranceType: e.target.value as 'in-network' | 'self-pay' | 'hsa-fsa',
                        })
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="in-network">Medical aid</option>
                      <option value="self-pay">Private (cash)</option>
                      <option value="hsa-fsa">Card / EFT</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Medical aid scheme (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Discovery Health, Bonitas, GEMS"
                      value={intake.insuranceProvider || ''}
                      onChange={(e) => setIntake({ ...intake, insuranceProvider: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="hasReferral"
                    checked={intake.hasReferral}
                    onChange={(e) => setIntake({ ...intake, hasReferral: e.target.checked })}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  <label htmlFor="hasReferral" className="text-xs text-slate-600 cursor-pointer">
                    I have a doctor’s referral, X-rays or scan reports (not required)
                  </label>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="popiaConsent"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  <label htmlFor="popiaConsent" className="text-xs text-slate-600 cursor-pointer">
                    I agree that MSK Hacks Physiotherapy may store the details on this form, including health information,
                    to manage my appointment and treatment. *
                  </label>
                </div>
                {formErrors.consent && <p className="text-[11px] text-red-600">{formErrors.consent}</p>}
              </div>
            </div>
          )}

          {/* STEP 5: Booking Confirmation Screen */}
          {step === 5 && createdAppointment && (
            <div className="text-center py-4 space-y-6">
              <div className="w-14 h-14 bg-teal-100 text-teal-800 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-teal-800" />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                  Appointment Scheduled
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                  We look forward to seeing you, {createdAppointment.intake.fullName.split(' ')[0]}!
                </h3>
                <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto">
                  Your booking with Mathenjwa SK has been recorded. Please save your reference code below.
                </p>
              </div>

              {/* Reference Card */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-left max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <span className="text-xs text-slate-500">Booking Reference Code:</span>
                  <span className="font-mono font-bold text-teal-900 text-base tabular-nums bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                    {createdAppointment.referenceCode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Service:</span>
                    <div className="font-semibold text-slate-900">{currentService.title}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Physiotherapist:</span>
                    <div className="font-semibold text-slate-900">
                      {THERAPISTS.find((t) => t.id === createdAppointment.therapistId)?.name || 'Mathenjwa SK'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Date & Time:</span>
                    <div className="font-semibold text-slate-900">
                      {formatDatePretty(createdAppointment.date)} at {createdAppointment.timeSlot}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Location:</span>
                    <div className="font-semibold text-slate-900">
                      {CLINIC_INFO.address}, {CLINIC_INFO.cityStateZip}
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation Email Dispatch Badge */}
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-left max-w-lg mx-auto flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-teal-900">Booking summary</div>
                    <div className="text-teal-700 text-[11px]">
                      Preview your confirmation details
                    </div>
                  </div>
                </div>

                {createdEmails && onOpenEmailPreview && (
                  <button
                    onClick={() =>
                      onOpenEmailPreview(createdEmails.patientEmail, createdEmails.practiceEmail)
                    }
                    className="px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-teal-800 font-semibold hover:bg-teal-100 transition-colors cursor-pointer text-xs flex items-center gap-1 shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Emails</span>
                  </button>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() =>
                    downloadCalendarIcs(
                      createdAppointment,
                      currentService,
                      THERAPISTS.find((t) => t.id === createdAppointment.therapistId),
                      CLINIC_INFO
                    )
                  }
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Add to Google Calendar</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>

              {/* What to bring note */}
              <div className="text-left text-xs text-slate-500 bg-slate-50/80 p-4 rounded-xl border border-slate-100 max-w-lg mx-auto space-y-1.5">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Important Reminders For Your Visit:
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                  <span>Wear comfortable, loose clothing (shorts for legs, a vest or loose T-shirt for neck and shoulders).</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                  <span>{CLINIC_INFO.parkingInfo}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                  <span>Need to reschedule? Use "Find My Booking" with code <span className="font-semibold text-slate-800">{createdAppointment.referenceCode}</span>.</span>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Modal Footer Controls (Steps 1-4, regular flow only) */}
        {!isWaitlistFlow && step < 5 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 3 && !selectedSlot) {
                    alert('Please select an available time slot before continuing.');
                    return;
                  }
                  setStep(step + 1);
                }}
                disabled={step === 3 && !selectedSlot}
                className={`px-5 py-2 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                  step === 3 && !selectedSlot
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-teal-800 hover:bg-teal-900'
                }`}
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2">
                {submitError && <span className="text-xs text-red-700 max-w-sm text-right">{submitError}</span>}
                <button
                  onClick={handleConfirmBooking}
                  disabled={submitting}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 active:scale-[0.98] rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Booking…' : 'Confirm booking'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
