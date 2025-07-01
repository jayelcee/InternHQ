-- Add metadata column to time_log_edit_requests table
-- This column will store JSON metadata for continuous session edit requests

ALTER TABLE time_log_edit_requests 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_time_log_edit_requests_metadata 
ON time_log_edit_requests USING GIN (metadata);
