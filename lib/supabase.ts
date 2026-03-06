import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = Object.assign(
  createClient(supabaseUrl, supabaseAnonKey),
  {
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  }
);

export type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'lawyer' | 'viewer';
  created_at: string;
  is_external?: boolean;
  access_expires_at?: string | null;
};

export type Case = {
  id: string;
  case_number: string;
  title: string;
  client_name: string;
  case_type: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  notes: Array<{
    id: string;
    text: string;
    created_by: string;
    created_at: string;
  }>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseAssignment = {
  id: string;
  case_id: string;
  user_id: string;
  assigned_at: string;
};

export type CaseDocument = {
  id: string;
  case_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  created_at: string;
  current_version?: number;
  tags?: string[];
  indexed_content?: string;
};

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  case_id: string | null;
  all_day: boolean;
  status: string;
  priority: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
