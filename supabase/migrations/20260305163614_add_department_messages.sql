/*
  # Add Department Messages Table

  ## Summary
  Creates a real-time chat system for department members.

  ## New Tables
  - `department_messages`
    - `id` (uuid, primary key)
    - `department_id` (uuid, FK → departments)
    - `user_id` (uuid, FK → profiles)
    - `content` (text, message body)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Members can read messages in their departments
  - Members can insert their own messages
  - Users can delete their own messages
  - Admins can delete any message
*/

CREATE TABLE IF NOT EXISTS department_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_department_messages_department_id ON department_messages(department_id);
CREATE INDEX IF NOT EXISTS idx_department_messages_created_at ON department_messages(created_at);

ALTER TABLE department_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Department members can read messages"
  ON department_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM department_members
      WHERE department_members.department_id = department_messages.department_id
        AND department_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Department members can send messages"
  ON department_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM department_members
        WHERE department_members.department_id = department_messages.department_id
          AND department_members.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
  );

CREATE POLICY "Users can delete own messages"
  ON department_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any message"
  ON department_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
