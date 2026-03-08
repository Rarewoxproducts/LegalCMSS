'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase, Case, ScheduleItem } from '@/lib/supabase';
import { queryCache } from '@/lib/query-cache';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen, Clock, CircleCheck as CheckCircle, Circle as XCircle, Calendar as CalendarIcon, FileText, ListTodo, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay, addMonths, subMonths } from 'date-fns';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
  });
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState<(ScheduleItem & { case_title?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;

    setLoading(true);

    try {
      const cacheKey = `dashboard-${profile.id}-${profile.role}`;

      const allCases = await queryCache.fetch(cacheKey, async () => {
        let casesQuery = supabase
          .from('cases')
          .select('*')
          .order('created_at', { ascending: false });

        if (profile.role !== 'admin') {
          const { data: assignments } = await supabase
            .from('case_assignments')
            .select('case_id')
            .eq('user_id', profile.id);

          const caseIds = assignments?.map(a => a.case_id) || [];

          if (caseIds.length === 0) {
            return [];
          }

          casesQuery = casesQuery.in('id', caseIds);
        }

        const { data: cases, error } = await casesQuery;
        if (error) throw error;
        return cases || [];
      }, 15000);

      setStats({
        total: allCases.length,
        open: allCases.filter(c => c.status === 'open').length,
        inProgress: allCases.filter(c => c.status === 'in_progress').length,
        closed: allCases.filter(c => c.status === 'closed').length,
      });

      setRecentCases(allCases.slice(0, 5));

      let scheduleQuery = supabase
        .from('schedule_items')
        .select('*, cases(title)')
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(4);

      if (profile.role !== 'admin') {
        const { data: assignments } = await supabase
          .from('schedule_assignments')
          .select('schedule_item_id')
          .eq('user_id', profile.id);

        const scheduleIds = assignments?.map(a => a.schedule_item_id) || [];

        if (scheduleIds.length > 0) {
          scheduleQuery = scheduleQuery.in('id', scheduleIds);
        } else {
          setUpcomingSchedule([]);
          setLoading(false);
          return;
        }
      }

      const { data: schedule, error: scheduleError } = await scheduleQuery;

      if (!scheduleError) {
        const scheduleWithCaseTitles = (schedule || []).map((item: any) => ({
          ...item,
          case_title: item.cases?.title,
        }));
        setUpcomingSchedule(scheduleWithCaseTitles);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarDate);
    const end = endOfMonth(calendarDate);
    const days = eachDayOfInterval({ start, end });
    const startPadding = getDay(start);
    return { days, startPadding };
  }, [calendarDate]);

  const scheduleDates = useMemo(() => {
    return upcomingSchedule.map(item => new Date(item.start_date));
  }, [upcomingSchedule]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      name: 'New Case',
      description: 'Create a case',
      icon: FolderOpen,
      href: '/dashboard/cases',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      name: 'Schedule',
      description: 'Add event',
      icon: CalendarIcon,
      href: profile?.role === 'admin' ? '/dashboard/schedule' : '/dashboard/my-schedule',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      name: 'Documents',
      description: 'Upload files',
      icon: FileText,
      href: '/dashboard/cases',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      name: 'Reports',
      description: 'View analytics',
      icon: ListTodo,
      href: '/dashboard/reports',
      color: 'bg-rose-50 text-rose-600',
    },
    ...(profile?.role === 'admin'
      ? [
          {
            name: 'Teams',
            description: 'Manage teams',
            icon: Building2,
            href: '/dashboard/departments',
            color: 'bg-cyan-50 text-cyan-600',
          },
        ]
      : []),
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-amber-50 text-amber-700 border-amber-200',
      in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
      closed: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return styles[status] || styles.open;
  };

  const formatStatus = (status: string) => {
    return status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      task: 'bg-blue-500',
      event: 'bg-emerald-500',
      hearing: 'bg-red-500',
      meeting: 'bg-amber-500',
      deadline: 'bg-orange-500',
      other: 'bg-slate-400',
    };
    return colors[type] || colors.other;
  };

  const getTypeTagStyle = (type: string) => {
    const styles: Record<string, string> = {
      task: 'bg-blue-50 text-blue-600 border-blue-100',
      event: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      hearing: 'bg-red-50 text-red-600 border-red-100',
      meeting: 'bg-amber-50 text-amber-600 border-amber-100',
      deadline: 'bg-orange-50 text-orange-600 border-orange-100',
      other: 'bg-slate-50 text-slate-500 border-slate-200',
    };
    return styles[type] || styles.other;
  };

  const statCards = [
    {
      title: 'Total Cases',
      value: stats.total,
      icon: FolderOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      title: 'Open',
      value: stats.open,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      title: 'Closed',
      value: stats.closed,
      icon: XCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Welcome, {profile?.full_name}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Here&apos;s what&apos;s happening across your legal workspace today.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className={`bg-white rounded-xl border ${stat.border} p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.title}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickActions.map((action) => (
            <Link key={action.name} href={action.href}>
              <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group">
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">{action.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Upcoming Events</h3>
              <Link href={profile?.role === 'admin' ? '/dashboard/schedule' : '/dashboard/my-schedule'}>
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-blue-600">
                  See all
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {upcomingSchedule.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <CalendarIcon className="w-10 h-10 mb-3 text-slate-300" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              ) : (
                upcomingSchedule.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-11 h-11 bg-slate-50 rounded-xl flex flex-col items-center justify-center">
                        <span className="text-[10px] font-medium text-slate-400 uppercase leading-none">
                          {format(parseISO(item.start_date), 'MMM')}
                        </span>
                        <span className="text-lg font-bold text-slate-800 leading-tight">
                          {format(parseISO(item.start_date), 'd')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border capitalize flex-shrink-0 ${getTypeTagStyle(item.type)}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {item.case_title ? `Case: ${item.case_title}` : item.location || 'No location'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`w-2 h-2 rounded-full ${getTypeColor(item.type)}`} />
                      <span className="text-xs text-slate-400">
                        {format(parseISO(item.start_date), item.all_day ? 'MMM d' : 'h:mm a')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
              <Link href="/dashboard/cases">
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-blue-600">
                  See all
                </Button>
              </Link>
            </div>
            {recentCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <FolderOpen className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">No cases available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="px-5 py-3 font-semibold">Case</th>
                      <th className="px-5 py-3 font-semibold hidden sm:table-cell">Client</th>
                      <th className="px-5 py-3 font-semibold hidden md:table-cell">Date</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentCases.map((case_) => (
                      <tr
                        key={case_.id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/cases/${case_.id}`}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-slate-800">{case_.title}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{case_.case_number}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <p className="text-sm text-slate-600">{case_.client_name}</p>
                          <p className="text-[11px] text-slate-400">{case_.case_type}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <p className="text-sm text-slate-500">
                            {format(new Date(case_.created_at), 'dd-MM-yyyy')}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadge(case_.status)}`}
                          >
                            {formatStatus(case_.status)}
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

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">
                {format(calendarDate, 'MMMM yyyy')}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-[10px] font-semibold text-slate-400 uppercase py-2"
                >
                  {day}
                </div>
              ))}

              {Array.from({ length: calendarDays.startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="text-center py-1.5" />
              ))}

              {calendarDays.days.map((day) => {
                const hasEvent = scheduleDates.some((d) => isSameDay(d, day));
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className="text-center py-1.5"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 text-xs rounded-full transition-colors ${
                        today
                          ? 'bg-blue-600 text-white font-bold'
                          : hasEvent
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-50">
              <h3 className="text-sm font-semibold text-slate-800">Today&apos;s Events</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {upcomingSchedule.filter(item => {
                try {
                  return isToday(parseISO(item.start_date));
                } catch {
                  return false;
                }
              }).length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-xs text-slate-400">No events today</p>
                </div>
              ) : (
                upcomingSchedule
                  .filter(item => {
                    try {
                      return isToday(parseISO(item.start_date));
                    } catch {
                      return false;
                    }
                  })
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50">
                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                        <p className="text-[11px] text-slate-400">
                          {item.location || item.type}
                        </p>
                      </div>
                      <span className={`w-2 h-2 rounded-full ${getTypeColor(item.type)}`} />
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
