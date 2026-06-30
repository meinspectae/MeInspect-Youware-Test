import React, { useState, useRef, useEffect } from 'react';

const COUNTRIES = [
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE', placeholder: '501234567', length: 9 },
  { code: 'SA', dial: '+966', flag: '🇸🇦', name: 'Saudi', placeholder: '512345678', length: 9 },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'USA', placeholder: '2025551234', length: 10 },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'UK', placeholder: '7911123456', length: 10 },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India', placeholder: '9876543210', length: 10 },
  { code: 'PK', dial: '+92', flag: '🇵🇰', name: 'Pakistan', placeholder: '3001234567', length: 10 },
  { code: 'PH', dial: '+63', flag: '🇵🇭', name: 'Philippines', placeholder: '9171234567', length: 10 },
  { code: 'EG', dial: '+20', flag: '🇪🇬', name: 'Egypt', placeholder: '1012345678', length: 10 },
  { code: 'JO', dial: '+962', flag: '🇯🇴', name: 'Jordan', placeholder: '791234567', length: 9 },
  { code: 'LB', dial: '+961', flag: '🇱🇧', name: 'Lebanon', placeholder: '71123456', length: 8 },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia', placeholder: '412345678', length: 9 },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada', placeholder: '4165551234', length: 10 },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany', placeholder: '15112345678', length: 11 },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France', placeholder: '612345678', length: 9 },
  { code: 'TR', dial: '+90', flag: '🇹🇷', name: 'Turkey', placeholder: '5321234567', length: 10 },
  { code: 'CN', dial: '+86', flag: '🇨🇳', name: 'China', placeholder: '13812345678', length: 11 },
];

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  defaultCountry?: string;
  error?: string;
  label?: string;
  placeholder?: string;
}

export default function PhoneInput({ value, onChange, defaultCountry = 'AE', error, label, placeholder }: PhoneInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [sel, setSel] = useState(() => COUNTRIES.find(c => c.code === defaultCountry) || COUNTRIES[0]);
  const [digits, setDigits] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const c = COUNTRIES.find(co => value.startsWith(co.dial));
      if (c) { setSel(c); setDigits(value.replace(c.dial, '').trim().replace(/\s/g, '')); }
      else { setDigits(value.replace(/[^0-9]/g, '')); }
    }
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectCountry = (c: typeof COUNTRIES[0]) => { setSel(c); setShowDropdown(false); setDigits(''); onChange(c.dial + ' '); };

  const changeDigits = (v: string) => {
    const d = v.replace(/[^0-9]/g, '').slice(0, sel.length);
    setDigits(d);
    onChange(sel.dial + ' ' + d);
  };

  const isValid = digits.length === sel.length;

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <div className="flex gap-2">
        <div className="relative" ref={ref}>
          <button type="button" onClick={() => setShowDropdown(!showDropdown)}
            className={`flex items-center gap-1.5 px-3 py-2.5 bg-white border rounded-xl text-sm font-medium h-[42px] transition-all ${error ? 'border-red-300' : 'border-slate-200'} hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500`}>
            <span>{sel.flag}</span>
            <span className="text-slate-600">{sel.dial}</span>
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showDropdown && (
            <div className="absolute z-50 top-full mt-1 left-0 w-60 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {COUNTRIES.map(c => (
                <button key={c.code} type="button" onClick={() => selectCountry(c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${c.code === sel.code ? 'bg-blue-50 font-semibold' : ''}`}>
                  <span className="text-lg">{c.flag}</span>
                  <span className="font-medium">{c.dial}</span>
                  <span className="text-slate-500 text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="tel" inputMode="numeric" value={digits} onChange={e => changeDigits(e.target.value)}
          placeholder={placeholder || sel.placeholder} maxLength={sel.length}
          className={`flex-1 px-4 py-2.5 bg-white border rounded-xl text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-[42px] ${error ? 'border-red-300' : digits.length > 0 && !isValid ? 'border-amber-300' : 'border-slate-200'}`} />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {!error && digits.length > 0 && !isValid && (
        <p className="text-xs text-amber-500 mt-1">Enter {sel.length} digits ({digits.length}/{sel.length})</p>
      )}
    </div>
  );
}
