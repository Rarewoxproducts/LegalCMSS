/*
  # Performance Optimization - Add Missing Indexes

  1. New Indexes
    - Add index on case_documents(case_id) for faster document lookups
    - Add index on case_documents(uploaded_by) for user document queries
    - Add composite index on case_assignments(user_id, case_id) for assignment lookups
    - Add index on cases(created_at) for sorting recent cases

  2. Important Notes
    - These indexes will significantly speed up common queries
    - No data changes, only performance improvements
    - Indexes are created with IF NOT EXISTS for safety
*/

-- Add indexes for case_documents table
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_uploaded_by ON case_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_case_documents_created_at ON case_documents(created_at DESC);

-- Add composite index for case_assignments lookups
CREATE INDEX IF NOT EXISTS idx_case_assignments_user_case ON case_assignments(user_id, case_id);

-- Add index for cases sorting by created_at
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases(updated_at DESC);