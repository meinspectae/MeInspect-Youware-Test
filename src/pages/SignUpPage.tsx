import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import { useAuthStore } from '../store/authStore';
import PhoneInput from '../components/PhoneInput';

const UAE_AREAS = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah',
  'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Dubai Marina',
  'Downtown Dubai', 'Palm Jumeirah', 'JBR', 'Business Bay',
  'Deira', 'Bur Dubai', 'Jumeirah', 'Al Barsha', 'Motor City',
  'Sports City', 'Dubai Hills', 'Arabian Ranches', 'Mirdif',
  'Dubai Silicon Oasis', 'Dubai Investment Park', 'JLT', 'DIFC',
];

export default function SignUpPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [location, setLocation] = useState('');
  const [locSuggestions, setLocSuggestions] = useState<string[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form' | 'success'>('form');

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    if (!phone.trim()) e.phone = 'Required';
    else if (phone.replace(/[^0-9]/g, '').length < 9) e.phone = 'Enter a valid phone number';
    if (!email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Required';
    else if (password.length < 8) e.password = 'Must be at least 8 characters';
    if (!confirmPassword) e.confirmPassword = 'Required';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!location.trim()) e.location = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLocChange = (v: string) => {
    setLocation(v);
    if (v.trim().length > 0) {
      const f = UAE_AREAS.filter(a => a.toLowerCase().includes(v.toLowerCase())).slice(0, 6);
      setLocSuggestions(f);
      setShowSugg(f.length > 0);
    } else setShowSugg(false);
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});

    try {
      // Use Youbase built-in auth (creates user in es_system__auth_user)
      const result = await client.auth.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        setErrors({ email: result.error.message || 'Signup failed' });
        setLoading(false);
        return;
      }

      // Get user from session
      const session = await client.auth.getSession();
      if (session.data?.user) {
        localStorage.setItem('meinspect_token', 'platform-auth');
        setUser({
          id: session.data.user.id,
          email: session.data.user.email || '',
          name: session.data.user.name || '',
        });

        // Save phone & location to users table
        try {
          await client.api.fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, location }),
          });
        } catch (profileErr) {
          console.warn('Failed to save profile data:', profileErr);
        }
      }

      setStep('success');
    } catch (err: any) {
      setErrors({ email: err.message || 'Signup failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-center">
          <h1 className="text-sm font-semibold text-slate-800">MeInspect</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-lg mx-auto px-4 py-6">
          {step === 'form' ? (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <img src="/meinspect-logo.png" alt="MeInspect" className="h-12 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Fill in your details to get started</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Al Maktoum"
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-slate-200'}`} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <PhoneInput label="Phone Number *" value={phone} onChange={(v) => setPhone(v)} error={errors.phone} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ahmed@example.com"
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-300' : 'border-slate-200'}`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars"
                    className={`w-full px-4 py-3 bg-white border rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 ${errors.password ? 'border-red-300' : 'border-slate-200'}`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {showPassword
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-300' : 'border-slate-200'}`} />
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Location *</label>
                <input type="text" value={location} onChange={e => handleLocChange(e.target.value)}
                  onFocus={() => { if (locSuggestions.length > 0) setShowSugg(true); }}
                  placeholder="e.g., Dubai Marina"
                  className={`w-full px-4 py-3 bg-white border rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.location ? 'border-red-300' : 'border-slate-200'}`} />
                {showSugg && locSuggestions.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {locSuggestions.map((s) => (
                      <button key={s} type="button"
                        onClick={() => { setLocation(s); setShowSugg(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors text-slate-700">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
              </div>

              <button onClick={handleSignup} disabled={loading}
                className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all ${loading ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25'}`}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <button onClick={() => navigate('/login')} className="text-blue-600 font-medium hover:text-blue-700">
                  Sign In
                </button>
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Account Created!</h2>
              <p className="text-sm text-slate-500 mb-6">Welcome to MeInspect. You can now start inspecting properties.</p>
              <button onClick={() => navigate('/')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-md">
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
