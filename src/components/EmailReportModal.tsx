import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { client } from '../api/client';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: { name: string; email: string; role: string }[];
  reportName: string;
  reportId: string;
  emailHtml?: string;
  inspection?: any; // Full inspection data for generating comprehensive email
}

type EmailStep = 'review' | 'sending' | 'success' | 'failed';

interface SendResult {
  email: string;
  success: boolean;
  error?: string;
}

export default function EmailReportModal({
  isOpen,
  onClose,
  recipients,
  reportName,
  reportId,
  emailHtml,
  inspection,
}: EmailReportModalProps) {
  const [step, setStep] = useState<EmailStep>('review');
  const [sendingTo, setSendingTo] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(
    recipients.map(r => r.email)
  );
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('review');
      setSentCount(0);
      setSelectedRecipients(recipients.map(r => r.email));
      setSendResults([]);
      setErrorMessage('');
    }
  }, [isOpen, recipients]);

  const handleSend = useCallback(async () => {
    setStep('sending');
    const targets = recipients.filter(r => selectedRecipients.includes(r.email));

    // Build the email HTML content
    const subject = `MeInspect Report: ${reportName} (RPT-${reportId.slice(0, 8).toUpperCase()})`;
    const html = emailHtml || generateDefaultEmailHtml(reportName, reportId, inspection);

    let totalSuccess = 0;
    let totalFailed = 0;
    const results: SendResult[] = [];

    for (let i = 0; i < targets.length; i++) {
      const recipient = targets[i];
      setSendingTo(`Sending to ${recipient.name} (${recipient.email})...`);
      setSentCount(i);

      try {
        const response = await client.api.fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: [recipient.email],
            subject,
            html,
          }),
        });

        const data = await response.json();
        if (data.success) {
          totalSuccess++;
          results.push({ email: recipient.email, success: true });
        } else {
          totalFailed++;
          results.push({ email: recipient.email, success: false, error: data.error || 'Send failed' });
        }
      } catch (err) {
        totalFailed++;
        results.push({
          email: recipient.email,
          success: false,
          error: err instanceof Error ? err.message : 'Network error',
        });
      }

      setSentCount(i + 1);
    }

    setSendResults(results);
    setSentCount(totalSuccess);

    if (totalFailed > 0 && totalSuccess === 0) {
      setErrorMessage('All emails failed to send. Please check your email configuration.');
      setStep('failed');
    } else if (totalFailed > 0) {
      // Partial success
      setStep('success');
    } else {
      setStep('success');
    }
  }, [recipients, selectedRecipients, reportName, reportId, emailHtml, inspection]);

  const toggleRecipient = (email: string) => {
    setSelectedRecipients(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Email Report</h3>
                  <p className="text-xs text-slate-500">Send to all inspection parties</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {step === 'review' && (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-slate-700 mb-1">Report</p>
                  <p className="text-sm text-slate-500">{reportName}</p>
                  <p className="text-xs text-slate-400 font-mono mt-1">ID: {reportId.slice(0, 8).toUpperCase()}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Recipients</p>
                  <div className="space-y-2">
                    {recipients.map((recipient) => (
                      <label
                        key={recipient.email}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(recipient.email)}
                          onChange={() => toggleRecipient(recipient.email)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{recipient.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              recipient.role === 'tenant' ? 'bg-blue-100 text-blue-700' :
                              recipient.role === 'landlord' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {recipient.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{recipient.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 'sending' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">{sendingTo}</p>
                <p className="text-xs text-slate-500 mt-1">{sentCount} of {selectedRecipients.length} sent</p>
                <div className="mt-4 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                    style={{ width: `${(sentCount / selectedRecipients.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-slate-900">Report Sent!</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Successfully emailed to {sentCount} {sentCount === 1 ? 'recipient' : 'recipients'}
                </p>
                {sendResults.some(r => !r.success) && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                    <p className="text-xs font-medium text-amber-800 mb-1">Some emails failed:</p>
                    {sendResults.filter(r => !r.success).map((r, i) => (
                      <p key={i} className="text-xs text-amber-700">
                        {r.email}: {r.error || 'Unknown error'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 'failed' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-slate-900">Sending Failed</h4>
                <p className="text-sm text-slate-500 mt-1">
                  {errorMessage || 'Some emails could not be sent. You can try again or download the PDF manually.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
            {step === 'review' && (
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={selectedRecipients.length === 0}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    selectedRecipients.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25'
                  }`}
                >
                  Send Report ({selectedRecipients.length})
                </button>
              </div>
            )}

            {step === 'sending' && (
              <div className="flex items-center justify-end">
                <button
                  disabled
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-200 text-slate-400 cursor-not-allowed"
                >
                  Sending...
                </button>
              </div>
            )}

            {(step === 'success' || step === 'failed') && (
              <div className="flex items-center justify-end gap-3">
                {step === 'failed' && (
                  <button
                    onClick={handleSend}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Default email HTML template
function generateDefaultEmailHtml(reportName: string, reportId: string, inspection?: any): string {
  // Compute summary stats if inspection data is available
  let totalRooms = 0;
  let totalItems = 0;
  let checkedItems = 0;
  let issuesFound = 0;
  let totalPhotos = 0;
  let roomSummaries: { name: string; icon: string; checked: number; total: number; issues: number }[] = [];

  if (inspection) {
    totalRooms = inspection.rooms?.length || 0;
    totalPhotos = (inspection.overallPhotos?.length || 0) +
      (inspection.rooms?.reduce((acc: number, r: any) => acc + r.items.reduce((a: number, i: any) => a + (i.photos?.length || 0), 0), 0) || 0);

    roomSummaries = (inspection.rooms || []).map((room: any) => {
      const items = room.items || [];
      const nonGeneral = items.filter((i: any) => i.name !== 'General');
      const checked = nonGeneral.filter((i: any) => i.checked).length;
      const issues = nonGeneral.filter((i: any) => i.condition === 'damaged' || i.condition === 'poor').length;
      totalItems += nonGeneral.length;
      checkedItems += checked;
      issuesFound += issues;
      return { name: room.name, icon: room.icon, checked, total: nonGeneral.length, issues };
    });
  }

  const completionPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const propertyAddress = inspection ? [
    inspection.property?.area,
    inspection.property?.city,
  ].filter(Boolean).join(', ') : '';
  const propertyType = inspection?.propertyType || '';
  const inspectorName = inspection?.meta?.inspectorName || '';
  const completedDate = inspection?.completedAt || inspection?.updatedAt || new Date().toISOString();
  const formattedDate = new Date(completedDate).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
  const gpsInfo = inspection?.meta?.location
    ? `${inspection.meta.location.latitude.toFixed(4)}, ${inspection.meta.location.longitude.toFixed(4)}`
    : '';

  // Build room summary rows
  const roomRows = roomSummaries.map(r => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">
        <span style="margin-right:6px;">${r.icon}</span> ${r.name}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;text-align:center;">
        ${r.checked}/${r.total}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;">
        ${r.issues > 0
          ? `<span style="color:#dc2626;font-weight:600;">⚠ ${r.issues}</span>`
          : `<span style="color:#059669;">✓</span>`
        }
      </td>
    </tr>
  `).join('');

  // Signature status
  const sigCount = inspection?.signatures?.length || 0;
  const sigStatus = sigCount >= 3
    ? '<span style="color:#059669;font-weight:600;">✓ All signatures collected</span>'
    : `<span style="color:#d97706;">${sigCount}/3 signatures collected</span>`;

  // GPS status
  const gpsStatus = gpsInfo
    ? `<span style="color:#059669;">📍 ${gpsInfo}</span>`
    : '<span style="color:#94a3b8;">GPS data not available</span>';

  // PDF download section
  const hasPdf = inspection?.pdfUrl;
  const pdfSection = hasPdf
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
        <p style="color:#166534;font-size:14px;font-weight:600;margin:0 0 8px 0;">📄 Full Report Available</p>
        <p style="color:#166534;font-size:13px;margin:0 0 16px 0;">The complete PDF report with photos, condition assessments, and digital signatures is ready for download.</p>
        <p style="color:#94a3b8;font-size:12px;margin:0;">Open the MeInspect app to download the PDF report.</p>
      </div>`
    : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
        <p style="color:#64748b;font-size:13px;margin:0;">Open the MeInspect app to generate and download the full PDF report.</p>
      </div>`;

  // Build the full HTML
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f1f5f9;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 50%,#3b82f6 100%);padding:32px 24px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;margin:0 0 8px 0;font-weight:800;">MeInspect</h1>
          <p style="color:#c7d2fe;font-size:14px;margin:0;">Property Condition Report</p>
        </div>

        <!-- Body -->
        <div style="padding:32px 24px;">
          <!-- Report Title -->
          <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px 0;font-weight:700;">Inspection Report: ${reportName}</h2>
          <p style="color:#64748b;font-size:13px;margin:0 0 24px 0;">
            RPT-${reportId.slice(0, 8).toUpperCase()} · ${formattedDate}
          </p>

          <!-- Property Details -->
          ${inspection ? `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 20px 0;">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px 0;">Property Details</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:4px 0;font-size:13px;color:#64748b;width:40%;">Type</td>
                <td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:500;">${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)}</td>
              </tr>
              ${propertyAddress ? `
              <tr>
                <td style="padding:4px 0;font-size:13px;color:#64748b;">Address</td>
                <td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:500;">${propertyAddress}</td>
              </tr>` : ''}
              ${inspection.property?.buildingName ? `
              <tr>
                <td style="padding:4px 0;font-size:13px;color:#64748b;">Building</td>
                <td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:500;">${inspection.property.buildingName}</td>
              </tr>` : ''}
              ${inspection.property?.unitNumber ? `
              <tr>
                <td style="padding:4px 0;font-size:13px;color:#64748b;">Unit</td>
                <td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:500;">${inspection.property.unitNumber}</td>
              </tr>` : ''}
              ${inspection.property?.totalAreaSqft ? `
              <tr>
                <td style="padding:4px 0;font-size:13px;color:#64748b;">Area</td>
                <td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:500;">${inspection.property.totalAreaSqft} sq ft</td>
              </tr>` : ''}
            </table>
          </div>
          ` : ''}

          <!-- Summary Stats -->
          ${inspection ? `
          <div style="display:flex;gap:12px;margin:0 0 20px 0;">
            <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;">
              <p style="color:#2563eb;font-size:24px;font-weight:800;margin:0;">${totalRooms}</p>
              <p style="color:#64748b;font-size:11px;margin:4px 0 0 0;">Rooms</p>
            </div>
            <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">
              <p style="color:#059669;font-size:24px;font-weight:800;margin:0;">${completionPct}%</p>
              <p style="color:#64748b;font-size:11px;margin:4px 0 0 0;">Complete</p>
            </div>
            <div style="flex:1;background:${issuesFound > 0 ? '#fef2f2' : '#f8fafc'};border:1px solid ${issuesFound > 0 ? '#fecaca' : '#e2e8f0'};border-radius:10px;padding:14px;text-align:center;">
              <p style="color:${issuesFound > 0 ? '#dc2626' : '#64748b'};font-size:24px;font-weight:800;margin:0;">${issuesFound}</p>
              <p style="color:#64748b;font-size:11px;margin:4px 0 0 0;">Issues</p>
            </div>
            <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
              <p style="color:#1e293b;font-size:24px;font-weight:800;margin:0;">${totalPhotos}</p>
              <p style="color:#64748b;font-size:11px;margin:4px 0 0 0;">Photos</p>
            </div>
          </div>
          ` : ''}

          <!-- Room-by-Room Summary -->
          ${roomSummaries.length > 0 ? `
          <div style="margin:0 0 20px 0;">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Room Assessment</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Room</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Items</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Issues</th>
                </tr>
              </thead>
              <tbody>
                ${roomRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Parties -->
          ${inspection ? `
          <div style="margin:0 0 20px 0;">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Inspection Parties</p>
            <div style="display:flex;gap:12px;">
              ${inspection.landlord?.name ? `
              <div style="flex:1;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;">
                <p style="color:#92400e;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 4px 0;">🏢 Landlord</p>
                <p style="color:#78350f;font-size:13px;font-weight:600;margin:0;">${inspection.landlord.name}</p>
              </div>` : ''}
              ${inspection.tenant?.name ? `
              <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;">
                <p style="color:#1e40af;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 4px 0;">👤 Tenant</p>
                <p style="color:#1e3a8a;font-size:13px;font-weight:600;margin:0;">${inspection.tenant.name}</p>
              </div>` : ''}
              ${inspectorName ? `
              <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;">
                <p style="color:#166534;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 4px 0;">🔍 Inspector</p>
                <p style="color:#166534;font-size:13px;font-weight:600;margin:0;">${inspectorName}</p>
              </div>` : ''}
            </div>
          </div>
          ` : ''}

          <!-- PDF Download -->
          ${pdfSection}

          <!-- Verification Info -->
          ${inspection ? `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 20px 0;">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px 0;">Verification</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#64748b;">Signatures</td>
                <td style="padding:4px 0;font-size:12px;">${sigStatus}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#64748b;">GPS Location</td>
                <td style="padding:4px 0;font-size:12px;">${gpsStatus}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#64748b;">Report ID</td>
                <td style="padding:4px 0;font-size:12px;color:#1e293b;font-family:monospace;">${reportId}</td>
              </tr>
            </table>
          </div>
          ` : ''}

          <!-- Message -->
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
            This property condition report has been prepared using MeInspect. It contains timestamped, geotagged photographic evidence and detailed condition assessments for all inspected areas.
          </p>
          <p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">
            For the complete report with all photos, condition details, and digital signatures, please open the MeInspect application or contact the inspector directly.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0 0 4px 0;">
            This email was sent by <strong style="color:#64748b;">MeInspect</strong> — Professional Property Condition Reports
          </p>
          <p style="color:#cbd5e1;font-size:11px;margin:0;">
            All data including timestamps, GPS coordinates, and digital signatures are embedded for report authenticity.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
