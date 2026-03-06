'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, MapPin, Plus, Pencil, Trash2, Users, FileText, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface ScheduleItem {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'event' | 'hearing' | 'meeting' | 'deadline' | 'other';
  start_date: string;
  end_date: string | null;
  location: string;
  case_id: string | null;
  all_day: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes: string;
  created_at: string;
  updated_at: string;
  assigned_users?: { id: string; full_name: string; email: string }[];
  case_title?: string;
}

interface Profile { id: string; full_name: string; email: string; role?: string; }
interface Case { id: string; title: string; }

export default function SchedulePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formData, setFormData] = useState({
    title: '', description: '', type: 'task' as ScheduleItem['type'],
    start_date: '', start_time: '', end_date: '', end_time: '',
    location: '', case_id: 'none', all_day: false,
    status: 'scheduled' as ScheduleItem['status'],
    priority: 'medium' as ScheduleItem['priority'],
    notes: '', assigned_user_ids: [] as string[],
  });

  useEffect(() => {
    if (profile?.role !== 'admin') { router.push('/dashboard/my-schedule'); return; }
    fetchScheduleItems();
    fetchUsers();
    fetchCases();
  }, [profile]);

  const fetchScheduleItems = async () => {
    setLoading(true);
    const { data: items, error } = await supabase.from('schedule_items').select('*, cases(title)').order('start_date', { ascending: true });
    if (error) { setLoading(false); return; }

    const itemsWithAssignments = await Promise.all(
      (items || []).map(async item => {
        const { data: assignments } = await supabase.from('schedule_assignments').select('user_id, profiles(id, full_name, role)').eq('schedule_item_id', item.id);
        return { ...item, case_title: item.cases?.title, assigned_users: assignments?.map((a: any) => a.profiles) || [] };
      })
    );
    setScheduleItems(itemsWithAssignments);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc('get_users_with_emails');
    if (!error) setUsers(data || []);
  };

  const fetchCases = async () => {
    const { data } = await supabase.from('cases').select('id, title').order('title');
    setCases(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = formData.all_day ? new Date(formData.start_date).toISOString() : new Date(`${formData.start_date}T${formData.start_time}`).toISOString();
    const endDateTime = formData.end_date ? formData.all_day ? new Date(formData.end_date).toISOString() : new Date(`${formData.end_date}T${formData.end_time || '00:00'}`).toISOString() : null;
    const itemData = { title: formData.title, description: formData.description, type: formData.type, start_date: startDateTime, end_date: endDateTime, location: formData.location, case_id: formData.case_id === 'none' ? null : formData.case_id, all_day: formData.all_day, status: formData.status, priority: formData.priority, notes: formData.notes, created_by: profile?.id };

    if (editingItem) {
      await supabase.from('schedule_items').update(itemData).eq('id', editingItem.id);
      await supabase.from('schedule_assignments').delete().eq('schedule_item_id', editingItem.id);
      if (formData.assigned_user_ids.length > 0) await supabase.from('schedule_assignments').insert(formData.assigned_user_ids.map(userId => ({ schedule_item_id: editingItem.id, user_id: userId })));
    } else {
      const { data: newItem } = await supabase.from('schedule_items').insert(itemData).select().single();
      if (newItem && formData.assigned_user_ids.length > 0) await supabase.from('schedule_assignments').insert(formData.assigned_user_ids.map(userId => ({ schedule_item_id: newItem.id, user_id: userId })));
    }
    resetForm();
    setDialogOpen(false);
    fetchScheduleItems();
  };

  const handleEdit = async (item: ScheduleItem) => {
    const { data: assignments } = await supabase.from('schedule_assignments').select('user_id').eq('schedule_item_id', item.id);
    const startDate = new Date(item.start_date);
    const endDate = item.end_date ? new Date(item.end_date) : null;
    setFormData({ title: item.title, description: item.description, type: item.type, start_date: format(startDate, 'yyyy-MM-dd'), start_time: item.all_day ? '' : format(startDate, 'HH:mm'), end_date: endDate ? format(endDate, 'yyyy-MM-dd') : '', end_time: endDate && !item.all_day ? format(endDate, 'HH:mm') : '', location: item.location, case_id: item.case_id || 'none', all_day: item.all_day, status: item.status, priority: item.priority, notes: item.notes, assigned_user_ids: assignments?.map((a: any) => a.user_id) || [] });
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule item?')) return;
    await supabase.from('schedule_items').delete().eq('id', id);
    fetchScheduleItems();
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', type: 'task', start_date: '', start_time: '', end_date: '', end_time: '', location: '', case_id: 'none', all_day: false, status: 'scheduled', priority: 'medium', notes: '', assigned_user_ids: [] });
    setEditingItem(null);
  };

  const toggleUserAssignment = (userId: string) => {
    setFormData(prev => ({ ...prev, assigned_user_ids: prev.assigned_user_ids.includes(userId) ? prev.assigned_user_ids.filter(id => id !== userId) : [...prev.assigned_user_ids, userId] }));
  };

  const typeColors: Record<string, string> = {
    task: 'bg-blue-50 text-blue-700 border-blue-200',
    event: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hearing: 'bg-red-50 text-red-700 border-red-200',
    meeting: 'bg-amber-50 text-amber-700 border-amber-200',
    deadline: 'bg-orange-50 text-orange-700 border-orange-200',
    other: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  const typeAccentColors: Record<string, string> = {
    task: 'bg-blue-500',
    event: 'bg-emerald-500',
    hearing: 'bg-red-500',
    meeting: 'bg-amber-500',
    deadline: 'bg-orange-500',
    other: 'bg-slate-400',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-50 text-slate-500 border-slate-200',
    medium: 'bg-blue-50 text-blue-600 border-blue-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    urgent: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-slate-50 text-slate-500 border-slate-200',
  };

  const filteredItems = scheduleItems.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q) || item.case_title?.toLowerCase().includes(q))) return false;
    }
    if (dateFrom && new Date(item.start_date) < new Date(dateFrom)) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); if (new Date(item.start_date) > to) return false; }
    return true;
  });

  const clearFilters = () => { setFilterType('all'); setFilterStatus('all'); setSearchQuery(''); setDateFrom(''); setDateTo(''); };
  const hasFilters = filterType !== 'all' || filterStatus !== 'all' || searchQuery || dateFrom || dateTo;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 animate-pulse rounded" />
        <div className="h-32 bg-slate-100 animate-pulse rounded-xl" />
        {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Schedule</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage tasks, events, hearings, and deadlines</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Schedule Item' : 'Create Schedule Item'}</DialogTitle>
              <DialogDescription>{editingItem ? 'Update the schedule item details' : 'Add a new task, event, or hearing'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Title *</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Type *</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="hearing">Hearing</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Priority *</Label>
                  <Select value={formData.priority} onValueChange={(v: any) => setFormData({...formData, priority: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="all_day" checked={formData.all_day} onCheckedChange={checked => setFormData({...formData, all_day: checked})} />
                <Label htmlFor="all_day" className="text-sm cursor-pointer">All day event</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Start Date *</Label>
                  <Input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required />
                </div>
                {!formData.all_day && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Start Time</Label>
                    <Input type="time" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">End Date</Label>
                  <Input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
                {!formData.all_day && formData.end_date && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">End Time</Label>
                    <Input type="time" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Location</Label>
                <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g., Court Room 3, Conference Room A" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Related Case</Label>
                <Select value={formData.case_id} onValueChange={v => setFormData({...formData, case_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select a case" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {cases.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Status</Label>
                <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Assign to Users</Label>
                <div className="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                  {users.length === 0 ? <p className="text-sm text-slate-400">No users available</p> : users.map(user => (
                    <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.assigned_user_ids.includes(user.id)} onChange={() => toggleUserAssignment(user.id)} className="rounded border-slate-300" />
                      <span className="text-sm text-slate-700">{user.full_name} <span className="text-slate-400">({user.email})</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="resize-none" placeholder="Additional notes or instructions" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800">{editingItem ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input placeholder="Search by title, description, location, or case..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-slate-50 border-slate-200 focus:bg-white text-sm" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="event">Event</SelectItem>
                <SelectItem value="hearing">Hearing</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
            <X className="w-3.5 h-3.5" />Clear filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">
            Schedule Items
            <span className="ml-2 text-xs font-normal text-slate-400">({filteredItems.length})</span>
          </h3>
        </div>
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Calendar className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No schedule items found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredItems.map(item => (
              <div key={item.id} className="flex items-start gap-4 p-5 hover:bg-slate-50/50 transition-colors group">
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${typeAccentColors[item.type] || 'bg-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${typeColors[item.type] || typeColors.other}`}>{item.type}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${priorityColors[item.priority] || priorityColors.medium}`}>{item.priority}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${statusColors[item.status] || statusColors.scheduled}`}>{item.status}</span>
                      </div>
                      {item.description && <p className="text-xs text-slate-500 mb-2 line-clamp-1">{item.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(item.start_date), item.all_day ? 'dd MMM yyyy' : 'dd MMM yyyy, h:mm a')}
                          {item.end_date && ` — ${format(new Date(item.end_date), item.all_day ? 'dd MMM yyyy' : 'h:mm a')}`}
                        </span>
                        {item.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{item.location}</span>}
                        {item.case_title && <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{item.case_title}</span>}
                        {item.assigned_users && item.assigned_users.length > 0 && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{item.assigned_users.map(u => u.full_name).join(', ')}</span>}
                      </div>
                      {item.notes && <p className="text-xs text-slate-400 mt-1.5 italic">Note: {item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-7 w-7 p-0 text-red-300 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
