import { useId } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useChartColors } from '@/hooks/useChartColors';

export interface Point { label: string; value: number; target?: number }

type ChartColor = 'tide' | 'signal' | 'violet' | 'alert';

const tooltipStyle = (c: ReturnType<typeof useChartColors>) => ({
  background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, fontSize: 12, color: c.ink,
  boxShadow: '0 10px 30px -10px rgba(0,0,0,.25)',
});

/** Animated area chart with a gradient fill — used for ROM, form, pain and completion trends. */
export function TrendChart({ data, unit, color = 'tide', height = 200, domain, reference }: {
  data: Point[]; unit: string; color?: ChartColor; height?: number; domain?: [number, number]; reference?: { value: number; label: string };
}) {
  const c = useChartColors();
  const id = useId().replace(/:/g, '');
  const stroke = c[color];
  const stroke2 = color === 'tide' ? c.tide2 : color === 'signal' ? c.alert : color === 'violet' ? c.tide2 : c.signal;
  return (
    <div style={{ height }} role="img" aria-label={`Line chart, ${data.length} sessions`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={stroke} />
              <stop offset="100%" stopColor={stroke2} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.line} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={16} />
          <YAxis tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={false} domain={domain ?? ['auto', 'auto']} unit={unit} />
          <Tooltip contentStyle={tooltipStyle(c)} formatter={(v: number) => [`${v}${unit}`, '']} separator="" cursor={{ stroke: c.line }} />
          {reference && <ReferenceLine y={reference.value} stroke={c.muted} strokeDasharray="4 4" label={{ value: reference.label, fill: c.muted, fontSize: 10, position: 'insideTopRight' }} />}
          <Area type="monotone" dataKey="value" stroke={`url(#s${id})`} strokeWidth={2.6} fill={`url(#f${id})`}
            dot={{ r: 2.5, fill: stroke, strokeWidth: 0 }} activeDot={{ r: 6, stroke: c.surface, strokeWidth: 2 }}
            animationDuration={1200} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RepsChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const c = useChartColors();
  const id = useId().replace(/:/g, '');
  return (
    <div style={{ height }} role="img" aria-label="Bar chart of repetitions per session">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={-10}>
          <defs>
            <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.tide2} />
              <stop offset="100%" stopColor={c.tide} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={c.line} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.line }} minTickGap={16} />
          <YAxis tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle(c)} cursor={{ fill: c.line, opacity: 0.3 }}
            formatter={(v: number, name: string) => [v, name === 'value' ? 'Completed' : 'Prescribed']} />
          <Bar dataKey="target" fill={c.line} radius={[6, 6, 0, 0]} maxBarSize={18} animationDuration={900} />
          <Bar dataKey="value" fill={`url(#b${id})`} radius={[6, 6, 0, 0]} maxBarSize={18} animationDuration={1200} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
