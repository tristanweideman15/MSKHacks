export type ServiceCategory = 'evaluation' | 'rehab' | 'sports' | 'spine' | 'specialized';

export interface TherapyService {
  id: string;
  title: string;
  category: ServiceCategory;
  durationMinutes: number;
  price: number;
  inNetworkEligible: boolean;
  shortDescription: string;
  detailedDescription: string;
  idealFor: string[];
  recommendedFollowUps?: string;
}

export interface Therapist {
  id: string;
  name: string;
  title: string;
  credentials: string;
  specialty: string;
  bio: string;
  yearsExperience: number;
  education: string[];
  certifications: string[];
  imageUrl: string;
  availableDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  workingHours: { start: string; end: string };
}

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

export interface PatientIntake {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  painLocation: string;
  painLevel: number; // 0 - 10
  injuryDuration: 'acute' | 'subacute' | 'chronic';
  priorImaging?: string;
  hasReferral: boolean;
  insuranceType: 'in-network' | 'self-pay' | 'hsa-fsa';
  insuranceProvider?: string;
  symptomsDescription: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface Appointment {
  id: string;
  referenceCode: string;
  serviceId: string;
  therapistId: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00 AM"
  status: AppointmentStatus;
  intake: PatientIntake;
  createdAt: string;
  clinicalNotes?: string;
}

export interface ClinicInfo {
  name: string;
  tagline: string;
  address: string;
  cityStateZip: string;
  phone: string;
  landline?: string;
  email: string;
  practiceAlertEmail: string;
  parkingInfo: string;
  instagramUrl?: string;
  instagramHandle?: string;
  hours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
}

export interface BlockedTimeSlot {
  id: string;
  title: string;
  type: 'lunch' | 'holiday' | 'custom';
  therapistId: string; // 'all' or specific therapist id
  date?: string; // YYYY-MM-DD for specific day
  startDate?: string;
  endDate?: string;
  timeSlots?: string[]; // specific time slots blocked e.g. ["12:00 PM", "12:45 PM"]
  isFullDay?: boolean;
  recurringDaily?: boolean; // blocks these slots every day (e.g. daily staff lunch)
  notes?: string;
  createdAt: string;
}

export interface EmailNotification {
  id: string;
  appointmentId: string;
  referenceCode: string;
  recipientType: 'patient' | 'practice';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  sentAt: string;
  previewSnippet: string;
  htmlContent: string;
  status: 'delivered';
}

export type WaitlistStatus = 'active' | 'contacted' | 'booked' | 'cancelled';

export interface WaitlistEntry {
  id: string;
  referenceCode: string; // e.g. "WAIT-4829"
  patientName: string;
  email: string;
  phone: string;
  serviceId: string;
  therapistId: string; // 'any' or specific therapist id
  preferredDate: string; // YYYY-MM-DD
  preferredTimeOfDay: 'morning' | 'afternoon' | 'any';
  painLocation: string;
  notes?: string;
  status: WaitlistStatus;
  createdAt: string;
}

export interface PatientProfile {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  painLocation?: string;
  insuranceType?: 'in-network' | 'self-pay' | 'hsa-fsa';
  insuranceProvider?: string;
  address?: string;
  notes?: string;
}



