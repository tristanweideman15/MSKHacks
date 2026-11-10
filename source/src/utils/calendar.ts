import { paymentLabel } from './format';
import { Appointment, TherapyService, Therapist, ClinicInfo, BlockedTimeSlot, EmailNotification, WaitlistEntry } from '../types';

export function generateReferenceCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `MSK-${digits}`;
}

export function generateWaitlistCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `WAIT-${digits}`;
}

export function formatDatePretty(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function generateDailyTimeSlots(startTime = '07:30', endTime = '17:30', intervalMinutes = 45): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinTotal = startHour * 60 + startMin;
  const endMinTotal = endHour * 60 + endMin;

  while (currentMinTotal + intervalMinutes <= endMinTotal) {
    const hours24 = Math.floor(currentMinTotal / 60);
    const mins = currentMinTotal % 60;

    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const formatted = `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
    slots.push(formatted);

    currentMinTotal += intervalMinutes;
  }

  return slots;
}

/**
 * Check if a date is completely blocked by a clinic holiday or full-day closure
 */
export function isDateBlocked(
  dateStr: string,
  therapistId: string,
  blockedSlots: BlockedTimeSlot[]
): { blocked: boolean; reason?: string } {
  for (const block of blockedSlots) {
    // Check provider match
    if (block.therapistId !== 'all' && therapistId !== 'any' && block.therapistId !== therapistId) {
      continue;
    }

    if (block.isFullDay) {
      if (block.date === dateStr) {
        return { blocked: true, reason: block.title };
      }
      if (block.startDate && block.endDate && dateStr >= block.startDate && dateStr <= block.endDate) {
        return { blocked: true, reason: block.title };
      }
    }
  }

  return { blocked: false };
}

/**
 * Check if a specific time slot is blocked on a date (e.g. staff lunch, meeting, doctor leave)
 */
export function isSlotBlocked(
  dateStr: string,
  slot: string,
  therapistId: string,
  blockedSlots: BlockedTimeSlot[]
): { blocked: boolean; reason?: string } {
  for (const block of blockedSlots) {
    // Provider check
    if (block.therapistId !== 'all' && therapistId !== 'any' && block.therapistId !== therapistId) {
      continue;
    }

    // Full day closure
    if (block.isFullDay) {
      if (block.date === dateStr || (block.startDate && block.endDate && dateStr >= block.startDate && dateStr <= block.endDate)) {
        return { blocked: true, reason: block.title };
      }
    }

    // Daily recurring block (e.g. staff lunch every day at 12:00 PM / 12:45 PM)
    if (block.recurringDaily && block.timeSlots && block.timeSlots.includes(slot)) {
      return { blocked: true, reason: block.title };
    }

    // Specific date slot block
    if (block.date === dateStr && block.timeSlots && block.timeSlots.includes(slot)) {
      return { blocked: true, reason: block.title };
    }
  }

  return { blocked: false };
}

/**
 * Generates both Patient and Practice confirmation email notification objects
 */
export function createBookingEmails(
  appointment: Appointment,
  service: TherapyService,
  therapist: Therapist,
  clinic: ClinicInfo
): { patientEmail: EmailNotification; practiceEmail: EmailNotification } {
  const prettyDate = formatDatePretty(appointment.date);
  const nowIso = new Date().toISOString();

  // 1. Patient Confirmation Email
  const patientHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f766e; padding: 24px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700;">${clinic.name}</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #ccfbf1;">Appointment Confirmation · Code: <strong>${appointment.referenceCode}</strong></p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${appointment.intake.fullName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Your physiotherapy appointment has been booked. We look forward to helping you relieve, restore and preserve.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="color: #64748b; width: 140px;">Service:</td>
              <td style="font-weight: 600; color: #0f172a;">${service.title} (${service.durationMinutes} min)</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Clinician:</td>
              <td style="font-weight: 600; color: #0f172a;">${therapist.name}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Date &amp; Time:</td>
              <td style="font-weight: 600; color: #0f766e;">${prettyDate} at ${appointment.timeSlot}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Confirmation Code:</td>
              <td style="font-weight: 700; color: #0f172a; font-family: monospace;">${appointment.referenceCode}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Location:</td>
              <td style="color: #334155;">${clinic.address}, ${clinic.cityStateZip}</td>
            </tr>
          </table>
        </div>

        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f766e; margin-bottom: 8px;">What to prepare for your visit</h3>
        <ul style="font-size: 13px; line-height: 1.6; color: #475569; padding-left: 20px; margin-top: 4px;">
          <li>Wear comfortable, loose clothing that lets us see and move the area being treated.</li>
          <li>${clinic.parkingInfo}</li>
          <li>Bring any referral letters, X-rays or scan reports, and your medical aid card if you plan to claim.</li>
        </ul>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
          Need to reschedule or cancel? You can manage your appointment online anytime using confirmation code <strong>${appointment.referenceCode}</strong> or by calling our clinic at ${clinic.phone}.
        </div>
      </div>
    </div>
  `.trim();

  const patientEmail: EmailNotification = {
    id: `em-pat-${Date.now()}`,
    appointmentId: appointment.id,
    referenceCode: appointment.referenceCode,
    recipientType: 'patient',
    recipientEmail: appointment.intake.email,
    recipientName: appointment.intake.fullName,
    subject: `Appointment Confirmed: ${service.title} (${appointment.referenceCode})`,
    sentAt: nowIso,
    previewSnippet: `Your appointment with ${therapist.name} is confirmed for ${prettyDate} at ${appointment.timeSlot}.`,
    htmlContent: patientHtml,
    status: 'delivered',
  };

  // 2. Practice Alert Email
  const practiceHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px 24px; color: #ffffff;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #2dd4bf; letter-spacing: 0.08em;">Practice Intake Alert · ${clinic.name}</span>
        <h2 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700;">New Patient Appointment: ${appointment.intake.fullName}</h2>
      </div>
      <div style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <div><strong>Date &amp; Slot:</strong> ${prettyDate} at ${appointment.timeSlot}</div>
          <div><strong>Code:</strong> <span style="font-family: monospace; font-weight: bold;">${appointment.referenceCode}</span></div>
        </div>

        <h3 style="font-size: 13px; text-transform: uppercase; color: #475569; margin: 16px 0 8px 0;">Patient Information</h3>
        <table style="width: 100%; font-size: 13px; line-height: 1.8; margin-bottom: 16px;">
          <tr>
            <td style="color: #64748b; width: 140px;">Full Legal Name:</td>
            <td style="font-weight: 600;">${appointment.intake.fullName}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Phone:</td>
            <td><a href="tel:${appointment.intake.phone}" style="color: #0f766e; text-decoration: none;">${appointment.intake.phone}</a></td>
          </tr>
          <tr>
            <td style="color: #64748b;">Email:</td>
            <td>${appointment.intake.email}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Date of Birth:</td>
            <td>${appointment.intake.dateOfBirth}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Payment / Medical aid:</td>
            <td>${paymentLabel(appointment.intake.insuranceType)}${appointment.intake.insuranceProvider ? ' (' + appointment.intake.insuranceProvider + ')' : ''}</td>
          </tr>
        </table>

        <h3 style="font-size: 13px; text-transform: uppercase; color: #475569; margin: 16px 0 8px 0;">Clinical Intake Summary</h3>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.6;">
          <p style="margin: 0 0 6px 0;"><strong>Primary Pain Area:</strong> ${appointment.intake.painLocation}</p>
          <p style="margin: 0 0 6px 0;"><strong>Pain Level:</strong> <span style="color: #b91c1c; font-weight: bold;">${appointment.intake.painLevel}/10</span> · <strong>Duration:</strong> ${appointment.intake.injuryDuration}</p>
          <p style="margin: 0 0 6px 0;"><strong>Referral:</strong> ${appointment.intake.hasReferral ? 'Yes (referral / imaging)' : 'No (self-referred)'}</p>
          <p style="margin: 0;"><strong>Subjective Symptoms:</strong> ${appointment.intake.symptomsDescription}</p>
        </div>

        <div style="margin-top: 20px; font-size: 12px; color: #64748b;">
          Physiotherapist: <strong>${therapist.name}</strong> · Session Duration: <strong>${service.durationMinutes} minutes</strong>
        </div>
      </div>
    </div>
  `.trim();

  const practiceEmail: EmailNotification = {
    id: `em-prac-${Date.now()}`,
    appointmentId: appointment.id,
    referenceCode: appointment.referenceCode,
    recipientType: 'practice',
    recipientEmail: clinic.practiceAlertEmail,
    recipientName: `${clinic.name} Clinical Staff`,
    subject: `[New Booking Alert] ${appointment.intake.fullName} · ${prettyDate} ${appointment.timeSlot} (${appointment.referenceCode})`,
    sentAt: nowIso,
    previewSnippet: `New booking: ${appointment.intake.fullName} for ${service.title} with ${therapist.name}. Pain: ${appointment.intake.painLevel}/10.`,
    htmlContent: practiceHtml,
    status: 'delivered',
  };

  return { patientEmail, practiceEmail };
}

export function downloadCalendarIcs(
  appointment: Appointment,
  service: TherapyService | undefined,
  therapist: Therapist | undefined,
  clinic: ClinicInfo
) {
  const [year, month, day] = appointment.date.split('-').map(Number);
  
  // Parse timeSlot e.g. "09:00 AM" or "02:30 PM"
  const timeMatch = appointment.timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  let hour = 9;
  let minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    const meridian = timeMatch[3].toUpperCase();
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
  }

  const startDate = new Date(year, month - 1, day, hour, minute);
  const durationMs = (service?.durationMinutes || 60) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const formatIcsDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const title = `Physiotherapy: ${service?.title || 'Physiotherapy session'} - MSK Hacks`;
  const location = `${clinic.address}, ${clinic.cityStateZip}`;
  const description = [
    `Patient: ${appointment.intake.fullName}`,
    `Provider: ${therapist?.name || 'MSK Hacks Clinical Team'}`,
    `Confirmation Code: ${appointment.referenceCode}`,
    `Clinic Phone: ${clinic.phone}`,
    `Instagram: ${clinic.instagramHandle || '@msk.hacks'} (${clinic.instagramUrl || 'https://www.instagram.com/msk.hacks/'})`,
    `Parking: ${clinic.parkingInfo}`,
    `Please arrive 10 minutes early in comfortable clothing.`,
  ].join('\\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MSK Hacks//Appointment Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appointment.referenceCode}-${Date.now()}@mskhacks.com`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Physiotherapy appointment reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  void icsContent;
  const fmt = (d: Date) => formatIcsDate(d);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details: description.replace(/\\n/g, '\n'),
    location,
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener');
}

/**
 * Generates automated notification emails when a patient joins the Priority Waitlist
 */
export function createWaitlistEmails(
  waitlistEntry: WaitlistEntry,
  service: TherapyService,
  therapist: Therapist | undefined,
  clinic: ClinicInfo
): { patientEmail: EmailNotification; practiceEmail: EmailNotification } {
  const prettyDate = formatDatePretty(waitlistEntry.preferredDate);
  const nowIso = new Date().toISOString();
  const therapistName = therapist ? therapist.name : 'Mathenjwa SK';

  const patientHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0d9488; padding: 24px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 700;">${clinic.name}</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #ccfbf1;">Priority Waitlist Request Received · Code: <strong>${waitlistEntry.referenceCode}</strong></p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; margin-top: 0;">Dear <strong>${waitlistEntry.patientName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          You are on our <strong>Priority Waitlist</strong> for <strong>${prettyDate}</strong>. If an appointment opens up due to a cancellation or schedule adjustment, we will contact you.
        </p>

        <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="color: #64748b; width: 140px;">Requested Service:</td>
              <td style="font-weight: 600; color: #0f172a;">${service.title}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Requested Provider:</td>
              <td style="font-weight: 600; color: #0f172a;">${therapistName}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Preferred Date:</td>
              <td style="font-weight: 600; color: #0f766e;">${prettyDate} (${waitlistEntry.preferredTimeOfDay.toUpperCase()} slots)</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Waitlist Code:</td>
              <td style="font-weight: 700; color: #0f172a; font-family: monospace;">${waitlistEntry.referenceCode}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Primary Pain Area:</td>
              <td style="color: #334155;">${waitlistEntry.painLocation}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #475569;">
          Have an urgent flare-up? Please call us on <strong>${clinic.phone}</strong>.
        </p>
      </div>
    </div>
  `.trim();

  const patientEmail: EmailNotification = {
    id: `em-wait-pat-${Date.now()}`,
    appointmentId: waitlistEntry.id,
    referenceCode: waitlistEntry.referenceCode,
    recipientType: 'patient',
    recipientEmail: waitlistEntry.email,
    recipientName: waitlistEntry.patientName,
    subject: `Priority Waitlist Confirmed: ${service.title} (${waitlistEntry.referenceCode})`,
    sentAt: nowIso,
    previewSnippet: `You are on the Priority Waitlist for ${prettyDate}. We will alert you the moment a slot opens.`,
    htmlContent: patientHtml,
    status: 'delivered',
  };

  const practiceHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px 24px; color: #ffffff;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #f59e0b; letter-spacing: 0.08em;">Priority Waitlist Alert · ${clinic.name}</span>
        <h2 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700;">New Waitlist Request: ${waitlistEntry.patientName}</h2>
      </div>
      <div style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <div><strong>Requested Date:</strong> ${prettyDate} (${waitlistEntry.preferredTimeOfDay})</div>
          <div><strong>Code:</strong> <span style="font-family: monospace; font-weight: bold;">${waitlistEntry.referenceCode}</span></div>
        </div>

        <table style="width: 100%; font-size: 13px; line-height: 1.8; margin-bottom: 16px;">
          <tr>
            <td style="color: #64748b; width: 140px;">Patient:</td>
            <td style="font-weight: 600;">${waitlistEntry.patientName}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Phone:</td>
            <td><a href="tel:${waitlistEntry.phone}" style="color: #0f766e; text-decoration: none;">${waitlistEntry.phone}</a></td>
          </tr>
          <tr>
            <td style="color: #64748b;">Email:</td>
            <td>${waitlistEntry.email}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Pain Focus:</td>
            <td style="font-weight: 600; color: #b91c1c;">${waitlistEntry.painLocation}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Requested Service:</td>
            <td>${service.title}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Therapist:</td>
            <td>${therapistName}</td>
          </tr>
        </table>

        ${waitlistEntry.notes ? `
          <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 12px; color: #92400e; margin-bottom: 16px;">
            <strong>Patient Note:</strong> ${waitlistEntry.notes}
          </div>
        ` : ''}

        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
          Log into the Practitioner Portal to promote this patient to an appointment when a cancellation occurs.
        </p>
      </div>
    </div>
  `.trim();

  const practiceEmail: EmailNotification = {
    id: `em-wait-prac-${Date.now()}`,
    appointmentId: waitlistEntry.id,
    referenceCode: waitlistEntry.referenceCode,
    recipientType: 'practice',
    recipientEmail: clinic.practiceAlertEmail,
    recipientName: `${clinic.name} Clinical Staff`,
    subject: `[Waitlist Request] ${waitlistEntry.patientName} · ${prettyDate} (${waitlistEntry.referenceCode})`,
    sentAt: nowIso,
    previewSnippet: `New waitlist request: ${waitlistEntry.patientName} for ${service.title} on ${prettyDate}.`,
    htmlContent: practiceHtml,
    status: 'delivered',
  };

  return { patientEmail, practiceEmail };
}

