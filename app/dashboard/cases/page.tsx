'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase, Case, Profile } from '@/lib/supabase';
import { queryCache } from '@/lib/query-cache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Calendar, FolderOpen, X } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getRoleLabel } from '@/lib/utils';

export default function CasesPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>('all');
  const [users, setUsers] = useState<Profile[]>([]);
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    client_name: '',
    case_type: '',
    description: '',
    status: 'open' as 'open' | 'in_progress' | 'closed',
    assigned_users: [] as string[],
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCases();
    if (profile?.role === 'admin') fetchUsers();
  }, [profile]);

  useEffect(() => {
    let filtered = cases;
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
    if (caseTypeFilter !== 'all') filtered = filtered.filter(c => c.case_type === caseTypeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.case_number.toLowerCase().includes(q) ||
        c.client_name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    if (dateFrom) filtered = filtered.filter(c => new Date(c.created_at) >= new Date(dateFrom));
    if (dateTo) filtered = filtered.filter(c => new Date(c.created_at) <= new Date(dateTo));
    setFilteredCases(filtered);
  }, [statusFilter, caseTypeFilter, searchQuery, dateFrom, dateTo, cases]);

  const caseTypes = Array.from(new Set(cases.map(c => c.case_type).filter(Boolean)));

  const clearFilters = () => {
    setStatusFilter('all');
    setCaseTypeFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = statusFilter !== 'all' || caseTypeFilter !== 'all' || searchQuery || dateFrom || dateTo;

  const fetchCases = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const cacheKey = `cases-${profile.id}-${profile.role}`;
      const data = await queryCache.fetch(cacheKey, async () => {
        let q = supabase.from('cases').select('*');
        if (profile.role !== 'admin') {
          const { data: assignments } = await supabase
            .from('case_assignments').select('case_id').eq('user_id', profile.id);
          const ids = assignments?.map(a => a.case_id) || [];
          if (ids.length === 0) return [];
          q = q.in('id', ids);
        }
        const { data, error } = await q.order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }, 15000);
      setCases(data);
      setFilteredCases(data);
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await queryCache.fetch('all-users', async () => {
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) throw error;
        return data || [];
      }, 30000);
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .insert({
          case_number: formData.case_number,
          title: formData.title,
          client_name: formData.client_name,
          case_type: formData.case_type,
          description: formData.description,
          status: formData.status,
          created_by: profile?.id,
        })
        .select()
        .single();
      if (caseError) throw caseError;
      if (formData.assigned_users.length > 0 && caseData) {
        await supabase.from('case_assignments').insert(
          formData.assigned_users.map(userId => ({ case_id: caseData.id, user_id: userId }))
        );
      }
      setDialogOpen(false);
      setFormData({ case_number: '', title: '', client_name: '', case_type: '', description: '', status: 'open', assigned_users: [] });
      queryCache.invalidatePattern('cases');
      queryCache.invalidatePattern('dashboard');
      fetchCases();
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const toggleUserAssignment = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_users: prev.assigned_users.includes(userId)
        ? prev.assigned_users.filter(id => id !== userId)
        : [...prev.assigned_users, userId],
    }));
  };

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-amber-50 text-amber-700 border-amber-200',
      in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
      closed: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return styles[status] || styles.open;
  };

  const formatStatus = (status: string) =>
    status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-7 w-28 mb-1.5" /><Skeleton className="h-4 w-52" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}</div>
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cases</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage and track all legal cases</p>
        </div>
        {profile?.role === 'admin' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800 text-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Case
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Case</DialogTitle>
                <DialogDescription>Add a new case to the system</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCase} className="space-y-4 mt-2">
                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">{error}</div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="case_number" className="text-xs font-medium text-slate-600">Case Number</Label>
                    <Input id="case_number" value={formData.case_number} onChange={e => setFormData({...formData, case_number: e.target.value})} required disabled={creating} placeholder="e.g., CASE-2024-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="status" className="text-xs font-medium text-slate-600">Status</Label>
                    <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})} disabled={creating}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-xs font-medium text-slate-600">Case Title</Label>
                  <Input id="title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required disabled={creating} placeholder="Brief title of the case" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="client_name" className="text-xs font-medium text-slate-600">Client Name</Label>
                    <Input id="client_name" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required disabled={creating} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="case_type" className="text-xs font-medium text-slate-600">Case Type</Label>
                    <Input id="case_type" value={formData.case_type} onChange={e => setFormData({...formData, case_type: e.target.value})} required disabled={creating} placeholder="e.g., Civil, Criminal, Corporate" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-medium text-slate-600">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required disabled={creating} rows={4} placeholder="Detailed description of the case" />
                </div>
                {users.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Assign To</Label>
                    <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                      {users.map(user => (
                        <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={formData.assigned_users.includes(user.id)} onChange={() => toggleUserAssignment(user.id)} disabled={creating} className="rounded border-slate-300" />
                          <span className="text-sm text-slate-800">{user.full_name} <span className="text-slate-400">({getRoleLabel(user.role)})</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Case'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by title, case number, client, or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-50 border-slate-200 focus:bg-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Case Type</Label>
            <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
              <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {caseTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">From Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="pl-8 h-9 text-sm border-slate-200 bg-slate-50" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To Date</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="pl-8 h-9 text-sm border-slate-200 bg-slate-50" />
            </div>
          </div>
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">
            All Cases
            <span className="ml-2 text-xs font-normal text-slate-400">({filteredCases.length})</span>
          </h3>
        </div>
        {filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No cases found</p>
            {hasFilters && <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:text-blue-600">Clear filters</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="px-5 py-3 font-semibold">Case</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Client</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Type</th>
                  <th className="px-5 py-3 font-semibold hidden lg:table-cell">Created</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCases.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/dashboard/cases/${c.id}`}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{c.case_number}</p>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-sm text-slate-600">{c.client_name}</p>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <p className="text-sm text-slate-500">{c.case_type}</p>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <p className="text-sm text-slate-500">{format(new Date(c.created_at), 'dd MMM yyyy')}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusStyle(c.status)}`}>
                        {formatStatus(c.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
