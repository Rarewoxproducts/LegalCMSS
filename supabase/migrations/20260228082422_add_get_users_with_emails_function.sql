/*
  # Add function to get users with emails for admins

  1. New Functions
    - `get_users_with_emails()` - Returns profiles joined with auth.users emails
  
  2. Security
    - Function is marked as SECURITY DEFINER to allow reading auth.users
    - Only accessible to authenticated admin users
*/

-- Create function to get users with their emails
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
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
    COALESCE(u.email, 'No email') as email,
    p.role
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name;
END;
$$;