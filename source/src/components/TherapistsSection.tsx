import React from 'react';
import { THERAPISTS, CLINIC_IMAGES, CLINIC_INFO } from '../data/mockData';
import { GraduationCap, Calendar, CheckCircle2 } from 'lucide-react';

interface TherapistsSectionProps {
  onBookWithTherapist: (therapistId: string) => void;
}

export const TherapistsSection: React.FC<TherapistsSectionProps> = ({ onBookWithTherapist }) => {
  const therapist = THERAPISTS[0];
  return (
    <section id="specialists" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-800 mb-2">Meet Our Physiotherapist</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            One-on-one care from a qualified physiotherapist.
          </h2>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 bg-slate-100 flex items-center justify-center p-6">
            <img
              src={CLINIC_IMAGES.physioPost}
              alt="Meet our physiotherapist: Mathenjwa SK, BSc Physiotherapy"
              className="w-full max-w-xs h-auto rounded-xl shadow-md"
            />
          </div>

          <div className="md:col-span-7 p-6 md:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 mb-1">
                <GraduationCap className="w-4 h-4" />
                <span>{therapist.credentials}</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">{therapist.name}</h3>
              <div className="text-sm text-slate-600 mb-5">{therapist.title}</div>

              <p className="text-sm text-slate-700 leading-relaxed mb-6">{therapist.bio}</p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {therapist.certifications.map((v) => (
                  <li key={v} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                {CLINIC_INFO.address}, {CLINIC_INFO.cityStateZip}
              </div>
              <button
                onClick={() => onBookWithTherapist(therapist.id)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Calendar className="w-4 h-4" />
                <span>Book with {therapist.name}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
