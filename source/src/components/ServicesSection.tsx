import React, { useState } from 'react';
import { SERVICES } from '../data/mockData';
import { TherapyService, ServiceCategory } from '../types';
import { Clock, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { formatPrice } from '../utils/format';

interface ServicesSectionProps {
  onSelectService: (serviceId: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onSelectService }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  const categories: { label: string; value: string }[] = [
    { label: 'All services', value: 'all' },
    { label: 'Assessment', value: 'evaluation' },
    { label: 'Musculoskeletal', value: 'rehab' },
    { label: 'Spine', value: 'spine' },
    { label: 'Sports', value: 'sports' },
    { label: 'Specialised rehab', value: 'specialized' },
  ];

  const filteredServices = SERVICES.filter((s) => {
    if (selectedCategory === 'all') return true;
    return s.category === (selectedCategory as ServiceCategory);
  });

  return (
    <section id="services" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-800 mb-2">
              Our Services
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Evidence-based physiotherapy for every stage of recovery.
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Book any service online. Not sure which one you need? Start with an initial assessment and we’ll guide you from there.
            </p>
          </div>

          {/* Interactive filter tabs / segmented controls */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start md:self-auto">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Services Bento Grid with Natural Editorial Numbering */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service, index) => {
            const isExpanded = expandedServiceId === service.id;
            const editorialIndex = String(index + 1).padStart(2, '0');

            return (
              <div
                key={service.id}
                className="flex flex-col justify-between bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 p-6 transition-all hover:shadow-md hover:border-slate-300"
              >
                <div>
                  {/* Top metadata line with typographic separators (no pills) */}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="font-semibold text-slate-700">{editorialIndex}.</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {service.durationMinutes} min
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-900">{formatPrice(service.price)}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                    {service.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {service.shortDescription}
                  </p>

                  {/* Insurance eligibility unboxed metadata */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mb-4">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                    <span>Medical aid and private patients welcome</span>
                  </div>

                  {/* Detailed Description toggle */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-3">
                      <p className="leading-relaxed">{service.detailedDescription}</p>
                      <div>
                        <div className="font-semibold text-slate-900 mb-1.5">Ideal For:</div>
                        <ul className="space-y-1">
                          {service.idealFor.map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                              <Check className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                  >
                    {isExpanded ? 'Less details' : 'More details'}
                  </button>

                  <button
                    onClick={() => onSelectService(service.id)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
                  >
                    <span>Book Session</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
