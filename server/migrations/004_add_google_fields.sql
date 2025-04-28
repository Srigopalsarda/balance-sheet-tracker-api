-- Add Google-specific fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_name text,
ADD COLUMN IF NOT EXISTS google_picture text; 