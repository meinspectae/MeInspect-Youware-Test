import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspectionStore } from '../store/inspectionStore';
import { formatDate, formatDateTime } from '../utils/helpers';
import { getPropertyTypeLabel } from '../data/propertyTemplates';

export default function Dashboard() {
  const navigate = useNavigate();
  const { inspections, setCurrentInspection } = useInspectionStore();

  const completed = inspections.filter(i => i.status === 'completed');
  const drafts = inspections.filter(i => i.status === 'draft' || i.status === 'in_progress');

  const recentInspections = [...inspections]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const handleDraftClick = (inspection: any) => {
    setCurrentInspection(inspection);
    navigate('/inspect');
  };

  return (
    <div className="space-y-6">
      {/* Hero - Start New Inspection */}
      <div
        onClick={() => navigate('/new')}
        className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/25 cursor-pointer hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-2xl group-hover:bg-white/30 transition-all shadow-lg">
            +
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold mb-1">Start New Inspection</h1>
            <p className="text-blue-100 text-xs sm:text-sm">
              Select property type, fill details, capture photos, and generate reports.
            </p>
          </div>
          <svg className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Quick Stats */}
      {(completed.length > 0 || drafts.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">✅</div>
              <div>
                <div className="text-xl font-bold text-slate-900">{completed.length}</div>
                <div className="text-xs text-slate-500">Completed</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg">📝</div>
              <div>
                <div className="text-xl font-bold text-slate-900">{drafts.length}</div>
                <div className="text-xs text-slate-500">Drafts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resume Drafts - Prominent section if drafts exist */}
      {drafts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">📋 Resume Draft</h2>
            <button onClick={() => navigate('/history')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All →</button>
          </div>
          <div className="space-y-2">
            {[...drafts]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .slice(0, 3)
              .map((inspection) => (
                <div
                  key={inspection.id}
                  onClick={() => handleDraftClick(inspection)}
                  className="bg-white rounded-xl border border-amber-200 p-4 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">
                      {getPropertyTypeEmoji(inspection.propertyType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                          {inspection.property.makaniNumber || `${inspection.property.buildingName || ''} ${inspection.property.unitNumber || ''}`.trim() || 'Untitled Property'}
                        </h3>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                          {inspection.status === 'draft' ? 'Draft' : 'In Progress'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>{getPropertyTypeLabel(inspection.propertyType)}</span>
                        <span>·</span>
                        <span>{formatDate(inspection.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-blue-600 font-medium group-hover:underline hidden sm:inline">Resume →</span>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Inspections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">Recent Inspections</h2>
          {inspections.length > 5 && (
            <button onClick={() => navigate('/history')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All →</button>
          )}
        </div>

        {recentInspections.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <div className="text-4xl mb-3">🏠</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No Inspections Yet</h3>
            <p className="text-slate-400 text-sm">Start your first inspection to see it here.</p>
            <button onClick={() => navigate('/new')}
              className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
              + Start Inspection
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {recentInspections.map((inspection) => (
              <div
                key={inspection.id}
                onClick={() => {
                  if (inspection.status === 'completed') {
                    setCurrentInspection(inspection);
                    navigate(`/report/${inspection.id}`);
                  } else {
                    handleDraftClick(inspection);
                  }
                }}
                className="bg-white rounded-xl border border-slate-100 p-4 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${inspection.status === 'completed' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    {getPropertyTypeEmoji(inspection.propertyType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {inspection.property.makaniNumber || `${inspection.property.buildingName || ''} ${inspection.property.unitNumber || ''}`.trim() || 'Untitled Property'}
                      </h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${inspection.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inspection.status === 'completed' ? 'Done' : 'Draft'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span>{getPropertyTypeLabel(inspection.propertyType)}</span>
                      <span>·</span>
                      <span>{formatDate(inspection.updatedAt)}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getPropertyTypeEmoji(type: string): string {
  const map: Record<string, string> = { apartment: '🏢', townhouse: '🏠', villa: '🏡', office: '🏬' };
  return map[type] || '🏠';
}
