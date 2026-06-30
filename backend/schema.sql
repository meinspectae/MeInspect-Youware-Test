-- MeInspect Database Schema
-- Cloudflare D1 (SQLite) with STRICT mode

-- Users table (synced from Youware auth)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  encrypted_yw_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  photo_url TEXT,
  inspector_name TEXT,
  inspector_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_users_encrypted_yw_id ON users(encrypted_yw_id);

-- Inspections table (main entity)
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'apartment',
  status TEXT NOT NULL DEFAULT 'draft',
  general_notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  report_generated INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_created_at ON inspections(created_at DESC);

-- Property details (1:1 with inspection)
CREATE TABLE IF NOT EXISTS property_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL UNIQUE,
  makani_number TEXT DEFAULT '',
  area TEXT DEFAULT '',
  city TEXT DEFAULT 'Dubai',
  building_name TEXT DEFAULT '',
  unit_number TEXT DEFAULT '',
  total_area_sqft INTEGER,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  furnished INTEGER DEFAULT 0,
  special_features TEXT DEFAULT '[]',
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

-- Party details (landlord, tenant, agent)
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  trade_license_number TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_parties_inspection_id ON parties(inspection_id);

-- Tenancy details
CREATE TABLE IF NOT EXISTS tenancy_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL UNIQUE,
  lease_start_date TEXT DEFAULT '',
  lease_end_date TEXT DEFAULT '',
  contract_number TEXT DEFAULT '',
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL,
  icon TEXT DEFAULT '🏠',
  overall_comments TEXT DEFAULT '',
  overall_condition TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_rooms_inspection_id ON rooms(inspection_id);

-- Inspection items
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  condition TEXT,
  comments TEXT DEFAULT '',
  checked INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_items_room_id ON items(room_id);

-- Photos
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  inspection_id TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'item',
  url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  gps_lat REAL,
  gps_lng REAL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_photos_item_id ON photos(item_id);
CREATE INDEX IF NOT EXISTS idx_photos_inspection_id ON photos(inspection_id);

-- Signatures
CREATE TABLE IF NOT EXISTS signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  data_url TEXT NOT NULL,
  signed_at TEXT NOT NULL,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_signatures_inspection_id ON signatures(inspection_id);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL,
  paid INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'AED',
  method TEXT DEFAULT 'card',
  paid_at TEXT,
  transaction_id TEXT,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_payments_inspection_id ON payments(inspection_id);
