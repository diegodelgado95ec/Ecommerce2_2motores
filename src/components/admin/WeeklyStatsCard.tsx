// src/components/admin/WeeklyStatsCard.tsx
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeeklyStatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  sparklineData?: number[]; // Opcional, ya no se usa
  gradientFrom: string;
  gradientTo: string;
}

export function WeeklyStatsCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  gradientFrom,
  gradientTo
}: WeeklyStatsCardProps) {
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
        return 'text-green-600 bg-green-50 border-green-200';
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="relative group">
      {/* Glassmorphism Card */}
      <div className="relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
        
        <div className="relative p-6">
          {/* Header con Icono y Trend */}
          <div className="flex items-start justify-between mb-6">
            {/* Icono Grande con Gradiente */}
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
              <div className="text-white">
                {icon}
              </div>
            </div>
            
            {/* Trend Badge */}
            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getTrendColor()} shadow-sm`}>
              {getTrendIcon()}
              <span>{trendValue}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-gray-600 mb-2 uppercase tracking-wide">
            {title}
          </h3>
          
          {/* Value - Más Grande y Prominente */}
          <div className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-3">
            {value}
          </div>

          {/* Comparison Text */}
          <p className="text-xs text-gray-500 flex items-center">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
            vs. semana anterior
          </p>
        </div>

        {/* Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </div>
  );
}
