import React from 'react';
import { X } from 'lucide-react';
import { CLINIC_INFO } from '../data/mockData';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <h3 className="text-base font-bold text-slate-900">Privacy &amp; POPIA Notice</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close privacy notice"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-700 space-y-4">
          <p className="text-xs text-slate-500">Last updated: [DATE]</p>

          <p>
            {CLINIC_INFO.name} ("we", "us", "the practice") is committed to protecting your
            personal information in line with South Africa's Protection of Personal Information
            Act 4 of 2013 ("POPIA"). This notice explains what we collect when you use this
            website, why we collect it, and how we handle it.
          </p>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">1. What we collect</h4>
            <p>When you book an appointment or join our waitlist, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Your name, email address, phone number and date of birth</li>
              <li>
                Health-related information you choose to share, such as your pain location,
                pain level, injury duration and a description of your symptoms
              </li>
              <li>Your payment or medical aid preference, and medical aid scheme name if given</li>
              <li>Whether you have a referral, X-rays or scan reports</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">2. Why we collect it</h4>
            <p>We use this information only to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Schedule, confirm, reschedule and manage your appointment</li>
              <li>Prepare your physiotherapist for your assessment and treatment</li>
              <li>Send you booking confirmations, reminders and appointment updates by email</li>
              <li>Contact you if a waitlist slot becomes available</li>
              <li>Process accounts and, where relevant, medical aid claims</li>
            </ul>
            <p className="mt-1">
              Health information is "special personal information" under POPIA. We only collect
              it with your explicit consent (the checkbox on the booking form), and only use it
              for the purposes above.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">3. Who can see it</h4>
            <p>
              Your booking and health information is visible only to authorised staff at{' '}
              {CLINIC_INFO.name} who need it to manage your care. It is stored using Supabase, a
              secure database provider, and confirmation emails are sent through EmailJS. We do
              not sell, rent or share your information with any third party for marketing
              purposes.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">4. How long we keep it</h4>
            <p>
              We retain appointment and clinical records for [RETENTION PERIOD — e.g. "a minimum
              of 6 years from your last visit"], in line with standard healthcare record-keeping
              practice, or as required by law. You may request deletion of your information
              outside of that minimum retention period.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">5. Your rights</h4>
            <p>Under POPIA, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Ask what personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>
                Request deletion of your information, subject to our legal and record-keeping
                obligations
              </li>
              <li>Withdraw consent for future processing (this does not cancel a booking already made)</li>
              <li>Lodge a complaint with the Information Regulator of South Africa</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">6. Contact us</h4>
            <p>
              To exercise any of these rights, or if you have questions about this notice, please
              contact us at{' '}
              <a href={`mailto:${CLINIC_INFO.email}`} className="text-teal-800 underline">
                {CLINIC_INFO.email}
              </a>{' '}
              or {CLINIC_INFO.phone}.
            </p>
          </div>

          <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
            This notice is a general template and has not been reviewed by a lawyer. Please have
            it checked against your practice's specific record-keeping and data-sharing practices
            before publishing.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
