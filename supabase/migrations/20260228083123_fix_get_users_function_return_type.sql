/*
  # Fix get_users_with_emails function return type
  
  1. Changes
    - Drop and recreate the function with correct return types matching auth.users schema
    - Use varchar for email to match auth.users.email column type
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_users_with_emails();

-- Recreate with correct return type
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  id uuid,
  full_name text,
  email varchar,
  role text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can access user emails';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    u.email,
    p.role
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name;
END;
$$;

-- Grant execute to authenticated users (function will check for admin role internally)
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;