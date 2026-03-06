'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Briefcase, Pencil, Trash2, UserPlus, Building2 } from 'lucide-react';

interface Department {
  id: string; name: string; description: string; created_at: string; updated_at: string;
  member_count?: number; case_count?: number;
}
interface DepartmentMember {
  id: string; department_id: string; user_id: string; role: string; created_at: string;
  user?: { id: string; full_name: string; email?: string; role?: string; };
}
interface Profile { id: string; full_name: string; email?: string; role?: string; }
interface Case { id: string; title: string; case_number: string; }

export default function DepartmentsPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [casesDialogOpen, setCasesDialogOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptMembers, setDeptMembers] = useState<DepartmentMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [availableCases, setAvailableCases] = useState<Case[]>([]);
  const [deptCases, setDeptCases] = useState<Case[]>([]);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [memberFormData, setMemberFormData] = useState({ user_id: '', role: 'member' as 'member' | 'lead' | 'manager' });
  const [caseFormData, setCaseFormData] = useState({ case_id: '' });

  useEffect(() => { if (profile) fetchDepartments(); }, [profile]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data: depts, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      const deptsWithCounts = await Promise.all((depts || []).map(async dept => {
        const { count: memberCount } = await supabase.from('department_members').select('*', { count: 'exact', head: true }).eq('department_id', dept.id);
        const { count: caseCount } = await supabase.from('department_cases').select('*', { count: 'exact', head: true }).eq('department_id', dept.id);
        return { ...dept, member_count: memberCount || 0, case_count: caseCount || 0 };
      }));
      setDepartments(deptsWithCounts);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await supabase.from('departments').update({ name: formData.name, description: formData.description, updated_at: new Date().toISOString() }).eq('id', editingDept.id);
      } else {
        await supabase.from('departments').insert({ name: formData.name, description: formData.description });
      }
      setDialogOpen(false);
      resetForm();
      fetchDepartments();
    } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this department? This will remove all member and case associations.')) return;
    try {
      await supabase.from('departments').delete().eq('id', id);
      fetchDepartments();
    } catch (err: any) { alert(err.message); }
  };

  const handleEdit = (dept: Department) => {
    setFormData({ name: dept.name, description: dept.description });
    setEditingDept(dept);
    setDialogOpen(true);
  };

  const resetForm = () => { setFormData({ name: '', description: '' }); setEditingDept(null); };

  const openMembersDialog = async (dept: Department) => {
    setSelectedDept(dept);
    await fetchDepartmentMembers(dept.id);
    await fetchAvailableUsers(dept.id);
    setMembersDialogOpen(true);
  };

  const openCasesDialog = async (dept: Department) => {
    setSelectedDept(dept);
    await fetchDepartmentCases(dept.id);
    await fetchAvailableCases(dept.id);
    setCasesDialogOpen(true);
  };

  const fetchDepartmentMembers = async (deptId: string) => {
    const { data } = await supabase.from('department_members').select('*, profiles:user_id (id, full_name, role)').eq('department_id', deptId);
    setDeptMembers((data || []).map((m: any) => ({ ...m, user: m.profiles })));
  };

  const fetchAvailableUsers = async (deptId: string) => {
    const { data: allUsers } = await supabase.from('profiles').select('*');
    const { data: existing } = await supabase.from('department_members').select('user_id').eq('department_id', deptId);
    const existingIds = (existing || []).map((m: any) => m.user_id);
    setAvailableUsers((allUsers || []).filter(u => !existingIds.includes(u.id)));
  };

  const fetchDepartmentCases = async (deptId: string) => {
    const { data } = await supabase.from('department_cases').select('*, cases:case_id (id, title, case_number)').eq('department_id', deptId);
    setDeptCases((data || []).map((dc: any) => dc.cases));
  };

  const fetchAvailableCases = async (deptId: string) => {
    const { data: allCases } = await supabase.from('cases').select('*');
    const { data: assigned } = await supabase.from('department_cases').select('case_id').eq('department_id', deptId);
    const assignedIds = (assigned || []).map((c: any) => c.case_id);
    setAvailableCases((allCases || []).filter(c => !assignedIds.includes(c.id)));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !memberFormData.user_id) return;
    try {
      await supabase.from('department_members').insert({ department_id: selectedDept.id, user_id: memberFormData.user_id, role: memberFormData.role });
      setMemberFormData({ user_id: '', role: 'member' });
      fetchDepartmentMembers(selectedDept.id);
      fetchAvailableUsers(selectedDept.id);
      fetchDepartments();
    } catch (err: any) { alert(err.message); }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedDept) return;
    try {
      await supabase.from('department_members').delete().eq('id', memberId);
      fetchDepartmentMembers(selectedDept.id);
      fetchAvailableUsers(selectedDept.id);
      fetchDepartments();
    } catch (err: any) { alert(err.message); }
  };

  const handleAssignCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !caseFormData.case_id) return;
    try {
      await supabase.from('department_cases').insert({ department_id: selectedDept.id, case_id: caseFormData.case_id });
      setCaseFormData({ case_id: '' });
      fetchDepartmentCases(selectedDept.id);
      fetchAvailableCases(selectedDept.id);
      fetchDepartments();
    } catch (err: any) { alert(err.message); }
  };

  const handleUnassignCase = async (caseId: string) => {
    if (!selectedDept) return;
    try {
      await supabase.from('department_cases').delete().eq('department_id', selectedDept.id).eq('case_id', caseId);
      fetchDepartmentCases(selectedDept.id);
      fetchAvailableCases(selectedDept.id);
      fetchDepartments();
    } catch (err: any) { alert(err.message); }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5"><div className="h-7 w-36 bg-slate-100 animate-pulse rounded" /><div className="h-4 w-56 bg-slate-100 animate-pulse rounded" /></div>
          <div className="h-9 w-36 bg-slate-100 animate-pulse rounded" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Departments</h2>
          <p className="text-sm text-slate-500 mt-0.5">Organize users into departments and manage case access</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDept ? 'Edit Department' : 'Create Department'}</DialogTitle>
              <DialogDescription>{editingDept ? 'Update department details' : 'Add a new department to organize your team'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Department Name *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g., Litigation, Corporate, Family Law" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="resize-none" placeholder="Brief description of the department's focus" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800">{editingDept ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 className="w-12 h-12 mb-3 text-slate-300" />
          <p className="text-sm">No departments created yet</p>
          <p className="text-xs mt-1 text-slate-300">Create your first department to get started</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {departments.map(dept => (
            <div key={dept.id} className="bg-white rounded-xl border border-slate-100 hover:shadow-md transition-shadow overflow-hidden group">
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(dept)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(dept.id)} className="h-7 w-7 p-0 text-red-300 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">{dept.name}</h3>
                {dept.description && <p className="text-xs text-slate-500 line-clamp-2">{dept.description}</p>}
              </div>
              <div className="border-t border-slate-50 px-5 py-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{dept.member_count} {dept.member_count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200" onClick={() => openMembersDialog(dept)}>
                    Manage
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>{dept.case_count} {dept.case_count === 1 ? 'case' : 'cases'}</span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200" onClick={() => openCasesDialog(dept)}>
                    Manage
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Members — {selectedDept?.name}</DialogTitle>
            <DialogDescription>Add or remove members from this department</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-3 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-medium text-slate-600">Add Member</Label>
                <Select value={memberFormData.user_id} onValueChange={v => setMemberFormData({...memberFormData, user_id: v})}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">Role</Label>
                <Select value={memberFormData.role} onValueChange={(v: any) => setMemberFormData({...memberFormData, role: v})}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={!memberFormData.user_id} className="w-full bg-slate-900 hover:bg-slate-800">
              <UserPlus className="w-4 h-4 mr-2" />Add Member
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Current Members ({deptMembers.length})</p>
            {deptMembers.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No members in this department</p>
            ) : (
              deptMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-700">
                      {member.user?.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{member.user?.full_name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded capitalize">{member.role}</span>
                        <span className="text-[10px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded capitalize">{member.user?.role}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)} className="h-7 text-xs text-red-400 hover:text-red-600 hover:bg-red-50">Remove</Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={casesDialogOpen} onOpenChange={setCasesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cases — {selectedDept?.name}</DialogTitle>
            <DialogDescription>Assign or unassign cases to this department</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignCase} className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Assign Case</Label>
              <Select value={caseFormData.case_id} onValueChange={v => setCaseFormData({ case_id: v })}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select case" /></SelectTrigger>
                <SelectContent>
                  {availableCases.map(c => <SelectItem key={c.id} value={c.id}>{c.case_number} — {c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!caseFormData.case_id} className="w-full bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" />Assign Case
            </Button>
          </form>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Assigned Cases ({deptCases.length})</p>
            {deptCases.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No cases assigned to this department</p>
            ) : (
              deptCases.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs font-mono text-slate-400">{c.case_number}</p>
                    <p className="text-sm font-medium text-slate-800">{c.title}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleUnassignCase(c.id)} className="h-7 text-xs text-red-400 hover:text-red-600 hover:bg-red-50">Unassign</Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
