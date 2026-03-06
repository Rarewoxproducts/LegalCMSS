/*
  # Allow admins to create user profiles

  1. Changes
    - Add INSERT policy for admins to create profiles for any user
    - This allows admins to create new users through the admin interface
  
  2. Security
    - Only authenticated users with admin role can insert profiles for others
    - Regular users can still only insert their own profile
*/

CREATE POLICY "Admins can insert any profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );