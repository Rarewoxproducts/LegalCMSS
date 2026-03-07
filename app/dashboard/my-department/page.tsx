'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, MessageSquare, ChevronRight, Crown, Shield } from 'lucide-react';
import Link from 'next/link';

interface MyDepartment {
  id: string;
  name: string;
  description: string;
  myRole: string;
  memberCount: number;
  created_at: string;
}

const roleIconMap: Record<string, React.ReactNode> = {
  manager: <Crown className="w-3.5 h-3.5 text-amber-500" />,
  lead: <Shield className="w-3.5 h-3.5 text-blue-500" />,
  member: <Users className="w-3.5 h-3.5 text-slate-400" />,
};

const roleLabelMap: Record<string, string> = {
  manager: 'Manager',
  lead: 'Lead',
  member: 'Member',
};

const roleColorMap: Record<string, string> = {
  manager: 'bg-amber-50 text-amber-700 border border-amber-200',
  lead: 'bg-blue-50 text-blue-700 border border-blue-200',
  member: 'bg-slate-50 text-slate-600 border border-slate-200',
};

export default function MyDepartmentPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<MyDepartment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchMyDepartments();
  }, [profile]);

  const fetchMyDepartments = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: memberships, error } = await supabase
        .from('department_members')
        .select('role, departments(id, name, description, created_at)')
        .eq('user_id', profile.id);

      if (error) throw error;

      const deptIds = memberships?.map((m: any) => m.departments?.id).filter(Boolean) || [];

      let memberCounts: Record<string, number> = {};
      if (deptIds.length > 0) {
        const { data: counts } = await supabase
          .from('department_members')
          .select('department_id')
          .in('department_id', deptIds);
        (counts || []).forEach((c: any) => {
          memberCounts[c.department_id] = (memberCounts[c.department_id] || 0) + 1;
        });
      }

      const result: MyDepartment[] = (memberships || [])
        .filter((m: any) => m.departments)
        .map((m: any) => ({
          id: m.departments.id,
          name: m.departments.name,
          description: m.departments.description,
          myRole: m.role,
          memberCount: memberCounts[m.departments.id] || 1,
          created_at: m.departments.created_at,
        }));

      setDepartments(result);
    } catch (err) {
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-44 mb-1.5" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Team</h2>
        <p className="text-sm text-slate-500 mt-0.5">Teams you belong to — click to open the chat room</p>
      </div>

      {departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-base font-semibold text-slate-700">Not in any team yet</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Ask your Head Legal to add you to a team. Once added, you can chat with your team here.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(dept => (
            <Link
              key={dept.id}
              href={`/dashboard/my-department/${dept.id}`}
              className="group bg-white rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
            >
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors duration-200">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${roleColorMap[dept.myRole] || roleColorMap.member}`}>
                    {roleIconMap[dept.myRole] || roleIconMap.member}
                    {roleLabelMap[dept.myRole] || dept.myRole}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">
                  {dept.name}
                </h3>
                {dept.description && (
                  <p className="text-sm text-slate-500 line-clamp-2">{dept.description}</p>
                )}
              </div>
              <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {dept.memberCount} {dept.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Open Chat
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
