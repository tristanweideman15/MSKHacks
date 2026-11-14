import React from 'react';
import { X } from 'lucide-react';
import { CLINIC_INFO } from '../data/mockData';

interface TermsOfUseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsOfUseModal: React.FC<TermsOfUseModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <h3 className="text-base font-bold text-slate-900">Terms of Use</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close terms of use"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-700 space-y-4">
          <p className="text-xs text-slate-500">Last updated: [DATE]</p>

          <p>
            These terms apply when you use this website to book, manage or cancel an appointment
            with {CLINIC_INFO.name}. By using the booking system, you agree to the terms below.
          </p>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">1. Bookings</h4>
            <p>
              Submitting a booking request through this site reserves a provisional appointment
              slot. Availability shown on the site reflects live bookings, but is not a guarantee
              against last-minute scheduling changes made directly with the practice.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">2. Rescheduling and cancellations</h4>
            <p>
              You may reschedule or cancel your own booking online using your reference code and
              the email address used to book. Please give at least 24 hours' notice where
              possible. [ADD YOUR CANCELLATION / NO-SHOW FEE POLICY HERE, IF ANY.]
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">3. Accuracy of information</h4>
            <p>
              You are responsible for providing accurate contact and health information when
              booking. Incomplete or inaccurate information may affect your physiotherapist's
              ability to prepare for your appointment.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">4. Not a substitute for emergency care</h4>
            <p>
              This website is for scheduling routine physiotherapy appointments only. It is not
              monitored continuously and must not be used to report a medical emergency. If you
              are experiencing a medical emergency, contact emergency services immediately.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">5. Fees and payment</h4>
            <p>
              Service fees are shown at the time of booking and are subject to change. Payment
              method (medical aid, card/EFT or cash) is selected during booking; final
              arrangements are confirmed at the practice.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">6. Your information</h4>
            <p>
              Information you provide when booking is handled in accordance with our{' '}
              <span className="font-semibold">Privacy &amp; POPIA Notice</span>, available
              elsewhere on this site.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">7. Changes to these terms</h4>
            <p>
              We may update these terms from time to time. Continued use of the booking system
              after changes are posted constitutes acceptance of the updated terms.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-1">8. Contact</h4>
            <p>
              Questions about these terms can be directed to{' '}
              <a href={`mailto:${CLINIC_INFO.email}`} className="text-teal-800 underline">
                {CLINIC_INFO.email}
              </a>{' '}
              or {CLINIC_INFO.phone}.
            </p>
          </div>

          <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
            This is a general template and has not been reviewed by a lawyer. Please review and
            adapt it — particularly the cancellation/no-show policy — before publishing.
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
