'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, FileText, CircleAlert as AlertCircle, Search, X } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, isFuture, startOfDay } from 'date-fns';

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
  case_title?: string;
}

export default function MySchedulePage() {
  const { user } = useAuth();
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'today' | 'completed' | 'past'>('upcoming');

  useEffect(() => { if (user) fetchMySchedule(); }, [user]);

  const fetchMySchedule = async () => {
    setLoading(true);
    const { data: assignments } = await supabase.from('schedule_assignments').select('schedule_item_id').eq('user_id', user?.id);
    if (!assignments || assignments.length === 0) { setScheduleItems([]); setLoading(false); return; }

    const ids = assignments.map((a: any) => a.schedule_item_id);
    const { data: items } = await supabase.from('schedule_items').select('*, cases(title)').in('id', ids).order('start_date', { ascending: true });
    setScheduleItems((items || []).map(item => ({ ...item, case_title: item.cases?.title })));
    setLoading(false);
  };

  const typeAccentColors: Record<string, string> = {
    task: 'bg-blue-500', event: 'bg-emerald-500', hearing: 'bg-red-500',
    meeting: 'bg-amber-500', deadline: 'bg-orange-500', other: 'bg-slate-400',
  };

  const typeColors: Record<string, string> = {
    task: 'bg-blue-50 text-blue-700 border-blue-200',
    event: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hearing: 'bg-red-50 text-red-700 border-red-200',
    meeting: 'bg-amber-50 text-amber-700 border-amber-200',
    deadline: 'bg-orange-50 text-orange-700 border-orange-200',
    other: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-50 text-slate-500 border-slate-200',
    medium: 'bg-blue-50 text-blue-600 border-blue-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    urgent: 'bg-red-50 text-red-700 border-red-200',
  };

  const getDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(startOfDay(date)) && !isToday(date)) return 'Past';
    return null;
  };

  const filteredItems = scheduleItems.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q) || item.case_title?.toLowerCase().includes(q))) return false;
    }
    if (dateFrom && new Date(item.start_date) < new Date(dateFrom)) return false;
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); if (new Date(item.start_date) > to) return false; }
    return true;
  });

  const clearFilters = () => { setFilterType('all'); setSearchQuery(''); setDateFrom(''); setDateTo(''); };
  const hasFilters = filterType !== 'all' || searchQuery || dateFrom || dateTo;

  const upcomingItems = filteredItems.filter(i => (isFuture(new Date(i.start_date)) || isToday(new Date(i.start_date))) && i.status === 'scheduled');
  const todayItems = filteredItems.filter(i => isToday(new Date(i.start_date)) && i.status === 'scheduled');
  const completedItems = filteredItems.filter(i => i.status === 'completed');
  const pastItems = filteredItems.filter(i => isPast(startOfDay(new Date(i.start_date))) && !isToday(new Date(i.start_date)));

  const tabs = [
    { key: 'upcoming' as const, label: 'Upcoming', count: upcomingItems.length },
    { key: 'today' as const, label: 'Today', count: todayItems.length },
    { key: 'completed' as const, label: 'Completed', count: completedItems.length },
    { key: 'past' as const, label: 'Past', count: pastItems.length },
  ];

  const activeItems = { upcoming: upcomingItems, today: todayItems, completed: completedItems, past: pastItems }[activeTab];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-slate-100 animate-pulse rounded" />
        <div className="h-32 bg-slate-100 animate-pulse rounded-xl" />
        {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Schedule</h2>
        <p className="text-sm text-slate-500 mt-0.5">Your assigned tasks, events, and hearings</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input placeholder="Search by title, description, location, or case..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-slate-50 border-slate-200 focus:bg-white text-sm" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
        <div className="flex border-b border-slate-100 px-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Calendar className="w-10 h-10 mb-3 text-slate-300" />
            <p className="text-sm">No items in this view</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeItems.map(item => {
              const dateLabel = getDateLabel(item.start_date);
              const isUrgent = (item.priority === 'urgent' || item.priority === 'high') && item.status === 'scheduled';
              return (
                <div key={item.id} className="flex items-start gap-4 p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-2 ${typeAccentColors[item.type] || 'bg-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      {dateLabel && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dateLabel === 'Today' ? 'bg-blue-600 text-white' : dateLabel === 'Tomorrow' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-500'}`}>
                          {dateLabel}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${typeColors[item.type] || typeColors.other}`}>{item.type}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${priorityColors[item.priority] || priorityColors.medium}`}>{item.priority}</span>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-2.5 h-2.5" />Important
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-slate-500 mb-2 line-clamp-1">{item.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(item.start_date), item.all_day ? 'dd MMM yyyy' : 'dd MMM yyyy, h:mm a')}
                        {item.end_date && ` — ${format(new Date(item.end_date), item.all_day ? 'dd MMM yyyy' : 'h:mm a')}`}
                      </span>
                      {item.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{item.location}</span>}
                      {item.case_title && <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Related to: {item.case_title}</span>}
                    </div>
                    {item.notes && <p className="text-xs text-slate-400 mt-1.5 italic">Note: {item.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
