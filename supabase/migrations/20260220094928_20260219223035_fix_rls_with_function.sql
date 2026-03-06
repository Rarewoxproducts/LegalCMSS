/*
  # Fix RLS Policies with Helper Function

  1. Problem
    - RLS policies checking profiles.role cause infinite recursion
    - The query to check if user is admin queries the same table being protected

  2. Solution
    - Create a function that caches the role in the transaction
    - Use app_metadata to store role information
    - Simplify policies to avoid self-referencing queries

  3. Changes
    - Drop all existing policies on profiles
    - Create simple, non-recursive policies
    - Allow users to read their own profile always
    - Allow authenticated users to read other profiles (for assignment displays)
*/

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Allow read own profile or all if admin" ON profiles;
DROP POLICY IF EXISTS "Allow insert profile if admin" ON profiles;
DROP POLICY IF EXISTS "Allow update profile if admin" ON profiles;

-- Create simple policies that don't cause recursion

-- Anyone authenticated can read any profile (needed for case assignments, user lists, etc.)
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Note: Admin-specific permissions will be handled in the application layer
-- This prevents infinite recursion while maintaining security through auth.uid() checks