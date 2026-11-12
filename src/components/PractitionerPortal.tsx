import { paymentLabel, nextWorkdayStr } from '../utils/format';
import React, { useState } from 'react';
import { Appointment, Therapist, TherapyService, BlockedTimeSlot, EmailNotification, WaitlistEntry } from '../types';
import { THERAPISTS, SERVICES, CLINIC_INFO } from '../data/mockData';
import { formatDatePretty, generateReferenceCode, createBookingEmails } from '../utils/calendar';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Phone,
  Shield,
  Activity,
  ChevronRight,
  ArrowLeft,
  Edit3,
  Coffee,
  CalendarOff,
  Mail,
  Trash2,
  Eye,
  AlertTriangle,
  Bell,
  UserCheck,
  ArrowUpRight,
  Send,
} from 'lucide-react';

interface PractitionerPortalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  blockedSlots: BlockedTimeSlot[];
  emails: EmailNotification[];
  waitlist: WaitlistEntry[];
  onUpdateAppointment: (updated: Appointment) => void;
  onAddAppointment: (
    appointment: Appointment,
    patientEmail: EmailNotification,
    practiceEmail: EmailNotification
  ) => Promise<Appointment | null> | void;
  staffEmail?: string;
  isDemo?: boolean;
  onSignOut?: () => void;
  onRefresh?: () => void;
  onAddBlockedSlot: (blockedSlot: BlockedTimeSlot) => void;
  onRemoveBlockedSlot: (blockedSlotId: string) => void;
  onViewEmail: (email: EmailNotification) => void;
  onUpdateWaitlistEntry: (updated: WaitlistEntry) => void;
  onRemoveWaitlistEntry: (waitlistId: string) => void;
  onPromoteWaitlistToBooking: (waitlistEntry: WaitlistEntry, date: string, timeSlot: string) => void;
}

export const PractitionerPortal: React.FC<PractitionerPortalProps> = ({
  isOpen,
  onClose,
  appointments,
  blockedSlots,
  emails,
  waitlist,
  onUpdateAppointment,
  onAddAppointment,
  onAddBlockedSlot,
  onRemoveBlockedSlot,
  onViewEmail,
  onUpdateWaitlistEntry,
  onRemoveWaitlistEntry,
  onPromoteWaitlistToBooking,
  staffEmail,
  isDemo,
  onSignOut,
  onRefresh,
}) => {
  // Main Navigation Tabs
  const [activeTab, setActiveTab] = useState<'schedule' | 'blockouts' | 'waitlist' | 'emails'>('schedule');

  // Schedule filtering state
  const [selectedTherapistFilter, setSelectedTherapistFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [showQuickAddModal, setShowQuickAddModal] = useState<boolean>(false);

  // Quick Add Appointment Form State (for reception/phone intake)
  const [quickPatientName, setQuickPatientName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickServiceId, setQuickServiceId] = useState(SERVICES[0].id);
  const [quickTherapistId, setQuickTherapistId] = useState(THERAPISTS[0].id);
  const [quickDate, setQuickDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  });
  const [quickTime, setQuickTime] = useState('10:00 AM');
  const [quickComplaint, setQuickComplaint] = useState('Evaluation & assessment');

  // New Blockout Form State
  const [blockTitle, setBlockTitle] = useState('Lunch break');
  const [blockType, setBlockType] = useState<'lunch' | 'holiday' | 'custom'>('lunch');
  const [blockTherapistId, setBlockTherapistId] = useState<string>('all');
  const [blockDate, setBlockDate] = useState(nextWorkdayStr());
  const [blockIsFullDay, setBlockIsFullDay] = useState(false);
  const [blockRecurringDaily, setBlockRecurringDaily] = useState(false);
  const [selectedBlockSlots, setSelectedBlockSlots] = useState<string[]>(['12:30 PM']);
  const [blockNotes, setBlockNotes] = useState('');

  // Waitlist State
  const [waitlistSearchQuery, setWaitlistSearchQuery] = useState('');
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState<string>('all');
  const [promotingEntry, setPromotingEntry] = useState<WaitlistEntry | null>(null);
  const [promoteDate, setPromoteDate] = useState('');
  const [promoteTime, setPromoteTime] = useState('09:00 AM');

  if (!isOpen) return null;

  // Filtered Appointments
  const filteredAppointments = appointments.filter((apt) => {
    if (selectedTherapistFilter !== 'all' && apt.therapistId !== selectedTherapistFilter) return false;
    if (selectedStatusFilter !== 'all' && apt.status !== selectedStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        apt.intake.fullName.toLowerCase().includes(q) ||
        apt.referenceCode.toLowerCase().includes(q) ||
        apt.intake.phone.includes(q);
      if (!match) return false;
    }
    return true;
  });

  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    return `${a.date} ${a.timeSlot}`.localeCompare(`${b.date} ${b.timeSlot}`);
  });

  // Metrics
  const totalBookings = appointments.length;
  const activeBookings = appointments.filter((a) => a.status === 'confirmed').length;
  const completedTreatments = appointments.filter((a) => a.status === 'completed').length;

  // Handle Note Save
  const handleSaveNotes = () => {
    if (!selectedAppointment) return;
    const updated: Appointment = {
      ...selectedAppointment,
      clinicalNotes: tempNotes,
    };
    onUpdateAppointment(updated);
    setSelectedAppointment(updated);
    setIsEditingNotes(false);
  };

  // Change Appointment Status
  const handleUpdateStatus = (status: Appointment['status']) => {
    if (!selectedAppointment) return;
    const updated: Appointment = {
      ...selectedAppointment,
      status,
    };
    onUpdateAppointment(updated);
    setSelectedAppointment(updated);
  };

  // Quick Add Walk-In or Phone Booking
  const handleCreateQuickAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPatientName.trim() || !quickPhone.trim()) {
      alert('Please fill out patient name and contact phone.');
      return;
    }

    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      referenceCode: generateReferenceCode(),
      serviceId: quickServiceId,
      therapistId: quickTherapistId,
      date: quickDate,
      timeSlot: quickTime,
      status: 'confirmed',
      intake: {
        fullName: quickPatientName,
        email: quickEmail.trim(),
        phone: quickPhone,
        dateOfBirth: '',
        painLocation: quickComplaint,
        painLevel: 5,
        injuryDuration: 'subacute',
        hasReferral: false,
        insuranceType: 'in-network',
        symptomsDescription: quickComplaint,
      },
      createdAt: new Date().toISOString(),
      clinicalNotes: 'Direct front-desk / phone scheduling intake.',
    };

    const srv = SERVICES.find((s) => s.id === quickServiceId) || SERVICES[0];
    const thr = THERAPISTS.find((t) => t.id === quickTherapistId) || THERAPISTS[0];
    const { patientEmail, practiceEmail } = createBookingEmails(newApt, srv, thr, CLINIC_INFO);

    const saved = await onAddAppointment(newApt, patientEmail, practiceEmail);
    if (saved === null) return; // failed: the error has been shown
    setShowQuickAddModal(false);
    setSelectedAppointment(saved || newApt);
    setQuickPatientName('');
    setQuickPhone('');
    setQuickEmail('');
  };

  // Handle Create Blocked Time Slot
  const handleCreateBlockout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) {
      alert('Please provide a title for this blocked time (e.g. Staff Lunch, Holiday).');
      return;
    }

    const newBlock: BlockedTimeSlot = {
      id: `block-${Date.now()}`,
      title: blockTitle.trim(),
      type: blockType,
      therapistId: blockTherapistId,
      date: blockRecurringDaily ? undefined : blockDate,
      isFullDay: blockIsFullDay,
      recurringDaily: blockRecurringDaily,
      timeSlots: blockIsFullDay ? undefined : selectedBlockSlots,
      notes: blockNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onAddBlockedSlot(newBlock);
    // Reset form to defaults
    setBlockTitle('');
    setBlockNotes('');
  };

  // Toggle slot selection for custom block
  const availableBlockSlotOptions = [
    '08:00 AM', '08:45 AM', '09:30 AM', '10:15 AM',
    '11:00 AM', '11:45 AM', '12:30 PM', '01:15 PM',
    '02:00 PM', '02:45 PM', '03:30 PM', '04:15 PM',
  ];

  const toggleSlotOption = (slot: string) => {
    if (selectedBlockSlots.includes(slot)) {
      setSelectedBlockSlots(selectedBlockSlots.filter((s) => s !== slot));
    } else {
      setSelectedBlockSlots([...selectedBlockSlots, slot]);
    }
  };

  // Export CSV for practice records
  const exportToCSV = () => {
    const headers = [
      'Reference Code',
      'Patient Name',
      'Date',
      'Time Slot',
      'Service',
      'Therapist',
      'Status',
      'Phone',
      'Email',
      'Pain Location',
      'Pain Level',
      'Payment',
      'Clinical Notes',
    ];

    const rows = appointments.map((a) => {
      const s = SERVICES.find((srv) => srv.id === a.serviceId);
      const t = THERAPISTS.find((thr) => thr.id === a.therapistId);
      return [
        `"${a.referenceCode}"`,
        `"${a.intake.fullName}"`,
        `"${a.date}"`,
        `"${a.timeSlot}"`,
        `"${s?.title || a.serviceId}"`,
        `"${t?.name || a.therapistId}"`,
        `"${a.status}"`,
        `"${a.intake.phone}"`,
        `"${a.intake.email}"`,
        `"${a.intake.painLocation}"`,
        `"${a.intake.painLevel}"`,
        `"${paymentLabel(a.intake.insuranceType)}"`,
        `"${(a.clinicalNotes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `msk_hacks_schedule_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                Clinic Operations Portal
              </div>
              <h2 className="text-base font-bold text-white">MSK Hacks Practice Portal</h2>
              <div className="text-[11px] text-slate-400">
                {isDemo ? 'Demo mode — sample data in this browser only' : staffEmail ? `Signed in as ${staffEmail}` : ''}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowQuickAddModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Walk-in Booking</span>
            </button>

            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export appointments to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Load the latest bookings"
              >
                Refresh
              </button>
            )}
            {onSignOut && !isDemo && (
              <button
                onClick={onSignOut}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Sign out
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Portal Subnav Tabs */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schedule'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>Appointments &amp; Charting ({appointments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('blockouts')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'blockouts'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-700" />
              <span>Staff Lunches &amp; Holidays ({blockedSlots.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('waitlist')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'waitlist'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Priority Waitlist ({waitlist.filter((w) => w.status === 'active').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('emails')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'emails'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-teal-700" />
              <span>Confirmations ({emails.length})</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-500">
            <span>Confirmed: <strong className="text-slate-800">{activeBookings}</strong></span>
            <span>Completed: <strong className="text-slate-800">{completedTreatments}</strong></span>
          </div>
        </div>

        {/* TAB 1: Appointments Schedule & Clinical Notes */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
            {/* Left Column: Schedule List & Filters */}
            <div className="lg:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50/50 overflow-hidden">
              <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search patient, phone, or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <select
                    value={selectedTherapistFilter}
                    onChange={(e) => setSelectedTherapistFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="all">All Therapists</option>
                    {THERAPISTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name.split(',')[0]}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {sortedAppointments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No appointments match current filters.
                  </div>
                ) : (
                  sortedAppointments.map((apt) => {
                    const s = SERVICES.find((srv) => srv.id === apt.serviceId);
                    const isSelected = selectedAppointment?.id === apt.id;

                    return (
                      <div
                        key={apt.id}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setTempNotes(apt.clinicalNotes || '');
                          setIsEditingNotes(false);
                        }}
                        className={`p-3.5 transition-colors cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-teal-50/80 border-l-4 border-teal-800'
                            : 'hover:bg-slate-100/70 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{apt.intake.fullName}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              apt.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : apt.status === 'completed'
                                ? 'bg-slate-200 text-slate-800'
                                : apt.status === 'rescheduled'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </div>

                        <div className="text-slate-600 line-clamp-1 font-medium">{s?.title}</div>

                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {formatDatePretty(apt.date)} · {apt.timeSlot}
                          </span>
                          <span className="font-mono">{apt.referenceCode}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Appointment Details, Patient Intake & Clinical Notes */}
            <div className="lg:col-span-7 p-6 overflow-y-auto bg-white flex flex-col justify-between">
              {selectedAppointment ? (
                <div className="space-y-6">
                  {/* Header card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div>
                      <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                        Appointment Details · {selectedAppointment.referenceCode}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                        {selectedAppointment.intake.fullName}
                      </h3>
                      <div className="text-xs text-slate-500">
                        DOB: {selectedAppointment.intake.dateOfBirth} · Contact: {selectedAppointment.intake.phone}
                      </div>
                    </div>

                    {/* Status Toggle Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateStatus('confirmed')}
                        className={`px-2.5 py-1 text-xs rounded font-medium border cursor-pointer ${
                          selectedAppointment.status === 'confirmed'
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Confirmed
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('completed')}
                        className={`px-2.5 py-1 text-xs rounded font-medium border cursor-pointer ${
                          selectedAppointment.status === 'completed'
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('cancelled')}
                        className={`px-2.5 py-1 text-xs rounded font-medium border cursor-pointer ${
                          selectedAppointment.status === 'cancelled'
                            ? 'bg-rose-700 text-white border-rose-700'
                            : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* Session specs */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500">Scheduled Service:</span>
                      <div className="font-semibold text-slate-900">
                        {SERVICES.find((s) => s.id === selectedAppointment.serviceId)?.title}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Physiotherapist:</span>
                      <div className="font-semibold text-slate-900">
                        {THERAPISTS.find((t) => t.id === selectedAppointment.therapistId)?.name}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Date & Time:</span>
                      <div className="font-semibold text-slate-900">
                        {formatDatePretty(selectedAppointment.date)} at {selectedAppointment.timeSlot}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Payment / Billing:</span>
                      <div className="font-semibold text-slate-900 capitalize">
                        {paymentLabel(selectedAppointment.intake.insuranceType)}{selectedAppointment.intake.insuranceProvider ? ` (${selectedAppointment.intake.insuranceProvider})` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Intake complaint & pain score */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Patient Intake Assessment
                    </h4>
                    <div className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Chief Complaint:</span>
                        <span className="font-semibold text-slate-900">{selectedAppointment.intake.painLocation}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Reported Pain Severity:</span>
                        <span className="font-bold text-teal-800 tabular-nums">
                          {selectedAppointment.intake.painLevel}/10
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Symptom Duration:</span>
                        <span className="capitalize text-slate-700 font-medium">
                          {selectedAppointment.intake.injuryDuration}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-500 block mb-1">Patient Subjective Description:</span>
                        <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                          {selectedAppointment.intake.symptomsDescription || 'No detailed note provided.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Clinical Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-800" />
                        Clinical notes
                      </h4>
                      {!isEditingNotes && (
                        <button
                          onClick={() => {
                            setTempNotes(selectedAppointment.clinicalNotes || '');
                            setIsEditingNotes(true);
                          }}
                          className="text-xs text-teal-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Notes</span>
                        </button>
                      )}
                    </div>

                    {isEditingNotes ? (
                      <div className="space-y-2">
                        <textarea
                          rows={4}
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Enter clinical findings: ROM measurements, manual mobilizations performed, home exercise program (HEP) prescribed, tolerance..."
                          className="w-full p-3 text-xs border border-teal-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono text-slate-800"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setIsEditingNotes(false)}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveNotes}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg cursor-pointer"
                          >
                            Save Clinical Notes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 min-h-[70px] whitespace-pre-wrap">
                        {selectedAppointment.clinicalNotes ||
                          'No clinical chart notes recorded yet. Click "Edit Notes" to document treatment and exercises.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <Calendar className="w-10 h-10 text-slate-300 mb-3" />
                  <div className="font-semibold text-sm text-slate-700">Select an appointment from the list</div>
                  <div className="text-xs text-slate-500 mt-1 max-w-sm">
                    View patient history, clinical intake, update session status, and add clinical notes.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Staff Lunches & Holiday Closures Manager */}
        {activeTab === 'blockouts' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden p-6 gap-6">
            {/* Left Column: Create New Time Block Form */}
            <div className="lg:col-span-6 bg-slate-50 rounded-xl border border-slate-200 p-5 overflow-y-auto space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-amber-700" />
                  <span>Block Out Staff Lunch or Practice Holiday</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Blocked hours automatically disappear from the patient booking calendar so no double bookings occur.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-500">Quick Presets:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBlockTitle('Lunch break');
                      setBlockType('lunch');
                      setBlockTherapistId('all');
                      setBlockRecurringDaily(true);
                      setBlockIsFullDay(false);
                      setSelectedBlockSlots(['12:30 PM']);
                    }}
                    className="px-2.5 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded cursor-pointer"
                  >
                    + Daily 12:00–1:00 PM Lunch (All Staff)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlockTitle('Christmas Holiday Practice Closure');
                      setBlockType('holiday');
                      setBlockTherapistId('all');
                      setBlockDate('2026-12-25');
                      setBlockIsFullDay(true);
                      setBlockRecurringDaily(false);
                    }}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded cursor-pointer"
                  >
                    + Christmas Holiday
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlockTitle('New Year’s Day Practice Closure');
                      setBlockType('holiday');
                      setBlockTherapistId('all');
                      setBlockDate('2027-01-01');
                      setBlockIsFullDay(true);
                      setBlockRecurringDaily(false);
                    }}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded cursor-pointer"
                  >
                    + New Year’s Day
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateBlockout} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Blockout Title / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={blockTitle}
                    onChange={(e) => setBlockTitle(e.target.value)}
                    placeholder="e.g. Lunch break, Heritage Day closure"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Block Type</label>
                    <select
                      value={blockType}
                      onChange={(e) => setBlockType(e.target.value as 'lunch' | 'holiday' | 'custom')}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="lunch">Staff Lunch Break</option>
                      <option value="holiday">Holiday / Clinic Closure</option>
                      <option value="custom">Staff Seminar / Time Off</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Staff Member</label>
                    <select
                      value={blockTherapistId}
                      onChange={(e) => setBlockTherapistId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="all">All Clinic Staff</option>
                      {THERAPISTS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Recurring or Specific Date */}
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="blockRecurringDaily"
                      checked={blockRecurringDaily}
                      onChange={(e) => setBlockRecurringDaily(e.target.checked)}
                      className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    <label htmlFor="blockRecurringDaily" className="font-semibold text-slate-700 cursor-pointer">
                      Recurring Daily (Blocks this time slot every weekday for lunch)
                    </label>
                  </div>

                  {!blockRecurringDaily && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Specific Date</label>
                        <input
                          type="date"
                          value={blockDate}
                          onChange={(e) => setBlockDate(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div className="flex items-center pt-5">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold">
                          <input
                            type="checkbox"
                            checked={blockIsFullDay}
                            onChange={(e) => setBlockIsFullDay(e.target.checked)}
                            className="rounded border-slate-300 text-teal-700"
                          />
                          <span>Full Day Clinic Closure</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Specific Time Slots selector when not full day */}
                {!blockIsFullDay && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Select Time Slots to Block Out:
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white border border-slate-200 rounded-lg">
                      {availableBlockSlotOptions.map((slot) => {
                        const isSelected = selectedBlockSlots.includes(slot);
                        return (
                          <button
                            type="button"
                            key={slot}
                            onClick={() => toggleSlotOption(slot)}
                            className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition-all text-center cursor-pointer ${
                              isSelected
                                ? 'bg-amber-800 text-white border-amber-800'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notes / Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={blockNotes}
                    onChange={(e) => setBlockNotes(e.target.value)}
                    placeholder="e.g. Clinical documentation & team review"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Blocked Time
                </button>
              </form>
            </div>

            {/* Right Column: Currently Active Blocked Slots List */}
            <div className="lg:col-span-6 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Active Practice Blockouts ({blockedSlots.length})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Slots below are removed from patient booking
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto divide-y divide-slate-100 space-y-3">
                {blockedSlots.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No time blocks currently set.
                  </div>
                ) : (
                  blockedSlots.map((b) => {
                    const isAll = b.therapistId === 'all';
                    const therapistName = isAll
                      ? 'All Staff & Therapists'
                      : THERAPISTS.find((t) => t.id === b.therapistId)?.name.split(',')[0] || b.therapistId;

                    return (
                      <div
                        key={b.id}
                        className="pt-3 first:pt-0 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                b.type === 'lunch'
                                  ? 'bg-amber-100 text-amber-800'
                                  : b.type === 'holiday'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {b.type}
                            </span>
                            <span className="font-bold text-slate-900">{b.title}</span>
                          </div>

                          <div className="text-slate-600 text-[11px]">
                            {b.recurringDaily ? (
                              <span className="text-amber-800 font-semibold">Recurring Every Day</span>
                            ) : (
                              <span>Date: {formatDatePretty(b.date || '')}</span>
                            )}{' '}
                            · {therapistName}
                          </div>

                          {b.isFullDay ? (
                            <div className="text-slate-500 text-[11px] font-medium">Full Day Closure</div>
                          ) : (
                            <div className="text-slate-500 text-[11px] flex flex-wrap gap-1">
                              <span>Slots:</span>
                              {b.timeSlots?.map((ts) => (
                                <span
                                  key={ts}
                                  className="px-1.5 py-0.2 bg-slate-100 rounded text-[10px] font-mono"
                                >
                                  {ts}
                                </span>
                              ))}
                            </div>
                          )}

                          {b.notes && (
                            <div className="text-slate-500 text-[11px] italic">"{b.notes}"</div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (window.confirm(`Unblock "${b.title}"?`)) {
                              onRemoveBlockedSlot(b.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Remove time block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Priority Waitlist Management */}
        {activeTab === 'waitlist' && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="max-w-5xl mx-auto space-y-5">
              {/* Header and Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <span>Priority Waitlist &amp; Full-Schedule Requests</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Patients queued for appointments when preferred calendar dates were fully booked.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                    Active: {waitlist.filter((w) => w.status === 'active').length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 font-semibold border border-sky-200">
                    Contacted: {waitlist.filter((w) => w.status === 'contacted').length}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                    Booked: {waitlist.filter((w) => w.status === 'booked').length}
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by patient name, phone, email, pain location, or waitlist code..."
                    value={waitlistSearchQuery}
                    onChange={(e) => setWaitlistSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-700 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={waitlistStatusFilter}
                    onChange={(e) => setWaitlistStatusFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="all">All Statuses ({waitlist.length})</option>
                    <option value="active">Active Only ({waitlist.filter((w) => w.status === 'active').length})</option>
                    <option value="contacted">Contacted ({waitlist.filter((w) => w.status === 'contacted').length})</option>
                    <option value="booked">Converted to Booked ({waitlist.filter((w) => w.status === 'booked').length})</option>
                    <option value="cancelled">Cancelled ({waitlist.filter((w) => w.status === 'cancelled').length})</option>
                  </select>
                </div>
              </div>

              {/* Waitlist Patient Cards */}
              <div className="space-y-3">
                {waitlist
                  .filter((w) => {
                    if (waitlistStatusFilter !== 'all' && w.status !== waitlistStatusFilter) return false;
                    if (waitlistSearchQuery.trim()) {
                      const q = waitlistSearchQuery.toLowerCase();
                      const match =
                        w.patientName.toLowerCase().includes(q) ||
                        w.email.toLowerCase().includes(q) ||
                        w.phone.includes(q) ||
                        w.referenceCode.toLowerCase().includes(q) ||
                        w.painLocation.toLowerCase().includes(q);
                      if (!match) return false;
                    }
                    return true;
                  })
                  .map((entry) => {
                    const srv = SERVICES.find((s) => s.id === entry.serviceId);
                    const thr = THERAPISTS.find((t) => t.id === entry.therapistId);

                    return (
                      <div
                        key={entry.id}
                        className={`p-4 rounded-xl border transition-all bg-white shadow-xs ${
                          entry.status === 'active'
                            ? 'border-amber-200 ring-1 ring-amber-100'
                            : entry.status === 'booked'
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            {/* Header row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {entry.referenceCode}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">{entry.patientName}</h4>
                              
                              {/* Status badge */}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  entry.status === 'active'
                                    ? 'bg-amber-100 text-amber-800'
                                    : entry.status === 'contacted'
                                    ? 'bg-sky-100 text-sky-800'
                                    : entry.status === 'booked'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {entry.status}
                              </span>

                              <span className="text-[11px] text-slate-400">
                                Added {new Date(entry.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Details grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-600 pt-1">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span>
                                  Target: <strong>{formatDatePretty(entry.preferredDate)}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span>
                                  Pref: <strong className="capitalize">{entry.preferredTimeOfDay}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span>
                                  PT: <strong>{thr?.name.split(',')[0] || 'Any Provider'}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <a
                                  href={`tel:${entry.phone}`}
                                  className="text-teal-700 hover:underline font-mono text-[11px]"
                                >
                                  {entry.phone}
                                </a>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <a
                                  href={`mailto:${entry.email}`}
                                  className="text-teal-700 hover:underline truncate text-[11px]"
                                >
                                  {entry.email}
                                </a>
                              </div>

                              <div className="flex items-center gap-1.5 truncate">
                                <Activity className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span className="truncate">{srv?.title || entry.serviceId}</span>
                              </div>
                            </div>

                            {/* Pain Location & Clinical Intake Notes */}
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1 mt-2">
                              <div>
                                <span className="font-semibold text-slate-700">Pain/Injury Area: </span>
                                <span className="text-slate-800">{entry.painLocation}</span>
                              </div>
                              {entry.notes && (
                                <div>
                                  <span className="font-semibold text-slate-700">Patient Notes: </span>
                                  <span className="text-slate-600 italic">"{entry.notes}"</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex md:flex-col items-center sm:items-end justify-between md:justify-start gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                            {/* Status changer */}
                            <div className="flex items-center gap-1 text-xs">
                              <label className="text-[11px] text-slate-500 hidden sm:inline">Status:</label>
                              <select
                                value={entry.status}
                                onChange={(e) =>
                                  onUpdateWaitlistEntry({
                                    ...entry,
                                    status: e.target.value as any,
                                  })
                                }
                                className="px-2 py-1 text-xs rounded border border-slate-300 bg-white font-medium"
                              >
                                <option value="active">Active</option>
                                <option value="contacted">Contacted</option>
                                <option value="booked">Booked</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </div>

                            {/* Promote button */}
                            {entry.status !== 'booked' && (
                              <button
                                onClick={() => {
                                  setPromotingEntry(entry);
                                  setPromoteDate(entry.preferredDate);
                                  setPromoteTime(
                                    entry.preferredTimeOfDay === 'morning' ? '09:00 AM' : '02:00 PM'
                                  );
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                title="Convert this waitlist entry into a booked appointment"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Book Appointment</span>
                              </button>
                            )}

                            {/* Remove button */}
                            <button
                              onClick={() => {
                                if (window.confirm(`Remove ${entry.patientName} from the waitlist?`)) {
                                  onRemoveWaitlistEntry(entry.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete from waitlist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {waitlist.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    No patients currently on the waitlist.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Automated Email Notification Log */}
        {activeTab === 'emails' && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirmation previews (this browser session)
                  </h3>
                  <p className="text-xs text-slate-600">
                    When EmailJS is set up, patients are emailed when bookings are made, moved or cancelled. Sending history: EmailJS dashboard → Email History.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
                {emails.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No confirmations yet.
                  </div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      className="p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              email.recipientType === 'patient'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-800 text-slate-100'
                            }`}
                          >
                            {email.recipientType === 'patient' ? 'Patient Copy' : 'Practice Alert'}
                          </span>
                          <span className="font-bold text-slate-900">{email.subject}</span>
                        </div>

                        <div className="text-slate-600">
                          To: <strong className="text-slate-800">{email.recipientName}</strong> &lt;
                          {email.recipientEmail}&gt;
                        </div>

                        <p className="text-slate-500 text-[11px] line-clamp-1">{email.previewSnippet}</p>

                        <div className="text-[10px] text-slate-400">
                          Dispatched: {new Date(email.sentAt).toLocaleString()} · Code: {email.referenceCode}
                        </div>
                      </div>

                      <button
                        onClick={() => onViewEmail(email)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-700" />
                        <span>View HTML</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Add Modal Overlay */}
        {showQuickAddModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Quick Add Walk-in / Phone Booking</h3>
                <button
                  onClick={() => setShowQuickAddModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateQuickAppointment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={quickPatientName}
                    onChange={(e) => setQuickPatientName(e.target.value)}
                    placeholder="e.g. Naledi Mokoena"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                      placeholder="e.g. 082 123 4567"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={quickEmail}
                      onChange={(e) => setQuickEmail(e.target.value)}
                      placeholder="patient@example.com"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service</label>
                  <select
                    value={quickServiceId}
                    onChange={(e) => setQuickServiceId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.durationMinutes} min)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Provider</label>
                    <select
                      value={quickTherapistId}
                      onChange={(e) => setQuickTherapistId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      {THERAPISTS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name.split(',')[0]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Time</label>
                    <input
                      type="text"
                      value={quickTime}
                      onChange={(e) => setQuickTime(e.target.value)}
                      placeholder="e.g. 10:00 AM"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={quickDate}
                    onChange={(e) => setQuickDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chief Complaint / Area</label>
                  <input
                    type="text"
                    value={quickComplaint}
                    onChange={(e) => setQuickComplaint(e.target.value)}
                    placeholder="e.g. Lumbar spine stiffness, post-op knee"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg cursor-pointer"
                  >
                    Save walk-in booking
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Promote Waitlist Patient into Booked Appointment Modal */}
        {promotingEntry && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Convert Waitlist to Booking</h3>
                    <p className="text-[11px] text-slate-500 font-mono">{promotingEntry.referenceCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPromotingEntry(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Patient summary badge */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Patient:</span>
                  <span className="font-bold text-slate-900">{promotingEntry.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact:</span>
                  <span className="text-slate-700">{promotingEntry.phone} · {promotingEntry.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Request:</span>
                  <span className="text-slate-700 font-medium">
                    {promotingEntry.preferredDate} ({promotingEntry.preferredTimeOfDay})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Service:</span>
                  <span className="text-slate-700">
                    {SERVICES.find((s) => s.id === promotingEntry.serviceId)?.title || promotingEntry.serviceId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pain Area:</span>
                  <span className="text-slate-700">{promotingEntry.painLocation}</span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!promotingEntry) return;
                  onPromoteWaitlistToBooking(promotingEntry, promoteDate, promoteTime);
                  setPromotingEntry(null);
                }}
                className="space-y-3 text-xs"
              >
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Appointment Date *</label>
                  <input
                    type="date"
                    required
                    value={promoteDate}
                    onChange={(e) => setPromoteDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Time Slot *</label>
                  <select
                    value={promoteTime}
                    onChange={(e) => setPromoteTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    {[
                      '08:00 AM',
                      '08:45 AM',
                      '09:30 AM',
                      '10:15 AM',
                      '11:00 AM',
                      '11:45 AM',
                      '01:00 PM',
                      '01:45 PM',
                      '02:30 PM',
                      '03:15 PM',
                      '04:00 PM',
                      '04:45 PM',
                    ].map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Submitting this will create a confirmed appointment, update the waitlist entry status to <strong>Booked</strong>, and send automated dual confirmation emails to the patient and clinic inbox.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPromotingEntry(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg cursor-pointer flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Confirm booking</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
