import React, { useState } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import { backend, friendlyError, StaffUser } from '../lib/backend';

interface StaffLoginProps {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn: (user: StaffUser) => void;
  /** True when the person arrived from a "reset password" email link. */
  isPasswordRecovery: boolean;
  onPasswordUpdated: () => void;
}

export const StaffLogin: React.FC<StaffLoginProps> = ({
  isOpen,
  onClose,
  onSignedIn,
  isPasswordRecovery,
  onPasswordUpdated,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const user = await backend.signIn(email.trim(), password);
      setPassword('');
      onSignedIn(user);
    });
  };

  const handleForgot = () => {
    if (!email.includes('@')) {
      setError('Type your staff email address first, then click “Forgot password”.');
      return;
    }
    run(async () => {
      await backend.sendPasswordReset(email.trim());
      setInfo('If that email is on the staff list, a reset link is on its way. Open it on this device.');
    });
  };

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Please use at least 8 characters.');
      return;
    }
    run(async () => {
      await backend.updatePassword(newPassword);
      setNewPassword('');
      onPasswordUpdated();
    });
  };

  const input =
    'w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700 bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-400" />
            <h2 className="text-base font-bold">{isPasswordRecovery ? 'Set a new password' : 'Practice portal sign-in'}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isPasswordRecovery ? (
          <form onSubmit={handleSetPassword} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" className={input}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save password
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="p-6 space-y-4">
            <p className="text-xs text-slate-500">For MSK Hacks staff only. Patients can manage their bookings with “My Bookings”.</p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="staff-email">Email</label>
              <input id="staff-email" type="email" autoComplete="username" className={input}
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="staff-password">Password</label>
              <input id="staff-password" type="password" autoComplete="current-password" className={input}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-xs text-red-700">{error}</p>}
            {info && <p className="text-xs text-teal-800">{info}</p>}
            <button type="submit" disabled={busy || !email || !password}
              className="w-full py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
            </button>
            <button type="button" onClick={handleForgot} className="w-full text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer">
              Forgot password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
