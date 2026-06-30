import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspectionStore } from '../store/inspectionStore';
import { getPropertyTypeLabel } from '../data/propertyTemplates';
import { capturePhoto } from '../utils/helpers';
import SignaturePad from '../components/SignaturePad';
import PhoneInput from '../components/PhoneInput';
import PaymentModal from '../components/PaymentModal';
import type { ConditionRating, Photo, Room, InspectionItem } from '../types';

const conditionOptions: { value: ConditionRating; label: string; color: string; activeColor: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'border-emerald-200 text-emerald-600', activeColor: 'bg-emerald-500 text-white border-emerald-500' },
  { value: 'good', label: 'Good', color: 'border-green-200 text-green-600', activeColor: 'bg-green-500 text-white border-green-500' },
  { value: 'fair', label: 'Fair', color: 'border-amber-200 text-amber-600', activeColor: 'bg-amber-500 text-white border-amber-500' },
  { value: 'poor', label: 'Poor', color: 'border-orange-200 text-orange-600', activeColor: 'bg-orange-500 text-white border-orange-500' },
  { value: 'damaged', label: 'Damaged', color: 'border-red-200 text-red-600', activeColor: 'bg-red-500 text-white border-red-500' },
  { value: 'missing', label: 'Missing', color: 'border-gray-200 text-gray-600', activeColor: 'bg-gray-500 text-white border-gray-500' },
];

type WizardStep = 'property' | 'parties' | 'tenancy' | string;

// Steps are built dynamically based on rooms

const roomIcons = ['🏠', '🛋️', '🍳', '🛏️', '🚿', '🚗', '🌅', '🌿', '📺', '🍽️', '💼', '🏊', '🧺', '👔', '🏛️', '🖥️', '☕'];

export default function InspectionForm() {
  const navigate = useNavigate();
  const {
    currentInspection,
    currentStep,
    currentRoomIndex,
    setCurrentStep,
    setCurrentRoomIndex,
    updateProperty,
    updateTenant,
    updateLandlord,
    updateAgent,
    updateTenancy,
    updateGeneralNotes,
    updateItemCondition,
    updateItemComments,
    toggleItemChecked,
    addPhotoToItem,
    removePhotoFromItem,
    updateRoomComments,
    addOverallPhoto,
    removeOverallPhoto,
    addRoom,
    removeRoom,
    addItem,
    removeItem,
    setRooms,
    addSignature,
    removeSignature,
    completeInspection,
    saveDraft,
    updatePropertyItem,
    addPhotoToPropertyItem,
    removePhotoFromPropertyItem,
  } = useInspectionStore();

  // All useState hooks MUST be declared before any early returns (React Rules of Hooks)
  const REPORT_PRICE = 500;
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(currentInspection?.payment?.paid || false);

  if (!currentInspection) {
    navigate('/new');
    return null;
  }

  // Build steps dynamically: Property → Parties → Tenancy → Room1..RoomN → Keys & Utility → Signatures → Review
  const roomSteps = currentInspection.rooms.map((r: any, i: number) => ({
    key: `room_${i}`,
    label: r.name,
    icon: r.icon,
  }));

  const steps: { key: WizardStep; label: string; icon: string }[] = [
    { key: 'property', label: 'Property', icon: '🏠' },
    { key: 'parties', label: 'Parties', icon: '👥' },
    { key: 'tenancy', label: 'Tenancy', icon: '📄' },
    ...roomSteps,
    { key: 'keys', label: 'Keys & Utility', icon: '🔑' },
    { key: 'signatures', label: 'Signatures', icon: '✍️' },
    { key: 'payment', label: 'Payment', icon: '💳' },
    { key: 'review', label: 'Review', icon: '✅' },
  ];

  const currentStepKey = steps[currentStep]?.key || 'property';
  const allSignaturesCollected = currentInspection.signatures.length >= 3;
  const isRoomStep = typeof currentStepKey === 'string' && currentStepKey.startsWith('room_');
  const currentRoomIdx = isRoomStep ? parseInt(currentStepKey.split('_')[1]) : -1;

  // Validation for each step
  const isPropertyValid = (): boolean => {
    const p = currentInspection.property;
    return !!(p.makaniNumber && p.area && p.city);
  };

  const isEmailValid = (email: string): boolean => {
    if (!email || email.trim().length === 0) return false;
    // Basic but sufficient email format check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isPartiesValid = (): boolean => {
    const t = currentInspection.tenant;
    const l = currentInspection.landlord;
    return !!(
      t.name && t.phone && isEmailValid(t.email) &&
      l.name && l.phone && isEmailValid(l.email)
    );
  };

  const isTenancyValid = (): boolean => {
    const tn = currentInspection.tenancy;
    return !!(tn.leaseStartDate && tn.leaseEndDate && tn.contractNumber);
  };

  const isRoomValid = (roomIndex: number): boolean => {
    const room = currentInspection.rooms[roomIndex];
    if (!room) return true;
    for (const item of room.items) {
      if (item.name === 'General') continue;
      const hasCondition = item.condition !== null;
      const hasComment = item.comments.trim().length > 0;
      const hasPhotos = item.photos.length > 0;
      const filledAny = hasCondition || hasComment || hasPhotos;
      if (filledAny && (!hasCondition || !hasComment || !hasPhotos)) {
        return false;
      }
    }
    return true;
  };

  const getValidationError = (): string | null => {
    if (currentStepKey === 'property') return isPropertyValid() ? null : 'Makani Number, Area, and City are required';
    if (currentStepKey === 'parties') return isPartiesValid() ? null : 'Landlord and Tenant name, phone, and email are required';
    if (currentStepKey === 'tenancy') return isTenancyValid() ? null : 'Lease Start, End, and Contract Number are required';
    if (isRoomStep && !isRoomValid(currentRoomIdx)) {
      const room = currentInspection.rooms[currentRoomIdx];
      for (const item of room.items) {
        if (item.name === 'General') continue;
        const hasCondition = item.condition !== null;
        const hasComment = item.comments.trim().length > 0;
        const hasPhotos = item.photos.length > 0;
        const filledAny = hasCondition || hasComment || hasPhotos;
        if (filledAny && (!hasCondition || !hasComment || !hasPhotos)) {
          return `"${item.name}" in ${room.name}: Photo, Condition, and Comment are all required`;
        }
      }
    }
    if (currentStepKey === 'signatures') return allSignaturesCollected ? null : 'All three signatures are required';
    if (currentStepKey === 'payment') return paymentCompleted ? null : 'Payment is required to generate the report';
    return null;
  };

  const canProceed = (): boolean => getValidationError() === null;

  // Check if a specific step (by index) has valid data up to that point
  const canJumpToStep = (targetStep: number): boolean => {
    // Always allow going backwards
    if (targetStep <= currentStep) return true;
    // Allow going forward one step at a time only
    if (targetStep === currentStep + 1) return canProceed();
    // Block jumping ahead more than one step
    return false;
  };

  const goNext = () => {
    // Don't allow going forward if inspection is completed
    if (currentInspection?.status === 'completed') return;
    if (!canProceed()) return;
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Sync currentRoomIndex when entering a room step
      const nextKey = steps[nextStep]?.key;
      if (typeof nextKey === 'string' && nextKey.startsWith('room_')) {
        setCurrentRoomIndex(parseInt(nextKey.split('_')[1]));
      }
    }
  };

  const goPrev = () => {
    // Don't allow going back if inspection is completed
    if (currentInspection?.status === 'completed') return;
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      const prevKey = steps[prevStep]?.key;
      if (typeof prevKey === 'string' && prevKey.startsWith('room_')) {
        setCurrentRoomIndex(parseInt(prevKey.split('_')[1]));
      }
    }
  };

  const handleComplete = () => {
    if (!currentInspection) return;
    if (currentInspection.status === 'completed') {
      // Already completed, just navigate to report
      navigate(`/report/${currentInspection.id}`);
      return;
    }
    // Enforce payment before completion
    if (!paymentCompleted && !currentInspection.payment?.paid) {
      return;
    }
    const id = currentInspection.id;
    completeInspection();
    // Small delay to ensure state is updated before navigation
    setTimeout(() => {
      navigate(`/report/${id}`);
    }, 100);
  };

  const handlePaymentSuccess = (paymentInfo: any) => {
    const { recordPayment } = useInspectionStore.getState();
    recordPayment(currentInspection.id, {
      paid: true,
      amount: REPORT_PRICE,
      currency: 'AED',
      method: paymentInfo.method || 'card',
      discountCode: paymentInfo.discountCode,
      discountAmount: paymentInfo.discountAmount,
    });
    setPaymentCompleted(true);
  };

  const validationError = getValidationError();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Completed/Locked Banner */}
      {currentInspection?.status === 'completed' && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-emerald-500 text-lg">🔒</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Inspection Completed & Locked</p>
            <p className="text-xs text-emerald-600">This inspection has been completed and signed. No further changes are allowed.</p>
          </div>
          <button
            onClick={() => navigate(`/report/${currentInspection.id}`)}
            className="ml-auto px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
          >
            View Report →
          </button>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Inspection Form</h1>
            <p className="text-sm text-slate-500">
              {getPropertyTypeLabel(currentInspection.propertyType)}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
          {steps.map((step, i) => {
            const canJump = canJumpToStep(i);
            const isAccessible = i <= currentStep || (i === currentStep + 1 && canProceed());
            return (
              <button
                key={step.key}
                onClick={() => isAccessible && setCurrentStep(i)}
                disabled={!isAccessible}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  i === currentStep
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : isAccessible
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <span>{step.icon}</span>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 mb-6">
        {currentStepKey === 'property' && (
          <PropertyStep
            property={currentInspection.property}
            onUpdate={updateProperty}
          />
        )}
        {currentStepKey === 'parties' && (
          <PartiesStep
            tenant={currentInspection.tenant}
            landlord={currentInspection.landlord}
            agent={currentInspection.agent}
            onUpdateTenant={updateTenant}
            onUpdateLandlord={updateLandlord}
            onUpdateAgent={updateAgent}
          />
        )}
        {currentStepKey === 'tenancy' && (
          <TenancyStep
            tenancy={currentInspection.tenancy}
            onUpdate={updateTenancy}
          />
        )}
        {isRoomStep && (
          <SingleRoomStep
            key={`room-${currentRoomIdx}`}
            room={currentInspection.rooms[currentRoomIdx]}
            roomIndex={currentRoomIdx}
            totalRooms={currentInspection.rooms.length}
            onUpdateItemCondition={updateItemCondition}
            onUpdateItemComments={updateItemComments}
            onToggleItemChecked={toggleItemChecked}
            onAddPhotoToItem={addPhotoToItem}
            onRemovePhotoFromItem={removePhotoFromItem}
            onUpdateRoomComments={updateRoomComments}
            onAddItem={addItem}
            onRemoveItem={removeItem}
          />
        )}
        {currentStepKey === 'keys' && (
          <KeysStep
            propertyItems={currentInspection.propertyItems}
            onUpdatePropertyItem={updatePropertyItem}
            onAddPhotoToPropertyItem={addPhotoToPropertyItem}
            onRemovePhotoFromPropertyItem={removePhotoFromPropertyItem}
          />
        )}
        {currentStepKey === 'signatures' && (
          <SignaturesStep
            tenant={currentInspection.tenant}
            landlord={currentInspection.landlord}
            inspectorName={currentInspection.meta.inspectorName}
            signatures={currentInspection.signatures}
            onAddSignature={addSignature}
            onRemoveSignature={removeSignature}
          />
        )}
        {currentStepKey === 'payment' && (
          <PaymentStep
            inspection={currentInspection}
            reportPrice={REPORT_PRICE}
            paymentCompleted={paymentCompleted}
            onOpenPayment={() => setShowPaymentModal(true)}
          />
        )}
        {currentStepKey === 'review' && (
          <ReviewStep
            inspection={currentInspection}
            onAddOverallPhoto={addOverallPhoto}
            onRemoveOverallPhoto={removeOverallPhoto}
            onUpdateGeneralNotes={updateGeneralNotes}
            onUpdatePropertyItem={updatePropertyItem}
            onAddPhotoToPropertyItem={addPhotoToPropertyItem}
            onRemovePhotoFromPropertyItem={removePhotoFromPropertyItem}
          />
        )}
      </div>

      {/* Validation Error */}
      {!canProceed() && validationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ {validationError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            currentStep === 0
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          ← Previous
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { saveDraft(); }}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 transition-all"
          >
            Save Draft
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                canProceed()
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!allSignaturesCollected || (!paymentCompleted && !currentInspection.payment?.paid)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                allSignaturesCollected && (paymentCompleted || currentInspection.payment?.paid)
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/25'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {!allSignaturesCollected
                ? 'Signatures Required'
                : (!paymentCompleted && !currentInspection.payment?.paid)
                ? 'Payment Required'
                : 'Complete & Generate Report ✓'}
            </button>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={() => handlePaymentSuccess({ method: 'card' })}
        amount={REPORT_PRICE}
        currency="AED"
        reportId={currentInspection.id}
      />
    </div>
  );
}

// Property Step
function PropertyStep({ property, onUpdate }: { property: any; onUpdate: (p: any) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Property Details</h2>
        <p className="text-sm text-slate-400">Enter the property information for the inspection report.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Makani Number *" value={property.makaniNumber || ''} onChange={(v) => onUpdate({ makaniNumber: v })} placeholder="e.g., 123456" />
        <InputField label="Building Name" value={property.buildingName || ''} onChange={(v) => onUpdate({ buildingName: v })} placeholder="e.g., Marina Heights Tower" />
        <InputField label="Unit / Apartment Number" value={property.unitNumber || ''} onChange={(v) => onUpdate({ unitNumber: v })} placeholder="e.g., 1204" />
        <AutocompleteInput label="Area / Community *" value={property.area} onChange={(v) => onUpdate({ area: v })} placeholder="e.g., Studio City" suggestions={DUBAI_AREAS} />
        <AutocompleteInput label="City *" value={property.city} onChange={(v) => onUpdate({ city: v })} placeholder="e.g., Dubai" suggestions={DUBAI_CITIES} />
        <InputField label="Total Area (sq ft)" value={property.totalAreaSqft?.toString() || ''} onChange={(v) => onUpdate({ totalAreaSqft: parseInt(v) || undefined })} type="number" placeholder="e.g., 1200" />
        <InputField label="Bedrooms" value={property.bedrooms?.toString() || ''} onChange={(v) => onUpdate({ bedrooms: parseInt(v) || undefined })} type="number" placeholder="e.g., 2" />
        <InputField label="Bathrooms" value={property.bathrooms?.toString() || ''} onChange={(v) => onUpdate({ bathrooms: parseInt(v) || undefined })} type="number" placeholder="e.g., 2" />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Furnished:</label>
        <button
          onClick={() => onUpdate({ furnished: !property.furnished })}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            property.furnished
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          {property.furnished ? 'Yes ✓' : 'No'}
        </button>
      </div>
    </div>
  );
}

// Parties Step
function PartiesStep({
  tenant, landlord, agent,
  onUpdateTenant, onUpdateLandlord, onUpdateAgent
}: {
  tenant: any; landlord: any; agent: any;
  onUpdateTenant: (t: any) => void; onUpdateLandlord: (l: any) => void; onUpdateAgent: (a: any) => void;
}) {
  const [showAgent, setShowAgent] = useState(!!agent?.name);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Involved Parties</h2>
        <p className="text-sm text-slate-400">Enter details for the tenant, landlord, and optional agent.</p>
      </div>

      {/* Landlord */}
      <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-xs">🏢</span>
          Landlord Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Full Name *" value={landlord.name} onChange={(v) => onUpdateLandlord({ name: v })} placeholder="Landlord name" />
          <PhoneInput label="Phone *" value={landlord.phone} onChange={(v) => onUpdateLandlord({ phone: v })} />
          <InputField label="Email *" value={landlord.email} onChange={(v) => onUpdateLandlord({ email: v })} placeholder="email@example.com" />
        </div>
      </div>

      {/* Tenant */}
      <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs">👤</span>
          Tenant Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Full Name *" value={tenant.name} onChange={(v) => onUpdateTenant({ name: v })} placeholder="Tenant name" />
          <PhoneInput label="Phone *" value={tenant.phone} onChange={(v) => onUpdateTenant({ phone: v })} />
          <InputField label="Email *" value={tenant.email} onChange={(v) => onUpdateTenant({ email: v })} placeholder="email@example.com" />
        </div>
      </div>

      {/* Agent (Optional) */}
      <div>
        {!showAgent ? (
          <button
            onClick={() => setShowAgent(true)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            + Add Real Estate Agent (Optional)
          </button>
        ) : (
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs">🏷️</span>
                Real Estate Agent (Optional)
              </h3>
              <button
                onClick={() => { setShowAgent(false); onUpdateAgent({ name: '', phone: '', email: '' }); }}
                className="text-xs text-slate-400 hover:text-red-500"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Agent Name" value={agent?.name || ''} onChange={(v) => onUpdateAgent({ name: v })} placeholder="Agent name" />
              <InputField label="Company" value={agent?.companyName || ''} onChange={(v) => onUpdateAgent({ companyName: v })} placeholder="Agency name" />
              <PhoneInput label="Phone" value={agent?.phone || ''} onChange={(v) => onUpdateAgent({ phone: v })} />
              <InputField label="Email" value={agent?.email || ''} onChange={(v) => onUpdateAgent({ email: v })} placeholder="email@example.com" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tenancy Step
function TenancyStep({ tenancy, onUpdate }: { tenancy: any; onUpdate: (t: any) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Tenancy Details</h2>
        <p className="text-sm text-slate-400">Enter lease information.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Lease Start Date *" value={tenancy.leaseStartDate} onChange={(v) => onUpdate({ leaseStartDate: v })} type="date" />
        <InputField label="Lease End Date *" value={tenancy.leaseEndDate} onChange={(v) => onUpdate({ leaseEndDate: v })} type="date" />
        <InputField label="Contract Number *" value={tenancy.contractNumber || ''} onChange={(v) => onUpdate({ contractNumber: v })} placeholder="Contract reference" className="sm:col-span-2" />
      </div>
    </div>
  );
}

// Single Room Step (one room per page, used in new navigation flow)
function SingleRoomStep({
  room, roomIndex, totalRooms,
  onUpdateItemCondition, onUpdateItemComments, onToggleItemChecked,
  onAddPhotoToItem, onRemovePhotoFromItem, onUpdateRoomComments,
  onAddItem, onRemoveItem,
}: {
  room: any; roomIndex: number; totalRooms: number;
  onUpdateItemCondition: (ri: number, itemId: string, c: ConditionRating) => void;
  onUpdateItemComments: (ri: number, itemId: string, c: string) => void;
  onToggleItemChecked: (ri: number, itemId: string) => void;
  onAddPhotoToItem: (ri: number, itemId: string, p: Photo) => void;
  onRemovePhotoFromItem: (ri: number, itemId: string, pid: string) => void;
  onUpdateRoomComments: (ri: number, c: string) => void;
  onAddItem: (ri: number, item: InspectionItem) => void;
  onRemoveItem: (ri: number, itemId: string) => void;
}) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);

  const handlePhoto = async (itemId: string) => {
    const photo = await capturePhoto();
    if (!photo) return;
    onAddPhotoToItem(roomIndex, itemId, photo);
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    onAddItem(roomIndex, {
      id: '', name: newItemName.trim(), category: 'custom',
      condition: null, comments: '', photos: [], checked: false,
    });
    setNewItemName('');
    setShowAddItem(false);
  };

  if (!room) return null;

  const completedItems = room.items.filter((i: any) => i.name !== 'General' && i.checked).length;
  const totalItems = room.items.filter((i: any) => i.name !== 'General').length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{room.icon}</span>
          <h2 className="text-lg font-semibold text-slate-800">{room.name}</h2>
        </div>
        <p className="text-sm text-slate-400">Room {roomIndex + 1} of {totalRooms} — {completedItems}/{totalItems} items assessed</p>
        <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {room.items.map((item: any) => (
          <div key={item.id} className={`bg-white rounded-xl border transition-all ${item.checked ? 'border-emerald-200' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
              <button onClick={(e) => { e.stopPropagation(); onToggleItemChecked(roomIndex, item.id); }}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-slate-400'}`}>
                {item.checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
              {item.condition && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conditionOptions.find(c => c.value === item.condition)?.activeColor || ''}`}>{item.condition}</span>
              )}
              {item.photos.length > 0 && <span className="text-xs text-slate-400">📷 {item.photos.length}</span>}
              {item.name !== 'General' && (
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`Remove "${item.name}"?`)) onRemoveItem(roomIndex, item.id); }}
                  className="text-red-400 hover:text-red-600 transition-colors p-1" title="Delete item">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedItem === item.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {expandedItem === item.id && (
              <div className="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-2">Condition Rating *</span>
                  <div className="flex flex-wrap gap-1.5">
                    {conditionOptions.map((opt) => (
                      <button key={opt.value} onClick={() => onUpdateItemCondition(roomIndex, item.id, opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${item.condition === opt.value ? opt.activeColor : opt.color}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Comments *</span>
                  <textarea value={item.comments} onChange={(e) => onUpdateItemComments(roomIndex, item.id, e.target.value)}
                    placeholder="Add notes about this item..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" rows={2} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Photos *</span>
                    <button onClick={() => handlePhoto(item.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">📷 Add Photo</button>
                  </div>
                  {item.photos.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {item.photos.map((photo: Photo) => (
                        <div key={photo.id} className="relative flex-shrink-0 group">
                          <img src={photo.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                          {(photo.gpsLat === undefined || photo.gpsLat === null) && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-white rounded-full text-[7px] flex items-center justify-center" title="No GPS data">⚠</div>
                          )}
                          <button onClick={() => onRemovePhotoFromItem(roomIndex, item.id, photo.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Item */}
      {showAddItem ? (
        <div className="flex gap-2 items-center p-3 bg-white rounded-xl border border-blue-200">
          <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()} autoFocus />
          <button onClick={handleAddItem} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Add</button>
          <button onClick={() => { setShowAddItem(false); setNewItemName(''); }} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowAddItem(true)} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all font-medium">+ Add Custom Item</button>
      )}

      {/* Room Comments */}
      <div>
        <span className="text-xs font-medium text-slate-500 block mb-1">Room General Notes</span>
        <textarea value={room.overallComments} onChange={(e) => onUpdateRoomComments(roomIndex, e.target.value)}
          placeholder="Overall notes for this room..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" rows={2} />
      </div>
    </div>
  );
}

// Payment Step
function PaymentStep({
  inspection, reportPrice, paymentCompleted, onOpenPayment,
}: {
  inspection: any; reportPrice: number; paymentCompleted: boolean;
  onOpenPayment: () => void;
}) {
  const paid = inspection.payment?.paid || paymentCompleted;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Payment</h2>
        <p className="text-sm text-slate-400">Pay to generate your professional property condition report.</p>
      </div>

      <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <span className="text-2xl">📄</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Property Condition Report</h3>
            <p className="text-xs text-slate-500">RPT-{inspection.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        {/* Report Summary */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-400">Rooms</div>
            <div className="text-lg font-bold text-slate-800">{inspection.rooms.length}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-400">Items</div>
            <div className="text-lg font-bold text-slate-800">{inspection.rooms.reduce((a: number, r: any) => a + r.items.length, 0)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-400">Photos</div>
            <div className="text-lg font-bold text-slate-800">{inspection.rooms.reduce((a: number, r: any) => a + r.items.reduce((b: number, i: any) => b + i.photos.length, 0), 0)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-400">Signatures</div>
            <div className="text-lg font-bold text-slate-800">{inspection.signatures.length}/3</div>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 mb-4">
          <span className="text-sm font-medium text-slate-600">Report Generation Fee</span>
          <span className="text-2xl font-extrabold text-slate-900">AED {reportPrice}</span>
        </div>

        {paid ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Payment Complete</p>
              <p className="text-xs text-emerald-600">You can now generate your report</p>
            </div>
          </div>
        ) : (
          <button onClick={onOpenPayment}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98] flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Pay AED {reportPrice} to Generate Report
          </button>
        )}
      </div>
    </div>
  );
}

// Keys & Access Cards + Utility Meters Step
function KeysStep({
  propertyItems, onUpdatePropertyItem, onAddPhotoToPropertyItem, onRemovePhotoFromPropertyItem,
}: {
  propertyItems: any[];
  onUpdatePropertyItem: (id: string, value: string, comments: string) => void;
  onAddPhotoToPropertyItem: (id: string, p: Photo) => void;
  onRemovePhotoFromPropertyItem: (id: string, pid: string) => void;
}) {
  const handlePhoto = async (itemId: string) => {
    const photo = await capturePhoto();
    if (photo) onAddPhotoToPropertyItem(itemId, photo);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Keys & Access Cards / Utility Meters</h2>
        <p className="text-sm text-slate-400">Document keys, access cards, and utility meter readings with photos.</p>
      </div>
      {propertyItems.map((item: any) => (
        <div key={item.id} className="p-5 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span>{item.id === 'keys_access_cards' ? '🔑' : '⚡'}</span>
            {item.name}
          </h3>
          <div className="space-y-3">
            <input type="text" value={item.value}
              onChange={(e) => onUpdatePropertyItem(item.id, e.target.value, item.comments)}
              placeholder={`Enter ${item.name.toLowerCase()} details...`}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={item.comments}
              onChange={(e) => onUpdatePropertyItem(item.id, item.value, e.target.value)}
              placeholder="Additional comments..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Photos</span>
              <button onClick={() => handlePhoto(item.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">📷 Add Photo</button>
            </div>
            {item.photos && item.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {item.photos.map((photo: Photo) => (
                  <div key={photo.id} className="relative flex-shrink-0 group">
                    <img src={photo.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                    {(photo.gpsLat === undefined || photo.gpsLat === null) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-500 text-white rounded-full text-[8px] flex items-center justify-center" title="No GPS data">⚠</div>
                    )}
                    <button onClick={() => onRemovePhotoFromPropertyItem(item.id, photo.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Signatures Step
function SignaturesStep({
  tenant, landlord, inspectorName,
  signatures, onAddSignature, onRemoveSignature,
}: {
  tenant: any; landlord: any; inspectorName: string;
  signatures: any[];
  onAddSignature: (s: any) => void;
  onRemoveSignature: (role: 'tenant' | 'landlord' | 'inspector') => void;
}) {
  const [activeRole, setActiveRole] = useState<'tenant' | 'landlord' | 'inspector'>('tenant');

  const roles: { role: 'tenant' | 'landlord' | 'inspector'; label: string; name: string; icon: string; color: string }[] = [
    { role: 'tenant', label: 'Tenant', name: tenant.name || 'Tenant', icon: '👤', color: 'blue' },
    { role: 'landlord', label: 'Landlord', name: landlord.name || 'Landlord', icon: '🏢', color: 'amber' },
    { role: 'inspector', label: 'Inspector', name: inspectorName || 'Inspector', icon: '🔍', color: 'emerald' },
  ];

  const tenantSigned = signatures.some(s => s.role === 'tenant');
  const landlordSigned = signatures.some(s => s.role === 'landlord');
  const inspectorSigned = signatures.some(s => s.role === 'inspector');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Digital Signatures</h2>
        <p className="text-sm text-slate-400">
          All three parties must sign the report before it can be generated.
        </p>
      </div>

      {/* Status */}
      <div className="grid grid-cols-3 gap-3">
        {roles.map((r) => {
          const signed = r.role === 'tenant' ? tenantSigned : r.role === 'landlord' ? landlordSigned : inspectorSigned;
          return (
            <div
              key={r.role}
              className={`p-3 rounded-xl text-center border-2 transition-all ${
                signed
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-2xl mb-1">{r.icon}</div>
              <div className="text-xs font-medium text-slate-700">{r.label}</div>
              <div className={`text-xs mt-1 font-semibold ${signed ? 'text-emerald-600' : 'text-slate-400'}`}>
                {signed ? '✓ Signed' : 'Not Signed'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Tabs */}
      <div className="flex gap-2">
        {roles.map((r) => {
          const signed = r.role === 'tenant' ? tenantSigned : r.role === 'landlord' ? landlordSigned : inspectorSigned;
          return (
            <button
              key={r.role}
              onClick={() => setActiveRole(r.role)}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeRole === r.role
                  ? 'bg-blue-600 text-white shadow-md'
                  : signed
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.icon} {r.label}
              {signed && ' ✓'}
            </button>
          );
        })}
      </div>

      {/* Active Signature */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
        {(() => {
          const activeRoleData = roles.find(r => r.role === activeRole)!;
          const existingSig = signatures.find((s: any) => s.role === activeRole);

          if (existingSig) {
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {activeRoleData.icon} {activeRoleData.label} Signature — {activeRoleData.name}
                  </h3>
                  <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-lg">
                    ✓ Signed {new Date(existingSig.signedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-center">
                  <img src={existingSig.dataUrl} alt={`${activeRoleData.label} signature`} className="max-h-24" />
                </div>
                <button
                  onClick={() => onRemoveSignature(activeRole)}
                  className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                >
                  Re-sign (replace existing)
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">
                {activeRoleData.icon} {activeRoleData.label} Signature — {activeRoleData.name}
              </h3>
              <SignaturePad
                label={`${activeRoleData.label}: ${activeRoleData.name}`}
                onSave={(dataUrl) => {
                  onAddSignature({
                    dataUrl,
                    signedAt: new Date().toISOString(),
                    role: activeRole,
                    name: activeRoleData.name,
                  });
                }}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// Review Step
function ReviewStep({
  inspection, onAddOverallPhoto, onRemoveOverallPhoto, onUpdateGeneralNotes, onUpdatePropertyItem,
  onAddPhotoToPropertyItem, onRemovePhotoFromPropertyItem,
}: {
  inspection: any; onAddOverallPhoto: (p: Photo) => void; onRemoveOverallPhoto: (pid: string) => void;
  onUpdateGeneralNotes: (n: string) => void; onUpdatePropertyItem: (id: string, value: string, comments: string) => void;
  onAddPhotoToPropertyItem: (id: string, p: Photo) => void; onRemovePhotoFromPropertyItem: (id: string, pid: string) => void;
}) {
  const handlePhoto = async () => {
    const photo = await capturePhoto();
    if (photo) onAddOverallPhoto(photo);
  };

  const handlePropertyItemPhoto = async (itemId: string) => {
    const photo = await capturePhoto();
    if (photo) onAddPhotoToPropertyItem(itemId, photo);
  };

  const totalItems = inspection.rooms.reduce((acc: number, r: any) => acc + r.items.length, 0);
  const checkedItems = inspection.rooms.reduce((acc: number, r: any) => acc + r.items.filter((i: any) => i.checked).length, 0);
  const totalPhotos = inspection.rooms.reduce((acc: number, r: any) =>
    acc + r.items.reduce((a: number, i: any) => a + i.photos.length, 0), 0
  ) + inspection.overallPhotos.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Review & Complete</h2>
        <p className="text-sm text-slate-400">Review your inspection summary before generating the report.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Rooms', value: inspection.rooms.length, icon: '🏠' },
          { label: 'Items Assessed', value: `${checkedItems}/${totalItems}`, icon: '✅' },
          { label: 'Photos', value: totalPhotos, icon: '📷' },
          { label: 'Signatures', value: `${inspection.signatures.length}/3`, icon: '✍️' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className="text-lg font-bold text-slate-800">{stat.value}</div>
            <div className="text-xs text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Overall Photos */}
      <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Overall Property Photos</h3>
          <button onClick={handlePhoto} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            📷 Add Photo
          </button>
        </div>
        {inspection.overallPhotos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {inspection.overallPhotos.map((photo: Photo) => (
              <div key={photo.id} className="relative flex-shrink-0 group">
                <img src={photo.url} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                {(photo.gpsLat === undefined || photo.gpsLat === null) && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-500 text-white rounded-full text-[8px] flex items-center justify-center" title="No GPS data">⚠</div>
                )}
                <button
                  onClick={() => onRemoveOverallPhoto(photo.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No overall photos added yet.</p>
        )}
      </div>

      {/* General Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">General Notes / Observations</label>
        <textarea
          value={inspection.generalNotes}
          onChange={(e) => onUpdateGeneralNotes(e.target.value)}
          placeholder="Add any general observations, recommendations, or notes for the report..."
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={4}
        />
      </div>

      {/* Property-Level Items */}
      {inspection.propertyItems && inspection.propertyItems.length > 0 && (
        <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Property Information</h3>
          <div className="space-y-4">
            {inspection.propertyItems.map((item: any) => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">{item.name}</label>
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => onUpdatePropertyItem(item.id, e.target.value, item.comments)}
                  placeholder={`Enter ${item.name.toLowerCase()} details...`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                />
                <textarea
                  value={item.comments}
                  onChange={(e) => onUpdatePropertyItem(item.id, item.value, e.target.value)}
                  placeholder="Additional comments..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-2"
                  rows={2}
                />
                {/* Photos */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Photos</span>
                  <button onClick={() => handlePropertyItemPhoto(item.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium">📷 Add Photo</button>
                </div>
                {item.photos && item.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {item.photos.map((photo: Photo) => (
                      <div key={photo.id} className="relative flex-shrink-0 group">
                        <img src={photo.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                        <button onClick={() => onRemovePhotoFromPropertyItem(item.id, photo.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspection Info */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Report will include:</h4>
        <ul className="space-y-1 text-xs text-blue-700">
          <li className="flex items-center gap-2">✓ Property details with Makani number</li>
          <li className="flex items-center gap-2">✓ Landlord and tenant information</li>
          <li className="flex items-center gap-2">✓ Tenancy/lease details</li>
          <li className="flex items-center gap-2">✓ Room-by-room condition assessment with ratings</li>
          <li className="flex items-center gap-2">✓ All inspection photos with timestamps</li>
          <li className="flex items-center gap-2">✓ Digital signatures from all parties</li>
          <li className="flex items-center gap-2">✓ GPS location and timestamp verification</li>
          <li className="flex items-center gap-2">✓ Inspector metadata for authenticity</li>
        </ul>
      </div>
    </div>
  );
}

// Reusable Input
// Dubai Areas/Communities for autocomplete
const DUBAI_AREAS = [
  'Dubai Marina', 'Downtown Dubai', 'Palm Jumeirah', 'JBR (Jumeirah Beach Residence)',
  'Business Bay', 'DIFC', 'Jumeirah Lake Towers (JLT)', 'Dubai Hills Estate',
  'Arabian Ranches', 'Motor City', 'Sports City', 'Dubai Silicon Oasis',
  'Dubai South', 'Dubai Production City (IMPZ)', 'Dubai Sports City',
  'Jumeirah Village Circle (JVC)', 'Jumeirah Village Triangle (JVT)',
  'Al Barsha', 'Al Quoz', 'Al Sufouh', 'Al Nahda', 'Al Qusais',
  'Deira', 'Bur Dubai', 'Karama', 'Satwa', 'Jumeirah', 'Umm Suqeim',
  'Al Jaddaf', 'Culture Village', 'Dubai Creek Harbour', 'Festival City',
  'Ras Al Khor', 'MBR City (Mohammed Bin Rashid City)', 'Emirates Living',
  'The Springs', 'The Meadows', 'The Lakes', 'Emirates Hills',
  'Mirdif', 'Al Warqaa', 'Rashidiya', 'Town Square',
  'Dubai Land', 'Liwan', 'Tilal Al Ghaf', 'Damac Hills',
  'Damac Hills 2', 'Mudon', 'Reem', 'Sobha Hartland',
  'MBR Fountain Views', 'Zabeel', 'Downtown Views', 'City Walk',
  'Al Quoz Creative Zone', 'Jumeirah Bay Island', 'Bluewaters Island',
  'Port de La Mer', 'La Mer', 'North Beach', 'Dubai Harbour',
  'Palm Jebel Ali', 'Dubai Islands', 'Creek Beach',
  'International City', 'Discovery Gardens', 'Dubai Production City',
  'Al Furjan', 'Jumeirah Park', 'Jumeirah Islands',
  'The Villa', 'Al Barari', 'Meydan', ' Mohammed Bin Rashid Al Maktoum City',
  'Academic City', 'Dubai International Academic City',
  'Dubai Healthcare City', 'Oud Metha', 'BurJuman',
];

const DUBAI_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

function AutocompleteInput({
  label, value, onChange, placeholder, suggestions,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; suggestions: string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    if (v.trim().length > 0) {
      const filtered = suggestions.filter(s =>
        s.toLowerCase().includes(v.toLowerCase())
      ).slice(0, 8);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setHighlightIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setShowSuggestions(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(filteredSuggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (value.trim().length > 0) {
            const filtered = suggestions.filter(s =>
              s.toLowerCase().includes(value.toLowerCase())
            ).slice(0, 8);
            setFilteredSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        autoComplete="off"
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion, idx) => (
            <button
              key={suggestion}
              onClick={() => handleSelect(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                idx === highlightIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({
  label, value, onChange, type = 'text', placeholder, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </div>
  );
}
