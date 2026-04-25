import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Student, FluencyLevel } from '../types';

interface FluencyChartProps {
  students: Student[];
  evolutionPeriod: string;
}

const COLORS: Record<string, string> = {
  'Nível 1': '#dc2626',
  'Nível 2': '#f87171',
  'Nível 3': '#fb923c',
  'Nível 4': '#facc15',
  'Leitor Iniciante': '#4ade80',
  'Leitor Fluente': '#16a34a',
};

const FluencyChart: React.FC<FluencyChartProps> = ({ students, evolutionPeriod }) => {
  const evaluatedStudents = students.filter(s => s.history.some(h => h.period === evolutionPeriod));
  
  if (evaluatedStudents.length === 0) {
     return (
        <div className="h-48 w-full flex items-center justify-center text-slate-400 text-xs uppercase tracking-widest">
           Nenhum aluno avaliado
        </div>
     );
  }

  // Count occurrences of each level
  const counts: Record<string, number> = {};
  evaluatedStudents.forEach(s => {
    counts[s.status] = (counts[s.status] || 0) + 1;
  });

  const data = Object.entries(counts).map(([name, value]) => ({
    name,
    value
  }));

  const totalStudents = students.length;
  const evaluatedCount = evaluatedStudents.length;

  return (
    <div className="h-64 w-full relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-[28px] font-black text-slate-800 leading-none">
            {totalStudents > 0 ? Math.round((evaluatedCount / totalStudents) * 100) : 0}%
          </p>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avaliados</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#ccc'} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FluencyChart;