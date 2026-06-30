# MeInspect — Property Condition Report App

## Project Overview
A professional property condition reporting application designed for the Dubai real estate market. It enables landlords, tenants, and inspectors to document property conditions with timestamped, geotagged photos and detailed item-by-item assessments.

## Architecture
```
Frontend (React + Vite)
├── src/
│   ├── api/client.ts          — Backend API service layer
│   ├── contexts/AuthContext.tsx — Authentication context
│   ├── components/
│   │   └── SignaturePad.tsx    — Canvas-based signature component
│   ├── pages/
│   │   ├── Dashboard.tsx       — Minimal home with Start New Inspection
│   │   ├── InspectionForm.tsx  — 6-step wizard with autocomplete
│   │   ├── ReportPage.tsx      — Multi-page PDF report generator
│   │   └── ...
│   ├── store/inspectionStore.ts — Zustand store (localStorage + API)
│   └── types/index.ts          — TypeScript interfaces

Backend (Cloudflare Workers + D1)
├── backend/
│   ├── src/index.ts            — Worker entry point
│   ├── schema.sql              — Database schema
│   └── wrangler.toml           — Worker config
```

## Key Features
- **4 Property Types**: Apartment, Townhouse, Villa, Office
- **6-Step Inspection Wizard**: Property → Parties → Tenancy → Rooms → Signatures → Review
- **Autocomplete Fields**: 70+ Dubai communities with suggestions as you type
- **Room Management**: Add/remove rooms and items with individual delete options
- **Photo Capture**: Camera-based with GPS tagging and timestamp embedding
- **Digital Signatures**: Canvas-based for Tenant, Landlord, and Inspector
- **Email Report Sending**: Real email delivery via Resend API through backend endpoint
- **Inspection History Sync**: Bidirectional sync between local storage and cloud backend
- **Multi-Page PDF Report**:
  - Page 1: Property summary with exterior photo (centered, constrained width)
  - Page 2: Legal disclaimer (Arabic & English)
  - Page 3: Recording methodology (Arabic & English)
  - Assessment pages: Room-by-room condition tables
  - Last page: Signatures + Legal declaration (Arabic & English)
  - All pages: Timestamp, Report ID, Geolocation, IP Address, Page numbers
  - Tamper-proof: SHA-256 hash of report data for integrity verification

## Backend Integration
- **Authentication**: Youware platform auth via X-Encrypted-Yw-ID header
- **Database**: Cloudflare D1 (SQLite-compatible) with user-scoped data
- **API Endpoints**:
  - `GET/POST /api/inspections` — List/create inspections (authenticated, user-scoped)
  - `GET/PUT/DELETE /api/inspections/:id` — CRUD single inspection (authenticated, ownership-verified)
  - `POST /api/send-email` — Send report email via Resend API (authenticated, requires RESEND_API_KEY secret)
  - `GET /api/sync/inspections` — Fetch all inspections from cloud for a user (authenticated)
  - `POST /api/sync/push` — Push local inspections to cloud (authenticated)
  - `POST /api/upload/pdf` — Presigned PDF upload URL (authenticated, ownership-verified)
  - `GET /api/download/pdf/:inspectionId` — Presigned PDF download (authenticated, ownership-verified)
  - `POST /api/upload/photo` — Presigned photo upload URL (authenticated, ownership-verified)
  - `GET /api/download/photo` — Presigned photo download (authenticated, path-ownership-verified)
  - `POST /api/user/profile` — Save/update user profile (authenticated)
  - `GET /api/user/profile` — Get own user profile (authenticated)
  - `POST /api/checkout` — Create payment session (authenticated)
  - `GET/POST /api/orders` — Payment history (authenticated)
- **Security**: All endpoints enforce user ownership via `requireOwnership()` helper

## Database Schema
- `users` — User accounts synced from Youware auth
- `inspections` — Main inspection records
- `property_details` — Property info (1:1 with inspection)
- `parties` — Landlord, tenant, agent details
- `tenancy_details` — Lease information
- `rooms` — Room definitions
- `items` — Inspection items within rooms
- `photos` — Photos with GPS and timestamps
- `signatures` — Digital signatures
- `payments` — Payment records

## Mobile Deployment (Capacitor)
- **iOS**: `npm run cap:add:ios && npm run cap:open:ios`
- **Android**: `npm run cap:add:android && npm run cap:open:android`
- **Sync**: `npm run cap:sync`

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite 7, Tailwind CSS 3.4
- **State**: Zustand with localStorage persistence + backend sync
- **Backend**: Cloudflare Workers, D1 Database, TypeScript
- **PDF**: html2pdf.js (html2canvas + jsPDF)
- **Mobile**: Capacitor 8

## Bug Fixes Applied
- **Room data loss**: All store room mutation functions now use immutable `.map()` pattern instead of array index mutation to prevent reference sharing issues between rooms
- **PDF generation**: Switched from dynamic `import('html2pdf.js')` to static import to ensure the library is always available; added print fallback on PDF failure

## Build Commands
- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run cap:sync` — Sync to native projects
