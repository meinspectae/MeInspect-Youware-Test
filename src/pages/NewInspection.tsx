import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspectionStore } from '../store/inspectionStore';
import { PropertyType } from '../types';

const propertyTypes: { type: PropertyType; label: string; icon: string; description: string }[] = [
  { type: 'apartment', label: 'Apartment', icon: '🏢', description: 'Standard apartment unit in a residential building' },
  { type: 'townhouse', label: 'Townhouse', icon: '🏠', description: 'Multi-story townhouse with shared walls' },
  { type: 'villa', label: 'Villa', icon: '🏡', description: 'Independent villa with private outdoor spaces' },
  { type: 'office', label: 'Office', icon: '🏬', description: 'Commercial office space' },
];

export default function NewInspection() {
  const navigate = useNavigate();
  const { createInspection } = useInspectionStore();
  const [selectedType, setSelectedType] = React.useState<PropertyType | null>(null);
  const [bedrooms, setBedrooms] = React.useState<number>(1);
  const [bathrooms, setBathrooms] = React.useState<number>(1);

  const isOffice = selectedType === 'office';
  const canProceed = selectedType !== null && bedrooms >= 0 && bathrooms >= 0;

  const handleStart = () => {
    if (!selectedType) return;
    createInspection(selectedType, { bedrooms, bathrooms });
    navigate('/inspect');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">New Inspection</h1>
        <p className="text-slate-500">Select the property type and enter room details to begin.</p>
      </div>

      {/* Property Type Tabs */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Property Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {propertyTypes.map((pt) => (
            <button
              key={pt.type}
              onClick={() => setSelectedType(pt.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selectedType === pt.type
                  ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{pt.icon}</span>
                <div>
                  <div className={`text-sm font-semibold ${
                    selectedType === pt.type ? 'text-blue-700' : 'text-slate-800'
                  }`}>
                    {pt.label}
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed mt-0.5">{pt.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Room & Bathroom Inputs */}
      {selectedType && (
        <div className="mb-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {isOffice ? 'Room & Restroom Details' : 'Bedroom & Bathroom Details'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {isOffice ? 'Meeting Rooms / Cabins' : 'Number of Bedrooms'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBedrooms(Math.max(0, bedrooms - 1))}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-lg transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center px-3 py-2 border border-slate-200 rounded-lg text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setBedrooms(bedrooms + 1)}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-lg transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {isOffice ? 'Additional rooms beyond reception & open office' : 'Additional rooms beyond living areas'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {isOffice ? 'Restrooms' : 'Number of Bathrooms'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBathrooms(Math.max(0, bathrooms - 1))}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-lg transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center px-3 py-2 border border-slate-200 rounded-lg text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setBathrooms(bathrooms + 1)}
                  className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-lg transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Preview of rooms that will be created */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-500 mb-2">Rooms that will be created:</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedType === 'office' ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🏛️ Reception</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">💼 Open Office</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🪑 Manager's Cabin</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🖥️ Server Room</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">☕ Kitchen</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">📦 Storage</span>
                  {bedrooms > 0 && Array.from({ length: bedrooms }, (_, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-600">🤝 Meeting {i + 1}</span>
                  ))}
                  {bathrooms > 0 && Array.from({ length: bathrooms }, (_, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-600">🚿 Restroom {i + 1}</span>
                  ))}
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🚪 Entrance</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🛋️ Living Room</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🍳 Kitchen</span>
                  {selectedType === 'apartment' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🌅 Balcony</span>}
                  {selectedType === 'townhouse' && (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🍽️ Dining</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🛏️ Maid's Room</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🌿 Garden</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🚗 Parking</span>
                    </>
                  )}
                  {selectedType === 'villa' && (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">📺 Family Room</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🍽️ Dining</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🛏️ Maid's Room</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🧺 Laundry</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🌿 Garden</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🏊 Pool</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">🚗 Garage</span>
                    </>
                  )}
                  {bedrooms > 0 && Array.from({ length: bedrooms }, (_, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-600">🛏️ {i === 0 ? 'Master Bedroom' : `Bedroom ${i + 1}`}</span>
                  ))}
                  {bathrooms > 0 && Array.from({ length: bathrooms }, (_, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-600">🚿 {i === 0 ? 'Master Bathroom' : `Bathroom ${i + 1}`}</span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start Button */}
      <div className="flex justify-end">
        <button
          onClick={handleStart}
          disabled={!canProceed}
          className={`px-8 py-3.5 rounded-xl text-base font-semibold transition-all ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Start Inspection →
        </button>
      </div>
    </div>
  );
}
