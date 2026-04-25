export type FluencyLevel = 'Nível 1' | 'Nível 2' | 'Nível 3' | 'Nível 4' | 'Leitor Iniciante' | 'Leitor Fluente';

export interface Student {
  id: string | number;
  name: string;
  ppm: number;
  status: FluencyLevel;
  report: string;
  longPauseDetected?: boolean;
  steps: [string, string, string]; // [Palavras, Pseudopalavras, Texto]
  turma: string;
  school: string; // Added for Network Management
  nee: boolean;
  bolsaFamilia: boolean;
  history: { 
    status: FluencyLevel; 
    date: string; 
    period: string; 
    source?: 'Manual' | 'IA' | 'Professor';
    ppm: number;
    report: string;
    longPauseDetected?: boolean;
  }[];
}

export interface Metrics {
  words: number;
  time: number;
  ppm: number;
}

// Minimal type definitions for Web Speech API since it's not fully standard in all TS configs
export interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export type RecordingState = 'idle' | 'recording' | 'analyzing';