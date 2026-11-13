import React, { useState, useEffect, useCallback } from 'react';
import { Appointment, BlockedTimeSlot, EmailNotification, WaitlistEntry } from './types';
import { SERVICES, THERAPISTS, CLINIC_INFO } from './data/mockData';
import { createBookingEmails, createWaitlistEmails } from './utils/calendar';
import { backend, friendlyError, NewBooking, NewWaitlist, StaffData, StaffUser } from './lib/backend';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { InteractiveBookingCalendar } from './components/InteractiveBookingCalendar';
import { SymptomTriage } from './components/SymptomTriage';
import { ServicesSection } from './components/ServicesSection';
import { TherapistsSection } from './components/TherapistsSection';
import { InsuranceFaqSection } from './components/InsuranceFaqSection';
import { Footer } from './components/Footer';
import { BookingModal } from './components/BookingModal';
import { ManageBookingModal } from './components/ManageBookingModal';
import { PractitionerPortal } from './components/PractitionerPortal';
import { StaffLogin } from './components/StaffLogin';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import { CheckCircle2, AlertTriangle, User } from 'lucide-react';
import { sendAppointmentEmails } from './lib/email';

const emptyStaffData: StaffData = { appointments: [], waitlist: [], blockedSlots: [] };

export default function App() {
  // Public data: taken slots (no personal details) and closures
  const [booked, setBooked] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedTimeSlot[]>([]);
  const [publicLoadError, setPublicLoadError] = useState<string | null>(null);

  // Staff session + data (only loaded after a staff member signs in)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [staffData, setStaffData] = useState<StaffData>(emptyStaffData);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Confirmation previews generated this session (no emails are sent)
  const [emails, setEmails] = useState<EmailNotification[]>([]);

  // Modals
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>();
  const [bookingTherapistId, setBookingTherapistId] = useState<string | undefined>();
  const [bookingDate, setBookingDate] = useState<string | undefined>();
  const [bookingSlot, setBookingSlot] = useState<string | undefined>();
  const [bookingInitialMode, setBookingInitialMode] = useState<'booking' | 'waitlist'>('booking');
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageRef, setManageRef] = useState<string | undefined>();
  const [manageEmail, setManageEmail] = useState<string | undefined>();
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [previewPatientEmail, setPreviewPatientEmail] = useState<EmailNotification | null>(null);
  const [previewPracticeEmail, setPreviewPracticeEmail] = useState<EmailNotification | null>(null);

  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const showToast = (text: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ text, kind });
    window.setTimeout(() => setToast(null), 6000);
  };

  // ------------------------------------------------------------------ loading
  const refreshPublic = useCallback(async () => {
    try {
      const r = await backend.loadPublic();
      setBooked(r.booked);
      setBlockedSlots(r.blockedSlots);
      setPublicLoadError(null);
    } catch (e) {
      setPublicLoadError(friendlyError(e));
    }
  }, []);

  const refreshStaff = useCallback(async () => {
    try {
      setStaffData(await backend.loadStaff());
    } catch (e) {
      showToast(friendlyError(e), 'error');
    }
  }, []);

  useEffect(() => {
    refreshPublic();
    backend.getStaffUser().then(setStaffUser);
    const unsubscribe = backend.onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsPortalOpen(true);
      }
      if (event === 'SIGNED_OUT') {
        setStaffUser(null);
        setStaffData(emptyStaffData);
      }
    });
    // Keep the public calendar fresh while the page is open
    const timer = window.setInterval(refreshPublic, 60_000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [refreshPublic]);

  const portalUnlocked = backend.mode === 'demo' || (!!staffUser && !isPasswordRecovery);

  useEffect(() => {
    if (isPortalOpen && portalUnlocked) refreshStaff();
  }, [isPortalOpen, portalUnlocked, refreshStaff]);

  const refreshAll = async () => {
    await Promise.all([refreshPublic(), portalUnlocked ? refreshStaff() : Promise.resolve()]);
  };

  // ------------------------------------------------------------------ patient actions
  const handleSaveNewAppointment = async (b: NewBooking) => {
   const handleSaveNewAppointment = async (b: NewBooking) => {
  try {
    const appointment = await backend.createBooking(b);
    const service = SERVICES.find((s) => s.id === appointment.serviceId) || SERVICES[0];
    const therapist = THERAPISTS.find((t) => t.id === appointment.therapistId) || THERAPISTS[0];
    const { patientEmail, practiceEmail } = createBookingEmails(appointment, service, therapist, CLINIC_INFO);
    setEmails((prev) => [patientEmail, practiceEmail, ...prev]);
    setPreviewPatientEmail(patientEmail);
    setPreviewPracticeEmail(practiceEmail);
    const emailResult = await sendAppointmentEmails(appointment, 'confirmed');
    showToast(`Appointment confirmed (${appointment.referenceCode}). Save your reference code.`);
    return { appointment, patientEmail, practiceEmail, emailResult };
  } finally {
    refreshAll();
  }
  };

  const handleSaveWaitlistEntry = async (w: NewWaitlist) => {
    const entry = await backend.joinWaitlist(w);
    const service = SERVICES.find((s) => s.id === entry.serviceId) || SERVICES[0];
    const therapist = THERAPISTS.find((t) => t.id === entry.therapistId);
    const { patientEmail, practiceEmail } = createWaitlistEmails(entry, service, therapist, CLINIC_INFO);
    setEmails((prev) => [patientEmail, practiceEmail, ...prev]);
    showToast(`Added to the waitlist (${entry.referenceCode}). We will contact you if a slot opens.`);
    if (portalUnlocked) refreshStaff();
    return { entry, patientEmail, practiceEmail };
  };

  // ------------------------------------------------------------------ staff actions
  const staffAction = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) showToast(ok);
    } catch (e) {
      showToast(friendlyError(e), 'error');
    } finally {
      refreshAll();
    }
  };

  const handleStaffAddAppointment = async (
    apt: Appointment,
    _patientEmail: EmailNotification,
    _practiceEmail: EmailNotification
  ): Promise<Appointment | null> => {
    try {
      const saved = await backend.staffCreateAppointment({
        serviceId: apt.serviceId,
        therapistId: apt.therapistId,
        date: apt.date,
        timeSlot: apt.timeSlot,
        intake: apt.intake,
        status: apt.status,
        clinicalNotes: apt.clinicalNotes,
      });
      showToast(`Booking ${saved.referenceCode} added.`);
      return saved;
    } catch (e) {
      showToast(friendlyError(e), 'error');
      return null;
    } finally {
      refreshAll();
    }
  };

  const handlePromoteWaitlistToBooking = (entry: WaitlistEntry, date: string, timeSlot: string) =>
    staffAction(async () => {
      const saved = await backend.staffCreateAppointment({
        serviceId: entry.serviceId,
        therapistId: entry.therapistId && entry.therapistId !== 'any' ? entry.therapistId : THERAPISTS[0].id,
        date,
        timeSlot,
        intake: {
          fullName: entry.patientName,
          email: entry.email,
          phone: entry.phone,
          dateOfBirth: '',
          painLocation: entry.painLocation,
          painLevel: 0,
          injuryDuration: 'subacute',
          hasReferral: false,
          insuranceType: 'self-pay',
          symptomsDescription: entry.notes || 'Booked from the waitlist',
        },
        clinicalNotes: `Booked from waitlist (${entry.referenceCode}).`,
      });
      await backend.staffUpdateWaitlist({ ...entry, status: 'booked' });
      showToast(`${entry.patientName} booked for ${date} at ${timeSlot} (${saved.referenceCode}). Please let them know.`);
    });

  const handleInspectEmail = (email: EmailNotification) => {
    const partner = emails.find((e) => e.appointmentId === email.appointmentId && e.recipientType !== email.recipientType) || null;
    setPreviewPatientEmail(email.recipientType === 'patient' ? email : partner);
    setPreviewPracticeEmail(email.recipientType === 'practice' ? email : partner);
    setIsEmailPreviewOpen(true);
  };

  // ------------------------------------------------------------------ opening modals
  const openBooking = (serviceId?: string, therapistId?: string, date?: string, slot?: string, mode: 'booking' | 'waitlist' = 'booking') => {
    setBookingServiceId(serviceId);
    setBookingTherapistId(therapistId);
    setBookingDate(date);
    setBookingSlot(slot);
    setBookingInitialMode(mode);
    setIsBookingOpen(true);
  };
  const openManage = (ref?: string, email?: string) => {
    setManageRef(ref);
    setManageEmail(email);
    setIsManageOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto z-[60] px-4 py-3 rounded-xl shadow-xl border flex items-center gap-2.5 text-xs ${
            toast.kind === 'ok' ? 'bg-slate-900 text-white border-slate-700' : 'bg-red-700 text-white border-red-800'
          }`}
        >
          {toast.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      <Navbar
        onOpenBooking={() => openBooking(SERVICES[0].id)}
        onOpenManageBooking={() => openManage()}
        onOpenPatientDashboard={() => openManage()}
        onOpenPractitionerPortal={() => setIsPortalOpen(true)}
        isPractitionerMode={isPortalOpen}
      />

      {publicLoadError && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 text-center">
          Live availability could not be loaded: {publicLoadError}
        </div>
      )}

      <main className="flex-1">
        <Hero
          onOpenBooking={() => openBooking(SERVICES[0].id)}
          onOpenPractitionerPortal={() => setIsPortalOpen(true)}
          isPractitionerMode={isPortalOpen}
        />
        <InteractiveBookingCalendar
          appointments={booked}
          blockedSlots={blockedSlots}
          onSelectSlotToBook={(serviceId, therapistId, date, slot) => openBooking(serviceId, therapistId, date, slot)}
          onJoinWaitlist={(serviceId, therapistId, date) =>
            openBooking(serviceId, therapistId === 'any' ? undefined : therapistId, date, undefined, 'waitlist')
          }
        />
        <SymptomTriage onSelectServiceAndBook={(serviceId, therapistId) => openBooking(serviceId, therapistId)} />
        <ServicesSection onSelectService={(serviceId) => openBooking(serviceId)} />
        <TherapistsSection onBookWithTherapist={(therapistId) => openBooking(undefined, therapistId)} />
        <InsuranceFaqSection />
      </main>

      <Footer
        onOpenBooking={() => openBooking(SERVICES[0].id)}
        onOpenManageBooking={() => openManage()}
        onOpenPatientDashboard={() => openManage()}
        onOpenPractitionerPortal={() => setIsPortalOpen(true)}
      />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialMode={bookingInitialMode}
        preSelectedServiceId={bookingServiceId}
        preSelectedTherapistId={bookingTherapistId}
        preSelectedDate={bookingDate}
        preSelectedSlot={bookingSlot}
        existingAppointments={booked}
        blockedSlots={blockedSlots}
        onSaveAppointment={handleSaveNewAppointment}
        onSaveWaitlistEntry={handleSaveWaitlistEntry}
        onOpenEmailPreview={(pat, prac) => {
          setPreviewPatientEmail(pat);
          setPreviewPracticeEmail(prac);
          setIsEmailPreviewOpen(true);
        }}
      />

      <ManageBookingModal
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
        booked={booked}
        blockedSlots={blockedSlots}
        initialRef={manageRef}
        initialEmail={manageEmail}
        onChanged={(message) => {
          showToast(message);
          refreshAll();
        }}
      />

      {isPortalOpen && !portalUnlocked && (
        <StaffLogin
          isOpen
          onClose={() => setIsPortalOpen(false)}
          isPasswordRecovery={isPasswordRecovery}
          onSignedIn={(user) => setStaffUser(user)}
          onPasswordUpdated={async () => {
            setIsPasswordRecovery(false);
            const user = await backend.getStaffUser();
            setStaffUser(user);
            showToast(user ? 'Password saved. You are signed in.' : 'Password saved. Please sign in.');
          }}
        />
      )}

      <PractitionerPortal
        isOpen={isPortalOpen && portalUnlocked}
        onClose={() => setIsPortalOpen(false)}
        appointments={staffData.appointments}
        blockedSlots={staffData.blockedSlots}
        emails={emails}
        waitlist={staffData.waitlist}
        isDemo={backend.mode === 'demo'}
        staffEmail={staffUser?.email}
        onRefresh={refreshAll}
        onSignOut={async () => {
          await backend.signOut();
          setStaffUser(null);
          setStaffData(emptyStaffData);
          setIsPortalOpen(false);
          showToast('Signed out.');
        }}
        onUpdateAppointment={(a) => staffAction(() => backend.staffUpdateAppointment(a), `Booking ${a.referenceCode} updated.`)}
        onAddAppointment={handleStaffAddAppointment}
        onAddBlockedSlot={(b) => staffAction(() => backend.staffAddBlock(b), `“${b.title}” blocked out.`)}
        onRemoveBlockedSlot={(id) => staffAction(() => backend.staffRemoveBlock(id), 'Time block removed.')}
        onViewEmail={handleInspectEmail}
        onUpdateWaitlistEntry={(w) => staffAction(() => backend.staffUpdateWaitlist(w), `Waitlist ${w.referenceCode} updated.`)}
        onRemoveWaitlistEntry={(id) => staffAction(() => backend.staffRemoveWaitlist(id), 'Removed from waitlist.')}
        onPromoteWaitlistToBooking={handlePromoteWaitlistToBooking}
      />

      <EmailPreviewModal
        isOpen={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        patientEmail={previewPatientEmail}
        practiceEmail={previewPracticeEmail}
      />

      <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center gap-2">
        <button
          onClick={() => openManage()}
          className="flex-1 py-2.5 px-3 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors text-center cursor-pointer truncate flex items-center justify-center gap-1.5 border border-teal-200"
        >
          <User className="w-3.5 h-3.5 text-teal-700" />
          <span>My Bookings</span>
        </button>
        <button
          onClick={() => openBooking(SERVICES[0].id)}
          className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors text-center cursor-pointer shadow-sm truncate"
        >
          Book Session
        </button>
      </div>
    </div>
  );
}
