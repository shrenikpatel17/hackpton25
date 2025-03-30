'use client';

import { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HealthScoreChartProps {
  startTimestamp: number;
  endTimestamp: number;
  placeholderFunction: (start: number, end: number) => { B: number; D: number; C: number; T: number; };
}

function calculateEyeHealthScore(B: number, D: number, C: number, T: number): number {
  return (
    0.3 * (1 - Math.min(B / 14, 1)) +
    0.2 * (1 - Math.min(D / 80, 1)) +
    0.25 * (1 - Math.min(C / 30, 1)) +
    0.25 * (1 - Math.min(T / 98, 1))
  );
}

export default function HealthScoreChart({ startTimestamp, endTimestamp, placeholderFunction }: HealthScoreChartProps) {
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  const generateTimeIntervals = () => {
    const intervals: { start: number; end: number; label: string }[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;
    
    if (viewMode === 'week') {
      // Generate 7 daily intervals
      for (let i = 0; i < 7; i++) {
        const start = startTimestamp + (i * msPerDay);
        const end = start + msPerDay;
        const date = new Date(start);
        intervals.push({
          start,
          end,
          label: date.toLocaleDateString('en-US', { weekday: 'short' })
        });
      }
    } else {
      // Generate 24 hourly intervals
      const msPerHour = 60 * 60 * 1000;
      for (let i = 0; i < 24; i++) {
        const start = startTimestamp + (i * msPerHour);
        const end = start + msPerHour;
        intervals.push({
          start,
          end,
          label: `${i}:00`
        });
      }
    }
    
    return intervals;
  };

  const intervals = generateTimeIntervals();
  const healthScores = intervals.map(interval => {
    const { B, D, C, T } = placeholderFunction(interval.start, interval.end);
    return calculateEyeHealthScore(B, D, C, T);
  });

  const data = {
    labels: intervals.map(interval => interval.label),
    datasets: [
      {
        label: 'Health Score',
        data: healthScores,
        backgroundColor: healthScores.map(score => 
          score >= 0.85 ? 'rgba(134, 239, 172, 0.8)' : 'rgba(252, 165, 165, 0.8)'
        ),
        borderColor: healthScores.map(score => 
          score >= 0.85 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
        ),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `Eye Health Score - ${viewMode === 'week' ? 'Weekly' : 'Daily'} View`,
        color: 'white',
        font: {
          size: 16,
        },
      },
    },
  };

  return (
    <div className="w-full p-6 bg-white/10 backdrop-blur-md rounded-xl">
      <div className="flex justify-end mb-4">
        <div className="inline-flex rounded-lg overflow-hidden">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              viewMode === 'week'
                ? 'bg-white text-black'
                : 'bg-white/20 text-white hover:bg-white/30'
            } transition-colors`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              viewMode === 'day'
                ? 'bg-white text-black'
                : 'bg-white/20 text-white hover:bg-white/30'
            } transition-colors`}
            onClick={() => setViewMode('day')}
          >
            Day
          </button>
        </div>
      </div>
      <Bar data={data} options={options} />
    </div>
  );
} 