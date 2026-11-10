import { formatPrice } from '../utils/format';
import { todayStr, nextWorkdayStr } from '../utils/format';
import React, { useState } from 'react';
import { SERVICES, THERAPISTS, CLINIC_INFO } from '../data/mockData';
import { Appointment, BlockedTimeSlot, TherapyService, Therapist } from '../types';
import {
  formatDatePretty,
  generateDailyTimeSlots,
  isDateBlocked,
  isSlotBlocked,
} from '../utils/calendar';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Sparkles,
  Bell,
  UserCheck,
} from 'lucide-react';

interface InteractiveBookingCalendarProps {
  appointments: Appointment[];
  blockedSlots: BlockedTimeSlot[];
  onSelectSlotToBook: (serviceId: string, therapistId: string, date: string, timeSlot: string) => void;
  onJoinWaitlist: (serviceId: string, therapistId: string, date: string) => void;
}

export const InteractiveBookingCalendar: React.FC<InteractiveBookingCalendarProps> = ({
  appointments,
  blockedSlots,
  onSelectSlotToBook,
  onJoinWaitlist,
}) => {
  // 1. Service Selection
  const [selectedServiceId, setSelectedServiceId] = useState<string>(SERVICES[0].id);
  // 2. Therapist Selection
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('any');
  // 3. Current viewing month state (current local year 2026, month index 10 = November)
  const initialDate = nextWorkdayStr();
  const [viewYear, setViewYear] = useState<number>(Number(initialDate.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState<number>(Number(initialDate.slice(5, 7)) - 1);

  // 4. Selected date (default to 2026-11-10)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  // 5. Selected time slot
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  const activeService = SERVICES.find((s) => s.id === selectedServiceId) || SERVICES[0];
  const activeTherapist = THERAPISTS.find((t) => t.id === selectedTherapistId);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (viewMonth === 10 && viewYear === 2026) return; // Prevent going to past
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Generate Calendar Days for viewMonth
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Daily all slots
  const allDailySlots = generateDailyTimeSlots(
    activeTherapist?.workingHours.start || THERAPISTS[0].workingHours.start,
    activeTherapist?.workingHours.end || THERAPISTS[0].workingHours.end,
    activeService.durationMinutes <= 45 ? 45 : 60
  );

  // Check selected date status
  const selectedDateBlock = isDateBlocked(selectedDate, selectedTherapistId, blockedSlots);

  // Compute available & blocked slots for selected date
  const bookedSlotsOnDate = appointments
    .filter((a) => {
      if (a.date !== selectedDate || a.status === 'cancelled') return false;
      if (selectedTherapistId !== 'any' && a.therapistId !== selectedTherapistId) return false;
      return true;
    })
    .map((a) => a.timeSlot);

  // Categorize slots
  const morningSlots: { slot: string; isBooked: boolean; isBlocked: boolean; blockReason?: string }[] = [];
  const afternoonSlots: { slot: string; isBooked: boolean; isBlocked: boolean; blockReason?: string }[] = [];
  const eveningSlots: { slot: string; isBooked: boolean; isBlocked: boolean; blockReason?: string }[] = [];

  allDailySlots.forEach((slot) => {
    const isBooked = bookedSlotsOnDate.includes(slot);
    const blockCheck = isSlotBlocked(selectedDate, slot, selectedTherapistId, blockedSlots);

    const timeNum = parseInt(slot.split(':')[0], 10);
    const isPM = slot.includes('PM');
    const hour24 = isPM && timeNum < 12 ? timeNum + 12 : (!isPM && timeNum === 12 ? 0 : timeNum);

    const item = {
      slot,
      isBooked,
      isBlocked: blockCheck.blocked,
      blockReason: blockCheck.reason,
    };

    if (hour24 < 12) {
      morningSlots.push(item);
    } else if (hour24 < 16) {
      afternoonSlots.push(item);
    } else {
      eveningSlots.push(item);
    }
  });

  const allSlotsToday = [...morningSlots, ...afternoonSlots, ...eveningSlots];
  const isDayFullyBooked =
    !selectedDateBlock.blocked &&
    allSlotsToday.length > 0 &&
    allSlotsToday.every((s) => s.isBooked || s.isBlocked);

  // Count available slots for a given date in month grid
  const getOpenSlotCount = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Weekend: closed for online booking

    const holiday = isDateBlocked(dateStr, selectedTherapistId, blockedSlots);
    if (holiday.blocked) return 0;

    const booked = appointments.filter(
      (a) =>
        a.date === dateStr &&
        a.status !== 'cancelled' &&
        (selectedTherapistId === 'any' || a.therapistId === selectedTherapistId)
    ).length;

    let totalPossible = allDailySlots.length;
    // subtract blocked lunch or custom slots
    for (const slot of allDailySlots) {
      if (isSlotBlocked(dateStr, slot, selectedTherapistId, blockedSlots).blocked) {
        totalPossible -= 1;
      }
    }

    return Math.max(0, totalPossible - booked);
  };

  const handleBookNow = () => {
    if (!selectedSlot) {
      alert('Please select an available time slot.');
      return;
    }
    const therapistIdToUse = selectedTherapistId === 'any' ? THERAPISTS[0].id : selectedTherapistId;
    onSelectSlotToBook(selectedServiceId, therapistIdToUse, selectedDate, selectedSlot);
  };

  return (
    <section id="book-calendar" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-800 mb-2">
            Book Online
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Choose a service, then pick a date and time that suits you.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            See open appointment times and book in a few steps. You’ll get a reference code to manage or reschedule your booking.
          </p>
        </div>

        {/* 1. Service Filter Strip */}
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
            1. Select Service / Treatment
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SERVICES.slice(0, 4).map((service) => {
              const isSelected = selectedServiceId === service.id;
              return (
                <button
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-teal-700 bg-teal-50/50 shadow-sm ring-1 ring-teal-700'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{service.durationMinutes} min</span>
                      <span className="font-semibold text-slate-900">{formatPrice(service.price)}</span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 line-clamp-1">{service.title}</div>
                  </div>
                  <div className="text-[11px] text-teal-800 font-medium mt-2">
                    Medical aid or private
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Therapist Filter Bar (hidden when there is only one physio) */}
        <div className={`mb-8 flex-wrap items-center gap-3 ${THERAPISTS.length > 1 ? 'flex' : 'hidden'}`}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            2. Physiotherapist:
          </span>
          <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-full">
            <button
              onClick={() => setSelectedTherapistId('any')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                selectedTherapistId === 'any'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Earliest available
            </button>
            {THERAPISTS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTherapistId(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  selectedTherapistId === t.id
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.name.split(',')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Main Interactive Calendar Grid + Timeslots (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/70 rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {/* Left Column: Interactive Month Calendar */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            {/* Calendar Month Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Select Date</span>
                <h3 className="text-lg font-bold text-slate-900">
                  {monthNames[viewMonth]} {viewYear}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-2">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar Day Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* Empty leading cells */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 rounded-lg bg-slate-50/50" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
                  dayNum
                ).padStart(2, '0')}`;
                const isSelected = selectedDate === dateStr;
                const isSunday = [0, 6].includes(new Date(viewYear, viewMonth, dayNum).getDay());

                const holidayCheck = isDateBlocked(dateStr, selectedTherapistId, blockedSlots);
                const isHoliday = holidayCheck.blocked;
                const openSlots = getOpenSlotCount(dateStr);

                // Disable past dates relative to 2026-11-09
                const isPast = dateStr <= todayStr();
                const isClickable = !isSunday && !isPast;

                return (
                  <button
                    key={dateStr}
                    disabled={!isClickable}
                    onClick={() => {
                      setSelectedDate(dateStr);
                      // Auto-select first available slot
                      setSelectedSlot('');
                    }}
                    className={`h-16 p-1.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-teal-800 text-white border-teal-800 shadow-md ring-2 ring-teal-700/50'
                        : isHoliday
                        ? 'bg-amber-50/60 border-amber-200 text-amber-900 cursor-pointer'
                        : isSunday
                        ? 'bg-slate-50 border-transparent text-slate-300 cursor-not-allowed'
                        : isPast
                        ? 'bg-slate-50 border-transparent text-slate-300 cursor-not-allowed opacity-40'
                        : 'bg-white border-slate-200 hover:border-teal-700 hover:bg-teal-50/30 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold tabular-nums">{dayNum}</span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-teal-300" />}
                    </div>

                    <div className="text-[9px] leading-tight">
                      {isSunday ? (
                        <span className="text-slate-400">Closed</span>
                      ) : isHoliday ? (
                        <span className={isSelected ? 'text-teal-200 font-semibold' : 'text-amber-700 font-semibold truncate block'}>
                          Holiday
                        </span>
                      ) : isPast ? (
                        <span className="text-slate-300">Past</span>
                      ) : (
                        <span
                          className={`font-medium ${
                            isSelected
                              ? 'text-teal-200'
                              : openSlots > 0
                              ? 'text-teal-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {openSlots > 0 ? `${openSlots} open` : 'Full'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-teal-800" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-white border border-teal-700" />
                <span>Available Slots</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" />
                <span>Holiday / Blocked Closure</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-slate-100" />
                <span>Weekend (Saturday by phone)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Time Slots for Selected Date */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-xs">
            <div>
              {/* Selected Date Summary Header */}
              <div className="pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Available Openings
                  </span>
                  <span className="text-xs font-medium text-teal-800">
                    {activeService.durationMinutes} min appointment
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {formatDatePretty(selectedDate)}
                </h3>
              </div>

              {/* Holiday Alert if Blocked */}
              {selectedDateBlock.blocked ? (
                <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-center text-amber-900 text-xs space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                  <div className="font-bold text-sm">Practice Closed: {selectedDateBlock.reason}</div>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Our clinic is closed on this date for scheduled holiday observances or team continuing education. Please select another date from the calendar.
                  </p>
                </div>
              ) : isDayFullyBooked ? (
                <div className="p-6 rounded-xl bg-teal-50/80 border border-teal-200 text-center text-xs space-y-3">
                  <div className="w-10 h-10 rounded-full bg-teal-800 text-white flex items-center justify-center mx-auto shadow-xs">
                    <Bell className="w-5 h-5 text-teal-200" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">All Appointment Slots Fully Booked</h4>
                    <p className="text-slate-600 text-[11px] mt-1 max-w-sm mx-auto leading-relaxed">
                      Every session on <strong>{formatDatePretty(selectedDate)}</strong> is currently taken. Join our Priority Waitlist — our clinical coordinator will contact you immediately if a cancellation or reschedule opens up.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      onJoinWaitlist(
                        selectedServiceId,
                        selectedTherapistId === 'any' ? THERAPISTS[0].id : selectedTherapistId,
                        selectedDate
                      )
                    }
                    className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Join Priority Waitlist for {formatDatePretty(selectedDate)}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                  {/* Morning Section */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Morning Slots</span>
                      <span className="text-slate-400 font-normal">08:00 – 12:30</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {morningSlots.map((item) => {
                        const isSelected = selectedSlot === item.slot;
                        const isDisabled = item.isBooked || item.isBlocked;

                        return (
                          <button
                            key={item.slot}
                            disabled={isDisabled}
                            onClick={() => setSelectedSlot(item.slot)}
                            className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                              isSelected
                                ? 'bg-teal-800 text-white border-teal-800 shadow-sm'
                                : isDisabled
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                : 'bg-slate-50 hover:bg-white text-slate-800 border-slate-200 hover:border-teal-700'
                            }`}
                          >
                            <span className="tabular-nums">{item.slot}</span>
                            {item.isBooked && <span className="block text-[9px] font-normal">Booked</span>}
                            {item.isBlocked && (
                              <span className="block text-[9px] font-normal text-amber-700 truncate">
                                Blocked
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Daily Staff Lunch Break Notice */}
                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
                    <Coffee className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">12:30 – 13:15:</span> Lunch break
                    </div>
                  </div>

                  {/* Afternoon Section */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Afternoon Slots</span>
                      <span className="text-slate-400 font-normal">13:15 – 17:00</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {afternoonSlots.map((item) => {
                        const isSelected = selectedSlot === item.slot;
                        const isDisabled = item.isBooked || item.isBlocked;

                        return (
                          <button
                            key={item.slot}
                            disabled={isDisabled}
                            onClick={() => setSelectedSlot(item.slot)}
                            className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                              isSelected
                                ? 'bg-teal-800 text-white border-teal-800 shadow-sm'
                                : isDisabled
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                : 'bg-slate-50 hover:bg-white text-slate-800 border-slate-200 hover:border-teal-700'
                            }`}
                          >
                            <span className="tabular-nums">{item.slot}</span>
                            {item.isBooked && <span className="block text-[9px] font-normal">Booked</span>}
                            {item.isBlocked && (
                              <span className="block text-[9px] font-normal text-amber-700 truncate">
                                {item.blockReason || 'Blocked'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Evening Section if available */}
                  {eveningSlots.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Late Afternoon</span>
                        <span className="text-slate-400 font-normal">4:00 PM – 5:30 PM</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {eveningSlots.map((item) => {
                          const isSelected = selectedSlot === item.slot;
                          const isDisabled = item.isBooked || item.isBlocked;

                          return (
                            <button
                              key={item.slot}
                              disabled={isDisabled}
                              onClick={() => setSelectedSlot(item.slot)}
                              className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-800 text-white border-teal-800 shadow-sm'
                                  : isDisabled
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                  : 'bg-slate-50 hover:bg-white text-slate-800 border-slate-200 hover:border-teal-700'
                              }`}
                            >
                              <span className="tabular-nums">{item.slot}</span>
                              {item.isBooked && <span className="block text-[9px] font-normal">Booked</span>}
                              {item.isBlocked && (
                                <span className="block text-[9px] font-normal text-amber-700 truncate">
                                  Blocked
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Booking Action Bar */}
            <div className="pt-4 mt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-slate-500">Selected Appointment:</span>
                <span className="font-bold text-slate-900">
                  {selectedSlot ? `${formatDatePretty(selectedDate)} at ${selectedSlot}` : 'No slot chosen'}
                </span>
              </div>

              <button
                disabled={!selectedSlot || selectedDateBlock.blocked}
                onClick={handleBookNow}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                  !selectedSlot || selectedDateBlock.blocked
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-teal-800 hover:bg-teal-900 active:scale-[0.98]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Continue to Patient Intake &amp; Instant Confirmation</span>
              </button>

              <div className="mt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
                <span>Can't find a time that fits?</span>
                <button
                  type="button"
                  onClick={() =>
                    onJoinWaitlist(
                      selectedServiceId,
                      selectedTherapistId === 'any' ? THERAPISTS[0].id : selectedTherapistId,
                      selectedDate
                    )
                  }
                  className="font-semibold text-teal-800 hover:text-teal-950 underline cursor-pointer"
                >
                  Join Priority Waitlist
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
