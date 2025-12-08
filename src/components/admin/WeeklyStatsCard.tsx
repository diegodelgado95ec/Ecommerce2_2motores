// src/components/admin/WeeklyStatsCard.tsx
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeeklyStatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  sparklineData: number[];
  gradientFrom: string;
  gradientTo: string;
}

export function WeeklyStatsCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  sparklineData,
  gradientFrom,
  gradientTo
}: WeeklyStatsCardProps) {
  // Normalizar datos del sparkline para el SVG
  const max = Math.max(...sparklineData, 1);
  const min = Math.min(...sparklineData, 0);
  const range = max - min || 1;
  const height = 40;
  const width = 100;
  const points = sparklineData.map((value, index) => {
    const x = (index / (sparklineData.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="relative group">
      {/* Glassmorphism Card */}
      <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
        
        <div className="relative p-6">
          {/* Header con Icono */}
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-lg`}>
              <div className="text-white">
                {icon}
              </div>
            </div>
            
            {/* Trend Badge */}
            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trendValue}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
          
          {/* Value */}
          <div className="text-3xl font-bold text-gray-900 mb-3">
            {value}
          </div>

          {/* Sparkline */}
          <div className="mt-4">
            <svg width="100%" height="40" className="overflow-visible">
              <polyline
                points={points}
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-sm"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" className={gradientFrom.replace('from-', 'stop-')} />
                  <stop offset="100%" className={gradientTo.replace('to-', 'stop-')} />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Comparison Text */}
          <p className="mt-2 text-xs text-gray-500">
            Comparado con semana anterior
          </p>
        </div>

        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </div>
  );
}
