import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { TimeSeriesData } from '../../types';

interface TimeSeriesDisplayProps {
  timeSeries: TimeSeriesData;
}

const SERIES_LIMIT = 5;

function buildSparklinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

function computeTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const diff = last - prev;
  const threshold = Math.abs(prev) * 0.01 || 0.01;
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
}

const SeriesCard: React.FC<{ name: string; points: Array<{ timestamp: string; value: number }> }> = ({ name, points }) => {
  if (points.length === 0) return null;

  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const values = sorted.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const W = 200;
  const H = 40;
  const PAD = 2;

  const svgPoints = values.map((v, i) => ({
    x: PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - (v - minVal) / range) * (H - PAD * 2),
  }));

  const latest = values[values.length - 1];
  const trend = computeTrend(values);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-green-600'
      : trend === 'down'
        ? 'text-red-500'
        : 'text-gray-400';

  return (
    <div className="p-3 bg-white rounded-lg border border-gray-100">
      <div className="text-xs font-semibold text-gray-700 mb-2 truncate" title={name}>
        {name}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <path
          d={buildSparklinePath(svgPoints)}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {svgPoints.length > 0 && (
          <circle
            cx={svgPoints[svgPoints.length - 1].x}
            cy={svgPoints[svgPoints.length - 1].y}
            r="2.5"
            fill="#6366f1"
          />
        )}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-sm font-bold text-gray-800">
          {latest.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
        </span>
        <TrendIcon size={14} className={trendColor} />
      </div>
    </div>
  );
};

const TimeSeriesDisplay: React.FC<TimeSeriesDisplayProps> = ({ timeSeries }) => {
  const [showAll, setShowAll] = useState(false);

  const seriesNames = Object.keys(timeSeries);
  if (seriesNames.length === 0) return null;

  const displayed = showAll ? seriesNames : seriesNames.slice(0, SERIES_LIMIT);
  const hasMore = seriesNames.length > SERIES_LIMIT;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
      <div className="flex items-center space-x-2 mb-3">
        <BarChart3 size={16} className="text-gray-800" />
        <span className="text-xs font-bold text-gray-800 uppercase">时间序列</span>
        <span className="text-xs text-gray-400">({seriesNames.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {displayed.map((name) => (
          <SeriesCard key={name} name={name} points={timeSeries[name]} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {showAll ? (
            <>
              收起 <ChevronUp size={12} />
            </>
          ) : (
            <>
              显示更多 ({seriesNames.length - SERIES_LIMIT}) <ChevronDown size={12} />
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default TimeSeriesDisplay;
