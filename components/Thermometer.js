import React from 'react';

export default function Thermometer({ value }) {
  const color = value > 70 ? 'red' : value > 50 ? 'orange' : value > 30 ? 'yellow' : 'blue';
  return (
    <div className="my-6 p-4 bg-white rounded shadow text-center">
      <h2 className="text-xl font-bold mb-2">🔥 Market Heat Index</h2>
      <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full`} style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 text-gray-600">{value.toFixed(1)} / 100</p>
    </div>
  );
}
