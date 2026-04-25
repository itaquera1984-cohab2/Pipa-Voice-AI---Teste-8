import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Student } from '../types';

interface EvolutionChartProps {
  students: Student[];
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  comparePeriod: string | null;
  setComparePeriod: (period: string | null) => void;
}

const COLORS: { [key: string]: string } = {
  'Nível 1': '#dc2626',
  'Nível 2': '#f87171',
  'Nível 3': '#fb923c',
  'Nível 4': '#facc15',
  'Leitor Iniciante': '#4ade80',
  'Leitor Fluente': '#16a34a',
  'Não Avaliado': '#94a3b8'
};

const IFL_WEIGHTS: { [key: string]: number } = {
  'Nível 1': 0,
  'Nível 2': 1,
  'Nível 3': 2.5,
  'Nível 4': 4,
  'Leitor Iniciante': 6,
  'Leitor Fluente': 10
};

export const EvolutionChart: React.FC<EvolutionChartProps> = ({ 
  students, 
  selectedPeriod, 
  setSelectedPeriod, 
  comparePeriod, 
  setComparePeriod 
}) => {
  const periods = ['Entrada', 'Simulado 1', 'Simulado 2', 'Saída'];

  const getStatusForPeriod = (student: Student, period: string) => {
    const historyEntry = student.history?.find(h => h.period === period);
    return historyEntry ? historyEntry.status : 'Não Avaliado';
  };

  const calculateIFL = (period: string) => {
    const evaluatedStudents = students.filter(s => getStatusForPeriod(s, period) !== 'Não Avaliado');
    const totalEvaluated = evaluatedStudents.length;
    
    const totalWeight = evaluatedStudents.reduce((sum, student) => {
      const status = getStatusForPeriod(student, period);
      return sum + (IFL_WEIGHTS[status] || 0);
    }, 0);

    return totalEvaluated > 0 ? (totalWeight / totalEvaluated) : 0;
  };

  const currentIFL = calculateIFL(selectedPeriod);
  const previousIFL = comparePeriod ? calculateIFL(comparePeriod) : null;
  const diff = previousIFL !== null ? currentIFL - previousIFL : null;

  const distribution = students.reduce((acc: { [key: string]: number }, student) => {
    const status = getStatusForPeriod(student, selectedPeriod);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(distribution).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => {
    const order = [
      'Nível 1', 
      'Nível 2', 
      'Nível 3', 
      'Nível 4', 
      'Leitor Iniciante', 
      'Leitor Fluente', 
      'Não Avaliado'
    ];
    return order.indexOf(a.name) - order.indexOf(b.name);
  });

  const totalEvaluated = students.filter(s => getStatusForPeriod(s, selectedPeriod) !== 'Não Avaliado').length;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 no-print">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Distribuição de Evolução</h3>
          <p className="text-sm text-slate-500">Acompanhamento por período estratégico</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periods.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedPeriod === period
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Selector */}
      <div className="flex items-center gap-2 mb-6 p-2 bg-slate-50 rounded-xl border border-slate-100">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Comparar com:</span>
        <div className="flex gap-1">
            {periods.filter(p => p !== selectedPeriod).map(p => (
                <button
                    key={p}
                    onClick={() => setComparePeriod(comparePeriod === p ? null : p)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        comparePeriod === p
                            ? 'bg-blue-100 text-blue-600 border border-blue-200'
                            : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                    }`}
                >
                    {p}
                </button>
            ))}
            {comparePeriod && (
                <button onClick={() => setComparePeriod(null)} className="text-[10px] font-bold text-rose-500 hover:underline ml-2">Limpar</button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="h-64 w-full relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="font-black text-indigo-600 leading-none" style={{ fontSize: '28px' }}>{currentIFL.toFixed(2)}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Índice IFL</p>
            
            {diff !== null && (
                <div className={`mt-1 font-black text-base ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                    {diff > 0 ? '+' : diff < 0 ? '-' : ''}{Math.abs(diff).toFixed(2)}
                </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#ccc'} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {data.filter(d => d.name !== 'Não Avaliado').map((item) => (
            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[item.name] }} />
                <span className="text-sm font-medium text-slate-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-400">Peso: {IFL_WEIGHTS[item.name]}</span>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            </div>
          ))}
          <div className="pt-4 border-t border-slate-100 mt-4">
            <div className="flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-wider">
              <span>Total Avaliados</span>
              <span>{totalEvaluated}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
