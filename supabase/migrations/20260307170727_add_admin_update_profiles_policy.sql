/*
  # Add admin update policy for profiles

  ## Problem
  Admins were unable to update other users' profiles because the only UPDATE
  policy restricted updates to a user's own row (id = auth.uid()).

  ## Changes
  - Add "Admins can update any profile" UPDATE policy on the profiles table
    allowing admin users to update any row.
*/

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
