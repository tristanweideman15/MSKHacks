import React, { useState } from 'react';
import { BODY_SYMPTOMS, SERVICES, THERAPISTS } from '../data/mockData';
import { ArrowRight, Activity, Clock, CheckCircle2 } from 'lucide-react';
import { formatPrice } from '../utils/format';

interface SymptomTriageProps {
  onSelectServiceAndBook: (serviceId: string, therapistId?: string) => void;
}

export const SymptomTriage: React.FC<SymptomTriageProps> = ({ onSelectServiceAndBook }) => {
  const [selectedSymptomId, setSelectedSymptomId] = useState<string>(BODY_SYMPTOMS[0].id);

  const activeSymptom = BODY_SYMPTOMS.find((s) => s.id === selectedSymptomId) || BODY_SYMPTOMS[0];
  const recommendedService = SERVICES.find((s) => s.id === activeSymptom.recommendedServiceId);
  const recommendedTherapist = THERAPISTS.find((t) => t.id === activeSymptom.therapistPreference);

  return (
    <section id="symptom-triage" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-800 mb-2">
            Find the Right Service
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Where does it hurt? Let’s match you with the right treatment.
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Choose the area or problem below to see how we can help and book the right session.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Anatomical / Condition Selector */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">
              Select Region or Complaint
            </div>
            {BODY_SYMPTOMS.map((symptom) => {
              const isSelected = symptom.id === selectedSymptomId;
              return (
                <button
                  key={symptom.id}
                  onClick={() => setSelectedSymptomId(symptom.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-white border-teal-700 shadow-sm ring-1 ring-teal-700'
                      : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className={`font-semibold text-sm ${isSelected ? 'text-teal-900' : 'text-slate-900'}`}>
                      {symptom.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{symptom.description}</div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                      isSelected ? 'bg-teal-700 scale-125' : 'bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Column: Tailored Clinical Prescription & Instant Booking Match */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs text-slate-500">Selected Condition Focus</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{activeSymptom.label}</h3>
              </div>
              <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{activeSymptom.typicalDuration}</span>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Common Symptoms
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {activeSymptom.description}. We look beyond where you feel the pain to find the cause, then set clear goals for your recovery together.
                </p>
              </div>

              {recommendedService && (
                <div className="p-5 rounded-xl border border-teal-200/80 bg-teal-50/50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-teal-700" />
                      Recommended Service
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {recommendedService.durationMinutes} min · {formatPrice(recommendedService.price)}
                    </span>
                  </div>
                  <h4 className="font-bold text-base text-slate-900">{recommendedService.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {recommendedService.shortDescription}
                  </p>

                  <div className="mt-4 pt-4 border-t border-teal-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    {recommendedTherapist && (
                      <div className="flex items-center gap-3">
                        <img
                          src={recommendedTherapist.imageUrl}
                          alt={recommendedTherapist.name}
                          className="w-10 h-10 rounded-full object-cover border border-teal-200"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            Your physiotherapist: {recommendedTherapist.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{recommendedTherapist.credentials}</div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        onSelectServiceAndBook(recommendedService.id, recommendedTherapist?.id)
                      }
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
                    >
                      <span>Book this service</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 pt-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>Thorough assessment and clear diagnosis</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>Treatment and a home programme from day one</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
