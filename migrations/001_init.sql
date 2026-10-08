-- Training booking platform schema (PostgreSQL 14+). All timestamps are stored in UTC (timestamptz).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admins (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, industry text, organization_type text, country text, city text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_name_uq ON organizations (lower(name));

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  full_name text NOT NULL, phone text, designation text, country text, city text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE training_programs (
  id text PRIMARY KEY, slug text NOT NULL UNIQUE, title text NOT NULL, short_description text NOT NULL,
  full_description text, duration_min int NOT NULL CHECK (duration_min BETWEEN 30 AND 1440),
  delivery_formats text[] NOT NULL DEFAULT '{online}', min_participants int NOT NULL DEFAULT 1,
  max_participants int NOT NULL DEFAULT 50, price_text text NOT NULL DEFAULT 'Contact for Pricing',
  learning_objectives text[] NOT NULL DEFAULT '{}', target_audience text, modules text[] NOT NULL DEFAULT '{}',
  banner_url text, active boolean NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_participants <= max_participants)
);

CREATE TABLE booking_sequences (year int PRIMARY KEY, last_value int NOT NULL DEFAULT 0);

CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  booking_reference text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  training_program_id text NOT NULL REFERENCES training_programs(id),
  program_title text NOT NULL,
  start_time timestamptz NOT NULL, end_time timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  format text NOT NULL CHECK (format IN ('online','onsite','hybrid')),
  location text, participant_count int NOT NULL CHECK (participant_count > 0),
  status text NOT NULL CHECK (status IN ('pending','confirmed','rejected','cancelled','rescheduled','completed','no_show')),
  experience_level text, budget_range text, lead_source text NOT NULL DEFAULT 'website',
  google_calendar_event_id text, sync_error text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  -- Database-level double-booking guard: no two active bookings may overlap, even if app logic is bypassed.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (tstzrange(start_time, end_time) WITH &&)
    WHERE (status IN ('pending','confirmed','rescheduled'))
);
CREATE INDEX bookings_start_idx ON bookings (start_time);
CREATE INDEX bookings_end_idx ON bookings (end_time);
CREATE INDEX bookings_status_idx ON bookings (status);
CREATE INDEX bookings_customer_idx ON bookings (customer_id);
CREATE UNIQUE INDEX bookings_gcal_uq ON bookings (google_calendar_event_id) WHERE google_calendar_event_id IS NOT NULL;

CREATE TABLE booking_status_history (
  id bigserial PRIMARY KEY, booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status text NOT NULL, actor text NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_history_booking_idx ON booking_status_history (booking_id);

CREATE TABLE temporary_reservations (
  token_hash text PRIMARY KEY, training_program_id text NOT NULL REFERENCES training_programs(id),
  start_time timestamptz NOT NULL, end_time timestamptz NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX reservations_expiry_idx ON temporary_reservations (expires_at);

-- Availability rules, blocked dates and holidays live in `settings` (key 'availability') as validated JSON.

CREATE TABLE calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), google_email text NOT NULL UNIQUE,
  refresh_token_enc text NOT NULL,            -- AES-256-GCM ciphertext, never plaintext
  selected_calendar_ids text[] NOT NULL DEFAULT '{primary}', status text NOT NULL DEFAULT 'connected',
  last_synced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE calendar_events (  -- cached busy blocks (no titles stored)
  id bigserial PRIMARY KEY, account_id uuid REFERENCES calendar_accounts(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL, end_time timestamptz NOT NULL, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_events_range_idx ON calendar_events (start_time, end_time);
CREATE TABLE calendar_sync_logs (
  id bigserial PRIMARY KEY, account_id uuid, status text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE custom_training_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payload jsonb NOT NULL, status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id bigserial PRIMARY KEY, booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE, kind text NOT NULL,
  send_at timestamptz NOT NULL, sent_at timestamptz, UNIQUE (booking_id, kind)
);
CREATE TABLE email_logs (
  id bigserial PRIMARY KEY, to_email text NOT NULL, subject text NOT NULL, provider_id text, status text NOT NULL,
  error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, entity text, entity_id text,
  ip text, previous_value jsonb, new_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_logs (created_at DESC);
CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
