'use client';

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// Shared color palette — matches the app's Tailwind theme.
const COLORS = {
  primary:  '#6366f1', // accent/indigo
  good:     '#10b981', // emerald
  warn:     '#f59e0b', // amber
  risk:     '#ef4444', // rose
  neutral:  '#94a3b8', // slate
  bg:       '#f1f5f9', // slate-100
  grid:     '#e5e7eb',
  axis:     '#9ca3af',
  axisLbl:  '#6b7280',
};

const tooltipStyle: React.CSSProperties = {
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '12px',
  padding: '8px 10px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

// ============================================================================
// 1. Calls per week (line chart)
// ============================================================================

export type CallsPerWeekPoint = { weekLabel: string; calls: number; students: number };

export function CallsPerWeekChart({ data }: { data: CallsPerWeekPoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No calls logged in the last 12 weeks." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="weekLabel" stroke={COLORS.axis} tick={{ fontSize: 11, fill: COLORS.axisLbl }} />
        <YAxis allowDecimals={false} stroke={COLORS.axis} tick={{ fontSize: 11, fill: COLORS.axisLbl }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Line type="monotone" dataKey="calls"    name="Calls"             stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="students" name="Unique students"   stroke={COLORS.good}    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// 2. Monthly collection rate (combo: bar = due, bar = paid, line = rate)
// ============================================================================

export type CollectionRatePoint = { monthLabel: string; due: number; paid: number; rate: number };

export function CollectionRateChart({ data }: { data: CollectionRatePoint[] }) {
  if (data.length === 0) {
    return <EmptyState message="No EMI history in the last 6 months." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="monthLabel" stroke={COLORS.axis} tick={{ fontSize: 11, fill: COLORS.axisLbl }} />
        <YAxis stroke={COLORS.axis} tick={{ fontSize: 11, fill: COLORS.axisLbl }}
          tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: any, name: string) => {
            if (name === 'Rate %') return [`${value.toFixed(1)}%`, name];
            return [`₹${Math.round(value).toLocaleString('en-IN')}`, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Bar dataKey="due"  name="Due"  fill={COLORS.neutral} radius={[4, 4, 0, 0]} />
        <Bar dataKey="paid" name="Paid" fill={COLORS.good}    radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// 3. Reminder delivery status (pie chart)
// ============================================================================

export type ReminderStatusSlice = { name: string; value: number; color: string };

export function ReminderDeliveryChart({ data }: { data: ReminderStatusSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <EmptyState message="No reminders fired in the last 30 days." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={50}
          paddingAngle={2}
          label={({ name, value, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} stroke="white" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: any, name: string) => [`${value} reminders`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// 4. Student funnel (horizontal bar)
// ============================================================================

export type FunnelStage = { stage: string; count: number; color: string };

export function StudentFunnelChart({ data }: { data: FunnelStage[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <EmptyState message="No students in the database yet." />;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 50, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" stroke={COLORS.axis} tick={{ fontSize: 11, fill: COLORS.axisLbl }} allowDecimals={false} />
        <YAxis dataKey="stage" type="category" stroke={COLORS.axis} tick={{ fontSize: 12, fill: COLORS.axisLbl, fontWeight: 500 }} width={80} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: any) => [`${value} students`, 'Count']}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11, fill: COLORS.axisLbl }}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Shared empty state
// ============================================================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[280px] flex items-center justify-center text-[13px] text-ink-500">
      {message}
    </div>
  );
}

// Re-export the color palette so the page can use matching colors in legends.
export const CHART_COLORS = COLORS;