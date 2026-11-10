import React, { useState } from 'react';
import { CLINIC_FAQS, CLINIC_INFO } from '../data/mockData';
import { ChevronDown, Wallet, UserCheck, Phone } from 'lucide-react';

export const InsuranceFaqSection: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
            <UserCheck className="w-5 h-5 text-teal-700 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">No referral needed</h3>
            <p className="text-sm text-slate-600">Book directly with your physiotherapist — no doctor’s letter required.</p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
            <Wallet className="w-5 h-5 text-teal-700 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Medical aid & private patients</h3>
            <p className="text-sm text-slate-600">Benefits vary by scheme and plan. Contact us before your visit and we’ll help you check.</p>
          </div>
          <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
            <Phone className="w-5 h-5 text-teal-700 mb-3" />
            <h3 className="font-bold text-slate-900 mb-1">Questions? Call us</h3>
            <p className="text-sm text-slate-600">
              <a className="underline underline-offset-2" href={`tel:${CLINIC_INFO.phone.replace(/\s/g, '')}`}>{CLINIC_INFO.phone}</a>
              {' or '}
              <a className="underline underline-offset-2" href={`tel:${(CLINIC_INFO.landline || '').replace(/\s/g, '')}`}>{CLINIC_INFO.landline}</a>
            </p>
          </div>
        </div>

        <div className="max-w-2xl mb-10">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-800 mb-2">Frequently Asked Questions</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Everything you need to know before your first visit.
          </h2>
        </div>

        <div className="space-y-3 max-w-3xl">
          {CLINIC_FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div key={index} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50"
                >
                  <span className="font-semibold text-sm sm:text-base text-slate-900">{faq.question}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-700' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
