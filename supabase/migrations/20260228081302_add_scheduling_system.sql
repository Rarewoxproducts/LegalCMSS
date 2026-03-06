/*
  # Add Scheduling System

  1. New Tables
    - `schedule_items`
      - `id` (uuid, primary key)
      - `title` (text) - Title of the scheduled item
      - `description` (text) - Detailed description
      - `type` (text) - Type: 'task', 'event', 'hearing', 'meeting', 'deadline', 'other'
      - `start_date` (timestamptz) - Start date and time
      - `end_date` (timestamptz) - Optional end date and time
      - `location` (text) - Optional location/venue
      - `case_id` (uuid) - Optional link to a case
      - `created_by` (uuid) - Admin who created this
      - `all_day` (boolean) - Whether this is an all-day event
      - `status` (text) - Status: 'scheduled', 'completed', 'cancelled'
      - `priority` (text) - Priority: 'low', 'medium', 'high', 'urgent'
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `schedule_assignments`
      - `id` (uuid, primary key)
      - `schedule_item_id` (uuid) - Link to schedule_items
      - `user_id` (uuid) - User assigned to this schedule item
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Admins can create, read, update, and delete all schedule items
    - Users can read schedule items assigned to them
    - Users cannot modify schedule items

  3. Indexes
    - Index on schedule_items.start_date for efficient date queries
    - Index on schedule_assignments.user_id for efficient user lookups
    - Index on schedule_items.case_id for case-related queries
*/

-- Create schedule_items table
CREATE TABLE IF NOT EXISTS schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'event', 'hearing', 'meeting', 'deadline', 'other')),
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  location text DEFAULT '',
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  all_day boolean DEFAULT false,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create schedule_assignments table
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_item_id uuid NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(schedule_item_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_items_start_date ON schedule_items(start_date);
CREATE INDEX IF NOT EXISTS idx_schedule_items_case_id ON schedule_items(case_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_created_by ON schedule_items(created_by);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_user_id ON schedule_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_schedule_item_id ON schedule_assignments(schedule_item_id);

-- Add updated_at trigger for schedule_items
CREATE OR REPLACE FUNCTION update_schedule_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_items_updated_at ON schedule_items;
CREATE TRIGGER schedule_items_updated_at
  BEFORE UPDATE ON schedule_items
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_items_updated_at();

-- Enable RLS
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_items

-- Admins can view all schedule items
CREATE POLICY "Admins can view all schedule items"
  ON schedule_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view schedule items assigned to them
CREATE POLICY "Users can view assigned schedule items"
  ON schedule_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedule_assignments
      WHERE schedule_assignments.schedule_item_id = schedule_items.id
      AND schedule_assignments.user_id = auth.uid()
    )
  );

-- Admins can insert schedule items
CREATE POLICY "Admins can insert schedule items"
  ON schedule_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update schedule items
CREATE POLICY "Admins can update schedule items"
  ON schedule_items FOR UPDATE
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

-- Admins can delete schedule items
CREATE POLICY "Admins can delete schedule items"
  ON schedule_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for schedule_assignments

-- Admins can view all assignments
CREATE POLICY "Admins can view all schedule assignments"
  ON schedule_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own assignments
CREATE POLICY "Users can view own schedule assignments"
  ON schedule_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can insert assignments
CREATE POLICY "Admins can insert schedule assignments"
  ON schedule_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete assignments
CREATE POLICY "Admins can delete schedule assignments"
  ON schedule_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );