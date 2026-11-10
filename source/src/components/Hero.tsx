import React from 'react';
import { Calendar, MapPin, Phone, ArrowRight, Stethoscope, Instagram } from 'lucide-react';
import { CLINIC_IMAGES, CLINIC_INFO, SERVICES } from '../data/mockData';

interface HeroProps {
  onOpenBooking: () => void;
  onOpenPractitionerPortal: () => void;
  isPractitionerMode: boolean;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenBooking,
  onOpenPractitionerPortal,
  isPractitionerMode,
}) => {
  return (
    <section className="relative bg-slate-950 text-white overflow-hidden">
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">{CLINIC_INFO.address}, {CLINIC_INFO.cityStateZip}</span>
          </div>
          <button
            onClick={onOpenPractitionerPortal}
  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors whitespace-nowrap cursor-pointer text-xs shrink-0"
  title="Staff only – clinic operations portal"
>
  <Stethoscope className="w-3.5 h-3.5" />
  <span>{isPractitionerMode ? 'Patient view' : 'Staff login'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="text-xs font-semibold tracking-[0.3em] text-teal-400 uppercase mb-4">
              {CLINIC_INFO.tagline}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15] text-balance mb-6">
              Professional and compassionate physiotherapy in Carletonville.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mb-8">
              Evidence-based, patient-focused care for joint pain, back and neck pain, sports injuries, neurological rehabilitation and more — with clear goals and the education you need to move, recover and thrive.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-10">
              <button
                onClick={onOpenBooking}
                className="px-7 py-3.5 text-base font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 active:scale-[0.98] rounded-xl shadow-lg shadow-teal-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Calendar className="w-5 h-5 text-slate-950" />
                <span>Book an Appointment</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#symptom-triage"
                className="px-6 py-3.5 text-sm font-medium text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors flex items-center justify-center gap-2 text-center"
              >
                <span>Where does it hurt? Find the right service</span>
              </a>
            </div>

            <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm text-slate-300">
              <a href={`tel:${CLINIC_INFO.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-white">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{CLINIC_INFO.phone}</span>
              </a>
              <a href={`tel:${(CLINIC_INFO.landline || '').replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-white">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{CLINIC_INFO.landline}</span>
              </a>
              <a href={CLINIC_INFO.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                <Instagram className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{CLINIC_INFO.instagramHandle}</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-3xl bg-white p-8 sm:p-10 shadow-2xl shadow-black/40 flex flex-col items-center text-center">
              <img src={CLINIC_IMAGES.logoFull} alt="MSK Hacks Physiotherapy logo" className="w-56 sm:w-64 h-auto" />
            </div>
          </div>
        </div>

        <div className="mt-14 pt-10 border-t border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-6 text-slate-300">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">1-on-1</div>
            <div className="text-xs text-slate-400 mt-1">Every session is with your physiotherapist</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums">{SERVICES.length - 1}</div>
            <div className="text-xs text-slate-400 mt-1">Areas of treatment, from sports injuries to pelvic floor rehab</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">No referral</div>
            <div className="text-xs text-slate-400 mt-1">Book directly — no doctor’s letter needed</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">BSc Physio</div>
            <div className="text-xs text-slate-400 mt-1">Qualified physiotherapist, Mathenjwa SK</div>
          </div>
        </div>
      </div>
    </section>
  );
};
