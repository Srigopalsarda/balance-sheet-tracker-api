-- Add Google authentication fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id TEXT,
ADD COLUMN IF NOT EXISTS google_name TEXT,
ADD COLUMN IF NOT EXISTS google_picture TEXT; 