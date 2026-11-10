import React from 'react';
import { CLINIC_INFO, SERVICES } from '../data/mockData';
import { MapPin, Phone, Mail, Clock, Lock, Instagram } from 'lucide-react';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenManageBooking: () => void;
  onOpenPatientDashboard?: () => void;
  onOpenPractitionerPortal: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBooking,
  onOpenManageBooking,
  onOpenPatientDashboard,
  onOpenPractitionerPortal,
}) => {
  return (
    <footer className="bg-slate-950 text-slate-300 text-xs border-t border-slate-800 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="text-lg font-extrabold text-white tracking-wide">MSK HACKS</div>
            <div className="text-[10px] font-semibold tracking-[0.3em] text-slate-400 mb-3">PHYSIOTHERAPY</div>
            <p className="text-slate-400 leading-relaxed mb-4 text-xs">
              Professional and compassionate physiotherapy in Carletonville. {CLINIC_INFO.tagline}.
            </p>
            <a href={CLINIC_INFO.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
              <span>{CLINIC_INFO.instagramHandle}</span>
            </a>
          </div>

          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Services</div>
            <ul className="space-y-2 text-slate-400 text-xs">
              {SERVICES.slice(1, 7).map((s) => (
                <li key={s.id}>
                  <a href="#services" className="hover:text-white transition-colors">{s.title}</a>
                </li>
              ))}
              <li>
                <button
                  onClick={onOpenPatientDashboard || onOpenManageBooking}
                  className="hover:text-teal-400 transition-colors text-left cursor-pointer font-medium text-slate-300"
                >
                  My bookings
                </button>
              </li>
              <li>
                <button onClick={onOpenManageBooking} className="hover:text-teal-400 transition-colors text-left cursor-pointer">
                  Manage / reschedule appointment
                </button>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Practice Hours</div>
            <div className="flex items-start gap-2 text-slate-400 text-xs">
              <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-slate-300">{CLINIC_INFO.hours.weekdays}</div>
                <div>{CLINIC_INFO.hours.saturday}</div>
                <div className="text-slate-500">{CLINIC_INFO.hours.sunday}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider mb-3">Location & Contact</div>
            <div className="space-y-2.5 text-slate-400 text-xs">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${CLINIC_INFO.address}, ${CLINIC_INFO.cityStateZip}, South Africa`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 hover:text-white"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <div>{CLINIC_INFO.address}</div>
                  <div>{CLINIC_INFO.cityStateZip}</div>
                </div>
              </a>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <a href={`tel:${CLINIC_INFO.phone.replace(/\s/g, '')}`} className="hover:text-white">{CLINIC_INFO.phone}</a>
                <span aria-hidden="true">·</span>
                <a href={`tel:${(CLINIC_INFO.landline || '').replace(/\s/g, '')}`} className="hover:text-white">{CLINIC_INFO.landline}</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <a href={`mailto:${CLINIC_INFO.email}`} className="hover:text-white break-all">{CLINIC_INFO.email}</a>
              </div>
              <div className="pt-2">
                <button
                  onClick={onOpenBooking}
                  className="w-full py-2 px-3 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors cursor-pointer text-center"
                >
                  Book an appointment
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>© {new Date().getFullYear()} MSK Hacks Physiotherapy. All rights reserved.</div>
          <button
            onClick={onOpenPractitionerPortal}
            className="flex items-center gap-1 text-slate-400 hover:text-teal-400 transition-colors cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            <span>Practice portal</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
