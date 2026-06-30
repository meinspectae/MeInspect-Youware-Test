import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { useInspectionStore } from '../store/inspectionStore';
import { client } from '../api/client';
import PaymentModal from '../components/PaymentModal';
import EmailReportModal from '../components/EmailReportModal';
import {
  formatDate,
  formatDateTime,
  generateReportHash,
} from '../utils/helpers';
import {
  getPropertyTypeLabel,
  getConditionLabel,
  getConditionColor,
} from '../data/propertyTemplates';

// Page footer component used on every page
function PageFooter({ inspection, pageNumber, totalPages }: { inspection: any; pageNumber: number; totalPages?: number }) {
  return (
    <div style={{
      borderTop: '1px solid #e2e8f0',
      padding: '8px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '8px',
      color: '#94a3b8',
      background: '#f8fafc',
      marginTop: 'auto',
    }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>📅 {formatDateTime(inspection.completedAt || inspection.updatedAt)}</span>
        <span>🔖 RPT-{inspection.id.slice(0, 8).toUpperCase()}</span>
        {inspection.meta.location && (
          <span>📍 {inspection.meta.location.latitude.toFixed(4)}, {inspection.meta.location.longitude.toFixed(4)}</span>
        )}
        {inspection.meta.ipAddress && (
          <span>🌐 {inspection.meta.ipAddress}</span>
        )}
      </div>
      <div style={{ fontWeight: '600' }}>
        Page {pageNumber}{totalPages ? ` of ${totalPages}` : ''}
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getInspection } = useInspectionStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportHash, setReportHash] = useState('');

  const inspection = id ? getInspection(id) : useInspectionStore.getState().currentInspection;
  const [isPaid, setIsPaid] = useState(inspection?.payment?.paid || false);

  // Explicit sync to backend when report page loads
  useEffect(() => {
    if (!inspection) return;
    // Generate tamper-proof hash
    generateReportHash(inspection).then(setReportHash);
    const syncToBackend = async () => {
      try {
        // Strip base64 photo data to keep payload under Cloudflare Workers size limit
        const stripPhotos = (data: any): any => {
          if (!data) return data;
          if (Array.isArray(data)) return data.map(stripPhotos);
          if (typeof data === 'object') {
            const r: any = {};
            for (const [k, v] of Object.entries(data)) {
              if ((k === 'url' || k === 'dataUrl') && typeof v === 'string' && v.startsWith('data:')) {
                r[k] = '';
              } else {
                r[k] = stripPhotos(v);
              }
            }
            return r;
          }
          return data;
        };

        const payload = stripPhotos({
          id: inspection.id,
          propertyType: inspection.propertyType,
          status: inspection.status,
          generalNotes: inspection.generalNotes,
          property: inspection.property,
          tenant: inspection.tenant,
          landlord: inspection.landlord,
          agent: inspection.agent,
          tenancy: inspection.tenancy,
          rooms: inspection.rooms,
          propertyItems: inspection.propertyItems,
          signatures: inspection.signatures,
          overallPhotos: inspection.overallPhotos,
          payment: inspection.payment,
          reportGenerated: inspection.reportGenerated,
          meta: inspection.meta,
        });

        // Try PUT first (update existing)
        const putRes = await client.api.fetch(`/api/inspections/${inspection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!putRes.ok) {
          // PUT failed (404 = not found), try POST (create new)
          console.log('[ReportPage] PUT failed, trying POST to create inspection:', inspection.id);
          const postRes = await client.api.fetch('/api/inspections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (postRes.ok) {
            console.log('[ReportPage] Inspection synced to backend via POST');
          } else {
            const errText = await postRes.text().catch(() => 'unknown');
            console.error(`[ReportPage] POST failed (${postRes.status}):`, errText);
          }
        } else {
          console.log('[ReportPage] Inspection synced to backend via PUT');
        }
      } catch (e) {
        console.warn('[ReportPage] Failed to sync inspection to backend:', e);
      }
    };
    syncToBackend();
  }, [inspection?.id]);

  if (!inspection) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Inspection not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
          Go to Dashboard
        </button>
      </div>
    );
  }

  const totalItems = inspection.rooms.reduce((acc, r) => acc + r.items.length, 0);
  const checkedItems = inspection.rooms.reduce((acc, r) => acc + r.items.filter(i => i.checked).length, 0);
  const damagedItems = inspection.rooms.reduce(
    (acc, r) => acc + r.items.filter(i => i.condition === 'damaged' || i.condition === 'poor').length,
    0
  );
  const goodItems = inspection.rooms.reduce(
    (acc, r) => acc + r.items.filter(i => i.condition === 'excellent' || i.condition === 'good').length,
    0
  );
  const totalPhotos = inspection.rooms.reduce((acc, r) => acc + r.items.reduce((a, i) => a + i.photos.length, 0), 0) + inspection.overallPhotos.length;

  const REPORT_PRICE = 500;

  // Compute display name and address from available fields
  const propertyDisplayName = [
    inspection.property.buildingName,
    inspection.property.unitNumber ? `Unit ${inspection.property.unitNumber}` : '',
  ].filter(Boolean).join(' ') || inspection.property.makaniNumber || 'Property';

  const propertyAddress = [
    inspection.property.area,
    inspection.property.city,
  ].filter(Boolean).join(', ') || '—';

  const handleDownloadClick = () => {
    generatePDF();
  };

  const generatePDF = useCallback(async () => {
    if (!printRef.current) {
      console.error('PDF generation: printRef is null');
      setProgress('Report content not ready. Please wait a moment and try again.');
      return;
    }
    setGenerating(true);
    setProgress('Generating PDF... Please wait.');

    try {
      const element = printRef.current;

      const opt = {
        margin: [5, 8, 10, 8] as [number, number, number, number],
        filename: `Property-Inspection-Report-${inspection.property.makaniNumber || inspection.id.slice(0, 8)}.pdf`,
        image: { type: 'jpeg', quality: 0.80 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          logging: false,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait' as const,
        },
      };

      // Generate PDF and get as blob for upload
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');

      // Trigger download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opt.filename;
      a.click();
      URL.revokeObjectURL(url);

      setProgress('PDF downloaded! Uploading to cloud...');

      // Upload PDF to R2 storage
      try {
        const res = await client.api.fetch('/api/upload/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inspectionId: inspection.id }),
        });

        if (res.ok) {
          const { uploadUrl, path } = await res.json();
          // Upload the PDF blob directly to R2 via presigned URL
          await fetch(uploadUrl, {
            method: 'PUT',
            body: pdfBlob,
            headers: { 'Content-Type': 'application/pdf' },
          });

          // Update the inspection record with the PDF URL
          const updateRes = await client.api.fetch(`/api/inspections/${inspection.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfUrl: path }),
          });

          if (updateRes.ok) {
            // Update local store
            const { setCurrentInspection, currentInspection } = useInspectionStore.getState();
            if (currentInspection && currentInspection.id === inspection.id) {
              setCurrentInspection({ ...currentInspection, pdfUrl: path });
            }
            setProgress('PDF saved to cloud! ✓');
          } else {
            setProgress('PDF downloaded! (Cloud save failed)');
          }
        } else {
          setProgress('PDF downloaded! (Cloud save unavailable)');
        }
      } catch (uploadErr) {
        console.warn('[ReportPage] Failed to upload PDF to cloud:', uploadErr);
        setProgress('PDF downloaded! (Cloud save failed)');
      }
    } catch (err) {
      console.error('PDF generation error:', err);
      setProgress('PDF failed. Opening print dialog instead...');
      try {
        handlePrint();
      } catch (printErr) {
        console.error('Print fallback error:', printErr);
        setProgress('Please try Ctrl+P to print manually.');
      }
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setProgress('');
      }, 2000);
    }
  }, [inspection]);

  const handlePaymentSuccess = useCallback(() => {
    setIsPaid(true);
    if (inspection) {
      const { recordPayment } = useInspectionStore.getState();
      recordPayment(inspection.id, {
        paid: true,
        amount: REPORT_PRICE,
        currency: 'AED',
        method: 'card',
      });
    }
    setTimeout(() => {
      generatePDF();
    }, 500);
    setTimeout(() => {
      setShowEmailModal(true);
    }, 2000);
  }, [generatePDF, inspection]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !printRef.current) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Property Inspection Report - ${propertyDisplayName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; color: #1e293b; line-height: 1.5; font-size: 13px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 600);
  };

  const getConditionBg = (condition: string | null) => {
    switch (condition) {
      case 'excellent': return 'background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #065f46;';
      case 'good': return 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;';
      case 'fair': return 'background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e;';
      case 'poor': return 'background: linear-gradient(135deg, #ffedd5, #fed7aa); color: #9a3412;';
      case 'damaged': return 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;';
      case 'missing': return 'background: linear-gradient(135deg, #f1f5f9, #e2e8f0); color: #475569;';
      default: return 'background: #f8fafc; color: #94a3b8; border: 1px dashed #cbd5e1;';
    }
  };

  // Find the first overall photo or first room photo for the cover
  const coverPhoto = inspection.overallPhotos.length > 0
    ? inspection.overallPhotos[0]
    : inspection.rooms.flatMap(r => r.items.flatMap(i => i.photos))[0] || null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2">
          {progress && (
            <span className="text-xs text-blue-600 font-medium animate-pulse">{progress}</span>
          )}
          <button
            onClick={handleDownloadClick}
            disabled={generating}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              generating
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
            }`}
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </>
            )}
          </button>
          <button
              onClick={() => setShowEmailModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Report
            </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={printRef} className="bg-white overflow-hidden" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}>

        {/* ============================================ */}
        {/* PAGE 1: COVER / PROPERTY SUMMARY             */}
        {/* ============================================ */}
        <div style={{ pageBreakAfter: 'always', breakAfter: 'page', minHeight: '100%' }}>
          {/* Header Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #3b82f6 100%)',
            padding: '36px 40px 44px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }}></div>
            <div style={{ position: 'absolute', bottom: '-20px', left: '60px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }}></div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{
                  width: '48px', height: '48px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
                  borderRadius: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a5f', fontFamily: 'Inter, sans-serif' }}>M</span>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '500', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    MeInspect
                  </div>
                  <div style={{ color: '#ffffff', fontSize: '10px', fontWeight: '400', opacity: 0.6, marginTop: '2px' }}>
                    Professional Property Condition Reports
                  </div>
                </div>
              </div>

              <h1 style={{
                color: '#ffffff',
                fontSize: '28px',
                fontWeight: '800',
                letterSpacing: '-0.5px',
                lineHeight: '1.2',
                marginBottom: '6px',
              }}>
                Property Condition Report
              </h1>
              <div style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '14px',
                fontWeight: '500',
              }}>
                {getPropertyTypeLabel(inspection.propertyType)} — Condition Assessment
              </div>
            </div>
          </div>

          {/* Info Bar */}
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 40px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
            fontSize: '10px',
            color: '#64748b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>📅</span>
              <span style={{ fontWeight: '500' }}>{formatDateTime(inspection.completedAt || inspection.updatedAt)}</span>
            </div>
            {inspection.meta.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>📍</span>
                <span style={{ fontWeight: '500' }}>{inspection.meta.location.latitude.toFixed(4)}, {inspection.meta.location.longitude.toFixed(4)}</span>
              </div>
            )}
            {inspection.meta.ipAddress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>🌐</span>
                <span style={{ fontWeight: '500', fontFamily: 'monospace' }}>{inspection.meta.ipAddress}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>🔖</span>
              <span style={{ fontWeight: '500', fontFamily: 'monospace' }}>RPT-{inspection.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Cover Body */}
          <div style={{ padding: '32px 40px' }}>
            {/* Property Name & Address - Large */}
            <div style={{ marginBottom: '28px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginBottom: '6px' }}>
                {propertyDisplayName}
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
                {propertyAddress}
              </p>
            </div>

            {/* Cover Photo */}
            {coverPhoto && (
              <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                <img
                  src={coverPhoto.url}
                  alt="Property exterior"
                  style={{
                    maxWidth: '420px',
                    width: '100%',
                    height: 'auto',
                    maxHeight: '280px',
                    objectFit: 'contain',
                    borderRadius: '14px',
                    border: '2px solid #e2e8f0',
                    display: 'block',
                    margin: '0 auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '6px' }}>
                  📷 Property Photo — {formatDateTime(coverPhoto.timestamp)}
                </div>
              </div>
            )}

            {/* Property Details Grid */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '20px 24px',
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                Property Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
                <InfoRow label="Makani Number" value={inspection.property.makaniNumber || '—'} />
                <InfoRow label="Type" value={getPropertyTypeLabel(inspection.propertyType)} />
                <InfoRow label="Area / Community" value={inspection.property.area || '—'} />
                <InfoRow label="City" value={inspection.property.city || '—'} />
                {inspection.property.buildingName && <InfoRow label="Building" value={inspection.property.buildingName} />}
                {inspection.property.unitNumber && <InfoRow label="Unit Number" value={inspection.property.unitNumber} />}
                {inspection.property.totalAreaSqft && <InfoRow label="Total Area" value={`${inspection.property.totalAreaSqft} sq ft`} />}
                {inspection.property.bedrooms !== undefined && <InfoRow label="Bedrooms" value={String(inspection.property.bedrooms)} />}
                {inspection.property.bathrooms !== undefined && <InfoRow label="Bathrooms" value={String(inspection.property.bathrooms)} />}
                <InfoRow label="Furnished" value={inspection.property.furnished ? 'Yes' : 'No'} />
              </div>
            </div>

            {/* Inspector & Report Info */}
            <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Inspector</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#1e3a8a' }}>{inspection.meta.inspectorName}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Report Summary</div>
                <div style={{ fontSize: '11px', color: '#166534', lineHeight: '1.6' }}>
                  {inspection.rooms.length} rooms · {checkedItems}/{totalItems} items · {totalPhotos} photos
                </div>
              </div>
            </div>
          </div>

          <PageFooter inspection={inspection} pageNumber={1} />
        </div>

        {/* ============================================ */}
        {/* PAGE 2: DISCLAIMER                           */}
        {/* ============================================ */}
        <div style={{ pageBreakAfter: 'always', breakAfter: 'page', padding: '32px 40px' }}>
          <div style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Disclaimer / إخلاء المسؤولية</h2>
          </div>

          {/* English Disclaimer */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>English</h3>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              fontSize: '11px',
              lineHeight: '1.8',
              color: '#475569',
            }}>
              <p style={{ marginBottom: '12px' }}>
                This Property Condition Report ("Report") has been prepared using the MeInspect application ("the Application") for informational and documentation purposes only. The Report is intended to provide a general assessment of the property condition at the time of inspection.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>Disclaimer of Liability:</strong> The developers, operators, and owners of the MeInspect application expressly disclaim any and all liability, whether direct, indirect, incidental, consequential, or otherwise, arising out of or in connection with the use of this Report or the Application. The Application is provided "as is" without any warranties of any kind, either express or implied.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>No Legal Obligations:</strong> This Report does not constitute legal advice, a legal opinion, or a binding assessment. It shall not be construed as creating any legal obligation, liability, or responsibility on the part of the Application developers or operators. The Report is not a substitute for professional surveys, valuations, or legal inspections conducted by licensed professionals.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>Accuracy:</strong> While every effort has been made to ensure the accuracy of the information contained herein, the Application makes no representations or warranties regarding the completeness, accuracy, reliability, or suitability of this Report for any particular purpose. Conditions may change between the time of inspection and the time of review.
              </p>
              <p>
                <strong>Governing Law:</strong> This Report and any disputes arising from it shall be governed by the laws of the United Arab Emirates and the applicable emirate-level regulations. Any claims must be pursued through the appropriate legal channels within the relevant jurisdiction.
              </p>
            </div>
          </div>

          {/* Arabic Disclaimer */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px', direction: 'rtl', textAlign: 'right' }}>العربية</h3>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              fontSize: '11px',
              lineHeight: '2',
              color: '#475569',
              direction: 'rtl',
              textAlign: 'right',
            }}>
              <p style={{ marginBottom: '12px' }}>
                تم إعداد تقرير حالة العقار ("التقرير") باستخدام تطبيق MeInspect ("التطبيق") لأغراض تثقيفية وتوثيقية فقط. يهدف التقرير إلى تقديم تقييم عام لحالة العقار في وقت الفحص.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>إخلاء المسؤولية:</strong> ينفي مطورو ومشغلو تطبيق MeInspect صراحةً أي مسؤولية مباشرة أو غير مباشرة أو عرضية أو تبعية أو بأي شكل آخر الناشئة عن أو فيما يتعلق باستخدام هذا التقرير أو التطبيق. يتم توفير التطبيق "كما هو" دون أي ضمانات من أي نوع، سواء صريحة أو ضمنية.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>عدم وجود التزامات قانونية:</strong> لا يشكل هذا التقرير مشورة قانونية أو رأياً قانونياً أو تقييماً ملزماً. ولا يُفسر على أنه يخلق أي التزام أو مسؤولية قانونية على مطرو أو مشغلي التطبيق. التقرير ليس بديلاً عن الدراسات المساحية أو التقييمات أو الفحوصات القانونية التي يُجريها متخصصون مرخصون.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>الدقة:</strong> على الرغم منبذل كل الجهود المطلوبة لضمان دقة المعلومات الواردة هنا، فإن التطبيق لا يقدم أي توصيات أو ضمانات بشأن اكتمال أو دقة أو موثوقية أو ملاءمة هذا التقرير لأي غرض معين. قد تتغير الظروف بين وقت الفحص و وقت المراجعة.
              </p>
              <p>
                <strong>القانون الحاكم:</strong> يخضع هذا التقرير وأي نزاعات ناشئة عنه لقوانين دولة الإمارات العربية المتحدة واللوائح المعمول بها على مستوى الإمارة. يجب ملاحقة أي مطالبات من خلال القنوات القانونية المناسبة داخل الولاية القضائية المختصة.
              </p>
            </div>
          </div>

          <PageFooter inspection={inspection} pageNumber={2} />
        </div>

        {/* ============================================ */}
        {/* PAGE 3: RECORDING METHODOLOGY & EVIDENCE     */}
        {/* ============================================ */}
        <div style={{ pageBreakAfter: 'always', breakAfter: 'page', padding: '32px 40px' }}>
          <div style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Recording Methodology & Evidence Integrity<br/>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>منهجية التوثيق وسلامة الأدلة</span>
            </h2>
          </div>

          {/* English Methodology */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>English</h3>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              fontSize: '11px',
              lineHeight: '1.8',
              color: '#475569',
            }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Purpose and Scope</h4>
              <p style={{ marginBottom: '12px' }}>
                This report documents the condition of the property identified herein at the time of inspection. Its purpose is to provide an objective, contemporaneous record of the property's physical condition for the benefit of all parties involved in the tenancy relationship, including the landlord, tenant, and any relevant real estate agents or property managers.
              </p>
              <p style={{ marginBottom: '12px' }}>
                The scope of this inspection covers a visual assessment of accessible areas, fixtures, fittings, and appliances within the property. It does not include structural engineering assessments, mechanical system inspections, or any invasive testing. The inspection is limited to what is visible and accessible at the time of examination.
              </p>

              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', marginTop: '16px' }}>Evidence Integrity</h4>
              <p style={{ marginBottom: '12px' }}>
                All photographic evidence captured during this inspection has been recorded with the following integrity measures:
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '12px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '4px' }}><strong>Timestamp Verification:</strong> Each photograph is embedded with the exact date and time of capture, verified against the device's internal clock and network time protocol (NTP).</li>
                <li style={{ marginBottom: '4px' }}><strong>Geolocation Tagging:</strong> GPS coordinates are automatically captured with each photograph, providing verifiable proof of the inspector's physical presence at the property location.</li>
                <li style={{ marginBottom: '4px' }}><strong>Device Authentication:</strong> Device information, including model, operating system, and application version, is recorded to establish the technical chain of custody.</li>
                <li><strong>Digital Signatures:</strong> All three parties (tenant, landlord, and inspector) have provided digital signatures, each timestamped and associated with the signatory's role and identity.</li>
              </ul>

              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', marginTop: '16px' }}>Condition Rating Scale</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { label: 'Excellent', desc: 'Like new, no visible wear or defects', color: '#059669' },
                  { label: 'Good', desc: 'Minor signs of use, fully functional', color: '#16a34a' },
                  { label: 'Fair', desc: 'Normal wear, may need minor attention', color: '#d97706' },
                  { label: 'Poor', desc: 'Significant wear or functional issues', color: '#ea580c' },
                  { label: 'Damaged', desc: 'Broken, non-functional, or requiring repair', color: '#dc2626' },
                  { label: 'Missing', desc: 'Item not present at time of inspection', color: '#64748b' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: r.color, flexShrink: 0 }}></div>
                    <span style={{ fontWeight: '600', fontSize: '10px', color: r.color, minWidth: '60px' }}>{r.label}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>— {r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Arabic Methodology */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px', direction: 'rtl', textAlign: 'right' }}>العربية</h3>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              fontSize: '11px',
              lineHeight: '2',
              color: '#475569',
              direction: 'rtl',
              textAlign: 'right',
            }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>الغرض وال范围</h4>
              <p style={{ marginBottom: '12px' }}>
                يوثق هذا التقرير حالة العقار المحدد هنا في وقت الفحص. غرضه هو تقديم سجل موضوعي ومحكم لحالة العقار المادية لمصلحة جميع الأطراف المعنية بالعلاقة الإيجارية، بما في ذلك المالك والمستأجر وأي وكلاء عقارات أو مديري ممتلكات ذوي صلة.
              </p>
              <p style={{ marginBottom: '12px' }}>
                يشمل نطاق هذا الفحص تقييماً بصرياً للمناطق المتاحة والتجهيزات والأثاث والأجهزة داخل العقار. ولا يشمل تقييمات الهندسة الهيكلية أو فحوصات الأنظمة الميكانيكية أو أي اختبارات تدخلية. يقتصر الفحص على ما هو مرئي ومتاح في وقت الفحص.
              </p>

              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', marginTop: '16px' }}>سلامة الأدلة</h4>
              <p style={{ marginBottom: '12px' }}>
                تم تسجيل جميع الأدلة الصورية التي تم التقاطها أثناء هذا الفحص مع تدابير السلامة التالية:
              </p>
              <ul style={{ paddingRight: '20px', marginBottom: '12px', listStyleType: 'disc' }}>
                <li style={{ marginBottom: '4px' }}><strong>التحقق من الوقت:</strong> كل صورة مدمج فيها التاريخ والوقت الدقيق لالتقاطها، والمتحقق منها مقابل الساعة الداخلية للجهاز وبروتوكول الوقت (NTP).</li>
                <li style={{ marginBottom: '4px' }}><strong>تحديد الموقع الجغرافي:</strong> يتم التقاط إحداثيات GPS تلقائياً مع كل صورة، مما يوفر دليلاً قابلاً للتحقق على الحضور الفعلي للمفتش في موقع العقار.</li>
                <li style={{ marginBottom: '4px' }}><strong>توثيق الجهاز:</strong> يتم تسجيل معلومات الجهاز، بما في ذلك الطراز ونظام التشغيل وإصدار التطبيق، لإنشاء سلسلة الحفظ التقنية.</li>
                <li><strong>التوقيعات الرقمية:</strong> قدم جميع الأطراف الثلاثة (المستأجر والمالك والمفتش) توقيعاً رقمياً، كل منها مُ=time-stamped ومرتبط بدور و هوية الموقع.</li>
              </ul>

              <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', marginTop: '16px' }}>مقياس تقييم الحالة</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { label: 'ممتاز', desc: 'كالجديد، لا توجد عيوب مرئية', color: '#059669' },
                  { label: 'جيد', desc: 'علامات طفيفة من الاستخدام، يعمل بشكل كامل', color: '#16a34a' },
                  { label: 'مقبول', desc: 'استهلاك عادي، قد يحتاج إلى اهتمام طفيف', color: '#d97706' },
                  { label: 'سيء', desc: 'استهلاك كبير أو مشاكل وظيفية', color: '#ea580c' },
                  { label: 'متضرر', desc: 'مكسور أو غير فعال أو يحتاج إلى إصلاح', color: '#dc2626' },
                  { label: 'مفقود', desc: 'العنصر غير موجود في وقت الفحص', color: '#64748b' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', flexDirection: 'row-reverse' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: r.color, flexShrink: 0 }}></div>
                    <span style={{ fontWeight: '600', fontSize: '10px', color: r.color, minWidth: '50px' }}>{r.label}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>— {r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <PageFooter inspection={inspection} pageNumber={3} />
        </div>

        {/* ============================================ */}
        {/* PAGE 4+: PARTIES & TENANCY + ROOM ASSESSMENT */}
        {/* ============================================ */}
        <div style={{ padding: '32px 40px' }}>
          {/* Parties */}
          <ReportSection title="Landlord & Tenant Information" icon="👥" accentColor="#f59e0b">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#f59e0b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🏢</div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Landlord</span>
                </div>
                <div style={{ fontSize: '12px', lineHeight: '2' }}>
                  <div><span style={{ color: '#92400e', fontWeight: '600' }}>Name:</span> <span style={{ color: '#78350f' }}>{inspection.landlord.name || '—'}</span></div>
                  <div><span style={{ color: '#92400e', fontWeight: '600' }}>Phone:</span> <span style={{ color: '#78350f' }}>{inspection.landlord.phone || '—'}</span></div>
                  <div><span style={{ color: '#92400e', fontWeight: '600' }}>Email:</span> <span style={{ color: '#78350f' }}>{inspection.landlord.email || '—'}</span></div>
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tenant</span>
                </div>
                <div style={{ fontSize: '12px', lineHeight: '2' }}>
                  <div><span style={{ color: '#1e40af', fontWeight: '600' }}>Name:</span> <span style={{ color: '#1e3a8a' }}>{inspection.tenant.name || '—'}</span></div>
                  <div><span style={{ color: '#1e40af', fontWeight: '600' }}>Phone:</span> <span style={{ color: '#1e3a8a' }}>{inspection.tenant.phone || '—'}</span></div>
                  <div><span style={{ color: '#1e40af', fontWeight: '600' }}>Email:</span> <span style={{ color: '#1e3a8a' }}>{inspection.tenant.email || '—'}</span></div>
                </div>
              </div>
            </div>

            {inspection.agent?.name && (
              <div style={{
                background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                border: '1px solid #e9d5ff',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#9333ea', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🏷️</div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Real Estate Agent</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '12px', lineHeight: '2' }}>
                  <div><span style={{ color: '#6b21a8', fontWeight: '600' }}>Name:</span> <span style={{ color: '#581c87' }}>{inspection.agent.name}</span></div>
                  {inspection.agent.companyName && <div><span style={{ color: '#6b21a8', fontWeight: '600' }}>Company:</span> <span style={{ color: '#581c87' }}>{inspection.agent.companyName}</span></div>}
                  <div><span style={{ color: '#6b21a8', fontWeight: '600' }}>Phone:</span> <span style={{ color: '#581c87' }}>{inspection.agent.phone || '—'}</span></div>
                  <div><span style={{ color: '#6b21a8', fontWeight: '600' }}>Email:</span> <span style={{ color: '#581c87' }}>{inspection.agent.email || '—'}</span></div>
                </div>
              </div>
            )}
          </ReportSection>

          {/* Tenancy */}
          <ReportSection title="Tenancy Details" icon="📄" accentColor="#8b5cf6">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
              <InfoRow label="Lease Start" value={formatDate(inspection.tenancy.leaseStartDate) || '—'} />
              <InfoRow label="Lease End" value={formatDate(inspection.tenancy.leaseEndDate) || '—'} />
              {inspection.tenancy.contractNumber && <InfoRow label="Contract No." value={inspection.tenancy.contractNumber} />}
            </div>
          </ReportSection>

          {/* Summary */}
          <ReportSection title="Inspection Summary" icon="📊" accentColor="#059669">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <SummaryBox label="Rooms" value={String(inspection.rooms.length)} icon="🏠" color="#2563eb" bg="#eff6ff" />
              <SummaryBox label="Assessed" value={`${checkedItems}`} sub={`of ${totalItems}`} icon="✅" color="#059669" bg="#ecfdf5" />
              <SummaryBox label="Good" value={String(goodItems)} icon="👍" color="#0891b2" bg="#ecfeff" />
              <SummaryBox label="Issues" value={String(damagedItems)} icon="⚠️" color={damagedItems > 0 ? '#dc2626' : '#64748b'} bg={damagedItems > 0 ? '#fef2f2' : '#f8fafc'} />
            </div>
            <div style={{
              marginTop: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#64748b',
              border: '1px solid #e2e8f0',
            }}>
              <span>📷 {totalPhotos} photos captured</span>
              <span>{checkedItems > 0 ? `${Math.round((checkedItems / totalItems) * 100)}% completion` : 'Inspection pending'}</span>
            </div>
          </ReportSection>

          {/* General Notes */}
          {inspection.generalNotes && (
            <ReportSection title="General Notes & Observations" icon="📝" accentColor="#d97706">
              <div style={{
                background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '12px',
                color: '#78350f',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
              }}>
                {inspection.generalNotes}
              </div>
            </ReportSection>
          )}
        </div>

        {/* ============================================ */}
        {/* ROOM-BY-ROOM ASSESSMENT                      */}
        {/* ============================================ */}
        <div style={{ padding: '0 40px 32px' }}>
          <ReportSection title="Room-by-Room Condition Assessment" icon="🔍" accentColor="#ea580c" pageBreak={true}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {inspection.rooms.map((room, roomIdx) => {
                const checked = room.items.filter(i => i.checked).length;
                const total = room.items.length;
                const issues = room.items.filter(i => i.condition === 'damaged' || i.condition === 'poor').length;
                const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

                return (
                  <div key={room.id} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                  }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      borderBottom: '1px solid #e2e8f0',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px',
                          background: '#ffffff',
                          borderRadius: '10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          border: '1px solid #e2e8f0',
                        }}>
                          {room.icon}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
                            {room.name}
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                            {checked}/{total} items assessed
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                          <svg style={{ transform: 'rotate(-90deg)' }} width="36" height="36" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15" fill="none" stroke={pct === 100 ? '#059669' : '#2563eb'} strokeWidth="3" strokeDasharray={`${pct * 0.942} 94.2`} strokeLinecap="round" />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#475569' }}>
                            {pct}%
                          </div>
                        </div>
                        {issues > 0 && (
                          <div style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                          }}>
                            ⚠️ {issues} issue{issues > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '16px 18px' }}>
                      {room.items.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item</th>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '14%' }}>Condition</th>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '38%' }}>Comments</th>
                              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: '600', color: '#475569', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '10%' }}>📷</th>
                            </tr>
                          </thead>
                          <tbody>
                            {room.items.map((item, idx) => (
                              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: '500', color: '#334155' }}>{item.name}</td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 10px',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    ...parseInlineStyle(getConditionBg(item.condition)),
                                  }}>
                                    {getConditionLabel(item.condition)}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '11px' }}>{item.comments || '—'}</td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '11px' }}>{item.photos.length > 0 ? `${item.photos.length}` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Item Detail Photos */}
                      {room.items.some(i => i.photos.length > 0) && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Item Detail Photos</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {room.items.filter(i => i.photos.length > 0).map((item) => (
                              <div key={item.id}>
                                <div style={{ fontSize: '10px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>{item.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {item.photos.map((photo) => (
                                    <div key={photo.id} style={{ position: 'relative' }}>
                                      <img src={photo.url} alt="" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                                      <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
                                        color: '#fff', fontSize: '7px', padding: '8px 3px 2px',
                                        borderRadius: '0 0 5px 5px', textAlign: 'center',
                                      }}>
                                        {formatDateTime(photo.timestamp)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {room.overallComments && (
                        <div style={{ marginTop: '14px', padding: '10px 14px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '11px', color: '#92400e' }}>
                          <span style={{ fontWeight: '600', fontSize: '10px', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.3px' }}>📝 Notes: </span>
                          {room.overallComments}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ReportSection>
        </div>

        {/* ============================================ */}
        {/* LAST PAGE: SIGNATURES + LEGAL DECLARATION    */}
        {/* ============================================ */}
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page', padding: '32px 40px' }}>
          <div style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '2px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Digital Signatures & Legal Declaration<br/>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>التوقيعات الرقمية والإعلان القانوني</span>
            </h2>
          </div>

          {/* Signatures */}
          {inspection.signatures.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                The following parties have reviewed and digitally signed this condition report.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(inspection.signatures.length, 3)}, 1fr)`, gap: '16px' }}>
                {inspection.signatures.map((sig) => (
                  <div key={sig.role} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    background: '#fafafa',
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                      {sig.role === 'inspector' ? '🔍 Inspector' : sig.role === 'landlord' ? '🏢 Landlord' : '👤 Tenant'}
                    </div>
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px',
                      marginBottom: '12px',
                    }}>
                      <img src={sig.dataUrl} alt={`${sig.role} signature`} style={{ maxHeight: '60px', display: 'block', margin: '0 auto' }} />
                    </div>
                    <div style={{ borderBottom: '1px solid #1e293b', margin: '0 8px 8px', paddingBottom: '2px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{sig.name}</div>
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                      Signed: {formatDateTime(sig.signedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal Declaration - English */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Legal Declaration / الإعلان القانوني</h3>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              fontSize: '11px',
              lineHeight: '1.8',
              color: '#475569',
            }}>
              <p style={{ marginBottom: '10px' }}>
                We, the undersigned parties, hereby declare that:
              </p>
              <ol style={{ paddingLeft: '20px', marginBottom: '12px' }}>
                <li style={{ marginBottom: '6px' }}>We have personally inspected the property described in this Report, or have reviewed the photographic evidence and findings contained herein.</li>
                <li style={{ marginBottom: '6px' }}>The condition assessments, ratings, and comments recorded in this Report are, to the best of our knowledge, a true and accurate reflection of the property's condition at the time of inspection.</li>
                <li style={{ marginBottom: '6px' }}>All photographs included in this Report were taken at the property location on the dates and times indicated by the embedded metadata.</li>
                <li style={{ marginBottom: '6px' }}>We understand that this Report is intended for documentation purposes and may be referenced in any future tenancy dispute, deposit return, or legal proceeding related to this property.</li>
                <li>We acknowledge that the MeInspect application serves as a documentation tool and does not assume any legal liability for the content of this Report or any decisions made based upon it.</li>
              </ol>
            </div>
          </div>

          {/* Legal Declaration - Arabic */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              fontSize: '11px',
              lineHeight: '2',
              color: '#475569',
              direction: 'rtl',
              textAlign: 'right',
            }}>
              <p style={{ marginBottom: '10px' }}>
                نحن الموقعون أدناه، نُعلن بموجب ذلك أن:
              </p>
              <ol style={{ paddingRight: '20px', marginBottom: '12px' }}>
                <li style={{ marginBottom: '6px' }}>لقد فحصنا شخصياً العقار الموصوف في هذا التقرير، أو راجعنا الأدلة الصورية والنتائج الواردة هنا.</li>
                <li style={{ marginBottom: '6px' }}>تقييمات الحالة والتصنيفات والملاحظات المدوّنة في هذا التقرير تعكس، إلى أقصى حد من علمنا، صورة صحيحة ودقيقة لحالة العقار في وقت الفحص.</li>
                <li style={{ marginBottom: '6px' }}>جميع الصور الواردة في هذا التقرير تم التقاطها في موقع العقار في التواريخ والأوقات المشار إليها في البيانات الوصفية المدمجة.</li>
                <li style={{ marginBottom: '6px' }}>نتفهم أن هذا التقرير مخصص لأغراض التوثيق وقد يُحتج به في أي نزاع إيجاري مستقبلي أو إعادة وديعة أو إجراء قانوني يتعلق بهذا العقار.</li>
                <li>نُقر بأن تطبيق MeInspect يخدم كأداة توثيق ولا يتحمل أي مسؤولية قانونية عن محتوى هذا التقرير أو أي قرارات اتخذت بناءً عليه.</li>
              </ol>
            </div>
          </div>

          {/* Report Verification */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '11px',
            color: '#475569',
          }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Report Verification Data</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: '600' }}>Report ID</span>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#64748b' }}>{inspection.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: '600' }}>Inspector</span>
                <span style={{ fontWeight: '500' }}>{inspection.meta.inspectorName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: '600' }}>Created</span>
                <span>{formatDateTime(inspection.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: '600' }}>Completed</span>
                <span>{formatDateTime(inspection.completedAt || inspection.updatedAt)}</span>
              </div>
              {inspection.meta.location && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', gridColumn: 'span 2' }}>
                  <span style={{ fontWeight: '600' }}>GPS Coordinates</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{inspection.meta.location.latitude.toFixed(6)}, {inspection.meta.location.longitude.toFixed(6)}</span>
                </div>
              )}
              {inspection.meta.ipAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontWeight: '600' }}>IP Address</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>{inspection.meta.ipAddress}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: '600' }}>App Version</span>
                <span>{inspection.meta.appVersion}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: '600' }}>Signatures</span>
                <span>{inspection.signatures.length}/3 collected</span>
              </div>
            </div>

            {/* Tamper-Proof Hash */}
            {reportHash && (
              <div style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '2px solid #e2e8f0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px' }}>🔒</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Tamper-Proof Verification Hash
                  </span>
                </div>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  color: '#166534',
                  wordBreak: 'break-all',
                  lineHeight: '1.5',
                  letterSpacing: '0.5px',
                }}>
                  SHA-256: {reportHash}
                </div>
                <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '6px', lineHeight: '1.5' }}>
                  This hash is generated from the report content, timestamps, GPS coordinates, IP address, and digital signatures.
                  Any modification to the report data will produce a different hash, enabling tamper detection.
                </p>
              </div>
            )}
          </div>

          <PageFooter inspection={inspection} pageNumber={4} />
        </div>

        {/* === FOOTER === */}
        <div style={{
          borderTop: '3px solid #2563eb',
          padding: '20px 40px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, #f8fafc, #f1f5f9)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '24px', height: '24px',
              background: 'linear-gradient(135deg, #2563eb, #1e40af)',
              borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: '800' }}>M</span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>MeInspect</span>
          </div>
          <p style={{ fontSize: '10px', color: '#94a3b8', lineHeight: '1.6' }}>
            This report was generated by <strong style={{ color: '#64748b' }}>MeInspect</strong> — Professional Property Condition Reports
          </p>
          <p style={{ fontSize: '9px', color: '#cbd5e1', marginTop: '4px' }}>
            All data including timestamps, GPS coordinates, digital signatures, and device information are embedded for report authenticity and legal verification.
          </p>
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #e2e8f0',
            fontSize: '9px',
            color: '#cbd5e1',
          }}>
            CONFIDENTIAL — This document contains proprietary information. © {new Date().getFullYear()} MeInspect. All rights reserved.
          </div>
        </div>
      </div>

      {/* Payment Badge */}
      {!isPaid && (
        <div className="no-print mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Payment Required</p>
              <p className="text-xs text-slate-500">Pay AED {REPORT_PRICE} to download this report as PDF</p>
            </div>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
            >
              Pay Now
            </button>
          </div>
        </div>
      )}

      {isPaid && (
        <div className="no-print mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-700">Payment verified — You can now download your report</span>
        </div>
      )}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        amount={REPORT_PRICE}
        currency="AED"
        reportId={inspection.id}
      />

      <EmailReportModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipients={[
          ...(inspection.tenant.email ? [{ name: inspection.tenant.name, email: inspection.tenant.email, role: 'tenant' }] : []),
          ...(inspection.landlord.email ? [{ name: inspection.landlord.name, email: inspection.landlord.email, role: 'landlord' }] : []),
          ...(inspection.meta.inspectorEmail ? [{ name: inspection.meta.inspectorName, email: inspection.meta.inspectorEmail, role: 'inspector' }] : []),
        ]}
        reportName={propertyDisplayName}
        reportId={inspection.id}
        inspection={inspection}
      />
    </div>
  );
}

// === Report Section Component ===
function ReportSection({ title, icon, accentColor, children, pageBreak }: {
  title: string;
  icon: string;
  accentColor: string;
  children: React.ReactNode;
  pageBreak?: boolean;
}) {
  return (
    <div style={{
      marginBottom: '28px',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
      ...(pageBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}),
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: `2px solid #e2e8f0`,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          bottom: '-2px',
          left: 0,
          width: '60px',
          height: '2px',
          background: accentColor,
          borderRadius: '1px',
        }}></div>
        <div style={{
          width: '28px',
          height: '28px',
          background: `${accentColor}15`,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
        }}>
          {icon}
        </div>
        <h3 style={{
          fontSize: '15px',
          fontWeight: '700',
          color: '#1e293b',
          letterSpacing: '-0.2px',
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// === Info Row ===
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      fontSize: '12px',
      padding: '5px 0',
      borderBottom: '1px solid #f8fafc',
    }}>
      <span style={{ fontWeight: '600', color: '#64748b', minWidth: '110px' }}>{label}:</span>
      <span style={{ color: '#1e293b', fontWeight: '500' }}>{value}</span>
    </div>
  );
}

// === Summary Box ===
function SummaryBox({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub?: string; icon: string; color: string; bg: string;
}) {
  return (
    <div style={{
      background: bg,
      borderRadius: '10px',
      padding: '14px',
      textAlign: 'center',
      border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>
      <div style={{ fontSize: '20px', fontWeight: '800', color, lineHeight: '1' }}>
        {value}{sub && <span style={{ fontSize: '10px', fontWeight: '500', opacity: 0.6, marginLeft: '2px' }}>{sub}</span>}
      </div>
      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '500', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

// === Parse inline style string ===
function parseInlineStyle(styleStr: string): React.CSSProperties {
  const style: Record<string, string> = {};
  styleStr.split(';').filter(Boolean).forEach(prop => {
    const [key, val] = prop.split(':').map(s => s.trim());
    if (key && val) {
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      style[camelKey] = val;
    }
  });
  return style as React.CSSProperties;
}
