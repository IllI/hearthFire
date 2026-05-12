ALTER TABLE delivery_schedules
  ADD COLUMN IF NOT EXISTS slots JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS time_slots JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS zip_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS location_details JSONB,
  ADD COLUMN IF NOT EXISTS cutoff_time TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_delivery_schedules_schedule_date
  ON delivery_schedules (schedule_date);

CREATE INDEX IF NOT EXISTS idx_delivery_schedules_type_active
  ON delivery_schedules (type, is_active);
