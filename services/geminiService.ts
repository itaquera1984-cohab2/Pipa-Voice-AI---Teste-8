import { Student } from "../types";

export const analyzeReadingFluency = async (
  steps: [string, string, string], 
  ppm: number,
  contextoSimulado: string = ""
): Promise<{ report: string; classification: string; longPauseDetected: boolean }> => {
  try {
    const response = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentSteps: steps, studentPpm: ppm, context: contextoSimulado })
    });

    if (!response.ok) throw new Error('API request failed');
    
    const result = await response.json();
    return {
      report: result.report || "Não foi possível gerar a análise.",
      classification: result.classification || "Nível 1",
      longPauseDetected: !!result.longPauseDetected
    };
  } catch (error) {
    console.error("Error analyzing fluency:", error);
    return {
      report: "Erro ao conectar com a API do Gemini no backend.",
      classification: "Nível 1",
      longPauseDetected: false
    };
  }
};

export const generateClassAnalysis = async (
  className: string,
  students: Student[]
): Promise<string> => {
  try {
    const response = await fetch('/api/gemini/class_analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className, studentsData: students })
    });

    if (!response.ok) throw new Error('API request failed');
    
    const result = await response.json();
    return result.report || "Não foi possível gerar o parecer da turma.";

  } catch (error) {
    console.error("Error generating class analysis:", error);
    return "Erro ao conectar com a API do Gemini no backend.";
  }
};

export const detectEarlyPattern = async (
  transcript: string
): Promise<{ pattern: 'Soletração' | 'Silabação' | 'Nenhum'; confidence: number }> => {
  try {
    const response = await fetch('/api/gemini/detect_early_pattern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });

    if (!response.ok) throw new Error('API request failed');
    
    const result = await response.json();
    return {
      pattern: (result.pattern as any) || "Nenhum",
      confidence: result.confidence || 0
    };
  } catch (error) {
    console.error("Error detecting early pattern:", error);
    return { pattern: "Nenhum", confidence: 0 };
  }
};
