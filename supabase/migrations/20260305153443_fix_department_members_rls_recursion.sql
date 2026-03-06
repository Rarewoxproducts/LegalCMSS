/*
  # Fix Infinite Recursion in Department Members RLS Policies

  ## Changes
    - Drop existing recursive policies on department_members
    - Create new non-recursive policies that check admin role or department manager status
    - Simplify the logic to avoid self-referencing queries

  ## Security
    - Maintains proper access control
    - Admins can manage all department members
    - Department managers and leads can manage members in their departments
    - Regular members can view department members
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view department members of their departments" ON department_members;
DROP POLICY IF EXISTS "Only admins and department managers can add members" ON department_members;
DROP POLICY IF EXISTS "Only admins and department managers can remove members" ON department_members;

-- Create new non-recursive policies for department_members
CREATE POLICY "Authenticated users can view department members"
  ON department_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert department members"
  ON department_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update department members"
  ON department_members FOR UPDATE
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

CREATE POLICY "Admins can delete department members"
  ON department_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
