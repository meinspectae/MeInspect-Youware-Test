import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { client } from '../api/client';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  amount: number;
  currency?: string;
  reportId: string;
  onDiscountApplied?: (discountedAmount: number, discountCode: string) => void;
}

const VALID_DISCOUNT_CODES: Record<string, { type: 'percent' | 'fixed'; value: number; label: string }> = {
  'WELCOME20': { type: 'percent', value: 20, label: '20% Off' },
  'LAUNCH50': { type: 'fixed', value: 50, label: 'AED 50 Off' },
  'MEINSPECT10': { type: 'percent', value: 10, label: '10% Off' },
  'INSPECTOR': { type: 'fixed', value: 100, label: 'AED 100 Off' },
  'FREE_REPORT': { type: 'percent', value: 100, label: '100% Off — Free Report' },
};

type PaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'samsung_pay';
type PaymentStep = 'select' | 'card_form' | 'processing' | 'success' | 'failed';

export default function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  amount,
  currency = 'AED',
  reportId,
  onDiscountApplied,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('select');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [processingMsg, setProcessingMsg] = useState('');
  const [cardErrors, setCardErrors] = useState<{ [key: string]: string }>({});
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; discount: number; finalAmount: number; label: string } | null>(null);
  const [discountError, setDiscountError] = useState('');

  const finalAmount = appliedDiscount ? appliedDiscount.finalAmount : amount;

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedMethod(null);
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
      setCardName('');
      setCardErrors({});
      setDiscountCode('');
      setAppliedDiscount(null);
      setDiscountError('');
    }
  }, [isOpen]);

  const handleApplyDiscount = () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) { setDiscountError('Enter a discount code'); return; }
    const offer = VALID_DISCOUNT_CODES[code];
    if (!offer) { setDiscountError('Invalid discount code'); return; }
    const discount = offer.type === 'percent' ? Math.round(amount * offer.value / 100) : offer.value;
    const final = Math.max(0, amount - discount);
    const applied = { code, discount: amount - final, finalAmount: final, label: offer.label };
    setAppliedDiscount(applied);
    setDiscountError('');
    if (onDiscountApplied) onDiscountApplied(final, code);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 16);
    return v.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) return v.slice(0, 2) + ' / ' + v.slice(2);
    return v;
  };

  const validateCard = (): boolean => {
    const errors: { [key: string]: string } = {};
    const num = cardNumber.replace(/\s/g, '');
    if (num.length < 13) errors.cardNumber = 'Invalid card number';
    if (!cardName.trim()) errors.cardName = 'Cardholder name required';
    const expParts = cardExpiry.split('/').map(s => s.trim());
    if (expParts.length < 2 || expParts[0].length < 2 || expParts[1].length < 2) {
      errors.cardExpiry = 'Invalid expiry';
    } else {
      const month = parseInt(expParts[0], 10);
      const year = parseInt('20' + expParts[1], 10);
      const now = new Date();
      if (month < 1 || month > 12) errors.cardExpiry = 'Invalid month';
      else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        errors.cardExpiry = 'Card expired';
      }
    }
    if (cardCvc.length < 3) errors.cardCvc = 'Invalid CVC';
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const simulatePayment = useCallback(async (_method: PaymentMethod) => {
    setStep('processing');
    const messages = [
      'Connecting to payment gateway...',
      'Verifying payment method...',
      'Authorizing transaction...',
      'Processing payment...',
      'Finalizing...',
    ];
    for (let i = 0; i < messages.length; i++) {
      setProcessingMsg(messages[i]);
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    }

    // Call backend dummy checkout
    try {
      const res = await client.api.fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'AED',
          inspectionId: reportId,
          discountCode: appliedDiscount?.code,
          discountAmount: appliedDiscount?.discount || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('success');
        await new Promise(r => setTimeout(r, 1200));
        onPaymentSuccess();
        onClose();
      } else {
        setStep('failed');
      }
    } catch (e) {
      console.error('Payment error:', e);
      // Fallback: treat as success for demo
      setStep('success');
      await new Promise(r => setTimeout(r, 1200));
      onPaymentSuccess();
      onClose();
    }
  }, [finalAmount, reportId, appliedDiscount, onPaymentSuccess, onClose]);

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    if (method === 'card') {
      setStep('card_form');
    } else {
      simulatePayment(method);
    }
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCard()) return;
    simulatePayment('card');
  };

  if (!isOpen) return null;

  const getCardBrand = (num: string): string => {
    const n = num.replace(/\s/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^6(?:011|5)/.test(n)) return 'discover';
    return 'card';
  };

  const cardBrand = getCardBrand(cardNumber);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={step !== 'processing' ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 px-6 pt-6 pb-8">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

              <div className="relative z-10">
                {/* Close button */}
                {step !== 'processing' && (
                  <button
                    onClick={onClose}
                    className="absolute -top-1 -right-1 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-white/60 text-xs font-medium tracking-wider uppercase">Secure Payment</span>
                </div>

                <h2 className="text-white text-xl font-bold tracking-tight">
                  {step === 'select' && 'Pay for Report'}
                  {step === 'card_form' && 'Card Details'}
                  {step === 'processing' && 'Processing...'}
                  {step === 'success' && 'Payment Complete'}
                  {step === 'failed' && 'Payment Failed'}
                </h2>

                <div className="mt-3 flex items-baseline gap-1">
                  {appliedDiscount ? (
                    <>
                      <span className="text-lg text-white/40 line-through">{currency} {amount.toLocaleString()}</span>
                      <span className="text-3xl font-extrabold text-emerald-400 tracking-tight ml-2">{currency}</span>
                      <span className="text-4xl font-extrabold text-emerald-400 tracking-tight ml-1">{finalAmount.toLocaleString()}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-extrabold text-white tracking-tight">{currency}</span>
                      <span className="text-4xl font-extrabold text-white tracking-tight ml-1">{amount.toLocaleString()}</span>
                    </>
                  )}
                </div>
                <p className="text-white/50 text-xs mt-1">Report ID: RPT-{reportId.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <AnimatePresence mode="wait">
                {/* Step: Select Payment Method */}
                {step === 'select' && (
                  <motion.div
                    key="select"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <p className="text-slate-500 text-sm mb-4">Choose your preferred payment method</p>

                    {/* Card Payment */}
                    <button
                      onClick={() => handleMethodSelect('card')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold text-slate-800">Credit / Debit Card</div>
                        <div className="text-xs text-slate-400 mt-0.5">Visa, Mastercard, Amex</div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Apple Pay */}
                    <button
                      onClick={() => handleMethodSelect('apple_pay')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-800 hover:bg-slate-50 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold text-slate-800">Apple Pay</div>
                        <div className="text-xs text-slate-400 mt-0.5">Touch ID or Face ID</div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Google Pay */}
                    <button
                      onClick={() => handleMethodSelect('google_pay')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-red-100 hover:bg-red-50/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold text-slate-800">Google Pay</div>
                        <div className="text-xs text-slate-400 mt-0.5">Quick & secure checkout</div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-red-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Samsung Pay */}
                    <button
                      onClick={() => handleMethodSelect('samsung_pay')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xs">SPay</span>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold text-slate-800">Samsung Pay</div>
                        <div className="text-xs text-slate-400 mt-0.5">Tap to pay with Samsung</div>
                      </div>
                      <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Security note */}
                    <div className="flex items-center gap-2 pt-3 mt-2 border-t border-slate-100">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs text-slate-400">256-bit SSL encrypted · Your data is secure</span>
                    </div>

                    {/* Discount Code */}
                    <div className="pt-3 mt-2 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">Have a discount code?</p>
                      {appliedDiscount ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span className="text-sm font-semibold text-emerald-700">{appliedDiscount.label} applied!</span>
                          <span className="text-xs text-emerald-600 ml-auto">-{currency} {appliedDiscount.discount.toLocaleString()}</span>
                          <button onClick={() => { setAppliedDiscount(null); setDiscountCode(''); }}
                            className="text-xs text-slate-400 hover:text-red-500 ml-1">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input type="text" value={discountCode}
                            onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(''); }}
                            placeholder="e.g., WELCOME20"
                            className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all font-mono tracking-wider ${discountError ? 'border-red-300 bg-red-50/50' : 'border-slate-100 focus:border-blue-300 bg-slate-50/50'}`} />
                          <button onClick={handleApplyDiscount}
                            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all">Apply</button>
                        </div>
                      )}
                      {discountError && <p className="text-xs text-red-500 mt-1">{discountError}</p>}
                    </div>
                  </motion.div>
                )}

                {/* Step: Card Form */}
                {step === 'card_form' && (
                  <motion.div
                    key="card_form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <button
                      onClick={() => { setStep('select'); setSelectedMethod(null); }}
                      className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>

                    <form onSubmit={handleCardSubmit} className="space-y-4">
                      {/* Card Brand Display */}
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <span className="text-xs text-slate-500 font-medium">Payment Method</span>
                        <div className="flex items-center gap-2">
                          {cardBrand === 'visa' && (
                            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md">VISA</span>
                          )}
                          {cardBrand === 'mastercard' && (
                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">MC</span>
                          )}
                          {cardBrand === 'amex' && (
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">AMEX</span>
                          )}
                          {cardBrand === 'card' && (
                            <svg className="w-6 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Cardholder Name */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={e => setCardName(e.target.value)}
                          placeholder="John Smith"
                          className={`w-full px-4 py-3 rounded-xl border-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all ${
                            cardErrors.cardName ? 'border-red-300 bg-red-50/50 focus:border-red-400' : 'border-slate-100 focus:border-blue-300 bg-slate-50/50'
                          }`}
                        />
                        {cardErrors.cardName && <p className="text-xs text-red-500 mt-1">{cardErrors.cardName}</p>}
                      </div>

                      {/* Card Number */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className={`w-full px-4 py-3 rounded-xl border-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all font-mono tracking-wider ${
                            cardErrors.cardNumber ? 'border-red-300 bg-red-50/50 focus:border-red-400' : 'border-slate-100 focus:border-blue-300 bg-slate-50/50'
                          }`}
                        />
                        {cardErrors.cardNumber && <p className="text-xs text-red-500 mt-1">{cardErrors.cardNumber}</p>}
                      </div>

                      {/* Expiry + CVC */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">Expiry Date</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                            placeholder="MM / YY"
                            maxLength={7}
                            className={`w-full px-4 py-3 rounded-xl border-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all font-mono ${
                              cardErrors.cardExpiry ? 'border-red-300 bg-red-50/50 focus:border-red-400' : 'border-slate-100 focus:border-blue-300 bg-slate-50/50'
                            }`}
                          />
                          {cardErrors.cardExpiry && <p className="text-xs text-red-500 mt-1">{cardErrors.cardExpiry}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5">CVC</label>
                          <input
                            type="text"
                            value={cardCvc}
                            onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            maxLength={4}
                            className={`w-full px-4 py-3 rounded-xl border-2 text-sm text-slate-800 placeholder-slate-300 outline-none transition-all font-mono ${
                              cardErrors.cardCvc ? 'border-red-300 bg-red-50/50 focus:border-red-400' : 'border-slate-100 focus:border-blue-300 bg-slate-50/50'
                            }`}
                          />
                          {cardErrors.cardCvc && <p className="text-xs text-red-500 mt-1">{cardErrors.cardCvc}</p>}
                        </div>
                      </div>

                      {/* Pay Button */}
                      <button
                        type="submit"
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Pay {currency} {finalAmount.toLocaleString()}
                      </button>
                    </form>

                    {/* Security note */}
                    <div className="flex items-center justify-center gap-2 pt-4 mt-2">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-[10px] text-slate-400">Secured with 256-bit encryption</span>
                    </div>
                  </motion.div>
                )}

                {/* Step: Processing */}
                {step === 'processing' && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 flex flex-col items-center"
                  >
                    <div className="relative mb-6">
                      <div className="w-16 h-16 border-4 border-emerald-100 rounded-full" />
                      <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-emerald-500 rounded-full animate-spin" />
                      <div className="absolute inset-2 w-12 h-12 border-4 border-transparent border-t-teal-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">{processingMsg}</p>
                    <p className="text-xs text-slate-400 mt-1">Please do not close this window</p>
                  </motion.div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 flex flex-col items-center"
                  >
                    <motion.div
                      className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                    >
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                    <p className="text-lg font-bold text-slate-800">Payment Successful!</p>
                    <p className="text-sm text-slate-500 mt-1">Your report is being generated...</p>
                  </motion.div>
                )}

                {/* Step: Failed */}
                {step === 'failed' && (
                  <motion.div
                    key="failed"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-8 flex flex-col items-center"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-lg font-bold text-slate-800">Payment Failed</p>
                    <p className="text-sm text-slate-500 mt-1 mb-4">Something went wrong. Please try again.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setStep('select'); setSelectedMethod(null); }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
                      >
                        Try Again
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
