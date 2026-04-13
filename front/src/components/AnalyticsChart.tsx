import { useState } from "react";

interface DataPoint {
  label: string;
  value: number;
}

export function AnalyticsChart({ data, title }: { data: DataPoint[]; title: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 100;
  const height = 60;
  const padding = 4;
  const stepX = (width - padding * 2) / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: height - padding - ((d.value / max) * (height - padding * 2)),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1]?.x ?? width} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="space-y-2">
      <h4 className="text-data font-semibold">{title}</h4>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(240 6% 10%)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="hsl(240 6% 10%)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#areaGrad)" />
          <path d={pathD} fill="none" stroke="hsl(240 6% 10%)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hovered === i ? 1.5 : 0.8}
              fill="hsl(240 6% 10%)"
              className="cursor-crosshair"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {hovered !== null && points[hovered] && (
            <line
              x1={points[hovered].x}
              y1={padding}
              x2={points[hovered].x}
              y2={height - padding}
              stroke="hsl(240 6% 10%)"
              strokeWidth="0.3"
              strokeDasharray="1 1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hovered !== null && data[hovered] && (
          <div className="absolute top-0 right-0 bg-card shadow-surface rounded px-2 py-1">
            <span className="text-[11px] text-muted-foreground">{data[hovered].label}</span>
            <span className="block font-mono-nums text-data font-medium">
              ${data[hovered].value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
