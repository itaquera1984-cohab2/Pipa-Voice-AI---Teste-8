import React from 'react';
import { Student, FluencyLevel } from '../types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EvolutionMapTableProps {
  students: Student[];
  currentPeriod: string;
  comparePeriod: string | null;
}

const IFL_WEIGHTS: Record<string, number> = {
  'Nível 1': 0,
  'Nível 2': 1,
  'Nível 3': 2.5,
  'Nível 4': 4,
  'Leitor Iniciante': 6,
  'Leitor Fluente': 10,
  'Não Avaliado': 0
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Nível 1': return 'bg-red-600 text-white';
    case 'Nível 2': return 'bg-red-400 text-white';
    case 'Nível 3': return 'bg-orange-400 text-white';
    case 'Nível 4': return 'bg-yellow-400 text-slate-900';
    case 'Leitor Iniciante': return 'bg-green-400 text-white';
    case 'Leitor Fluente': return 'bg-green-600 text-white';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export const EvolutionMapTable: React.FC<EvolutionMapTableProps> = ({ students, currentPeriod, comparePeriod }) => {
  if (!comparePeriod) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
        <p className="text-slate-400 font-medium italic">Selecione um período de comparação no gráfico acima para visualizar o Mapa de Evolução.</p>
      </div>
    );
  }

  const getStatusForPeriod = (student: Student, period: string) => {
    const historyEntry = student.history?.find(h => h.period === period);
    return historyEntry ? historyEntry.status : 'Não Avaliado';
  };

  const getEvolutionStatus = (startLevel: string, endLevel: string) => {
    const startWeight = IFL_WEIGHTS[startLevel] || 0;
    const endWeight = IFL_WEIGHTS[endLevel] || 0;

    if (endWeight > startWeight) return 'Avanço';
    if (endWeight < startWeight) return 'Regressão';
    return 'Manteve';
  };

  const getImpactIFL = (startLevel: string, endLevel: string) => {
    const startWeight = IFL_WEIGHTS[startLevel] || 0;
    const endWeight = IFL_WEIGHTS[endLevel] || 0;
    return endWeight - startWeight;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden no-print">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-800">Mapa de Evolução de Fluência</h3>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
          Comparativo: <span className="text-indigo-600">{comparePeriod}</span> vs <span className="text-indigo-600">{currentPeriod}</span>
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100">
              <th className="px-6 py-4">Aluno</th>
              <th className="px-6 py-4">Ponto de Partida ({comparePeriod})</th>
              <th className="px-6 py-4">Ponto Atual ({currentPeriod})</th>
              <th className="px-6 py-4 text-center">Status de Evolução</th>
              <th className="px-6 py-4 text-center">Impacto IFL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {students.map((student) => {
              const startLevel = getStatusForPeriod(student, comparePeriod);
              const endLevel = getStatusForPeriod(student, currentPeriod);
              const evolution = getEvolutionStatus(startLevel, endLevel);
              const impact = getImpactIFL(startLevel, endLevel);

              return (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-700">{student.name}</p>
                    {student.nee && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase mt-1 inline-block">NEE</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide ${getStatusBadgeClass(startLevel)}`}>{startLevel}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide ${getStatusBadgeClass(endLevel)}`}>{endLevel}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      {evolution === 'Avanço' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                          <TrendingUp className="w-3 h-3" /> Avanço
                        </span>
                      )}
                      {evolution === 'Manteve' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                          <Minus className="w-3 h-3" /> Manteve
                        </span>
                      )}
                      {evolution === 'Regressão' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                          <TrendingDown className="w-3 h-3" /> Regressão
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-black ${impact > 0 ? 'text-emerald-600' : impact < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {impact > 0 ? '+' : ''}{impact.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
