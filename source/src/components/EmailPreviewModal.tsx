import React, { useState } from 'react';
import { EmailNotification } from '../types';
import { X, Mail, CheckCircle2, User, Building, ExternalLink, Send } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientEmail: EmailNotification | null;
  practiceEmail: EmailNotification | null;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  patientEmail,
  practiceEmail,
}) => {
  const [activeTab, setActiveTab] = useState<'patient' | 'practice'>('patient');

  if (!isOpen || (!patientEmail && !practiceEmail)) return null;

  const currentEmail = activeTab === 'patient' ? patientEmail : practiceEmail;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                Automated Email Notification System
              </div>
              <h3 className="text-base font-bold text-white">Confirmation preview</h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close email preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Patient Email vs Practice Alert */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('patient')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'patient'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-teal-700" />
              <span>Patient Confirmation ({patientEmail?.recipientEmail})</span>
            </button>

            <button
              onClick={() => setActiveTab('practice')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'practice'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-teal-700" />
              <span>Practice Alert ({practiceEmail?.recipientEmail.split(',')[0]})</span>
            </button>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered</span>
          </span>
        </div>

        {/* Email Metadata */}
        {currentEmail && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs space-y-1 text-slate-600">
            <div>
              <span className="text-slate-400 font-medium">To:</span>{' '}
              <span className="font-semibold text-slate-800">{currentEmail.recipientName}</span> &lt;
              {currentEmail.recipientEmail}&gt;
            </div>
            <div>
              <span className="text-slate-400 font-medium">From:</span>{' '}
              <span className="font-semibold text-slate-800">MSK Hacks Physiotherapy</span> &lt;info@mskhacksphysio.com&gt;
            </div>
            <div>
              <span className="text-slate-400 font-medium">Subject:</span>{' '}
              <span className="font-semibold text-slate-900">{currentEmail.subject}</span>
            </div>
          </div>
        )}

        {/* Email HTML Body Render */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60">
          {currentEmail ? (
            <div
              className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: currentEmail.htmlContent }}
            />
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">No email content available.</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            A copy of this notice is archived in the Practitioner Portal audit logs.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
