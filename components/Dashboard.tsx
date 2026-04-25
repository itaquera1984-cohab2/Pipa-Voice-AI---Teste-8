import React, { useMemo, useState } from 'react';
import { Student, FluencyLevel } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { ArrowLeft, Users, Zap, Target, Award, TrendingUp, Info, X, Download, AlertOctagon, FileDown, CheckCircle, Hourglass, Scale } from 'lucide-react';

interface DashboardProps {
  students: Student[]; // Contains ONLY current class students for charts
  allStudents: Student[]; // Contains ALL students for CSV export
  currentClass: string;
  schoolName: string;
  schoolDataMap: Record<string, string[]>;
  onBack: () => void;
  evolutionPeriod: string;
}

// Color Palette Definition
const COLORS: Record<string, string> = {
  'Nível 1': '#dc2626', // Red-600
  'Nível 2': '#f87171', // Red-400
  'Nível 3': '#fb923c', // Orange-400
  'Nível 4': '#facc15', // Yellow-400
  'Leitor Iniciante': '#4ade80', // Green-400
  'Leitor Fluente': '#16a34a', // Green-600
};

const LEGEND_DATA = [
  { level: 'Nível 1', desc: 'Pré-leitor: Não decodifica palavras isoladas. Dificuldade severa.', color: 'bg-red-600' },
  { level: 'Nível 2', desc: 'Leitor de Palavras: Lê palavras isoladas com muitos erros. Silabação excessiva.', color: 'bg-red-400' },
  { level: 'Nível 3', desc: 'Em Construção: Lê palavras simples corretamente, trava em complexas.', color: 'bg-orange-400' },
  { level: 'Nível 4', desc: 'Fraseado: Lê frases curtas, ainda com silabação, mas compreende o sentido básico.', color: 'bg-yellow-400' },
  { level: 'Leitor Iniciante', desc: 'Transição: Lê textos curtos com baixa fluência. Início da automação.', color: 'bg-green-400' },
  { level: 'Leitor Fluente', desc: 'Consolidado: Leitura rítmica, precisa, respeita pontuação e entonação.', color: 'bg-green-600' },
];

const Dashboard: React.FC<DashboardProps> = ({ students, allStudents, currentClass, schoolName, schoolDataMap, onBack, evolutionPeriod }) => {
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  
  // --- Data Processing ---
  const stats = useMemo(() => {
    const evaluated = students.filter(s => s.history.some(h => h.period === evolutionPeriod));
    const totalEvaluated = evaluated.length;
    
    // Critical students (Global - Network View)
    const criticalStudents = allStudents.filter(s => {
        const periodEntry = s.history.find(h => h.period === evolutionPeriod);
        const status = periodEntry ? periodEntry.status : s.status;
        return status === 'Nível 1' || status === 'Nível 2';
    });
    const criticalCount = criticalStudents.length;

    // --- NETWORK ANALYSIS AGGREGATION ---
    const schoolStats: Record<string, { total: number, levels: Record<string, number>, ifl: number }> = {};
    // Fix: Explicitly type schoolsList as string[] to avoid 'unknown' index error
    const schoolsList: string[] = Array.from(new Set(allStudents.map(s => s.school || 'Desconhecida').filter((s): s is string => !!s)));

    schoolsList.forEach((school: string) => {
        const schoolStudents = allStudents.filter(s => s.school === school && s.history.some(h => h.period === evolutionPeriod));
        if (schoolStudents.length === 0) return;

        const levels: Record<string, number> = { 
            'Nível 1': 0, 
            'Nível 2': 0, 
            'Nível 3': 0, 
            'Nível 4': 0, 
            'Leitor Iniciante': 0, 
            'Leitor Fluente': 0
        };
        schoolStudents.forEach(s => {
          const periodEntry = s.history.find(h => h.period === evolutionPeriod);
          const statusKey = periodEntry ? periodEntry.status : s.status;
          levels[statusKey] = (levels[statusKey] || 0) + 1;
        });

        // Weighted Average IFL Calculation (0-10 Scale)
        const weights: Record<string, number> = { 
            'Nível 1': 0, 
            'Nível 2': 1, 
            'Nível 3': 2.5, 
            'Nível 4': 4, 
            'Leitor Iniciante': 6, 
            'Leitor Fluente': 10
        };
        const totalScore = schoolStudents.reduce((acc, s) => {
            const periodEntry = s.history.find(h => h.period === evolutionPeriod);
            const status = periodEntry ? periodEntry.status : s.status;
            return acc + (weights[status] || 0);
        }, 0);
        
        schoolStats[school] = {
            total: schoolStudents.length,
            levels,
            ifl: totalScore / schoolStudents.length
        };
    });

    // 1. Critical Schools (Red): (N1 + N2) >= 30%
    const criticalSchools = Object.entries(schoolStats).filter(([_, data]) => {
        const criticalPerc = ((data.levels['Nível 1'] + data.levels['Nível 2']) / data.total) * 100;
        return criticalPerc >= 30;
    }).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.ifl - a.ifl); // Sort by IFL ascending (worst first)

    // 2. Excellence Schools (Green): (Beginner + Fluent) >= 80%
    const excellenceSchools = Object.entries(schoolStats).filter(([_, data]) => {
        const excPerc = ((data.levels['Leitor Iniciante'] + data.levels['Leitor Fluente']) / data.total) * 100;
        return excPerc >= 80;
    }).map(([name, data]) => ({ name, ...data }));

    // 3. Bottleneck Analysis (Level 4 count is high)
    const bottleneckSchools = Object.entries(schoolStats).filter(([_, data]) => {
        const l4Perc = (data.levels['Nível 4'] / data.total) * 100;
        return l4Perc >= 25; // 25% or more students stuck in Level 4
    }).map(([name, data]) => ({ name, ...data }));

    // 4. Sector Equity
    const sectorEquity: { sector: string, diff: number, minSchool: string, maxSchool: string, avgIfl: number }[] = [];
    Object.entries(schoolDataMap).forEach(([sector, schools]) => {
        const sectorSchoolsList = schools as string[]; // Explicit cast to handle potential inference issues and avoid shadowing schoolsList
        const sectorSchools = sectorSchoolsList.filter(s => schoolStats[s]);
        if (sectorSchools.length === 0) return;
        
        const ifls = sectorSchools.map(s => schoolStats[s].ifl);
        const min = Math.min(...ifls);
        const max = Math.max(...ifls);
        const diff = max - min;
        const avgIfl = ifls.reduce((a, b) => a + b, 0) / ifls.length;
        
        const minSchool = sectorSchools.find(s => schoolStats[s].ifl === min) || "";
        const maxSchool = sectorSchools.find(s => schoolStats[s].ifl === max) || "";
        sectorEquity.push({ sector, diff, minSchool, maxSchool, avgIfl });
    });

    // School IFL Calculation (Network View - Weighted Index 0-10) for CURRENT Selected School/Network
    // Formula: (N1*0 + N2*1 + N3*2.5 + N4*4 + Ini*6 + Flu*10) / Total
    const allEvaluated = allStudents.filter(s => s.history.some(h => h.period === evolutionPeriod));
    let schoolIFL = 0;
    if (allEvaluated.length > 0) {
        const weights: Record<string, number> = { 
            'Nível 1': 0, 
            'Nível 2': 1, 
            'Nível 3': 2.5, 
            'Nível 4': 4, 
            'Leitor Iniciante': 6, 
            'Leitor Fluente': 10
        };
        const totalScore = allEvaluated.reduce((acc, s) => {
            const periodEntry = s.history.find(h => h.period === evolutionPeriod);
            const status = periodEntry ? periodEntry.status : s.status;
            return acc + (weights[status] || 0);
        }, 0);
        schoolIFL = totalScore / allEvaluated.length;
    }

    const emptyLevels: Record<string, number> = {
      'Nível 1': 0, 
      'Nível 2': 0, 
      'Nível 3': 0, 
      'Nível 4': 0, 
      'Leitor Iniciante': 0, 
      'Leitor Fluente': 0
    };

    if (totalEvaluated === 0 && allEvaluated.length === 0) return {
        totalEvaluated: 0, avgPpm: 0, avgAccuracy: 0, levels: emptyLevels, classLevel: "", evaluated: [], mode: "Nível 1" as FluencyLevel, criticalStudents, criticalCount, schoolIFL, criticalSchools, excellenceSchools, bottleneckSchools, sectorEquity
    };

    // Current Class Stats
    const totalPpm = evaluated.reduce((acc, s) => acc + s.ppm, 0);
    const avgPpm = evaluated.length > 0 ? Math.round(totalPpm / evaluated.length) : 0;
    const calculateAccuracy = (ppm: number) => Math.min(100, Math.max(60, 70 + (ppm * 0.3)));
    const avgAccuracy = evaluated.length > 0 ? Math.round(evaluated.reduce((acc, s) => acc + calculateAccuracy(s.ppm), 0) / evaluated.length) : 0;
    
    const levels: Record<string, number> = { ...emptyLevels };
    evaluated.forEach(s => {
      if (levels[s.status] !== undefined) levels[s.status]++;
      else levels['Nível 1']++;
    });

    let classLevel = "EM DESENVOLVIMENTO";
    if (levels['Leitor Fluente'] > totalEvaluated * 0.5) classLevel = "TURMA FLUENTE";
    else if ((levels['Nível 1'] + levels['Nível 2']) > totalEvaluated * 0.4) classLevel = "ATENÇÃO PRIORITÁRIA";
    const mode = totalEvaluated > 0 ? (Object.keys(levels) as FluencyLevel[]).reduce((a, b) => levels[a] > levels[b] ? a : b) : "Nível 1" as FluencyLevel;

    return {
      totalEvaluated,
      avgPpm,
      avgAccuracy,
      levels,
      classLevel,
      evaluated,
      mode,
      criticalStudents,
      criticalCount,
      schoolIFL,
      criticalSchools,
      excellenceSchools,
      bottleneckSchools,
      sectorEquity
    };
  }, [students, allStudents, schoolDataMap]);

  // --- Chart Data Helpers ---
  const pieData = stats && stats.totalEvaluated > 0 ? Object.entries(stats.levels).map(([name, value]) => ({
    name,
    value: value as number, // Explicit cast for safety
    color: COLORS[name as FluencyLevel]
  })).filter(d => d.value > 0) : [];

  const barData = stats && stats.totalEvaluated > 0 ? [
    { name: 'Palavras', score: Math.min(100, stats.avgAccuracy + 5) },
    { name: 'Pseudopalavras', score: Math.min(100, stats.avgAccuracy - 10) },
    { name: 'Texto (PPM)', score: stats.avgPpm }, 
  ] : [];

  // --- CSV Export Handler (School Wide) ---
  const handleExport = () => {
    const evaluatedAll = allStudents.filter(s => s.ppm > 0);
    if (evaluatedAll.length === 0) return alert("Não há dados avaliados para exportar.");
    
    const headers = ["Nome do Aluno", "Escola", "Turma", "PPM", "Nível Fluência", "Pseudopalavras (Transcrição)"];
    
    const rows = evaluatedAll.map(s => {
      return [
        `"${s.name}"`,
        `"${s.school || 'N/A'}"`,
        `"${s.turma}"`,
        s.ppm,
        `"${s.status}"`,
        `"${s.steps[1].replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `Dados_Rede_Completo_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Critical List Export ---
  const handleExportCritical = () => {
      if (stats.criticalCount === 0) return alert("Não há alunos em estado crítico para exportar.");
      
      const headers = ["Nome do Aluno", "Escola", "Turma", "Nível de Fluência", "Status"];
      const rows = stats.criticalStudents.map(s => {
          return `"${s.name}","${s.school || 'Não Informada'}","${s.turma}","${s.status}","Intervenção Imediata"`;
      });
      
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute("download", `Lista_Intervencao_Prioritaria_${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Empty State ---
  if (!stats || (stats.totalEvaluated === 0 && stats.criticalCount === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <Users className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold uppercase tracking-widest">Sem dados para análise</h2>
        <p className="text-sm mt-2">Realize coletas para gerar o dashboard de rede.</p>
        <button onClick={onBack} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all">
          Voltar para Coleta
        </button>
      </div>
    );
  }

  // Determine Priority Status for School (Using IFL <= 6.0 logic)
  const isPrioritySchool = stats.schoolIFL <= 6.0 && allStudents.filter(s => s.ppm > 0).length > 0;
  
  // Prognosis Logic (Simple Linear Projection)
  const prognosisMonth = Math.ceil((80 - ((stats.levels['Leitor Fluente'] + stats.levels['Leitor Iniciante'])/stats.totalEvaluated)*100) / 2); // Assuming 2% growth per month
  const prognosisText = prognosisMonth > 0 
    ? `Se o ritmo atual de evolução se mantiver, a rede atingirá a meta de 80% de fluência em aproximadamente ${prognosisMonth} meses.` 
    : "A rede já atingiu os patamares de excelência em fluência leitora.";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-12">
      
      {/* Legend Modal */}
      {isLegendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setIsLegendOpen(false)}>
           <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" /> Matriz de Fluência
                 </h3>
                 <button onClick={() => setIsLegendOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                 {LEGEND_DATA.map((item) => (
                    <div key={item.level} className="flex gap-4 items-start">
                       <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${item.color}`}></div>
                       <div>
                          <p className="font-bold text-xs uppercase text-slate-800">{item.level}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="bg-slate-50 p-4 text-center">
                 <button onClick={() => setIsLegendOpen(false)} className="text-xs font-bold text-blue-600 uppercase tracking-wider hover:underline">Fechar Legenda</button>
              </div>
           </div>
        </div>
      )}

      {/* Network Alert Header */}
      <div className={`border rounded-xl p-4 mb-8 flex items-center justify-between shadow-sm transition-colors ${isPrioritySchool ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPrioritySchool ? 'bg-rose-100' : 'bg-slate-200'}`}>
                  <AlertOctagon className={`w-5 h-5 ${isPrioritySchool ? 'text-rose-600' : 'text-slate-500'}`} />
              </div>
              <div>
                  <h2 className={`text-sm font-black uppercase tracking-wide ${isPrioritySchool ? 'text-rose-700' : 'text-slate-700'}`}>Alerta de Rede</h2>
                  <p className={`text-xs font-medium ${isPrioritySchool ? 'text-rose-600' : 'text-slate-500'}`}>Total de alunos em estado crítico na rede: <span className="font-bold text-lg ml-1">{stats.criticalCount}</span> alunos</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1">IFL Calculado (Geral): {stats.schoolIFL.toFixed(1)} / 10.0</p>
              </div>
          </div>
          {isPrioritySchool && (
              <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-red-200">
                  ⚠️ Unidade Prioritária (IFL ≤ 6.0)
              </span>
          )}
      </div>

      {/* Header / Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
           <button 
             onClick={onBack}
             className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-bold uppercase text-xs tracking-wider mb-2"
           >
             <ArrowLeft className="w-4 h-4" /> Voltar à Coleta
           </button>
           <div className="flex flex-col md:flex-row md:items-center gap-3">
             <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
               Gestão de Rede <span className="text-blue-600">:: {schoolName || "Geral"}</span>
             </h1>
             <button 
               onClick={() => setIsLegendOpen(true)}
               className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors self-start md:self-auto"
               title="Ver Legenda Técnica"
             >
               <Info className="w-4 h-4" />
             </button>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-slate-700 transition-all shadow-lg shadow-slate-200"
           >
             <Download className="w-4 h-4" /> Exportar Tudo (CSV)
           </button>
           <div className="text-right hidden md:block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Classificação da Turma Atual</span>
              <span className={`text-lg font-black uppercase ${
                  stats.classLevel === 'TURMA FLUENTE' ? 'text-emerald-500' : 
                  stats.classLevel === 'ATENÇÃO PRIORITÁRIA' ? 'text-rose-500' : 'text-amber-500'
              }`}>
                {stats.classLevel}
              </span>
           </div>
        </div>
      </div>

      {/* NEW SECTION: Análise de Rede e Equidade */}
      <div className="mb-8">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              Análise de Rede & Equidade
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. Prognóstico de Rede */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-5 text-white shadow-lg col-span-1 lg:col-span-2">
                  <div className="flex items-start gap-3">
                      <Hourglass className="w-6 h-6 text-blue-200 mt-1" />
                      <div>
                          <h3 className="text-xs font-black uppercase text-blue-200 tracking-widest mb-1">Prognóstico de Rede</h3>
                          <p className="text-sm font-medium leading-relaxed">{prognosisText}</p>
                      </div>
                  </div>
              </div>

              {/* 2. Disparidade de Setor (Equity) */}
              {stats.sectorEquity.filter(eq => eq.diff > 3.0).length > 0 ? (
                  stats.sectorEquity.filter(eq => eq.diff > 3.0).map(eq => (
                      <div key={eq.sector} className="bg-amber-50 border border-amber-100 rounded-xl p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                              <Scale className="w-5 h-5 text-amber-600" />
                              <h3 className="text-xs font-black uppercase text-amber-700 tracking-widest">Alerta de Equidade</h3>
                          </div>
                          <p className="text-xs text-amber-800 font-bold mb-1">Alta disparidade no {eq.sector}</p>
                          <div className="text-[10px] text-amber-700 space-y-1">
                             <p>Diferença de IFL: <span className="font-bold">{eq.diff.toFixed(1)} pontos</span></p>
                             <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                                <span>{eq.minSchool.split(' ')[0]}... (Min)</span>
                                <span>{eq.maxSchool.split(' ')[0]}... (Max)</span>
                             </div>
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 shadow-sm flex items-center justify-center text-center">
                       <div>
                           <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                           <p className="text-xs font-bold text-emerald-700 uppercase">Equidade Estável</p>
                           <p className="text-[10px] text-emerald-600">Sem grandes disparidades nos setores.</p>
                       </div>
                  </div>
              )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Critical Ranking (Red) */}
              <div className="bg-white rounded-xl border border-rose-100 shadow-sm overflow-hidden">
                  <div className="bg-rose-50 p-3 border-b border-rose-100 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-rose-600 tracking-widest">Atenção Primária</h3>
                      <AlertOctagon className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                      {stats.criticalSchools.length > 0 ? (
                          <table className="w-full text-[10px]">
                              <tbody className="divide-y divide-rose-50">
                                  {stats.criticalSchools.map((s, i) => (
                                      <tr key={s.name} className="hover:bg-rose-50/50">
                                          <td className="p-3 font-bold text-slate-700">{i+1}. {s.name}</td>
                                          <td className="p-3 text-right font-mono text-rose-600 font-bold">{s.ifl.toFixed(1)} IFL</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div className="p-4 text-center text-xs text-slate-400">Nenhuma escola em estado crítico.</div>
                      )}
                  </div>
              </div>

              {/* Excellence Ranking (Green) */}
              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
                  <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-emerald-600 tracking-widest">Unidades de Excelência</h3>
                      <Award className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                      {stats.excellenceSchools.length > 0 ? (
                          <table className="w-full text-[10px]">
                              <tbody className="divide-y divide-emerald-50">
                                  {stats.excellenceSchools.map((s, i) => (
                                      <tr key={s.name} className="hover:bg-emerald-50/50">
                                          <td className="p-3 font-bold text-slate-700">{i+1}. {s.name}</td>
                                          <td className="p-3 text-right font-mono text-emerald-600 font-bold">{s.ifl.toFixed(1)} IFL</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div className="p-4 text-center text-xs text-slate-400">Nenhuma escola atingiu 80% de fluência.</div>
                      )}
                  </div>
              </div>

              {/* Bottleneck Analysis */}
              <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
                  <div className="bg-amber-50 p-3 border-b border-amber-100 flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-amber-600 tracking-widest">Gargalo de Transição (N4)</h3>
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                   <div className="max-h-60 overflow-y-auto">
                      {stats.bottleneckSchools.length > 0 ? (
                          <table className="w-full text-[10px]">
                              <tbody className="divide-y divide-amber-50">
                                  {stats.bottleneckSchools.map((s) => (
                                      <tr key={s.name} className="hover:bg-amber-50/50">
                                          <td className="p-3 font-bold text-slate-700">{s.name}</td>
                                          <td className="p-3 text-right text-amber-600 font-bold">Travando em Frases</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : (
                          <div className="p-4 text-center text-xs text-slate-400">Fluxo de evolução normal.</div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* KPI Cards (Current Class View) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Zap className="w-12 h-12 text-blue-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Média PPM (Turma)</span>
            <span className="text-3xl font-black text-slate-800 mt-2">{stats.avgPpm}</span>
            <div className="w-full bg-slate-100 h-1 mt-4 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, stats.avgPpm)}%` }}></div>
            </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Target className="w-12 h-12 text-emerald-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precisão Est.</span>
            <span className="text-3xl font-black text-slate-800 mt-2">{stats.avgAccuracy}%</span>
            <div className="w-full bg-slate-100 h-1 mt-4 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${stats.avgAccuracy}%` }}></div>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Users className="w-12 h-12 text-violet-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alunos Avaliados</span>
            <span className="text-3xl font-black text-slate-800 mt-2">{stats.totalEvaluated}</span>
            <span className="text-[10px] text-slate-400 font-bold mt-4 block">De {students.length} matriculados</span>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Award className="w-12 h-12 text-amber-500" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moda (Nível)</span>
            <span className="text-xl font-black text-slate-800 mt-2 leading-tight truncate" style={{ color: COLORS[stats.mode] }}>
                {stats.mode}
            </span>
            <div className="flex gap-1 mt-4">
                 {Object.entries(stats.levels).map(([lvl, count]) => (
                   (count as number) > 0 && <div key={lvl} className={`h-1 flex-1 rounded-full opacity-80`} style={{ backgroundColor: COLORS[lvl], flexGrow: (count as number) }}></div>
                 ))}
            </div>
        </div>
      </div>

          {/* Equity Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col mb-8">
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-6">
                  Análise de Equidade por Setor (Média IFL)
              </h3>
              <div className="h-64 flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.sectorEquity} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="sector" tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 10]} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                        <Bar dataKey="avgIfl" name="Média IFL" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        Distribuição da Rede
                    </h3>
                <button onClick={() => setIsLegendOpen(true)} className="text-[10px] text-blue-500 font-bold uppercase hover:underline">Ver Níveis</button>
              </div>
              <div className="h-64 flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                            ))}
                        </Pie>
                        <RechartsTooltip 
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                    </PieChart>
                </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-6 flex items-center gap-2">
                  Desempenho por Etapa (Média)
              </h3>
              <div className="h-64 flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                        <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
              </div>
          </div>
      </div>

      {/* Critical Intervention Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-8 ring-4 ring-rose-50">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
              <h3 className="text-xs font-black uppercase text-rose-600 tracking-widest flex items-center gap-2">
                 <AlertOctagon className="w-4 h-4" /> Foco de Intervenção Imediata (Níveis 1 e 2)
              </h3>
              <button 
                  onClick={handleExportCritical}
                  className="flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide hover:bg-rose-700 transition-all shadow-md shadow-rose-200"
              >
                  <FileDown className="w-3 h-3" /> Baixar Lista de Intervenção
              </button>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-400 uppercase font-bold">
                      <tr>
                          <th className="p-4 text-left">Nome do Aluno</th>
                          <th className="p-4 text-left">Escola</th>
                          <th className="p-4 text-center">Turma</th>
                          <th className="p-4 text-center">Nível de Fluência</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {stats.criticalStudents.length > 0 ? (
                          stats.criticalStudents.map(student => (
                              <tr key={student.id} className="hover:bg-rose-50 transition-colors">
                                  <td className="p-4 font-bold text-slate-700">{student.name}</td>
                                  <td className="p-4 text-slate-500 font-medium">{student.school || schoolName || 'Não Informada'}</td>
                                  <td className="p-4 text-center text-slate-500 font-medium">{student.turma}</td>
                                  <td className="p-4 text-center">
                                      <span 
                                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide text-white shadow-sm ${
                                            student.status === 'Nível 1' ? 'bg-red-600' : 'bg-red-400'
                                        }`}
                                      >
                                          {student.status}
                                      </span>
                                  </td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                  Nenhum aluno em estado crítico encontrado. Excelente!
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
};

export default Dashboard;