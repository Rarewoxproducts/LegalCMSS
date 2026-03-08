'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarRange, RotateCcw } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';

interface ChartFilters {
  dateFrom: string;
  dateTo: string;
  departmentId: string;
  counselId: string;
}

interface Department { id: string; name: string; }
interface Counsel { id: string; full_name: string; }

interface CaseRow {
  id: string;
  status: string;
  case_type: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: '#2563eb',
  in_progress: '#f59e0b',
  closed: '#64748b',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
};

const CATEGORY_COLORS = [
  '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#64748b', '#7c3aed', '#db2777', '#0d9488', '#ca8a04',
];

const TREND_NEW = '#2563eb';
const TREND_CLOSED = '#64748b';

export default function ReportsCharts() {
  const [filters, setFilters] = useState<ChartFilters>({
    dateFrom: format(subMonths(new Date(), 11), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
    departmentId: 'all',
    counselId: 'all',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [counselList, setCounselList] = useState<Counsel[]>([]);

  const [statusData, setStatusData] = useState<{ name: string; value: number; key: string }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [trendData, setTrendData] = useState<{ month: string; newCases: number; closedCases: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [filters]);

  const fetchFilterOptions = async () => {
    const [deptRes, counselRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name').in('role', ['admin', 'lawyer']).order('full_name'),
    ]);
    setDepartments(deptRes.data || []);
    setCounselList(counselRes.data || []);
  };

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    try {
      let caseIdsFromDept: string[] | null = null;
      let caseIdsFromCounsel: string[] | null = null;

      if (filters.departmentId !== 'all') {
        const { data } = await supabase
          .from('department_cases')
          .select('case_id')
          .eq('department_id', filters.departmentId);
        caseIdsFromDept = (data || []).map(d => d.case_id);
      }

      if (filters.counselId !== 'all') {
        const { data } = await supabase
          .from('case_assignments')
          .select('case_id')
          .eq('user_id', filters.counselId);
        caseIdsFromCounsel = (data || []).map(d => d.case_id);
      }

      let intersectedIds: string[] | null = null;
      if (caseIdsFromDept !== null && caseIdsFromCounsel !== null) {
        const set = new Set(caseIdsFromDept);
        intersectedIds = caseIdsFromCounsel.filter(id => set.has(id));
      } else if (caseIdsFromDept !== null) {
        intersectedIds = caseIdsFromDept;
      } else if (caseIdsFromCounsel !== null) {
        intersectedIds = caseIdsFromCounsel;
      }

      let query = supabase
        .from('cases')
        .select('id, status, case_type, created_at');

      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      if (intersectedIds !== null) {
        if (intersectedIds.length === 0) {
          setStatusData([]);
          setCategoryData([]);
          setTrendData([]);
          setLoading(false);
          return;
        }
        query = query.in('id', intersectedIds);
      }

      const { data: cases } = await query;
      const rows: CaseRow[] = cases || [];

      buildStatusChart(rows);
      buildCategoryChart(rows);
      await buildTrendChart(filters, intersectedIds);
    } catch (err) {
      console.error('Chart data error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const buildStatusChart = (rows: CaseRow[]) => {
    const counts: Record<string, number> = { open: 0, in_progress: 0, closed: 0 };
    rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    setStatusData(
      Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: STATUS_LABELS[k], value: v, key: k }))
    );
  };

  const buildCategoryChart = (rows: CaseRow[]) => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const t = r.case_type || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    });
    setCategoryData(
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))
    );
  };

  const buildTrendChart = async (f: ChartFilters, filteredIds: string[] | null) => {
    const from = f.dateFrom ? parseISO(f.dateFrom) : subMonths(new Date(), 11);
    const to = f.dateTo ? parseISO(f.dateTo) : new Date();

    const months: { start: Date; end: Date; label: string }[] = [];
    let cursor = startOfMonth(from);
    while (cursor <= endOfMonth(to)) {
      months.push({
        start: startOfMonth(cursor),
        end: endOfMonth(cursor),
        label: format(cursor, 'MMM yyyy'),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    let newQuery = supabase
      .from('cases')
      .select('id, created_at')
      .gte('created_at', format(months[0]?.start || from, 'yyyy-MM-dd'))
      .lte('created_at', format(endOfMonth(to), 'yyyy-MM-dd') + 'T23:59:59');

    if (filteredIds !== null) {
      if (filteredIds.length === 0) {
        setTrendData(months.map(m => ({ month: m.label, newCases: 0, closedCases: 0 })));
        return;
      }
      newQuery = newQuery.in('id', filteredIds);
    }

    const { data: allCases } = await newQuery;

    let closedQuery = supabase
      .from('cases')
      .select('id, updated_at')
      .eq('status', 'closed')
      .gte('updated_at', format(months[0]?.start || from, 'yyyy-MM-dd'))
      .lte('updated_at', format(endOfMonth(to), 'yyyy-MM-dd') + 'T23:59:59');

    if (filteredIds !== null && filteredIds.length > 0) {
      closedQuery = closedQuery.in('id', filteredIds);
    }

    const { data: closedCases } = await closedQuery;

    const trend = months.map(m => {
      const mStart = m.start.getTime();
      const mEnd = m.end.getTime();

      const newCount = (allCases || []).filter(c => {
        const d = new Date(c.created_at).getTime();
        return d >= mStart && d <= mEnd;
      }).length;

      const closedCount = (closedCases || []).filter(c => {
        const d = new Date(c.updated_at).getTime();
        return d >= mStart && d <= mEnd;
      }).length;

      return { month: m.label, newCases: newCount, closedCases: closedCount };
    });

    setTrendData(trend);
  };

  const resetFilters = () => {
    setFilters({
      dateFrom: format(subMonths(new Date(), 11), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
      departmentId: 'all',
      counselId: 'all',
    });
  };

  const hasData = statusData.length > 0 || categoryData.length > 0;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">Visual Analytics</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs text-slate-500 hover:text-slate-700">
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset Filters
          </Button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">From Date</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="h-9 text-sm border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">To Date</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="h-9 text-sm border-slate-200 bg-slate-50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Team</Label>
              <Select value={filters.departmentId} onValueChange={v => setFilters(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Counsel</Label>
              <Select value={filters.counselId} onValueChange={v => setFilters(f => ({ ...f, counselId: v }))}>
                <SelectTrigger className="h-9 text-sm border-slate-200 bg-slate-50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counsel</SelectItem>
                  {counselList.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 pb-5 pt-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-slate-50 animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            No case data found for the selected filters.
          </div>
        ) : (
          <div className="px-5 pb-5 pt-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <StatusPieChart data={statusData} />
              <CategoryBarChart data={categoryData} />
              <TrendLineChart data={trendData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPieChart({ data }: { data: { name: string; value: number; key: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-slate-50/60 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cases by Status</h4>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={(value: number, name: string) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 mt-2">
        {data.map(d => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.key] }} />
            <span className="text-[11px] text-slate-500">{d.name}</span>
            <span className="text-[11px] font-semibold text-slate-700">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="bg-slate-50/60 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cases by Category</h4>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Bar dataKey="value" name="Cases" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendLineChart({ data }: { data: { month: string; newCases: number; closedCases: number }[] }) {
  return (
    <div className="bg-slate-50/60 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New vs Closed Cases</h4>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            <Line
              type="monotone"
              dataKey="newCases"
              name="New Cases"
              stroke={TREND_NEW}
              strokeWidth={2}
              dot={{ r: 3, fill: TREND_NEW }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="closedCases"
              name="Closed Cases"
              stroke={TREND_CLOSED}
              strokeWidth={2}
              dot={{ r: 3, fill: TREND_CLOSED }}
              activeDot={{ r: 5 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
