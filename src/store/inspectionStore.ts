import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { client } from '../api/client';
import { useAuthStore } from './authStore';
import {
  Inspection,
  PropertyType,
  PropertyDetails,
  PartyDetails,
  TenancyDetails,
  Room,
  InspectionItem,
  PropertyItem,
  Photo,
  ConditionRating,
  Signature,
  PaymentInfo,
} from '../types';
import { buildRoomsForPropertyType, buildRoomsForOffice } from '../data/propertyTemplates';
import { getLocation, getIPAddress } from '../utils/helpers';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Strip base64 photo data from sync payload to keep it under Cloudflare Workers size limit.
// Photos are only needed for client-side PDF generation; backend stores metadata only.
function stripBase64Photos(data: any): any {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(stripBase64Photos);
  }
  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'url' && typeof value === 'string' && value.startsWith('data:')) {
        // Replace base64 data URL with a placeholder
        result[key] = '';
      } else if (key === 'dataUrl' && typeof value === 'string' && value.startsWith('data:')) {
        result[key] = '';
      } else {
        result[key] = stripBase64Photos(value);
      }
    }
    return result;
  }
  return data;
}

// Sync inspection data to backend database
// Returns true if sync succeeded, false if failed
async function syncInspectionToBackend(inspection: any): Promise<boolean> {
  try {
    const authUser = useAuthStore.getState().user;
    if (!authUser) {
      console.warn('[Store] Cannot sync: user not logged in');
      return false;
    }
    const userId = authUser.email;

    const payload = {
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
      pdfUrl: inspection.pdfUrl || '',
      meta: inspection.meta,
    };

    // Strip base64 photo data to keep payload under Cloudflare Workers size limit
    const strippedPayload = stripBase64Photos(payload);

    // Try to update first, then create if not found
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const updateRes = await client.api.fetch(`/api/inspections/${inspection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strippedPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!updateRes.ok) {
      const putError = await updateRes.text().catch(() => 'unknown');
      console.log(`[Store] PUT returned ${updateRes.status}, creating new inspection in backend:`, inspection.id, putError);
      const createController = new AbortController();
      const createTimeout = setTimeout(() => createController.abort(), 15000);

      const createRes = await client.api.fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...strippedPayload, userId }),
        signal: createController.signal,
      });
      clearTimeout(createTimeout);

      if (!createRes.ok) {
        const errorBody = await createRes.text().catch(() => 'unknown');
        console.error(`[Store] Failed to create inspection in backend (HTTP ${createRes.status}):`, errorBody);
        return false;
      }
      const createData = await createRes.json();
      console.log('[Store] Create result:', createData);
    } else {
      console.log('[Store] Updated inspection in backend:', inspection.id);
    }
    return true;
  } catch (e) {
    console.warn('Failed to sync inspection to backend:', e);
    return false;
  }
}

// Retry sync with exponential backoff
async function retrySync(inspection: any, maxRetries = 2): Promise<boolean> {
  for (let i = 0; i <= maxRetries; i++) {
    const success = await syncInspectionToBackend(inspection);
    if (success) return true;
    if (i < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return false;
}

// Debounced auto-sync: waits 2 seconds after last change, then syncs
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoSync() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    const { currentInspection } = useInspectionStore.getState();
    if (currentInspection && currentInspection.status !== 'completed') {
      syncInspectionToBackend(currentInspection).then(ok => {
        if (!ok) console.warn('[Store] Auto-sync failed');
      });
    }
  }, 2000);
}

interface InspectionState {
  inspections: Inspection[];
  currentInspection: Inspection | null;
  currentStep: number;
  currentRoomIndex: number;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  deletedIds: string[]; // Track locally-deleted inspection IDs to prevent resurrection from backend sync

  // Actions
  createInspection: (propertyType: PropertyType, counts: { bedrooms: number; bathrooms: number }) => void;
  updateProperty: (property: Partial<PropertyDetails>) => void;
  updateTenant: (tenant: Partial<PartyDetails>) => void;
  updateLandlord: (landlord: Partial<PartyDetails>) => void;
  updateAgent: (agent: Partial<PartyDetails>) => void;
  updateTenancy: (tenancy: Partial<TenancyDetails>) => void;
  updateGeneralNotes: (notes: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentRoomIndex: (index: number) => void;
  updatePropertyItem: (itemId: string, value: string, comments: string) => void;
  addPhotoToPropertyItem: (itemId: string, photo: Photo) => void;
  removePhotoFromPropertyItem: (itemId: string, photoId: string) => void;

  // Room actions
  updateItemCondition: (roomIndex: number, itemId: string, condition: ConditionRating) => void;
  updateItemComments: (roomIndex: number, itemId: string, comments: string) => void;
  toggleItemChecked: (roomIndex: number, itemId: string) => void;
  addPhotoToItem: (roomIndex: number, itemId: string, photo: Photo) => void;
  removePhotoFromItem: (roomIndex: number, itemId: string, photoId: string) => void;
  updateRoomComments: (roomIndex: number, comments: string) => void;
  addOverallPhoto: (photo: Photo) => void;
  removeOverallPhoto: (photoId: string) => void;

  // Room/Item management
  addRoom: (room: Room) => void;
  removeRoom: (roomIndex: number) => void;
  updateRoomName: (roomIndex: number, name: string) => void;
  addItem: (roomIndex: number, item: InspectionItem) => void;
  removeItem: (roomIndex: number, itemId: string) => void;
  setRooms: (rooms: Room[]) => void;

  // Signatures
  addSignature: (signature: Signature) => void;
  removeSignature: (role: 'tenant' | 'landlord' | 'inspector') => void;

  // Payment
  recordPayment: (inspectionId: string, payment: PaymentInfo) => void;

  // Completion
  completeInspection: () => void;
  saveDraft: () => void;

  // Sync
  syncFromBackend: () => Promise<void>;
  pushToBackend: () => Promise<void>;
  getSyncStatus: () => { lastSyncTime: string | null; status: string };

  // Management
  deleteInspection: (id: string) => void;
  getInspection: (id: string) => Inspection | undefined;
  setCurrentInspection: (inspection: Inspection | null) => void;
  resetCurrentInspection: () => void;
}

function assignIds(rooms: Omit<Room, 'id'>[]): Room[] {
  return rooms.map(room => ({
    ...room,
    id: generateId(),
    items: room.items.map(item => ({
      ...item,
      id: item.id === 'general' ? 'general' : generateId(),
    })),
  }));
}

export const useInspectionStore = create<InspectionState>()(
  persist(
    (set, get) => ({
      inspections: [],
      currentInspection: null,
      currentStep: 0,
      currentRoomIndex: 0,
      lastSyncTime: null,
      syncStatus: 'idle' as const,
      deletedIds: [] as string[],

      createInspection: (propertyType, counts) => {
        const rooms = assignIds(
          propertyType === 'office'
            ? buildRoomsForOffice(counts.bedrooms, counts.bathrooms)
            : buildRoomsForPropertyType(propertyType, counts.bedrooms, counts.bathrooms)
        );

        const now = new Date().toISOString();
        const inspection: Inspection = {
          id: generateId(),
          propertyType,
          status: 'in_progress',
          property: {
            type: propertyType,
            makaniNumber: '',
            area: '',
            city: 'Dubai',
            buildingName: '',
            unitNumber: '',
            totalAreaSqft: undefined,
            bedrooms: counts.bedrooms,
            bathrooms: counts.bathrooms,
            furnished: false,
            specialFeatures: [],
          },
          tenant: { name: '', phone: '', email: '' },
          landlord: { name: '', phone: '', email: '' },
          agent: undefined,
          tenancy: {
            leaseStartDate: '',
            leaseEndDate: '',
            contractNumber: '',
          },
          rooms,
          propertyItems: [
            { id: 'keys_access_cards', name: 'Keys & Access Cards', value: '', comments: '', photos: [] },
            { id: 'utility_meters', name: 'Utility Meters Reading', value: '', comments: '', photos: [] },
          ],
          generalNotes: '',
          overallPhotos: [],
          signatures: [],
          createdAt: now,
          updatedAt: now,
          meta: {
            inspectorId: 'current-user',
            inspectorName: localStorage.getItem('inspector_name') || 'Inspector',
            inspectorEmail: localStorage.getItem('inspector_email') || '',
            deviceInfo: navigator.userAgent,
            appVersion: '1.0.0',
          },
          reportGenerated: false,
        };

        set({
          currentInspection: inspection,
          currentStep: 0,
          currentRoomIndex: 0,
        });

        // Fetch geolocation and IP address asynchronously and update the inspection
        (async () => {
          const [loc, ip] = await Promise.all([getLocation(), getIPAddress()]);
          const { currentInspection } = get();
          if (currentInspection && currentInspection.id === inspection.id) {
            set({
              currentInspection: {
                ...currentInspection,
                meta: {
                  ...currentInspection.meta,
                  ...(loc ? { location: loc } : {}),
                  ...(ip ? { ipAddress: ip } : {}),
                },
              },
            });
          }
        })();
      },

      updateProperty: (property) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            property: { ...currentInspection.property, ...property },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateTenant: (tenant) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            tenant: { ...currentInspection.tenant, ...tenant },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateLandlord: (landlord) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            landlord: { ...currentInspection.landlord, ...landlord },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateAgent: (agent) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            agent: { ...(currentInspection.agent || { name: '', phone: '', email: '' }), ...agent },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateTenancy: (tenancy) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            tenancy: { ...currentInspection.tenancy, ...tenancy },
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updateGeneralNotes: (notes) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            generalNotes: notes,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      updatePropertyItem: (itemId, value, comments) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const propertyItems = currentInspection.propertyItems.map(item =>
          item.id === itemId ? { ...item, value, comments } : item
        );
        set({
          currentInspection: {
            ...currentInspection,
            propertyItems,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      addPhotoToPropertyItem: (itemId, photo) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const propertyItems = currentInspection.propertyItems.map(item =>
          item.id === itemId ? { ...item, photos: [...item.photos, photo] } : item
        );
        set({
          currentInspection: {
            ...currentInspection,
            propertyItems,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      removePhotoFromPropertyItem: (itemId, photoId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const propertyItems = currentInspection.propertyItems.map(item =>
          item.id === itemId ? { ...item, photos: item.photos.filter(p => p.id !== photoId) } : item
        );
        set({
          currentInspection: {
            ...currentInspection,
            propertyItems,
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentRoomIndex: (index) => set({ currentRoomIndex: index }),

      updateItemCondition: (roomIndex, itemId, condition) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, condition, checked: true } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      updateItemComments: (roomIndex, itemId, comments) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, comments } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      toggleItemChecked: (roomIndex, itemId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, checked: !item.checked } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      addPhotoToItem: (roomIndex, itemId, photo) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, photos: [...item.photos, photo], checked: true } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      removePhotoFromItem: (roomIndex, itemId, photoId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return {
            ...r,
            items: r.items.map(item =>
              item.id === itemId ? { ...item, photos: item.photos.filter(p => p.id !== photoId) } : item
            ),
          };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      updateRoomComments: (roomIndex, comments) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return { ...r, overallComments: comments };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
        scheduleAutoSync();
      },

      addOverallPhoto: (photo) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            overallPhotos: [...currentInspection.overallPhotos, photo],
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      removeOverallPhoto: (photoId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            overallPhotos: currentInspection.overallPhotos.filter(p => p.id !== photoId),
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      // Room/Item management
      addRoom: (room) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const newRoom = {
          ...room,
          id: generateId(),
          items: room.items.map(item => ({ ...item, id: item.id === 'general' ? 'general' : generateId() })),
        };
        set({
          currentInspection: {
            ...currentInspection,
            rooms: [...currentInspection.rooms, newRoom],
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      removeRoom: (roomIndex) => {
        const { currentInspection, currentRoomIndex } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.filter((_, i) => i !== roomIndex);
        const newCurrentIndex = currentRoomIndex >= rooms.length
          ? Math.max(0, rooms.length - 1)
          : currentRoomIndex >= roomIndex
          ? Math.max(0, currentRoomIndex - 1)
          : currentRoomIndex;
        set({
          currentInspection: { ...currentInspection, rooms: [...rooms], updatedAt: new Date().toISOString() },
          currentRoomIndex: newCurrentIndex,
        });
      },

      updateRoomName: (roomIndex, name) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) =>
          i === roomIndex ? { ...r, name } : r
        );
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
      },

      addItem: (roomIndex, item) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return { ...r, items: [...r.items, { ...item, id: generateId() }] };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
      },

      removeItem: (roomIndex, itemId) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const rooms = currentInspection.rooms.map((r, i) => {
          if (i !== roomIndex) return r;
          return { ...r, items: r.items.filter(item => item.id !== itemId) };
        });
        set({
          currentInspection: { ...currentInspection, rooms, updatedAt: new Date().toISOString() },
        });
      },

      setRooms: (newRooms) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        // Deep clone rooms to prevent any reference mutation
        const clonedRooms = JSON.parse(JSON.stringify(newRooms));
        set({
          currentInspection: { ...currentInspection, rooms: clonedRooms, updatedAt: new Date().toISOString() },
        });
      },

      // Signatures
      addSignature: (signature) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        const existing = currentInspection.signatures.filter(s => s.role !== signature.role);
        set({
          currentInspection: {
            ...currentInspection,
            signatures: [...existing, signature],
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      removeSignature: (role) => {
        const { currentInspection } = get();
        if (!currentInspection) return;
        set({
          currentInspection: {
            ...currentInspection,
            signatures: currentInspection.signatures.filter(s => s.role !== role),
            updatedAt: new Date().toISOString(),
          },
        });
        scheduleAutoSync();
      },

      recordPayment: (inspectionId, payment) => {
        const { inspections, currentInspection } = get();
        const updatedPayment = {
          ...payment,
          paidAt: new Date().toISOString(),
          transactionId: `txn_${generateId()}`,
        };

        const newInspections = inspections.map(i =>
          i.id === inspectionId ? { ...i, payment: updatedPayment, updatedAt: new Date().toISOString() } : i
        );

        const newCurrent = currentInspection?.id === inspectionId
          ? { ...currentInspection, payment: updatedPayment, updatedAt: new Date().toISOString() }
          : currentInspection;

        set({
          inspections: newInspections,
          currentInspection: newCurrent,
        });
      },

      completeInspection: () => {
        const { currentInspection, inspections } = get();
        if (!currentInspection) return;
        const completed = {
          ...currentInspection,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = inspections.findIndex(i => i.id === completed.id);
        const newInspections = [...inspections];
        if (existingIndex >= 0) {
          newInspections[existingIndex] = completed;
        } else {
          newInspections.push(completed);
        }

        set({
          inspections: newInspections,
          currentInspection: completed,
        });

        // Sync to backend with retry
        retrySync(completed).then(success => {
          if (!success) {
            console.error('[Store] Failed to sync completed inspection after retries');
          }
        });
      },

      saveDraft: () => {
        const { currentInspection, inspections } = get();
        if (!currentInspection) return;
        const draft = {
          ...currentInspection,
          status: 'draft' as const,
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = inspections.findIndex(i => i.id === draft.id);
        const newInspections = [...inspections];
        if (existingIndex >= 0) {
          newInspections[existingIndex] = draft;
        } else {
          newInspections.push(draft);
        }

        set({ inspections: newInspections, currentInspection: draft });

        // Sync to backend with retry
        retrySync(draft).then(success => {
          if (!success) {
            console.error('[Store] Failed to sync draft inspection after retries');
          }
        });
      },

      // ==================== SYNC METHODS ====================

      syncFromBackend: async () => {
        const state = get();
        set({ syncStatus: 'syncing' });

        // Timeout after 15 seconds to prevent UI from being stuck
        const syncTimeout = setTimeout(() => {
          const current = get();
          if (current.syncStatus === 'syncing') {
            set({ syncStatus: 'error' });
          }
        }, 15000);

        try {
          const authUser = useAuthStore.getState().user;
          if (!authUser) {
            clearTimeout(syncTimeout);
            set({ syncStatus: 'error' });
            return;
          }
          const userId = authUser.email;

          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 12000);

          const response = await client.api.fetch(`/api/sync/inspections`, {
            signal: controller.signal,
          });
          clearTimeout(fetchTimeout);

          if (!response.ok) {
            clearTimeout(syncTimeout);
            set({ syncStatus: 'error' });
            return;
          }

          const result = await response.json();
          const backendInspections: Inspection[] = (result.data || []).map((item: any) => ({
            id: item.id,
            propertyType: item.propertyType || 'apartment',
            status: item.status || 'draft',
            property: item.property || {},
            tenant: item.tenant || { name: '', phone: '', email: '' },
            landlord: item.landlord || { name: '', phone: '', email: '' },
            agent: item.agent || undefined,
            tenancy: item.tenancy || { leaseStartDate: '', leaseEndDate: '', contractNumber: '' },
            rooms: item.rooms || [],
            propertyItems: item.propertyItems || [],
            generalNotes: item.generalNotes || '',
            overallPhotos: item.overallPhotos || [],
            signatures: item.signatures || [],
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
            completedAt: item.completedAt || undefined,
            meta: {
              inspectorId: userId,
              inspectorName: localStorage.getItem('inspector_name') || 'Inspector',
              inspectorEmail: localStorage.getItem('inspector_email') || '',
              deviceInfo: navigator.userAgent,
              appVersion: '1.0.0',
            },
            reportGenerated: !!item.reportGenerated,
            pdfUrl: item.pdfUrl || '',
            payment: item.payment || undefined,
          }));

          // Merge: backend data + local data, preferring the most recently updated
          const localInspections = state.inspections;
          const deletedIds = state.deletedIds || [];
          const mergedMap = new Map<string, Inspection>();

          // Add all local inspections
          for (const local of localInspections) {
            mergedMap.set(local.id, local);
          }

          // Merge backend inspections (use most recent updatedAt), skip deleted ones
          for (const backend of backendInspections) {
            if (deletedIds.includes(backend.id)) continue; // Skip resurrected inspections
            const existing = mergedMap.get(backend.id);
            if (!existing) {
              // New from backend
              mergedMap.set(backend.id, backend);
            } else {
              // Conflict resolution: use most recently updated
              const localTime = new Date(existing.updatedAt).getTime();
              const backendTime = new Date(backend.updatedAt).getTime();
              if (backendTime > localTime) {
                mergedMap.set(backend.id, backend);
              }
            }
          }

          const merged = Array.from(mergedMap.values());
          const now = new Date().toISOString();

          clearTimeout(syncTimeout);
          set({
            inspections: merged,
            syncStatus: 'synced',
            lastSyncTime: now,
          });

          // Also push any local-only inspections to the backend
          const localOnlyIds = localInspections
            .filter(local => !backendInspections.some(b => b.id === local.id))
            .map(l => l.id);

          if (localOnlyIds.length > 0) {
            // Push local-only items to backend in background
            const localOnlyItems = localInspections.filter(l => localOnlyIds.includes(l.id)).map(l => stripBase64Photos(l));
            client.api.fetch('/api/sync/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inspections: localOnlyItems }),
            }).catch(() => {}); // fire and forget
          }
        } catch (e) {
          clearTimeout(syncTimeout);
          console.warn('Sync from backend failed:', e);
          set({ syncStatus: 'error' });
        }
      },

      pushToBackend: async () => {
        const state = get();
        set({ syncStatus: 'syncing' });

        try {
          const authUser = useAuthStore.getState().user;
          if (!authUser) {
            set({ syncStatus: 'error' });
            return;
          }
          const userId = authUser.email;

          const response = await client.api.fetch('/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, inspections: state.inspections.map(i => stripBase64Photos(i)) }),
          });

          if (response.ok) {
            set({
              syncStatus: 'synced',
              lastSyncTime: new Date().toISOString(),
            });
          } else {
            set({ syncStatus: 'error' });
          }
        } catch (e) {
          console.warn('Push to backend failed:', e);
          set({ syncStatus: 'error' });
        }
      },

      getSyncStatus: () => {
        const { lastSyncTime, syncStatus } = get();
        return { lastSyncTime, status: syncStatus };
      },

      deleteInspection: (id) => {
        const { inspections, deletedIds } = get();
        // Remove from local state
        set({
          inspections: inspections.filter(i => i.id !== id),
          deletedIds: [...deletedIds, id],
        });
        // Also delete from backend (fire and forget)
        client.api.fetch(`/api/inspections/${id}`, { method: 'DELETE' }).catch(() => {});
      },

      getInspection: (id) => {
        const { inspections, currentInspection } = get();
        if (currentInspection?.id === id) return currentInspection;
        return inspections.find(i => i.id === id);
      },

      setCurrentInspection: (inspection) => set({ currentInspection: inspection }),

      resetCurrentInspection: () => set({ currentInspection: null, currentStep: 0, currentRoomIndex: 0 }),
    }),
    {
      name: 'propinspect-storage',
    }
  )
);
