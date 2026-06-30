import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspectionStore } from '../store/inspectionStore';
import { client } from '../api/client';
import { formatDate, formatDateTime } from '../utils/helpers';
import { getPropertyTypeLabel } from '../data/propertyTemplates';

export default function HistoryPage() {
  const navigate = useNavigate();
  const {
    inspections,
    deleteInspection,
    setCurrentInspection,
    syncFromBackend,
    pushToBackend,
    lastSyncTime,
    syncStatus,
  } = useInspectionStore();

  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);

  // Auto-sync on mount
  useEffect(() => {
    const doSync = async () => {
      await syncFromBackend();
      setIsInitialSyncDone(true);
    };
    doSync();
  }, []);

  const handleSync = useCallback(async () => {
    await syncFromBackend();
  }, [syncFromBackend]);

  const handlePush = useCallback(async () => {
    await pushToBackend();
  }, [pushToBackend]);

  const sorted = [...inspections].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const [filter, setFilter] = React.useState<'all' | 'completed' | 'draft'>('all');

  const filtered = filter === 'all' ? sorted : sorted.filter(i => {
    if (filter === 'completed') return i.status === 'completed';
    return i.status === 'draft' || i.status === 'in_progress';
  });

  const handleView = (inspection: any) => {
    setCurrentInspection(inspection);
    if (inspection.status === 'completed') {
      navigate(`/report/${inspection.id}`);
    } else {
      navigate('/inspect');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this inspection?')) {
      deleteInspection(id);
    }
  };

  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Never synced';
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(time);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">Inspection History</h1>
        <p className="text-slate-500">View and manage all your property inspections.</p>
      </div>

      {/* Sync Bar */}
      <div className="mb-6 bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${
              syncStatus === 'syncing' ? 'bg-amber-400 animate-pulse' :
              syncStatus === 'synced' ? 'bg-emerald-400' :
              syncStatus === 'error' ? 'bg-red-400' :
              'bg-slate-300'
            }`} />
            <div>
              <p className="text-sm font-medium text-slate-700">
                {syncStatus === 'syncing' ? 'Syncing...' :
                 syncStatus === 'synced' ? 'Synced' :
                 syncStatus === 'error' ? 'Sync failed' :
                 'Not synced'}
              </p>
              <p className="text-xs text-slate-400">
                Last sync: {formatSyncTime(lastSyncTime)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncStatus === 'syncing'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                syncStatus === 'syncing'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Pull from Cloud
            </button>
            <button
              onClick={handlePush}
              disabled={syncStatus === 'syncing'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                syncStatus === 'syncing'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Push to Cloud
            </button>
          </div>
        </div>
        {inspections.length > 0 && (
          <p className="text-xs text-slate-400 mt-2 pl-5">
            {inspections.length} inspection{inspections.length !== 1 ? 's' : ''} stored locally
          </p>
        )}
      </div>

      {/* Sync Warning */}
      {syncStatus === 'error' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-800">Cloud sync failed</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Your inspections are only stored on this device. If you clear your browser data or switch devices, you will lose them.
                Please check your connection and try syncing again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'all' as const, label: `All (${sorted.length})` },
          { key: 'completed' as const, label: `Completed (${sorted.filter(i => i.status === 'completed').length})` },
          { key: 'draft' as const, label: `Drafts (${sorted.filter(i => i.status === 'draft' || i.status === 'in_progress').length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">
            {filter === 'all' ? 'No Inspections Yet' : `No ${filter} inspections`}
          </h3>
          <p className="text-slate-400 text-sm">
            {filter === 'all'
              ? 'Start your first inspection to see it here.'
              : 'Try changing the filter or start a new inspection.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inspection) => (
            <div
              key={inspection.id}
              onClick={() => handleView(inspection)}
              className="bg-white rounded-xl border border-slate-100 p-4 sm:p-5 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                  inspection.status === 'completed' ? 'bg-emerald-50' : 'bg-amber-50'
                }`}>
                  {getPropertyEmoji(inspection.propertyType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {inspection.property.makaniNumber || `${inspection.property.buildingName || ''} ${inspection.property.unitNumber || ''}`.trim() || 'Untitled Property'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inspection.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : inspection.status === 'draft'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {inspection.status === 'completed' ? 'Completed' : inspection.status === 'draft' ? 'Draft' : 'In Progress'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 flex-wrap">
                    <span>{getPropertyTypeLabel(inspection.propertyType)}</span>
                    <span>•</span>
                    <span>{formatDateTime(inspection.updatedAt)}</span>
                  </div>
                  {inspection.property.area && (
                    <div className="text-xs text-slate-400 mt-1">📍 {inspection.property.area}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inspection.status === 'completed' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentInspection(inspection);
                          navigate(`/report/${inspection.id}`);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                      >
                        📄 View Report
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (inspection.pdfUrl) {
                            try {
                              const res = await client.api.fetch(`/api/download/pdf/${inspection.id}`);
                              if (res.ok) {
                                const { downloadUrl } = await res.json();
                                window.open(downloadUrl, '_blank');
                              } else {
                                alert('PDF download unavailable. Please view the report and regenerate it.');
                              }
                            } catch {
                              alert('Failed to get PDF download link.');
                            }
                          } else {
                            alert('PDF not saved to cloud yet. Open the report and click "Download PDF" to save it.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all"
                        title={inspection.pdfUrl ? 'Download saved PDF from cloud' : 'PDF not yet saved to cloud'}
                      >
                        ⬇️ {inspection.pdfUrl ? 'Download PDF' : 'Save to Cloud'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => handleDelete(inspection.id, e)}
                    className={`p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all ${inspection.status === 'completed' ? 'hidden' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    🗑️
                  </button>
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPropertyEmoji(type: string): string {
  const map: Record<string, string> = { apartment: '🏢', townhouse: '🏠', villa: '🏡', office: '🏬' };
  return map[type] || '🏠';
}
