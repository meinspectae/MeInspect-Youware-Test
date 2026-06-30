export type PropertyType = 'apartment' | 'townhouse' | 'villa' | 'office';

export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'missing';

export type InspectionStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export type InspectionType = 'move_in' | 'move_out' | 'routine' | 'mid_lease';

export interface Photo {
  id: string;
  url: string;
  caption?: string;
  timestamp: string;
  gpsLat?: number;
  gpsLng?: number;
}

export interface InspectionItem {
  id: string;
  name: string;
  category: string;
  condition: ConditionRating | null;
  comments: string;
  photos: Photo[];
  checked: boolean;
}

export interface PropertyItem {
  id: string;
  name: string;
  value: string;
  comments: string;
  photos: Photo[];
}

export interface Room {
  id: string;
  name: string;
  type: string;
  icon: string;
  items: InspectionItem[];
  overallComments: string;
  overallCondition: ConditionRating | null;
}

export interface Signature {
  dataUrl: string;
  signedAt: string;
  role: 'tenant' | 'landlord' | 'inspector';
  name: string;
}

export interface PropertyDetails {
  type: PropertyType;
  makaniNumber: string;
  area: string;
  city: string;
  buildingName?: string;
  unitNumber?: string;
  totalAreaSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  furnished: boolean;
  specialFeatures: string[];
}

export interface PartyDetails {
  name: string;
  phone: string;
  email: string;
  tradeLicenseNumber?: string;
  companyName?: string;
}

export interface TenancyDetails {
  leaseStartDate: string;
  leaseEndDate: string;
  contractNumber: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
}

export interface MetaData {
  inspectorId: string;
  inspectorName: string;
  inspectorEmail?: string;
  ipAddress?: string;
  location?: LocationData;
  deviceInfo: string;
  appVersion: string;
}

export interface Inspection {
  id: string;
  propertyType: PropertyType;
  status: InspectionStatus;
  property: PropertyDetails;
  tenant: PartyDetails;
  landlord: PartyDetails;
  agent?: PartyDetails;
  tenancy: TenancyDetails;
  rooms: Room[];
  propertyItems: PropertyItem[];
  generalNotes: string;
  overallPhotos: Photo[];
  signatures: Signature[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  meta: MetaData;
  reportGenerated: boolean;
  pdfUrl?: string;
  payment?: PaymentInfo;
}

export interface PaymentInfo {
  paid: boolean;
  amount: number;
  currency: string;
  method: 'card' | 'apple_pay' | 'google_pay' | 'samsung_pay';
  paidAt?: string;
  transactionId?: string;
  discountCode?: string;
  discountAmount?: number;
}

export interface PropertyTemplate {
  type: PropertyType;
  label: string;
  description: string;
  icon: string;
  defaultRooms: Omit<Room, 'id'>[];
}

export interface DashboardStats {
  totalInspections: number;
  completedInspections: number;
  draftInspections: number;
  thisMonthInspections: number;
}
