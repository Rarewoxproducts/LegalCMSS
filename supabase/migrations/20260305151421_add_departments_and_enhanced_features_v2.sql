/*
  # Enhanced Legal Case Management System - Departments, Reporting & Advanced Features

  ## 1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `department_members`
      - `id` (uuid, primary key)
      - `department_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `role` (text) - e.g., 'member', 'lead', 'manager'
      - `created_at` (timestamptz)
    
    - `department_cases`
      - `id` (uuid, primary key)
      - `department_id` (uuid, foreign key)
      - `case_id` (uuid, foreign key)
      - `created_at` (timestamptz)
    
    - `document_versions`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key)
      - `version_number` (integer)
      - `file_path` (text)
      - `file_name` (text)
      - `file_size` (bigint)
      - `uploaded_by` (uuid, foreign key)
      - `created_at` (timestamptz)
      - `change_notes` (text)

  ## 2. Modified Tables
    - `profiles`
      - Add `access_expires_at` (timestamptz) - for temporary access
      - Add `is_external` (boolean) - for external counsel/parties
    
    - `case_documents`
      - Add `current_version` (integer)
      - Add `tags` (text array) - for better search
      - Add `indexed_content` (text) - for full-text search

  ## 3. Security
    - Enable RLS on all new tables
    - Add policies for department-based access
    - Add policies for document versioning
    - Add policies for temporary access control

  ## 4. Indexes
    - Add performance indexes for searching and filtering
    - Add full-text search indexes for documents
    - Add indexes for date range queries

  ## 5. Functions
    - Create function for department access checking
    - Create function for document search
*/

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Create department_members junction table
CREATE TABLE IF NOT EXISTS department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(department_id, user_id)
);

ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;

-- Create department_cases junction table
CREATE TABLE IF NOT EXISTS department_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(department_id, case_id)
);

ALTER TABLE department_cases ENABLE ROW LEVEL SECURITY;

-- Create document_versions table
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES case_documents(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  uploaded_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  change_notes text DEFAULT '',
  UNIQUE(document_id, version_number)
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Add columns to profiles for temporary/external access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'access_expires_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN access_expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_external'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_external boolean DEFAULT false;
  END IF;
END $$;

-- Add columns to case_documents for versioning and search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_documents' AND column_name = 'current_version'
  ) THEN
    ALTER TABLE case_documents ADD COLUMN current_version integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_documents' AND column_name = 'tags'
  ) THEN
    ALTER TABLE case_documents ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_documents' AND column_name = 'indexed_content'
  ) THEN
    ALTER TABLE case_documents ADD COLUMN indexed_content text DEFAULT '';
  END IF;
END $$;

-- Create function to check if user has department access to a case
CREATE OR REPLACE FUNCTION has_department_access_to_case(user_id uuid, case_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM department_cases dc
    INNER JOIN department_members dm ON dc.department_id = dm.department_id
    WHERE dc.case_id = has_department_access_to_case.case_id
      AND dm.user_id = has_department_access_to_case.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user's access has expired
CREATE OR REPLACE FUNCTION access_is_valid(user_id uuid)
RETURNS boolean AS $$
DECLARE
  expires_at timestamptz;
BEGIN
  SELECT access_expires_at INTO expires_at
  FROM profiles
  WHERE id = user_id;
  
  RETURN expires_at IS NULL OR expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for departments
CREATE POLICY "Authenticated users can view all departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for department_members
CREATE POLICY "Users can view department members of their departments"
  ON department_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM department_members dm
      WHERE dm.department_id = department_members.department_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins and department managers can add members"
  ON department_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_members
      WHERE department_id = department_members.department_id
        AND user_id = auth.uid()
        AND role IN ('manager', 'lead')
    )
  );

CREATE POLICY "Only admins and department managers can remove members"
  ON department_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_members dm
      WHERE dm.department_id = department_members.department_id
        AND dm.user_id = auth.uid()
        AND dm.role IN ('manager', 'lead')
    )
  );

-- RLS Policies for department_cases
CREATE POLICY "Users can view department cases of their departments"
  ON department_cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM department_members dm
      WHERE dm.department_id = department_cases.department_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins and department managers can assign cases"
  ON department_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_members
      WHERE department_id = department_cases.department_id
        AND user_id = auth.uid()
        AND role IN ('manager', 'lead')
    )
  );

CREATE POLICY "Only admins and department managers can unassign cases"
  ON department_cases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM department_members dm
      WHERE dm.department_id = department_cases.department_id
        AND dm.user_id = auth.uid()
        AND dm.role IN ('manager', 'lead')
    )
  );

-- RLS Policies for document_versions
CREATE POLICY "Users can view document versions if they have case access"
  ON document_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM case_documents cd
      INNER JOIN cases c ON cd.case_id = c.id
      WHERE cd.id = document_versions.document_id
        AND (
          c.created_by = auth.uid()
          OR has_department_access_to_case(auth.uid(), c.id)
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY "Users can create document versions if they have case access"
  ON document_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM case_documents cd
      INNER JOIN cases c ON cd.case_id = c.id
      WHERE cd.id = document_versions.document_id
        AND (
          c.created_by = auth.uid()
          OR has_department_access_to_case(auth.uid(), c.id)
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_department_members_user_id ON department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_department_members_department_id ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_department_cases_case_id ON department_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_department_cases_department_id ON department_cases(department_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_profiles_access_expires_at ON profiles(access_expires_at) WHERE access_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_is_external ON profiles(is_external);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_schedule_items_start_date ON schedule_items(start_date);
CREATE INDEX IF NOT EXISTS idx_schedule_items_end_date ON schedule_items(end_date);

-- Create GIN index for array search on tags
CREATE INDEX IF NOT EXISTS idx_case_documents_tags ON case_documents USING GIN(tags);

-- Create full-text search index for documents
CREATE INDEX IF NOT EXISTS idx_case_documents_search ON case_documents USING GIN(to_tsvector('english', indexed_content));
