/*
  # Add Case Documents Table

  1. New Tables
    - `case_documents`
      - `id` (uuid, primary key)
      - `case_id` (uuid, foreign key to cases)
      - `file_name` (text)
      - `file_url` (text)
      - `file_size` (bigint)
      - `file_type` (text)
      - `uploaded_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `case_documents` table
    - Add policy for admins to insert, view, update, and delete documents
    - Add policy for lawyers to view documents for their assigned cases
    - Add policy for viewers to view documents for their assigned cases

  3. Notes
    - Files will be stored with metadata only (file_url will point to Supabase storage or external storage)
    - file_size is in bytes
    - file_type stores MIME type (e.g., 'application/pdf', 'image/jpeg')
*/

-- Create case_documents table
CREATE TABLE IF NOT EXISTS case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

-- Admins can do everything with documents
CREATE POLICY "Admins can view all documents"
  ON case_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert documents"
  ON case_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update documents"
  ON case_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete documents"
  ON case_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Lawyers and viewers can view documents for their assigned cases
CREATE POLICY "Assigned users can view case documents"
  ON case_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_assignments
      WHERE case_assignments.case_id = case_documents.case_id
      AND case_assignments.user_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_uploaded_by ON case_documents(uploaded_by);