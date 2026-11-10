import React from 'react';
import { User, Instagram } from 'lucide-react';
import { CLINIC_IMAGES } from '../data/mockData';

interface NavbarProps {
  onOpenBooking: () => void;
  onOpenManageBooking: () => void;
  onOpenPatientDashboard: () => void;
  onOpenPractitionerPortal: () => void;
  isPractitionerMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenBooking,
  onOpenManageBooking,
  onOpenPatientDashboard,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-18">
          <a
            href="#"
            className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2.5"
          >
            <img src={CLINIC_IMAGES.logoMark} alt="" className="w-10 h-10 rounded-full object-contain bg-white" />
            <span className="flex flex-col leading-none">
              <span className="font-extrabold tracking-wide">MSK HACKS</span>
              <span className="text-[10px] font-semibold tracking-[0.25em] text-slate-500 mt-1">PHYSIOTHERAPY</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
            <a href="#book-calendar" className="text-teal-800 font-semibold hover:text-teal-950 transition-colors whitespace-nowrap shrink-0">
              Book Online
            </a>
            <a href="#services" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Services
            </a>
            <a href="#specialists" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              Our Physio
            </a>
            <a href="#faq" className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
            <button
              onClick={onOpenPatientDashboard}
              className="text-slate-800 font-medium hover:text-teal-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-teal-700" />
              <span>My Bookings</span>
            </button>
            <a
              href="https://www.instagram.com/msk.hacks/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-pink-600 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 text-xs text-slate-500 font-medium"
              title="Follow @msk.hacks on Instagram"
            >
              <Instagram className="w-3.5 h-3.5 text-pink-600" />
              <span>@msk.hacks</span>
            </a>
            <button
              onClick={onOpenManageBooking}
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-xs text-slate-400 hidden lg:inline"
            >
              Find Booking
            </button>
          </nav>

          <button
            onClick={onOpenBooking}
            className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
          >
            Book Appointment
          </button>
        </div>
      </div>
    </header>
  );
};
