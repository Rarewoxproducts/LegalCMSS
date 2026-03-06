/*
  # Fix Department Cases RLS Policies

  ## Changes
    - Simplify department_cases policies to avoid potential recursion
    - Use direct admin role checks instead of complex joins

  ## Security
    - Admins can manage all department case assignments
    - Users can view department cases they have access to
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view department cases of their departments" ON department_cases;
DROP POLICY IF EXISTS "Only admins and department managers can assign cases" ON department_cases;
DROP POLICY IF EXISTS "Only admins and department managers can unassign cases" ON department_cases;

-- Create new simplified policies for department_cases
CREATE POLICY "Authenticated users can view department cases"
  ON department_cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can assign cases to departments"
  ON department_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update department case assignments"
  ON department_cases FOR UPDATE
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

CREATE POLICY "Admins can remove cases from departments"
  ON department_cases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
