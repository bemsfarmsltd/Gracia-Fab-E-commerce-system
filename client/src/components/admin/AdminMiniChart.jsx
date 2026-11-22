import { useId } from "react";

/**
 * Lightweight SVG sparkline / area chart for DashLite-inspired metric cards.
 * Zero external charting library dependencies.
 */
export default function AdminMiniChart({
  data = [],
  strokeColor = "#7A2432",
  fillColor,
  height = 42,
  width = "100%",
  ariaLabel = "Trend chart",
}) {
  const chartId = useId();

  if (!data || data.length === 0) {
    return (
      <div className="admin-mini-chart-empty" style={{ height }} aria-hidden="true" />
    );
  }

  // Extract raw numerical values
  const values = data.map((d) => (typeof d === "number" ? d : Number(d.value ?? d.revenue ?? d.paidOrders ?? d.newCustomers ?? 0)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const viewBoxWidth = 200;
  const viewBoxHeight = 50;
  const paddingY = 6;
  const usableHeight = viewBoxHeight - paddingY * 2;

  // Generate points
  const points = values.map((val, idx) => {
    const x = values.length > 1 ? (idx / (values.length - 1)) * viewBoxWidth : viewBoxWidth / 2;
    const y = viewBoxHeight - paddingY - ((val - min) / range) * usableHeight;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  const linePath = points.reduce(
    (acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
    ""
  );

  const areaPath = `${linePath} L ${viewBoxWidth} ${viewBoxHeight} L 0 ${viewBoxHeight} Z`;
  const gradientId = `chart-grad-${chartId.replace(/:/g, "")}`;
  const effectiveFill = fillColor || strokeColor;

  return (
    <div className="admin-mini-chart-wrap" style={{ height, width }}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="none"
        className="admin-mini-chart-svg"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={effectiveFill} stopOpacity="0.28" />
            <stop offset="100%" stopColor={effectiveFill} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
