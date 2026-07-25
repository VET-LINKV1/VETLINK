/**
 * charts.jsx
 * Pure-SVG chart primitives used by the Health Check dashboards.
 * No external charting library required.
 *
 * Exports:
 *   <BarChart   data={[{key,count}]} />            — vertical bars (good for ≤12 categories)
 *   <HBarChart  data={[{key,count}]} />            — horizontal bars (good for long labels / many items)
 *   <LineChart  data={[{day|x, value|count, ...}]} />
 *   <DonutChart data={[{key,count}]} />            — pie / donut
 *   <SparkLine  data={[{date, weight}]} />          — tiny line for KPI cards
 */
const PALETTE = [
  '#2563eb', // blue-600
  '#0ea5e9', // sky-500
  '#14b8a6', // teal-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
];

const colorFor = (i) => PALETTE[i % PALETTE.length];

const STATUS_COLOR = {
  pending:   '#f59e0b',
  confirmed: '#0ea5e9',
  completed: '#10b981',
  cancelled: '#ef4444',
  paid:      '#10b981',
  failed:    '#ef4444',
  unpaid:    '#94a3b8',
  refunded:  '#6366f1',
};

const niceMax = (n) => {
  if (!n || n <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / exp;
  let nf;
  if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * exp;
};

// ── Vertical Bar Chart ─────────────────────────────────────────
export function BarChart({ data = [], height = 220, valueKey = 'count', labelKey = 'key' }) {
  if (data.length === 0) return <EmptyChart height={height} />;
  const W = 560;
  const H = height;
  const padL = 36, padR = 8, padT = 12, padB = 36;
  const maxV = niceMax(Math.max(...data.map((d) => d[valueKey] || 0)));
  const barGap = 6;
  const barW = (W - padL - padR - barGap * (data.length - 1)) / data.length;

  // 4 horizontal grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + (H - padT - padB) * (1 - t);
    return { y, value: Math.round(maxV * t) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="bar chart">
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="#e2e8f0" strokeDasharray="3 3" />
          <text x={padL - 6} y={g.y + 4} fontSize="10" textAnchor="end" fill="#94a3b8">{g.value}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const h = ((H - padT - padB) * v) / maxV;
        const x = padL + i * (barW + barGap);
        const y = H - padB - h;
        const c = STATUS_COLOR[String(d[labelKey]).toLowerCase()] || colorFor(i);
        const label = String(d[labelKey] ?? '');
        const shortLabel = label.length > 10 ? label.slice(0, 9) + '…' : label;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="3" fill={c} />
            <text
              x={x + barW / 2} y={H - padB + 12}
              fontSize="10" textAnchor="middle" fill="#64748b">
              {shortLabel}
            </text>
            <title>{label}: {v}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal Bar Chart ───────────────────────────────────────
export function HBarChart({ data = [], height = 'auto', valueKey = 'count', labelKey = 'key' }) {
  if (data.length === 0) return <EmptyChart />;
  const rowH = 24, gap = 6;
  const H = data.length * (rowH + gap) + 12;
  const W = 560;
  const padL = 130, padR = 36;
  const maxV = niceMax(Math.max(...data.map((d) => d[valueKey] || 0)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 480 }} role="img" aria-label="horizontal bar chart">
      {data.map((d, i) => {
        const v = d[valueKey] || 0;
        const w = ((W - padL - padR) * v) / maxV;
        const y = i * (rowH + gap) + 6;
        const c = STATUS_COLOR[String(d[labelKey]).toLowerCase()] || colorFor(i);
        const label = String(d[labelKey] ?? '');
        const shortLabel = label.length > 18 ? label.slice(0, 17) + '…' : label;
        return (
          <g key={i}>
            <text x={padL - 8} y={y + rowH / 2 + 4} fontSize="11" textAnchor="end" fill="#475569">
              {shortLabel}
            </text>
            <rect x={padL} y={y} width={Math.max(w, 1)} height={rowH} rx="4" fill={c} />
            <text x={padL + w + 6} y={y + rowH / 2 + 4} fontSize="11" fill="#475569">{v}</text>
            <title>{label}: {v}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ── Line Chart ─────────────────────────────────────────────────
export function LineChart({ data = [], height = 220, xKey = 'day', yKey = 'count', stacked = null }) {
  // stacked: optional array of keys to stack-line (e.g. ['pending','confirmed','completed','cancelled'])
  if (data.length === 0) return <EmptyChart height={height} />;
  const series = stacked || [yKey];
  const W = 560, H = height;
  const padL = 36, padR = 8, padT = 12, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxV = niceMax(Math.max(1, ...data.flatMap((d) => series.map((k) => d[k] || 0))));
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;

  const xy = (i, v) => [padL + i * xStep, padT + innerH * (1 - (v / maxV))];

  // Tick labels — show first, middle, last (avoid clutter)
  const ticks = data.length <= 7
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + innerH * (1 - t),
    value: Math.round(maxV * t),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="line chart">
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="#e2e8f0" strokeDasharray="3 3" />
          <text x={padL - 6} y={g.y + 4} fontSize="10" textAnchor="end" fill="#94a3b8">{g.value}</text>
        </g>
      ))}

      {series.map((key, sIdx) => {
        const c = STATUS_COLOR[key.toLowerCase()] || colorFor(sIdx);
        const points = data.map((d, i) => xy(i, d[key] || 0));
        const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
        const areaPath = `${path} L ${padL + (data.length - 1) * xStep} ${padT + innerH} L ${padL} ${padT + innerH} Z`;
        return (
          <g key={key}>
            {series.length === 1 && (
              <path d={areaPath} fill={c} opacity="0.08" />
            )}
            <path d={path} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.2" fill={c}>
                <title>{`${data[i][xKey]} — ${key}: ${data[i][key]}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {ticks.map((i) => {
        const [x] = xy(i, 0);
        const lbl = String(data[i]?.[xKey] ?? '');
        return (
          <text key={i} x={x} y={H - padB + 14} fontSize="10" textAnchor="middle" fill="#64748b">
            {lbl.slice(5)}{/* show MM-DD when ISO */}
          </text>
        );
      })}

      {series.length > 1 && (
        <g>
          {series.map((key, i) => {
            const c = STATUS_COLOR[key.toLowerCase()] || colorFor(i);
            const x = padL + i * 76;
            return (
              <g key={key}>
                <rect x={x} y={H - 14} width={10} height={4} fill={c} rx="1.5" />
                <text x={x + 14} y={H - 10} fontSize="10" fill="#64748b">{key}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

// ── Donut Chart ────────────────────────────────────────────────
export function DonutChart({ data = [], size = 180, valueKey = 'count', labelKey = 'key' }) {
  if (data.length === 0) return <EmptyChart height={size} />;
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  if (total === 0) return <EmptyChart height={size} />;

  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 8;
  const inner = r * 0.6;

  let acc = 0;
  const slices = data.map((d, i) => {
    const v = d[valueKey] || 0;
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += v;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const xi0 = cx + inner * Math.cos(a0), yi0 = cy + inner * Math.sin(a0);
    const xi1 = cx + inner * Math.cos(a1), yi1 = cy + inner * Math.sin(a1);
    const path = [
      `M ${x0} ${y0}`,
      `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
      `L ${xi1} ${yi1}`,
      `A ${inner} ${inner} 0 ${large} 0 ${xi0} ${yi0}`,
      'Z',
    ].join(' ');
    return {
      path,
      color: STATUS_COLOR[String(d[labelKey]).toLowerCase()] || colorFor(i),
      label: d[labelKey],
      value: v,
      pct:   ((v / total) * 100).toFixed(1),
    };
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color}>
            <title>{`${s.label}: ${s.value} (${s.pct}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">total</text>
      </svg>
      <ul className="space-y-1.5 text-xs flex-1 min-w-[140px]">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600 dark:text-slate-300 capitalize truncate">{s.label}</span>
            <span className="ml-auto font-mono text-slate-500">{s.value}</span>
            <span className="font-mono text-slate-400 w-10 text-right">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Sparkline (used inside KPI tiles) ─────────────────────────
export function SparkLine({ data = [], height = 32, color = '#2563eb', valueKey = 'count' }) {
  if (data.length < 2) return <div className="h-8" />;
  const W = 100, H = height;
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  const xStep = W / (data.length - 1);
  const points = data.map((d, i) => [i * xStep, H - ((d[valueKey] || 0) / max) * (H - 4) - 2]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyChart({ height = 220 }) {
  return (
    <div
      className="flex items-center justify-center text-slate-300 dark:text-slate-600 font-body text-sm border border-dashed border-slate-200 dark:border-white/10 rounded-xl"
      style={{ height }}
    >
      No data in this window
    </div>
  );
}
