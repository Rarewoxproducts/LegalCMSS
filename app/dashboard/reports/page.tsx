'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Calendar, Building2, Users, Download, TrendingUp, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { getRoleLabel } from '@/lib/utils';

interface ReportFilters {
  reportType: 'cases' | 'schedule' | 'departments' | 'users';
  status: string;
  caseType: string;
  dateFrom: string;
  dateTo: string;
}

interface Stats {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  closedCases: number;
  totalScheduleItems: number;
  totalDepartments: number;
  totalUsers: number;
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalCases: 0, openCases: 0, inProgressCases: 0, closedCases: 0, totalScheduleItems: 0, totalDepartments: 0, totalUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({ reportType: 'cases', status: 'all', caseType: '', dateFrom: '', dateTo: '' });

  useEffect(() => { if (profile) fetchStats(); }, [profile]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [casesResult, scheduleResult, deptsResult, usersResult] = await Promise.all([
        supabase.from('cases').select('status'),
        supabase.from('schedule_items').select('id', { count: 'exact', head: true }),
        supabase.from('departments').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      const cases = casesResult.data || [];
      setStats({
        totalCases: cases.length,
        openCases: cases.filter(c => c.status === 'open').length,
        inProgressCases: cases.filter(c => c.status === 'in_progress').length,
        closedCases: cases.filter(c => c.status === 'closed').length,
        totalScheduleItems: scheduleResult.count || 0,
        totalDepartments: deptsResult.count || 0,
        totalUsers: usersResult.count || 0,
      });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      let data: any[] = [];
      if (filters.reportType === 'cases') {
        let q = supabase.from('cases').select('*').order('created_at', { ascending: false });
        if (filters.status !== 'all') q = q.eq('status', filters.status);
        if (filters.caseType) q = q.ilike('case_type', `%${filters.caseType}%`);
        if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom);
        if (filters.dateTo) q = q.lte('created_at', filters.dateTo);
        const { data: cases } = await q;
        data = (cases || []).map(c => ({ 'Case Number': c.case_number, 'Title': c.title, 'Client': c.client_name, 'Type': c.case_type, 'Status': c.status, 'Created': format(new Date(c.created_at), 'yyyy-MM-dd') }));
      } else if (filters.reportType === 'schedule') {
        let q = supabase.from('schedule_items').select('*').order('start_date', { ascending: true });
        if (filters.status !== 'all') q = q.eq('status', filters.status);
        if (filters.dateFrom) q = q.gte('start_date', filters.dateFrom);
        if (filters.dateTo) q = q.lte('start_date', filters.dateTo);
        const { data: items } = await q;
        data = (items || []).map(i => ({ 'Title': i.title, 'Type': i.type, 'Priority': i.priority, 'Status': i.status, 'Start Date': format(new Date(i.start_date), 'yyyy-MM-dd'), 'Location': i.location || '' }));
      } else if (filters.reportType === 'departments') {
        const { data: depts } = await supabase.from('departments').select('*').order('name');
        const withCounts = await Promise.all((depts || []).map(async d => {
          const { count: memberCount } = await supabase.from('department_members').select('*', { count: 'exact', head: true }).eq('department_id', d.id);
          const { count: caseCount } = await supabase.from('department_cases').select('*', { count: 'exact', head: true }).eq('department_id', d.id);
          return { 'Team': d.name, 'Description': d.description || '', 'Members': memberCount || 0, 'Cases': caseCount || 0, 'Created': format(new Date(d.created_at), 'yyyy-MM-dd') };
        }));
        data = withCounts;
      } else if (filters.reportType === 'users') {
        const { data: users } = await supabase.from('profiles').select('*').order('full_name');
        data = (users || []).map(u => ({ 'Full Name': u.full_name, 'Role': getRoleLabel(u.role), 'External': u.is_external ? 'Yes' : 'No', 'Access Expires': u.access_expires_at ? format(new Date(u.access_expires_at), 'yyyy-MM-dd') : '', 'Created': format(new Date(u.created_at), 'yyyy-MM-dd') }));
      }
      setReportData(data);
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  };

  const exportCSV = () => {
    if (!reportData.length) return;
    const headers = Object.keys(reportData[0]);
    const rows = reportData.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filters.reportType}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getReportColumns = () => reportData.length ? Object.keys(reportData[0]) : [];

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Cases', value: stats.totalCases, icon: FolderOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Open Cases', value: stats.openCases, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'In Progress', value: stats.inProgressCases, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Closed', value: stats.closedCases, icon: FolderOpen, color: 'text-slate-500', bg: 'bg-slate-50' },
    { label: 'Schedule Items', value: stats.totalScheduleItems, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Teams', value: stats.totalDepartments, icon: Building2, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-500 mt-0.5">Generate and export reports for cases, schedules, teams, and users</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {loading ? (
          [...Array(7)].map((_, i) => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />)
        ) : (
          statCards.map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
          <Filter className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Report Generator</h3>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Report Type</Label>
              <Select value={filters.reportType} onValueChange={(v: any) => setFilters({...filters, reportType: v})}>
                <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cases">Cases</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="departments">Teams</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(filters.reportType === 'cases' || filters.reportType === 'schedule') && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</Label>
                <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}>
                  <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {filters.reportType === 'cases' ? <>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </> : <>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </>}
                  </SelectContent>
                </Select>
              </div>
            )}
            {filters.reportType === 'cases' && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Case Type</Label>
                <Input value={filters.caseType} onChange={e => setFilters({...filters, caseType: e.target.value})} placeholder="e.g., Civil" className="h-9 text-sm border-slate-200 bg-slate-50" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">From Date</Label>
              <Input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="h-9 text-sm border-slate-200 bg-slate-50" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To Date</Label>
              <Input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="h-9 text-sm border-slate-200 bg-slate-50" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={generateReport} disabled={generating} className="bg-slate-900 hover:bg-slate-800 text-sm">
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
            {reportData.length > 0 && (
              <Button onClick={exportCSV} variant="outline" className="text-sm border-slate-200">
                <Download className="w-4 h-4 mr-2" />
                Export CSV ({reportData.length} records)
              </Button>
            )}
          </div>
        </div>
      </div>

      {reportData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h3 className="text-sm font-semibold text-slate-800">
              Report Preview
              <span className="ml-2 text-xs font-normal text-slate-400">({reportData.length} records)</span>
            </h3>
            <Button onClick={exportCSV} variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-slate-700">
              <Download className="w-3.5 h-3.5 mr-1.5" />Export
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  {getReportColumns().map(col => (
                    <th key={col} className="px-5 py-3 font-semibold whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    {getReportColumns().map(col => (
                      <td key={col} className="px-5 py-3.5 text-slate-600 whitespace-nowrap text-xs">{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {reportData.length > 50 && (
              <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-50">
                Showing first 50 of {reportData.length} records. Export to CSV to view all.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
