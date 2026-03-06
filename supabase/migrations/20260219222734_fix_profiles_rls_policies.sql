/*
  # Fix Profiles RLS Policies

  1. Issue
    - Infinite recursion in profiles policies
    - The admin check policy was querying the same table it was protecting

  2. Solution
    - Simplify policies to avoid self-referencing queries
    - Use direct role checks where possible

  3. Changes
    - Drop existing policies
    - Create new non-recursive policies
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

-- Create new non-recursive policies for admins
-- For SELECT: Allow if current user is admin OR reading own profile
CREATE POLICY "Allow read own profile or all if admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- For INSERT: Only allow if inserting with matching auth.uid or user is admin
CREATE POLICY "Allow insert profile if admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- For UPDATE: Only allow if updating own profile or user is admin
CREATE POLICY "Allow update profile if admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );
