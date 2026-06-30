import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, reset } = useAuthStore();

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleLogout = async () => {
    signOut();
    reset();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Account Settings</h1>
        <p className="text-slate-500">Manage your profile and account.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input type="text" value={user.name || ''} disabled
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" value={user.email} disabled
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500" />
            <p className="text-xs text-slate-400 mt-1">Managed by your account</p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button onClick={handleLogout}
              className="px-6 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
