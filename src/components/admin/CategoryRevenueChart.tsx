'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { CategoryPerformanceData } from '../../types';

interface CategoryRevenueChartProps {
  data: CategoryPerformanceData[];
}

export default function CategoryRevenueChart({ data }: CategoryRevenueChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="categoryName"
            tick={{ fontSize: 11, fill: '#64748b' }}
            interval={0}
            angle={-10}
            textAnchor="end"
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(v) => `R${v / 1000}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '12px',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
            }}
            formatter={(value: any, name: any) => [
              name === 'Revenue (ZAR)' ? `R ${Number(value).toLocaleString()}` : value,
              name,
            ]}
          />
          <Bar
            yAxisId="left"
            dataKey="revenueZAR"
            name="Revenue (ZAR)"
            fill="#4f46e5"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="bookingCount"
            name="Bookings Count"
            fill="#f59e0b"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
