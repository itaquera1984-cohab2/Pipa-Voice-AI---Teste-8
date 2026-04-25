/**
 * --------------------------------------------------------------------------
 * PIPA Voice AI (Plano de Intervenção Pedagógico Amplo)
 *
 * Autor: HENRIQUE MORAIS
 * Propósito: Tecnologia de Análise de Fluência Leitora e Redução de Desigualdades.
 *
 * Aviso Legal: Todos os direitos reservados. A reprodução ou distribuição 
 * não autorizada deste código é proibida.
 * --------------------------------------------------------------------------
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Student, Metrics, RecordingState, IWindow, FluencyLevel } from './types';
import { analyzeReadingFluency, generateClassAnalysis, detectEarlyPattern } from './services/geminiService';
import FluencyChart from './components/FluencyChart';
import { EvolutionChart } from './components/EvolutionChart';
import { EvolutionMapTable } from './components/EvolutionMapTable';
import Dashboard from './components/Dashboard';
import { Plus, Mic, Square, Activity, Save, Trash2, BookOpen, Layers, Zap, Download, Users, AlertTriangle, PlusCircle, BarChart3, FileText, Printer, X, Building2, Map, HelpCircle, Copyright, Lock, UploadCloud, Settings, FileCheck, ExternalLink } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase, uploadAudio, saveAssessment, upsertStudent, fetchStudents, AlunoFluencia } from './lib/supabase';

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const LoginScreen = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleManualLogin = async () => {
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message === "Invalid login credentials" 
          ? "Usuário ou senha incorretos. Verifique suas credenciais." 
          : authError.message);
        alert(`Erro de Autenticação: ${authError.message}`);
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || "Usuário",
          isAuthenticated: true
        };
        sessionStorage.setItem('pipa_user', JSON.stringify(userData));
        onLogin(userData);
      }
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      setError("Ocorreu um erro inesperado ao tentar acessar o sistema.");
      alert(`Erro inesperado: ${err.message || 'Falha na conexão'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch('/api/auth/google-url');
      const { url } = await res.json();
      
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      window.open(url, 'google_login', `width=${width},height=${height},left=${left},top=${top}`);
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          sessionStorage.setItem('pipa_user', JSON.stringify(event.data.user));
          onLogin(event.data.user);
        }
      };
      
      window.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Login error', error);
      alert('Erro ao iniciar login. Verifique a configuração do servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500"></div>
      
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 relative z-10 overflow-hidden">
        {/* Imagem estendida no topo */}
        <div className="w-full bg-slate-50 border-b border-slate-100 flex justify-center">
          <img 
            src="/logo-pipa-hcc.png" 
            alt="Logo PIPA" 
            className="w-full h-auto object-cover" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://placehold.co/400x120/e2e8f0/475569?text=Logo+PIPA";
            }} 
          />
        </div>
        
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">PIPA Voice AI</h1>
            <p className="text-blue-600 font-bold text-sm tracking-widest mt-1">hcc</p>
          </div>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">E-mail de Acesso</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              placeholder="••••"
            />
          </div>
          
          {error && <p className="text-red-500 text-[10px] font-bold text-center leading-relaxed px-4">{error}</p>}

          <button 
            onClick={handleManualLogin}
            disabled={isLoading}
            className={`w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 uppercase tracking-wide text-xs ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
          >
            {isLoading ? "Autenticando..." : "Acessar Dashboard"}
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] uppercase font-bold tracking-widest">Ou acesse com</span>
            <div className="flex-grow border-t border-slate-200"></div>
        </div>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm uppercase tracking-wide text-xs"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Entrar com sua Conta Google
        </button>
        </div>
      </div>

      {/* Security Footer */}
      <div className="mt-8 container mx-auto px-4 md:px-6">
         <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logotipo Altbit (Esquerda) */}
            <div className="bg-white/50 p-2 rounded-lg border border-slate-200/50 backdrop-blur-sm shadow-sm transition-transform hover:scale-105">
                <img 
                  src="/logoaltbit.jpeg" 
                  alt="Altbit Logo" 
                  className="h-10 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
            </div>

            <div className="flex flex-col items-center gap-2 text-center flex-grow">
               <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">PROJETO PIPA - LER PARA PODER SONHAR</span>
            </div>

            {/* Espaçador para equilibrar no desktop */}
            <div className="hidden md:block w-[140px]"></div>
         </div>
      </div>
    </div>
  );
};

// Official Network Data
const SCHOOL_DATA: Record<string, string[]> = {
  "SETOR 1": ["André Franco Montoro", "Arantes Vasques", "Dulce Pedrosa", "Gilda Piorini", "Maria Zara", "Moacyr de Almeida", "Paulo Freire"],
  "SETOR 4": ["Maria Ap. Camargo (Ribeirão Grande)", "Augusto Cesar", "Dona Minica", "Felix Adib", "Mario Bonotti", "Orlando Pires"],
  "SETOR 5": ["Ângelo Paz", "Elias Bargis", "João Kolenda", "Madalena Caltabiano", "Regina Célia", "Vito Ardito"],
  "SETOR 7": ["Alexandre Machado", "Arthur de Andrade", "João Cesário", "Maria Helena Ribeiro", "Ruth Azevedo", "Yvone"],
  "SETOR 9": ["Francisco de Assis", "Joaquim Pereira", "Lauro Vicente", "Mario de Assis", "Rachel de Aguiar", "Seu Juquinha"],
  "SETOR 10": ["Abdias", "Isabel do Carmo", "Julieta Reale", "Odete Corrêa", "Padre Zezinho", "Serafim Ferreira"]
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(() => {
    const saved = sessionStorage.getItem('pipa_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Supabase Auth Session Check
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "Usuário",
          isAuthenticated: true
        };
        sessionStorage.setItem('pipa_user', JSON.stringify(userData));
        setUser(userData);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "Usuário",
          isAuthenticated: true
        };
        sessionStorage.setItem('pipa_user', JSON.stringify(userData));
        setUser(userData);
      } else {
        sessionStorage.removeItem('pipa_user');
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  const [availableClasses, setAvailableClasses] = useState<string[]>([
    "1º A", "1º B", "2º A", "2º B", "3º A"
  ]);

  const [evolutionPeriod, setEvolutionPeriod] = useState<string>("Entrada");
  const [comparePeriod, setComparePeriod] = useState<string | null>(null);

  // Initial data with schools to demonstrate Network Analysis features
  const [students, setStudents] = useState<Student[]>([
    { id: 1, name: "AGATHA MAMEDE", ppm: 12, status: "Nível 1", report: "", steps: ["", "", ""], turma: "1º A", school: "André Franco Montoro", nee: false, bolsaFamilia: false, history: [] },
    { id: 2, name: "MURILLO FELIX", ppm: 25, status: "Nível 2", report: "", steps: ["", "", ""], turma: "1º A", school: "André Franco Montoro", nee: false, bolsaFamilia: false, history: [] },
    { id: 3, name: "JOÃO SILVA", ppm: 95, status: "Leitor Fluente", report: "", steps: ["", "", ""], turma: "1º B", school: "André Franco Montoro", nee: false, bolsaFamilia: false, history: [] },
    // Data for Sector 4 (Critical)
    { id: 4, name: "MARIA SOUZA", ppm: 5, status: "Nível 1", report: "", steps: ["", "", ""], turma: "2º A", school: "Augusto Cesar", nee: false, bolsaFamilia: false, history: [] },
    { id: 5, name: "PEDRO HENRIQUE", ppm: 15, status: "Nível 2", report: "", steps: ["", "", ""], turma: "2º A", school: "Augusto Cesar", nee: false, bolsaFamilia: false, history: [] },
    // Data for Sector 5 (High Excellence)
    { id: 6, name: "ANA CLARA", ppm: 110, status: "Leitor Fluente", report: "", steps: ["", "", ""], turma: "3º A", school: "Ângelo Paz", nee: false, bolsaFamilia: false, history: [] },
    { id: 7, name: "LUCAS MOURA", ppm: 85, status: "Leitor Iniciante", report: "", steps: ["", "", ""], turma: "3º A", school: "Ângelo Paz", nee: false, bolsaFamilia: false, history: [] },
    // Data for Bottleneck (Level 4)
    { id: 8, name: "GABRIEL LIMA", ppm: 60, status: "Nível 4", report: "", steps: ["", "", ""], turma: "2º B", school: "Dulce Pedrosa", nee: false, bolsaFamilia: false, history: [] },
    { id: 9, name: "BEATRIZ COSTA", ppm: 55, status: "Nível 4", report: "", steps: ["", "", ""], turma: "2º B", school: "Dulce Pedrosa", nee: false, bolsaFamilia: false, history: [] },
    { id: 10, name: "FELIPE SANTOS", ppm: 65, status: "Nível 4", report: "", steps: ["", "", ""], turma: "2º B", school: "Dulce Pedrosa", nee: false, bolsaFamilia: false, history: [] }
  ]);
  
  const [currentClass, setCurrentClass] = useState<string>("1º A");
  
  // School/Sector Selection State
  const [currentSector, setCurrentSector] = useState<string>("SETOR 1");
  const [schoolName, setSchoolName] = useState<string>(SCHOOL_DATA["SETOR 1"][0]);

  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0); // 0: Palavras, 1: Pseudo, 2: Texto
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState<string>("");
  const [startTime, setStartTime] = useState<number>(0);
  const [liveMetrics, setLiveMetrics] = useState<Metrics>({ words: 0, time: 0, ppm: 0 });
  const [showTimeLimitAlert, setShowTimeLimitAlert] = useState<boolean>(false);
  
  // View State
  const [currentView, setCurrentView] = useState<'collection' | 'dashboard'>('collection');

  // Modal States
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState<boolean>(false);
  const [isDeleteClassModalOpen, setIsDeleteClassModalOpen] = useState<boolean>(false);
  const [newClassInput, setNewClassInput] = useState<string>("");
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');

  // --- Helper to save student to database ---
  const saveStudentData = useCallback(async (student: Student) => {
    if (!user) return;
    setSyncStatus('saving');
    try {
      const history = student.history || [];
      const aluno: AlunoFluencia = {
        id: student.id,
        escola_id: user.id || user.email, // using user.id or email as escola_id
        nome_aluno: student.name,
        nee: student.nee,
        bf: student.bolsaFamilia,
        ppm_atual: student.ppm,
        turma: student.turma,
        school: student.school,
        resultado_entrada: history.find(h => h.period === 'Entrada')?.status,
        simulado_1: history.find(h => h.period === 'Simulado 1')?.status,
        simulado_2: history.find(h => h.period === 'Simulado 2')?.status,
        resultado_saida: history.find(h => h.period === 'Saída')?.status,
      };
      
      await upsertStudent(aluno);
      setSyncStatus('synced');
    } catch (error) {
      console.error("Failed to sync student data:", error);
      setSyncStatus('error');
    }
  }, [user]);

  // Load data from Supabase
  useEffect(() => {
    if (user) {
      const loadStudents = async () => {
        try {
          const data = await fetchStudents(user.id);
          if (data && data.length > 0) {
            const mappedStudents: Student[] = data.map((aluno: any) => {
              const history = [];
              if (aluno.resultado_entrada) history.push({ period: 'Entrada', status: aluno.resultado_entrada, date: '', report: '', ppm: 0 });
              if (aluno.simulado_1) history.push({ period: 'Simulado 1', status: aluno.simulado_1, date: '', report: '', ppm: 0 });
              if (aluno.simulado_2) history.push({ period: 'Simulado 2', status: aluno.simulado_2, date: '', report: '', ppm: 0 });
              if (aluno.resultado_saida) history.push({ period: 'Saída', status: aluno.resultado_saida, date: '', report: '', ppm: 0 });
              
              // Determine current status based on most recent period
              const currentStatus = aluno.resultado_saida || aluno.simulado_2 || aluno.simulado_1 || aluno.resultado_entrada || 'Nível 1';
              
              return {
                id: aluno.id,
                name: aluno.nome_aluno,
                nee: aluno.nee,
                bolsaFamilia: aluno.bf,
                ppm: aluno.ppm_atual,
                status: currentStatus as FluencyLevel,
                turma: aluno.turma,
                school: aluno.school,
                report: '',
                steps: ["", "", ""],
                history: history as any
              };
            });
            setStudents(mappedStudents);
          }
        } catch (error) {
          console.error("Failed to fetch students from Supabase:", error);
        }
      };
      loadStudents();
    }
  }, [user]);

  // Report Modals State
  const [isStudentReportModalOpen, setIsStudentReportModalOpen] = useState<boolean>(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [isClassReportModalOpen, setIsClassReportModalOpen] = useState<boolean>(false);
  const [classReportContent, setClassReportContent] = useState<string>("");
  const [isGeneratingClassReport, setIsGeneratingClassReport] = useState<boolean>(false);

  // Simulado State
  const [isSimuladoModalOpen, setIsSimuladoModalOpen] = useState<boolean>(false);
  const [isPendingDiagnosis, setIsPendingDiagnosis] = useState<boolean>(false);
  const [contextoSimuladoPdf, setContextoSimuladoPdf] = useState<string>("");
  const [contextoSimuladoManual, setContextoSimuladoManual] = useState<string>("");
  const [simuladoFileName, setSimuladoFileName] = useState<string>("");
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [simuladoTab, setSimuladoTab] = useState<'pdf' | 'manual'>('pdf');
  const [manualPalavras, setManualPalavras] = useState<string>("");
  const [manualPseudopalavras, setManualPseudopalavras] = useState<string>("");
  const [manualTexto, setManualTexto] = useState<string>("");

  // We need a selection state to view data without recording
  const [viewStudentId, setViewStudentId] = useState<number | null>(null);
  const [lastUploadedAudioUrl, setLastUploadedAudioUrl] = useState<string>("");

  // Early Detection State
  const [earlyDetectionTriggered, setEarlyDetectionTriggered] = useState(false);
  const [earlyDetectionData, setEarlyDetectionData] = useState<{ pattern: string; level: FluencyLevel } | null>(null);
  const [showEarlyDetectionModal, setShowEarlyDetectionModal] = useState(false);
  const [isDetectingEarly, setIsDetectingEarly] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Check initial mic permission
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'denied') {
            setMicError("O acesso ao microfone está bloqueado. Por favor, clique no ícone de cadeado na barra de endereços para permitir o acesso.");
          }
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              setMicError(null);
            } else if (permissionStatus.state === 'denied') {
              setMicError("O acesso ao microfone está bloqueado. Por favor, clique no ícone de cadeado na barra de endereços para permitir o acesso.");
            }
          };
        })
        .catch(err => console.warn("Permissions API not supported for microphone", err));
    }
  }, []);

  // --- Refs ---
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Derived State (Filter) ---
  const studentsWithCurrentStatus = useMemo(() => {
    return students.map(s => {
      const historyEntry = s.history.find(h => h.period === evolutionPeriod);
      return {
        ...s,
        status: historyEntry ? historyEntry.status : s.status,
        longPauseDetected: historyEntry ? !!historyEntry.longPauseDetected : !!s.longPauseDetected
      };
    });
  }, [students, evolutionPeriod]);

  const filteredStudents = useMemo(() => {
    return studentsWithCurrentStatus.filter(s => s.turma === currentClass && s.school === schoolName);
  }, [studentsWithCurrentStatus, currentClass, schoolName]);

  // --- Helpers ---
  const updateLiveMetrics = useCallback(() => {
    if (!startTime) return;
    const now = Date.now();
    const seconds = Math.max(1, Math.floor((now - startTime) / 1000));
    
    // Simple word count by splitting spaces
    const currentTranscript = transcript.trim();
    const wordCount = currentTranscript ? currentTranscript.split(/\s+/).length : 0;
    
    const ppm = Math.round((wordCount / seconds) * 60);
    
    setLiveMetrics({
      words: wordCount,
      time: seconds,
      ppm: ppm
    });
  }, [transcript, startTime]);

  // Update metrics whenever transcript changes during recording
  useEffect(() => {
    if (recordingState === 'recording') {
      updateLiveMetrics();
    }
  }, [transcript, recordingState, updateLiveMetrics]);

  // Timer effect
  useEffect(() => {
    if (recordingState === 'recording') {
      timerIntervalRef.current = window.setInterval(() => {
        updateLiveMetrics();
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [recordingState, updateLiveMetrics]);

  // Handlers needed for effect below
  const handleStopRecording = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    let audioUrl = '';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // We will handle the upload in the onstop event of MediaRecorder to ensure chunks are complete
    }

    // Save the transcript to the current step of the active student
    if (activeStudentId !== null) {
      setStudents(prev => prev.map(s => {
        if (s.id === activeStudentId) {
            const newSteps = [...s.steps] as [string, string, string];
            newSteps[currentStep] = transcript;
            
            // If we are recording the Text step (index 2), we update the PPM and set pending diagnosis
            const newPpm = currentStep === 2 ? liveMetrics.ppm : s.ppm;
            if (currentStep === 2) {
                setIsPendingDiagnosis(true);
            }
            
            return {
                ...s,
                steps: newSteps,
                ppm: newPpm
            };
        }
        return s;
      }));
    }

    setRecordingState('idle');
    setActiveStudentId(null);
  }, [activeStudentId, currentStep, liveMetrics.ppm, transcript]);

  const handleEarlyClassification = () => {
    if (!earlyDetectionData || !viewStudentId) return;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const newStatus = earlyDetectionData.level;
    const report = `Detecção Precoce: O PIPA identificou um padrão de ${earlyDetectionData.pattern} nos primeiros ${liveMetrics.time} segundos de teste. Classificação automatizada conforme regra de otimização.`;

    setStudents(prev => prev.map(s => {
      if (s.id === viewStudentId) {
        const date = new Date().toLocaleDateString('pt-BR');
        const existingHistoryIndex = s.history.findIndex(h => h.period === evolutionPeriod);
        let newHistory = [...s.history];
        
        // Save current transcript to the current step
        const newSteps = [...s.steps] as [string, string, string];
        newSteps[currentStep] = transcript;

        const historyEntry = { 
          status: newStatus, 
          date, 
          period: evolutionPeriod, 
          source: 'IA' as const,
          ppm: 0, 
          report: report,
          longPauseDetected: false
        };

        if (existingHistoryIndex >= 0) {
          newHistory[existingHistoryIndex] = historyEntry;
        } else {
          newHistory.push(historyEntry);
        }

        return {
          ...s,
          steps: newSteps,
          status: newStatus,
          report: report,
          ppm: 0, 
          longPauseDetected: false,
          history: newHistory
        };
      }
      return s;
    }));

    setRecordingState('idle');
    setActiveStudentId(null);
    setShowEarlyDetectionModal(false);
    setIsPendingDiagnosis(false);
  };

  // Time Limit Check Effect
  useEffect(() => {
    if (recordingState === 'recording' && liveMetrics.time >= 60) {
        handleStopRecording();
        setShowTimeLimitAlert(true);
    }
  }, [liveMetrics.time, recordingState, handleStopRecording]);

  // Early Detection Effect
  useEffect(() => {
    const runEarlyDetection = async () => {
      // Monitor between 15 and 30 seconds
      if (recordingState === 'recording' && liveMetrics.time >= 15 && liveMetrics.time <= 30 && !earlyDetectionTriggered && !isDetectingEarly) {
        setIsDetectingEarly(true);
        const result = await detectEarlyPattern(transcript);
        if (result.confidence >= 85 && result.pattern !== 'Nenhum') {
          setEarlyDetectionData({
            pattern: result.pattern,
            level: result.pattern === 'Soletração' ? 'Nível 2' : 'Nível 3'
          });
          setShowEarlyDetectionModal(true);
        }
        setEarlyDetectionTriggered(true);
        setIsDetectingEarly(false);
      }
    };

    runEarlyDetection();
  }, [liveMetrics.time, recordingState, earlyDetectionTriggered, isDetectingEarly, transcript]);

  // --- Handlers ---
  
  const handleSectorChange = (sector: string) => {
      setCurrentSector(sector);
      setSchoolName(SCHOOL_DATA[sector][0]); // Default to first school
  };

  const handleStartRecording = async (id: number) => {
    if (activeStudentId !== null && activeStudentId !== id) {
      alert("Por favor, finalize a gravação atual antes de iniciar outra.");
      return;
    }

    setMicError(null);

    // Proactively check for microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        const student = students.find(s => s.id === id);
        const nomeAluno = (student?.name || 'desconhecido').replace(/[^a-zA-Z0-9]/g, '_');
        const simplifiedPath = `coletas/${Date.now()}_${nomeAluno}.wav`;
        
        console.log(`Preparando upload simplificado: ${simplifiedPath}`);

        // Background upload with 10s timeout
        const uploadWithTimeout = async () => {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout de 10 segundos atingido")), 10000)
          );

          try {
            const url = await Promise.race([
              uploadAudio(audioBlob, simplifiedPath),
              timeoutPromise
            ]) as string;
            
            console.log("Upload em segundo plano concluído:", url);
            setLastUploadedAudioUrl(url);
          } catch (err: any) {
            console.error("ERRO CRÍTICO NO UPLOAD:", err);
            // Salva localmente se falhar ou der timeout (apenas log simulado conforme instrução)
            console.warn("Salvando áudio em cache local devido a falha ou lentidão.");
            
            if (err.status === 403) {
              console.error("ERRO 403: Verifique as credenciais SUPABASE_ANON_KEY no sistema.");
            }
          }
        };

        // Executa em "segundo plano" (não bloqueia o fluxo principal da UI)
        uploadWithTimeout();

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
    } catch (err: any) {
      console.error("Microphone permission error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('denied')) {
        setMicError("Acesso ao microfone negado. Clique no ícone de cadeado na barra de endereços para permitir o acesso. Se estiver usando o PIPA dentro de outro site, tente abrir em uma nova aba para garantir as permissões.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError("Nenhum microfone encontrado. Verifique se o seu microfone está conectado corretamente.");
      } else {
        setMicError(`Erro ao acessar o microfone: ${err.message || 'Erro desconhecido'}`);
      }
      return;
    }

    const w = window as unknown as IWindow;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de fala via Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
         fullTranscript += event.results[i][0].transcript;
      }
      setTranscript(fullTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setMicError("Acesso ao microfone negado. Verifique as permissões do seu navegador e se o site possui acesso ao microfone.");
      } else if (event.error === 'network') {
        setMicError("Erro de rede. Verifique sua conexão com a internet.");
      } else {
        setMicError(`Erro no reconhecimento de voz: ${event.error}`);
      }
      handleStopRecording();
    };

    recognition.onend = () => {
      if (recordingState === 'recording') {
        handleStopRecording();
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setMicError(null);
    } catch (e) {
      console.error("Failed to start recognition", e);
      setMicError("Não foi possível iniciar o reconhecimento de voz.");
      setRecordingState('idle');
      return;
    }
    
    setActiveStudentId(id);
    setRecordingState('recording');
    setStartTime(Date.now());
    setTranscript("");
    setLiveMetrics({ words: 0, time: 0, ppm: 0 });
    setShowTimeLimitAlert(false);
    
    // Reset Early Detection
    setEarlyDetectionTriggered(false);
    setEarlyDetectionData(null);
    setShowEarlyDetectionModal(false);
    setIsDetectingEarly(false);
  };

  const toggleRecording = async (id: number) => {
      if (recordingState === 'recording') {
          if (activeStudentId === id) {
              handleStopRecording();
          }
      } else {
          setViewStudentId(id); // Select for viewing
          await handleStartRecording(id);
      }
  };

  const handleQuickTriage = (newStatus: 'Nível 2' | 'Nível 3') => {
    if (!viewStudentId) return;
    
    const student = students.find(s => s.id === viewStudentId);
    if (!student) return;

    const report = newStatus === 'Nível 2' 
      ? "O aluno realizou a leitura através da soletração das letras, não conseguindo formar sílabas ou palavras de forma fluida. (Observação Direta)"
      : "O aluno realizou a leitura através da silabação, lendo as palavras sílaba por sílaba, com dificuldade na fluidez da frase. (Observação Direta)";

    setStudents(prev => prev.map(s => {
      if (s.id === viewStudentId) {
        const date = new Date().toLocaleDateString('pt-BR');
        const existingHistoryIndex = s.history.findIndex(h => h.period === evolutionPeriod);
        let newHistory = [...s.history];
        
        const historyEntry = { 
          status: newStatus, 
          date, 
          period: evolutionPeriod, 
          source: 'Professor',
          ppm: s.ppm,
          report: report,
          longPauseDetected: false
        };

        if (existingHistoryIndex >= 0) {
          newHistory[existingHistoryIndex] = historyEntry;
        } else {
          newHistory.push(historyEntry);
        }

        return {
          ...s,
          status: newStatus,
          report: report,
          longPauseDetected: false,
          history: newHistory
        };
      }
      return s;
    }));
    
    setIsPendingDiagnosis(false);
    setRecordingState('idle');
    setCurrentStep(0);
  };

  const triggerAnalysis = async () => {
      if (!viewStudentId) return alert("Selecione um aluno primeiro.");
      
      const student = students.find(s => s.id === viewStudentId);
      if (!student) return;

      setRecordingState('analyzing');
      const contextoFinal = contextoSimuladoPdf || contextoSimuladoManual;
      const { report, classification, longPauseDetected } = await analyzeReadingFluency(student.steps, student.ppm, contextoFinal);
      
      // Update local state and determine new status
      let newStatus: any = classification;
      if (!classification) {
          if (report.includes("Leitor Fluente")) newStatus = "Leitor Fluente";
          else if (report.includes("Leitor Iniciante")) newStatus = "Leitor Iniciante";
          else if (report.includes("Nível 4")) newStatus = "Nível 4";
          else if (report.includes("Nível 3")) newStatus = "Nível 3";
          else if (report.includes("Nível 2")) newStatus = "Nível 2";
          else if (report.includes("Nível 1")) newStatus = "Nível 1";
          else if (student.ppm >= 80) newStatus = "Leitor Fluente";
          else if (student.ppm >= 50) newStatus = "Leitor Iniciante";
          else if (student.ppm >= 20) newStatus = "Nível 4";
          else if (student.ppm > 10) newStatus = "Nível 3";
          else if (student.ppm > 0) newStatus = "Nível 2";
      }

      const date = new Date().toLocaleDateString('pt-BR');
      const updatedStudent = {
          ...student,
          status: newStatus as FluencyLevel,
          report: report,
          longPauseDetected,
          history: [
            ...student.history.filter(h => h.period !== evolutionPeriod),
            { 
                status: newStatus, 
                date, 
                period: evolutionPeriod, 
                source: 'IA' as const,
                ppm: student.ppm,
                report: report,
                longPauseDetected
            }
          ]
      };

      setStudents(prev => prev.map(s => s.id === viewStudentId ? updatedStudent : s));
      setRecordingState('idle');
      setIsPendingDiagnosis(false);
      
      // Sync to Supabase
      saveStudentData(updatedStudent);

      try {
        await saveAssessment({
          student_id: student.id,
          student_name: student.name,
          class_name: currentClass,
          school_name: schoolName,
          ppm: student.ppm,
          status: newStatus,
          report: report,
          audio_url: lastUploadedAudioUrl,
          period: evolutionPeriod,
          long_pause: longPauseDetected
        });
        console.log("Assessment saved to Supabase");
        setLastUploadedAudioUrl("");
      } catch (err) {
        console.error("Failed to save assessment to Supabase:", err);
      }
  };

  const addStudent = () => {
    const newId = Date.now();
    const newStudent: Student = { 
        id: newId, 
        name: "NOVO ALUNO", 
        ppm: 0, 
        status: "Nível 1", 
        report: "", 
        steps: ["", "", ""],
        turma: currentClass,
        school: schoolName,
        nee: false,
        bolsaFamilia: false,
        history: []
    };
    setStudents([...students, newStudent]);
    saveStudentData(newStudent);
  };

  // Add Class Modal Handlers
  const openAddClassModal = () => {
      setNewClassInput("");
      setIsAddClassModalOpen(true);
  };

  const closeAddClassModal = () => {
      setIsAddClassModalOpen(false);
  };

  const confirmAddClass = () => {
      const trimmed = newClassInput.trim();
      if (!trimmed) return;
      
      if (availableClasses.includes(trimmed)) {
          alert("Esta turma já existe!");
          return;
      }

      // Sort classes with natural numeric order (10 comes after 2)
      const updatedClasses = [...availableClasses, trimmed].sort((a, b) => 
          a.localeCompare(b, 'pt-BR', { numeric: true })
      );

      setAvailableClasses(updatedClasses);
      setCurrentClass(trimmed);
      setViewStudentId(null);
      closeAddClassModal();
  };

  // Delete Class Handlers
  const openDeleteClassModal = () => {
      if (availableClasses.length <= 1) return;
      setIsDeleteClassModalOpen(true);
  };

  const closeDeleteClassModal = () => {
      setIsDeleteClassModalOpen(false);
  };

  const confirmDeleteClass = () => {
      if (availableClasses.length <= 1) return;

      // 1. Remove all students from this class
      const updatedStudents = students.filter(s => s.turma !== currentClass);

      // 2. Remove class from list
      const updatedClasses = availableClasses.filter(c => c !== currentClass);

      // 3. Set new active class (default to first one)
      const nextClass = updatedClasses[0];

      setStudents(updatedStudents);
      setAvailableClasses(updatedClasses);
      setCurrentClass(nextClass);
      setViewStudentId(null);
      setIsDeleteClassModalOpen(false);
  };

  // Report Handlers
  const handleViewStudentReport = (student: Student) => {
    setSelectedStudentForReport(student);
    setIsStudentReportModalOpen(true);
  };

  const handleGenerateClassReport = async () => {
      setIsClassReportModalOpen(true);
      if (!classReportContent) {
          setIsGeneratingClassReport(true);
          const report = await generateClassAnalysis(currentClass, filteredStudents);
          setClassReportContent(report);
          setIsGeneratingClassReport(false);
      }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
          alert('Por favor, selecione um arquivo PDF.');
          return;
      }

      setIsParsingPdf(true);
      setSimuladoFileName(file.name);

      try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += pageText + '\n';
          }

          setContextoSimuladoPdf(fullText);
          setIsSimuladoModalOpen(false);
      } catch (error) {
          console.error('Erro ao processar PDF:', error);
          alert('Erro ao ler o arquivo PDF. Tente novamente.');
          setSimuladoFileName("");
          setContextoSimuladoPdf("");
      } finally {
          setIsParsingPdf(false);
      }
  };

  const removeSimulado = () => {
      setSimuladoFileName("");
      setContextoSimuladoPdf("");
  };

  const handleManualSimuladoSave = () => {
      if (!manualPalavras && !manualPseudopalavras && !manualTexto) {
          setContextoSimuladoManual("");
          setIsSimuladoModalOpen(false);
          return;
      }
      
      const manualContext = `Palavras:\n${manualPalavras}\n\nPseudopalavras:\n${manualPseudopalavras}\n\nTexto:\n${manualTexto}`;
      setContextoSimuladoManual(manualContext);
      setIsSimuladoModalOpen(false);
      alert("Gabarito manual salvo com sucesso!");
  };

  const removeManualSimulado = () => {
      setManualPalavras("");
      setManualPseudopalavras("");
      setManualTexto("");
      setContextoSimuladoManual("");
  };

  const handlePrintClassResults = () => {
      if (!filteredStudents || filteredStudents.length === 0) {
          alert("Não há alunos vinculados a esta escola/turma para gerar o relatório.");
          return;
      }

      const printWindow = window.open('', '', 'height=600,width=800');
      if (!printWindow) return;

      const date = new Date().toLocaleDateString('pt-BR');
      
      const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório da Turma - ${currentClass}</title>
            <style>
                body { font-family: sans-serif; padding: 40px; position: relative; min-height: 100vh; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .header img { height: 85px; }
                .header-text { text-align: center; flex-grow: 1; }
                .header-text h1 { font-size: 18px; margin: 0; }
                .header-text h2 { font-size: 14px; margin: 5px 0; }
                .header-text p { font-size: 12px; margin: 0; font-weight: bold; }
                h1 { margin-bottom: 5px; color: #1e293b; }
                h2 { margin-top: 0; color: #64748b; font-size: 16px; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #f1f5f9; text-transform: uppercase; font-weight: bold; }
                .status-badge { padding: 4px 12px; border-radius: 9999px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; text-transform: uppercase; border: 1px solid #ccc; }
                .watermark { position: fixed; bottom: 20px; width: 100%; text-align: center; color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 10px; left: 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="/brasao.png" alt="Brasão Pinda" />
                <div class="header-text">
                    <h1>PREFEITURA MUNICIPAL DE PINDAMONHANGABA</h1>
                    <h2>Secretaria Municipal de Educação</h2>
                    <p>Dashboard de Intervenção Pedagógica — Ciclo Estratégico 2026</p>
                </div>
                <img src="/LOGO%20EMPRESA.png" alt="Logo Empresa" />
            </div>
            
            <h2>Turma: ${currentClass} | Escola: ${schoolName || 'Não informada'} | Data: ${date}</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Aluno</th>
                        <th style="text-align: center;">NEE</th>
                        <th style="text-align: center;">BF</th>
                        <th style="text-align: center;">PPM</th>
                        <th style="text-align: center;">Nível</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredStudents.map(s => `
                        <tr>
                            <td>${s.name}</td>
                            <td style="text-align: center;">${s.nee ? 'SIM' : 'NÃO'}</td>
                            <td style="text-align: center;">${s.bolsaFamilia ? 'SIM' : 'NÃO'}</td>
                            <td style="text-align: center;">${s.ppm}</td>
                            <td style="text-align: center;">
                                <span class="status-badge">${s.status}</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="watermark">
                Gerado por PIPA Voice AI - Tecnologia de Gestão Educacional
            </div>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
  };

  const handlePrintIndividualReport = (student: Student) => {
      const printWindow = window.open('', '', 'height=600,width=800');
      if (!printWindow) return;

      const date = new Date().toLocaleDateString('pt-BR');
      
      const getStatusForPeriod = (s: Student, p: string) => {
        const entry = s.history?.find(h => h.period === p);
        return entry ? entry.status : 'Não Avaliado';
      };

      const iflWeightsReport: Record<string, number> = {
        'Nível 1': 0,
        'Nível 2': 1,
        'Nível 3': 2.5,
        'Nível 4': 4,
        'Leitor Iniciante': 6,
        'Leitor Fluente': 10,
        'Não Avaliado': 0
      };

      const startLevel = comparePeriod ? getStatusForPeriod(student, comparePeriod) : 'N/A';
      const endLevel = getStatusForPeriod(student, evolutionPeriod);
      const startWeight = iflWeightsReport[startLevel] || 0;
      const endWeight = iflWeightsReport[endLevel] || 0;
      const impact = endWeight - startWeight;
      const evolution = endWeight > startWeight ? 'Avanço' : endWeight < startWeight ? 'Regressão' : 'Manteve';
      
      const currentEntry = student.history?.find(h => h.period === evolutionPeriod);
      const diagnosisSource = currentEntry?.source === 'Professor' ? 'Observação Direta (Professor)' : 'Análise por IA';
      const hasApoio = student.status === 'Nível 1' || student.status === 'Nível 2' || student.longPauseDetected;

      const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Relatório Individual - ${student.name}</title>
            <style>
                body { font-family: sans-serif; padding: 40px; position: relative; min-height: 100vh; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .header img { height: 85px; }
                .header-text { text-align: center; flex-grow: 1; }
                .header-text h1 { font-size: 18px; margin: 0; }
                .header-text h2 { font-size: 14px; margin: 5px 0; }
                .header-text p { font-size: 12px; margin: 0; font-weight: bold; }
                .student-info { margin-bottom: 30px; }
                .student-info p { margin: 5px 0; font-size: 14px; }
                .section-title { font-weight: bold; text-transform: uppercase; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin: 20px 0 10px; }
                .history-table { width: 100%; border-collapse: collapse; }
                .history-table th, .history-table td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }
                .history-table th { background-color: #f1f5f9; }
                .footer-signatures { margin-top: 80px; display: flex; justify-content: space-between; }
                .signature-box { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 5px; font-size: 12px; }
                .watermark { position: fixed; bottom: 20px; width: 100%; text-align: center; color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 10px; left: 0; }
                .badge { padding: 4px 12px; border-radius: 9999px; color: white; font-weight: bold; font-size: 10px; text-transform: uppercase; display: inline-flex; align-items: center; justify-content: center; }
                .bg-nivel-1 { background-color: #dc2626; }
                .bg-nivel-2 { background-color: #f87171; }
                .bg-nivel-3 { background-color: #fb923c; }
                .bg-nivel-4 { background-color: #facc15; color: #0f172a; }
                .bg-iniciante { background-color: #4ade80; }
                .bg-fluente { background-color: #16a34a; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="/brasao.png" alt="Brasão Pinda" />
                <div class="header-text">
                    <h1>PREFEITURA MUNICIPAL DE PINDAMONHANGABA</h1>
                    <h2>Secretaria Municipal de Educação</h2>
                    <p>Dashboard de Intervenção Pedagógica — Ciclo Estratégico 2026</p>
                </div>
                <img src="/LOGO%20EMPRESA.png" alt="Logo Empresa" />
            </div>

            <div class="student-info">
                <p><strong>Aluno(a):</strong> ${student.name}</p>
                <p><strong>Escola:</strong> ${student.school}</p>
                <p><strong>Turma:</strong> ${student.turma}</p>
                <p><strong>NEE:</strong> ${student.nee ? 'Sim' : 'Não'} | <strong>Bolsa Família:</strong> ${student.bolsaFamilia ? 'Sim' : 'Não'}</p>
                <p><strong>Data de Emissão:</strong> ${date}</p>
            </div>

            <div class="section-title">Observações de Atenção</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
                ${hasApoio ? `
                    <div style="padding: 8px 12px; background-color: #fff1f2; border: 1px solid #fda4af; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">⚠️</span>
                        <div>
                            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #9f1239; text-transform: uppercase;">Apoio Pedagógico</p>
                            <p style="margin: 0; font-size: 9px; color: #be123c;">Requer intervenção imediata para desenvolvimento da fluidez.</p>
                        </div>
                    </div>
                ` : ''}
                ${student.nee ? `
                    <div style="padding: 8px 12px; background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">♿</span>
                        <div>
                            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #1e40af; text-transform: uppercase;">Suporte Especializado</p>
                            <p style="margin: 0; font-size: 9px; color: #1d4ed8;">Aluno com Atendimento Educacional Especializado (AEE).</p>
                        </div>
                    </div>
                ` : ''}
                ${student.bolsaFamilia ? `
                    <div style="padding: 8px 12px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">🏠</span>
                        <div>
                            <p style="margin: 0; font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">Prioridade Social</p>
                            <p style="margin: 0; font-size: 9px; color: #64748b;">Inscrito em programas de transferência de renda.</p>
                        </div>
                    </div>
                ` : ''}
            </div>
            <p style="font-size: 10px; color: #64748b; margin-bottom: 20px;"><strong>Metodologia do Diagnóstico:</strong> ${diagnosisSource}</p>

            <div class="section-title">Trajetória de Evolução</div>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Mapa de Evolução Estratégica</p>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 10px;">
                    <div>
                        <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Partida (${comparePeriod || 'N/A'})</p>
                        <div style="margin-top: 4px;">
                            <span class="badge" style="background-color: ${getStatusColorHex(startLevel)}; color: ${getStatusTextColorHex(startLevel)};">${startLevel}</span>
                        </div>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Atual (${evolutionPeriod})</p>
                        <div style="margin-top: 4px;">
                            <span class="badge" style="background-color: ${getStatusColorHex(endLevel)}; color: ${getStatusTextColorHex(endLevel)};">${endLevel}</span>
                        </div>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Status</p>
                        <p style="margin: 2px 0 0; font-size: 12px; font-weight: bold; color: ${evolution === 'Avanço' ? '#059669' : evolution === 'Regressão' ? '#e11d48' : '#64748b'};">
                            ${evolution}
                        </p>
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Impacto IFL</p>
                        <p style="margin: 2px 0 0; font-size: 12px; font-weight: bold; color: ${impact > 0 ? '#059669' : impact < 0 ? '#e11d48' : '#64748b'};">
                            ${impact > 0 ? '+' : ''}${impact.toFixed(1)}
                        </p>
                    </div>
                </div>
            </div>

            <div style="background-color: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Contexto de Vulnerabilidade da Turma</p>
                <p style="margin: 5px 0 0; font-size: 13px; font-weight: bold; color: ${bolsaFamiliaPercentage > 50 ? '#e11d48' : bolsaFamiliaPercentage >= 25 ? '#d97706' : '#059669'};">
                    ${bolsaFamiliaPercentage.toFixed(0)}% dos alunos possuem Bolsa Família — Status: ${vulnerabilityStatus}
                </p>
            </div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Período</th>
                        <th>Data</th>
                        <th>Fonte</th>
                        <th>Nível de Fluência</th>
                    </tr>
                </thead>
                <tbody>
                    ${student.history && student.history.length > 0 
                        ? student.history.map(h => `
                            <tr>
                                <td>${h.period}</td>
                                <td>${h.date}</td>
                                <td>${h.source || 'N/A'}</td>
                                <td><span class="badge" style="background-color: ${getStatusColorHex(h.status)}; color: ${getStatusTextColorHex(h.status)};">${h.status}</span></td>
                            </tr>
                        `).join('')
                        : `<tr><td colspan="4" style="text-align: center;">Nenhum histórico registrado.</td></tr>`
                    }
                </tbody>
            </table>

            <div class="section-title">Diagnóstico Atual</div>
            <p style="font-size: 14px;"><strong>Nível:</strong> <span class="badge" style="background-color: ${getStatusColorHex(student.status)}; color: ${getStatusTextColorHex(student.status)};">${student.status}</span></p>
            <p style="font-size: 14px;"><strong>Velocidade:</strong> ${student.ppm} PPM</p>
            <div style="font-size: 12px; line-height: 1.5; margin-top: 10px; white-space: pre-wrap;">
                ${student.report || 'Nenhum laudo técnico gerado.'}
            </div>

            <div class="footer-signatures">
                <div class="signature-box">Professor(a)</div>
                <div class="signature-box">Diretor(a) de Escola</div>
            </div>

            <div class="watermark">
                Gerado por PIPA Voice AI - Tecnologia de Gestão Educacional
            </div>
            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
  };

  const toggleNee = (id: number) => {
    setStudents(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, nee: !s.nee } : s);
      const student = updated.find(s => s.id === id);
      if (student) saveStudentData(student);
      return updated;
    });
  };

  const toggleBf = (id: number) => {
    setStudents(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, bolsaFamilia: !s.bolsaFamilia } : s);
      const student = updated.find(s => s.id === id);
      if (student) saveStudentData(student);
      return updated;
    });
  };

  const handleManualStatusUpdate = (studentId: number, newStatus: FluencyLevel) => {
    setStudents(prev => {
      const updated = prev.map(s => {
          if (s.id === studentId) {
              const date = new Date().toLocaleDateString('pt-BR');
              const existingHistoryIndex = s.history.findIndex(h => h.period === evolutionPeriod);
              let newHistory = [...s.history];
              
              if (existingHistoryIndex >= 0) {
                  newHistory[existingHistoryIndex] = { 
                      status: newStatus, 
                      date, 
                      period: evolutionPeriod, 
                      source: 'Manual',
                      ppm: s.ppm,
                      report: s.report,
                      longPauseDetected: false
                  };
              } else {
                  newHistory.push({ 
                      status: newStatus, 
                      date, 
                      period: evolutionPeriod, 
                      source: 'Manual',
                      ppm: 0,
                      report: 'Avaliação manual via plataforma CAED.',
                      longPauseDetected: false
                  });
              }
  
              const updatedStudent = {
                  ...s,
                  status: newStatus,
                  longPauseDetected: false,
                  history: newHistory
              };
              saveStudentData(updatedStudent);
              return updatedStudent;
          }
          return s;
      });
      return updated;
    });
  };

  const updateStudentName = (id: number, newName: string) => {
    setStudents(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, name: newName } : s);
      const student = updated.find(s => s.id === id);
      if (student) saveStudentData(student);
      return updated;
    });
  };

  const removeStudent = (id: number) => {
      if (confirm('Tem certeza que deseja remover este aluno?')) {
          setStudents(students.filter(s => s.id !== id));
          if (viewStudentId === id) setViewStudentId(null);
      }
  };

  const exportClassReport = () => {
      if (!filteredStudents || filteredStudents.length === 0) {
          alert("Não há alunos vinculados a esta escola/turma para gerar o relatório.");
          return;
      }

      const csvContent = "data:text/csv;charset=utf-8," 
          + "Nome,Turma,PPM,Status,Palavras,Pseudopalavras,Texto,Relatorio\n"
          + filteredStudents.map(s => {
              return `"${s.name}","${s.turma}","${s.ppm}","${s.status}","${s.steps[0].replace(/"/g, '""')}","${s.steps[1].replace(/"/g, '""')}","${s.steps[2].replace(/"/g, '""')}","${s.report.replace(/"/g, '""')}"`;
          }).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Relatorio_Fluencia_${currentClass.replace(/\s/g, '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Reset class report when changing class
  useEffect(() => {
      setClassReportContent("");
  }, [currentClass]);

  // Get current student data for display
  const currentStudent = students.find(s => s.id === viewStudentId);
  const displayTranscript = recordingState === 'recording' 
    ? transcript 
    : (currentStudent?.steps[currentStep] || "");

  // --- Stats Calculation (Based on Filtered Students) ---
  const evaluatedStudents = filteredStudents.filter(s => s.history.some(h => h.period === evolutionPeriod));
  const evaluatedCount = evaluatedStudents.length;
  const totalStudents = filteredStudents.length;
  const participationPercentage = totalStudents > 0 ? Math.round((evaluatedCount / totalStudents) * 100) : 0;
  
  const bolsaFamiliaCount = filteredStudents.filter(s => s.bolsaFamilia).length;
  const bolsaFamiliaPercentage = totalStudents > 0 ? (bolsaFamiliaCount / totalStudents) * 100 : 0;
  
  const vulnerabilityColor = bolsaFamiliaPercentage > 50 ? 'text-rose-600' : bolsaFamiliaPercentage >= 25 ? 'text-amber-600' : 'text-emerald-600';
  const vulnerabilityBg = bolsaFamiliaPercentage > 50 ? 'bg-rose-50 border-rose-200' : bolsaFamiliaPercentage >= 25 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
  const vulnerabilityStatus = bolsaFamiliaPercentage > 50 ? 'Alerta Máximo' : bolsaFamiliaPercentage >= 25 ? 'Atenção' : 'Estável';

  // Calculate IFL (Indice de Fluência Leitora) - Weighted Average 0-10
  // Weights: N1(0), N2(1), N3(2.5), N4(4), Iniciante(6), Fluente(10)
  const iflWeights: Record<string, number> = {
    'Nível 1': 0,
    'Nível 2': 1,
    'Nível 3': 2.5,
    'Nível 4': 4,
    'Leitor Iniciante': 6,
    'Leitor Fluente': 10
  };

  const totalIFLScore = evaluatedStudents.reduce((acc, s) => acc + (iflWeights[s.status] || 0), 0);
  const classIFL = evaluatedCount > 0 ? totalIFLScore / evaluatedCount : 0;
  const isClassCritical = evaluatedCount > 0 && classIFL <= 6.0;

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

  const getStatusColorHex = (status: string) => {
    switch (status) {
      case 'Nível 1': return '#dc2626';
      case 'Nível 2': return '#f87171';
      case 'Nível 3': return '#fb923c';
      case 'Nível 4': return '#facc15';
      case 'Leitor Iniciante': return '#4ade80';
      case 'Leitor Fluente': return '#16a34a';
      default: return '#64748b';
    }
  };

  const getStatusTextColorHex = (status: string) => {
    return status === 'Nível 4' ? '#0f172a' : '#ffffff';
  };

  // --- Render ---
  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col relative">
      
      {/* Time Limit Overlay */}
      {showTimeLimitAlert && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border-4 border-red-500 relative overflow-hidden">
                  <div className="absolute inset-0 bg-red-50 opacity-20 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px]"></div>
                  <div className="relative z-10">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                          <AlertTriangle className="w-10 h-10 text-red-600" />
                      </div>
                      <h3 className="text-2xl font-black text-red-600 mb-2 uppercase tracking-tighter">Tempo Encerrado!</h3>
                      <p className="text-slate-600 font-bold mb-6">A coleta foi finalizada automaticamente após 60 segundos.</p>
                      <button onClick={() => setShowTimeLimitAlert(false)} className="bg-red-600 text-white font-bold py-3 px-8 rounded-full hover:bg-red-700 transition-all shadow-lg shadow-red-200 uppercase tracking-widest text-sm">Entendido</button>
                  </div>
              </div>
          </div>
      )}

      {/* Simulado Upload Modal */}
      {isSimuladoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsSimuladoModalOpen(false)}>
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl transform transition-all scale-100 border border-slate-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-4 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <UploadCloud className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Base de Aferição</h3>
                    
                    <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
                        <button 
                            onClick={() => setSimuladoTab('pdf')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${simuladoTab === 'pdf' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Upload de PDF
                        </button>
                        <button 
                            onClick={() => setSimuladoTab('manual')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${simuladoTab === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Inserção Manual
                        </button>
                    </div>

                    <div className="text-slate-600 text-sm leading-relaxed space-y-4 text-left">
                        {simuladoTab === 'pdf' ? (
                            <>
                                <p>
                                    Faça o upload do arquivo PDF da prova (simulado) que será aplicada aos alunos. O sistema extrairá o texto para servir como base de aferição da Inteligência Artificial.
                                </p>
                                
                                {simuladoFileName ? (
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Simulado Ativo</p>
                                                <p className="text-sm text-blue-600 truncate font-medium">{simuladoFileName}</p>
                                            </div>
                                        </div>
                                        <button onClick={removeSimulado} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors" title="Remover Simulado">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                                        <input 
                                            type="file" 
                                            accept=".pdf" 
                                            onChange={handleFileUpload} 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            disabled={isParsingPdf}
                                        />
                                        {isParsingPdf ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-sm font-bold text-blue-600">Processando PDF...</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <UploadCloud className="w-8 h-8 text-slate-400" />
                                                <p className="text-sm font-bold text-slate-600">Clique ou arraste o arquivo PDF aqui</p>
                                                <p className="text-xs text-slate-400">Apenas arquivos .pdf</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                <p className="text-xs text-slate-500 mb-2">Cole os textos da prova nos campos abaixo. Eles serão usados caso nenhum PDF seja enviado.</p>
                                
                                {contextoSimuladoManual && (
                                    <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <FileCheck className="w-5 h-5 text-emerald-600" />
                                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Gabarito Manual Ativo</span>
                                        </div>
                                        <button onClick={removeManualSimulado} className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors" title="Limpar Manual">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">1. Palavras</label>
                                    <textarea 
                                        value={manualPalavras}
                                        onChange={(e) => setManualPalavras(e.target.value)}
                                        placeholder="Cole a lista de palavras reais aqui..."
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm resize-none h-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">2. Pseudopalavras</label>
                                    <textarea 
                                        value={manualPseudopalavras}
                                        onChange={(e) => setManualPseudopalavras(e.target.value)}
                                        placeholder="Cole a lista de palavras inventadas aqui..."
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm resize-none h-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">3. Texto Narrativo</label>
                                    <textarea 
                                        value={manualTexto}
                                        onChange={(e) => setManualTexto(e.target.value)}
                                        placeholder="Cole o texto narrativo de fluência aqui..."
                                        className="w-full p-3 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm resize-none h-24"
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4 text-xs">
                            <p className="font-bold text-slate-700 uppercase mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Prioridade de Dados</p>
                            <p>O sistema prioriza o PDF. Caso não haja PDF, utilizará a Inserção Manual. Se ambos estiverem vazios, usará uma base padrão.</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 mt-2 flex justify-end gap-2">
                         <button onClick={() => setIsSimuladoModalOpen(false)} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-all text-xs uppercase tracking-wider">Fechar</button>
                         {simuladoTab === 'manual' && (
                             <button onClick={handleManualSimuladoSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all text-xs uppercase tracking-wider">Salvar Gabarito Manual</button>
                         )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Credits / About Modal */}
      {isCreditsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsCreditsModalOpen(false)}>
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl transform transition-all scale-100 border border-slate-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-4 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Activity className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sobre o PIPA</h3>
                    <div className="text-slate-600 text-sm leading-relaxed space-y-4 text-left">
                        <p>
                            O <strong>PIPA Voice AI</strong> (Plano de Intervenção Pedagógico Amplo) é uma tecnologia educacional desenvolvida para apoiar a rede pública na análise de fluência leitora e na redução das desigualdades de alfabetização.
                        </p>
                        <p>
                            Utilizando Inteligência Artificial avançada, o sistema oferece diagnósticos rápidos e precisos, permitindo que gestores e professores identifiquem gargalos de aprendizagem e atuem com eficácia pedagógica.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4 text-xs">
                            <p className="font-bold text-slate-700 uppercase mb-1">Ficha Técnica</p>
                            <p><strong>Autor/Desenvolvedor:</strong> HENRIQUE MORAIS</p>
                            <p><strong>Ano:</strong> 2026</p>
                            <p><strong>Propósito:</strong> Gestão Educacional e Equidade</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 mt-2">
                         <button onClick={() => setIsCreditsModalOpen(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-all text-xs uppercase tracking-wider">Fechar</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Student Report Modal */}
      {isStudentReportModalOpen && selectedStudentForReport && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsStudentReportModalOpen(false)}>
           <div className="bg-white rounded-2xl p-0 max-w-2xl w-full shadow-2xl transform transition-all scale-100 border border-slate-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
               <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                   <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                       <FileText className="w-4 h-4 text-blue-500" /> Laudo Técnico: <span className="text-blue-600">{selectedStudentForReport.name}</span>
                   </h3>
                   <button onClick={() => setIsStudentReportModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
               </div>
               <div className="p-6 max-h-[70vh] overflow-y-auto">
                   <div className="grid grid-cols-2 gap-4 mb-6">
                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                           <span className="text-[10px] uppercase font-bold text-slate-400">Classificação</span>
                           <p className="text-lg font-black text-slate-800">{selectedStudentForReport.status}</p>
                       </div>
                       <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                           <span className="text-[10px] uppercase font-bold text-slate-400">Velocidade (PPM)</span>
                           <p className="text-lg font-black text-blue-600 font-mono">{selectedStudentForReport.ppm} PPM</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 col-span-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Sinalizadores de Atenção</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {(selectedStudentForReport.status === 'Nível 1' || selectedStudentForReport.status === 'Nível 2' || selectedStudentForReport.longPauseDetected) && (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-600 border border-rose-200 uppercase tracking-tighter">
                                        ⚠️ Requer Apoio Pedagógico
                                    </span>
                                )}
                                {selectedStudentForReport.nee && (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-tighter">
                                        ♿ Suporte Especializado
                                    </span>
                                )}
                                {selectedStudentForReport.bolsaFamilia && (
                                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-tighter">
                                        🏠 Prioridade Social
                                    </span>
                                )}
                                {(!selectedStudentForReport.nee && !selectedStudentForReport.bolsaFamilia && !(selectedStudentForReport.status === 'Nível 1' || selectedStudentForReport.status === 'Nível 2' || selectedStudentForReport.longPauseDetected)) && (
                                    <span className="text-[10px] font-bold text-slate-400 italic">Nenhum sinalizador ativo.</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="prose prose-sm prose-slate max-w-none">
                       <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 font-medium">
                           {selectedStudentForReport.report || "Nenhum laudo gerado ainda."}
                       </div>
                   </div>
                   
                   <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                       <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Metodologia do Diagnóstico</p>
                       <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                           {selectedStudentForReport.history.find(h => h.period === evolutionPeriod)?.source === 'Professor' ? 'Observação Direta (Professor)' : 'Análise por IA'}
                       </span>
                   </div>
               </div>
               <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
                    <button onClick={() => setIsStudentReportModalOpen(false)} className="text-xs font-bold text-blue-600 uppercase">Fechar</button>
               </div>
           </div>
        </div>
      )}

      {/* Class Report Modal */}
      {isClassReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsClassReportModalOpen(false)}>
           <div className="bg-white rounded-2xl p-0 max-w-2xl w-full shadow-2xl transform transition-all scale-100 border border-slate-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
               <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                   <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                       <Users className="w-4 h-4 text-blue-500" /> Parecer da Turma: <span className="text-blue-600">{currentClass}</span>
                   </h3>
                   <button onClick={() => setIsClassReportModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-red-500" /></button>
               </div>
               <div className="p-6 max-h-[70vh] overflow-y-auto">
                   {isGeneratingClassReport ? (
                       <div className="flex flex-col items-center justify-center py-10 gap-4">
                           <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                           <p className="text-xs font-bold text-slate-500 uppercase animate-pulse">Gerando análise com IA...</p>
                       </div>
                   ) : (
                       <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 font-medium">
                           {classReportContent || "Nenhum parecer disponível. Clique para gerar."}
                       </div>
                   )}
               </div>
               <div className="bg-slate-50 p-4 text-center border-t border-slate-200">
                    <button onClick={() => setIsClassReportModalOpen(false)} className="text-xs font-bold text-blue-600 uppercase">Fechar</button>
               </div>
           </div>
        </div>
      )}

      {/* Add/Delete Class Modals (Keeping logic same as before, simplified in view) */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={closeAddClassModal}>
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all scale-100 border border-slate-100" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight text-center border-b border-slate-100 pb-4 mb-4">Cadastrar Nova Turma</h3>
                <div className="py-2"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nome da Turma</label><input autoFocus type="text" value={newClassInput} onChange={(e) => setNewClassInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmAddClass()} placeholder="Ex: 5º Ano C" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold" /></div>
                <div className="flex gap-3 pt-2"><button onClick={closeAddClassModal} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 uppercase text-xs">Cancelar</button><button onClick={confirmAddClass} disabled={!newClassInput.trim()} className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 uppercase text-xs">Confirmar</button></div>
            </div>
        </div>
      )}
      {isDeleteClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={closeDeleteClassModal}>
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all scale-100 border border-slate-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-4 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2"><Trash2 className="w-8 h-8 text-red-600" /></div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Excluir Turma?</h3>
                    <p className="text-slate-600 font-medium">Deseja realmente excluir a turma <span className="font-bold text-slate-900">"{currentClass}"</span>?</p>
                    <p className="text-red-500 text-xs font-bold uppercase tracking-wide bg-red-50 p-3 rounded-lg border border-red-100">Esta ação apagará todos os alunos e diagnósticos vinculados a esta turma e não pode ser desfeita.</p>
                    <div className="flex gap-3 pt-4"><button onClick={closeDeleteClassModal} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 uppercase text-xs">Cancelar</button><button onClick={confirmDeleteClass} className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 uppercase text-xs">Confirmar Exclusão</button></div>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white text-slate-900 shadow-md mb-8 relative overflow-hidden no-print">
        <div className="container mx-auto p-4 relative z-10">
          <div className="flex justify-between items-center gap-4">
            {/* Lado Esquerdo: Brasão */}
            <div className="flex-shrink-0">
              <img src="/brasao.png" alt="Brasão Pinda" className="h-[85px] w-auto" onError={(e) => (e.currentTarget.src = 'https://placehold.co/85x85?text=Brasão')} />
            </div>

            {/* Centro: Textos Institucionais */}
            <div className="flex-grow text-center flex flex-col justify-center">
              <h1 className="text-lg md:text-xl font-black text-slate-800 leading-tight uppercase">PREFEITURA MUNICIPAL DE PINDAMONHANGABA</h1>
              <h2 className="text-md md:text-lg font-bold text-slate-600 leading-tight uppercase">Secretaria Municipal de Educação</h2>
              <p className="text-xs md:text-sm font-black text-blue-600 mt-1 tracking-tight uppercase">Dashboard de Intervenção Pedagógica — Ciclo Estratégico 2026</p>
            </div>

            {/* Lado Direito: Logo Empresa */}
            <div className="flex-shrink-0">
              <img src="/LOGO%20EMPRESA.png" alt="Logo Empresa" className="h-[85px] w-auto" onError={(e) => (e.currentTarget.src = 'https://placehold.co/85x85?text=Logo')} />
            </div>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-4 mt-6 pt-4 border-t border-slate-100">
            <div className="flex gap-2 items-center">
              {/* Evolution Period Selection */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <div className="relative flex items-center gap-1 pl-2">
                  <Zap className="w-3 h-3 text-blue-600" />
                  <select disabled={isPendingDiagnosis} value={evolutionPeriod} onChange={(e) => setEvolutionPeriod(e.target.value)} className={`bg-transparent text-slate-700 px-2 py-2 rounded-lg text-xs font-bold outline-none appearance-none min-w-[5rem] ${isPendingDiagnosis ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/50'}`}>
                    {["Entrada", "Simulado 1", "Simulado 2", "Saída"].map(period => (<option key={period} value={period}>{period}</option>))}
                  </select>
                </div>
              </div>

              {/* Sector Selection */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <div className="relative flex items-center gap-1 pl-2">
                      <Map className="w-3 h-3 text-blue-600" />
                      <select disabled={isPendingDiagnosis} value={currentSector} onChange={(e) => handleSectorChange(e.target.value)} className={`bg-transparent text-slate-700 px-2 py-2 rounded-lg text-xs font-bold outline-none appearance-none min-w-[5rem] ${isPendingDiagnosis ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/50'}`}>
                        {Object.keys(SCHOOL_DATA).map(sector => (<option key={sector} value={sector}>{sector}</option>))}
                      </select>
                  </div>
              </div>

              {/* School Selection */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 flex-grow max-w-xs">
                  <div className="relative flex items-center gap-1 pl-2 w-full">
                      <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                      <select disabled={isPendingDiagnosis} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={`bg-transparent text-slate-700 px-2 py-2 rounded-lg text-xs font-bold outline-none appearance-none w-full truncate ${isPendingDiagnosis ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/50'}`}>
                        {SCHOOL_DATA[currentSector].map(school => (<option key={school} value={school}>{school}</option>))}
                      </select>
                  </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <div className="relative">
                      <select disabled={isPendingDiagnosis} value={currentClass} onChange={(e) => { setCurrentClass(e.target.value); setViewStudentId(null); }} className={`bg-blue-600 border border-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400 appearance-none h-9 min-w-[5rem] text-center transition-all ${isPendingDiagnosis ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-blue-700'}`}>
                        {availableClasses.map(cls => (<option key={cls} value={cls}>{cls}</option>))}
                      </select>
                  </div>
                  <button onClick={openDeleteClassModal} disabled={availableClasses.length <= 1 || isPendingDiagnosis} className={`h-9 px-2 rounded-lg flex items-center transition-colors border ${availableClasses.length <= 1 || isPendingDiagnosis ? 'bg-slate-200 text-slate-400 border-transparent cursor-not-allowed opacity-50' : 'bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-200 hover:border-red-200'}`}><Trash2 className="w-4 h-4" /></button>
                  <button onClick={openAddClassModal} disabled={isPendingDiagnosis} className={`h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1 transition-colors text-xs font-bold uppercase tracking-wide border border-slate-200 ${isPendingDiagnosis ? 'opacity-50 cursor-not-allowed' : ''}`}><PlusCircle className="w-4 h-4 text-blue-600" /><span className="hidden sm:inline">Turma</span></button>
              </div>
               <button disabled={isPendingDiagnosis} onClick={() => setCurrentView(currentView === 'collection' ? 'dashboard' : 'collection')} className={`h-10 px-4 rounded-lg flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-wide border shadow-sm ${isPendingDiagnosis ? 'opacity-50 cursor-not-allowed' : ''} ${currentView === 'dashboard' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}><BarChart3 className="w-4 h-4" /><span className="hidden sm:inline">{currentView === 'collection' ? 'Gestão de Rede' : 'Coleta'}</span></button>
               <button onClick={() => setIsSimuladoModalOpen(true)} className={`h-10 px-3 rounded-lg flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-wide border shadow-sm ${simuladoFileName ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700' : contextoSimuladoManual ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`} title="Upload de Simulado">
                   <UploadCloud className="w-4 h-4" />
                   {simuladoFileName ? (
                       <span className="hidden sm:inline truncate max-w-[100px]">{simuladoFileName}</span>
                   ) : contextoSimuladoManual ? (
                       <span className="hidden sm:inline truncate max-w-[100px]">Gabarito Manual</span>
                   ) : null}
               </button>
               <button onClick={() => setIsCreditsModalOpen(true)} className="h-10 px-3 rounded-lg flex items-center gap-2 transition-all text-xs font-bold uppercase tracking-wide border shadow-sm bg-white text-slate-700 border-slate-200 hover:bg-slate-50" title="Créditos e Sobre"><HelpCircle className="w-4 h-4 text-blue-600" /></button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
             <div className={`flex flex-col items-center justify-center p-3 rounded-lg ${isClassCritical ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50 border border-slate-100'}`}>
                <p className={`text-[10px] uppercase font-bold tracking-wider ${isClassCritical ? 'text-rose-600' : 'text-blue-600'}`}>IFL Turma ({currentClass})</p>
                <p className={`text-3xl font-black mt-1 ${isClassCritical ? 'text-rose-700' : 'text-slate-800'}`}>{classIFL.toFixed(1)}</p>
             </div>
             <div className="flex flex-row items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-1/2 flex flex-col items-center justify-center">
                   <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Alunos Avaliados</p>
                   <p className="text-2xl font-black text-slate-800 mt-1">{evaluatedCount}/{totalStudents}</p>
                </div>
                <div className="w-[1px] h-8 bg-slate-200"></div>
                <div className="w-1/2 flex flex-col items-center justify-center">
                   <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Participação</p>
                   <p className="text-2xl font-black text-blue-600 mt-1">{participationPercentage}%</p>
                </div>
             </div>
             <div className={`flex flex-col items-center justify-center p-3 rounded-lg border ${vulnerabilityBg}`}>
                <p className={`text-[10px] uppercase font-bold tracking-wider ${vulnerabilityColor}`}>Vulnerabilidade</p>
                <p className={`text-2xl font-black mt-1 ${vulnerabilityColor.replace('600', '700')}`}>{bolsaFamiliaPercentage.toFixed(0)}%</p>
                <p className={`text-[9px] font-bold uppercase mt-1 ${vulnerabilityColor}`}>{vulnerabilityStatus}</p>
             </div>
             <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-50 border border-slate-100 md:col-span-2 flex-row gap-4">
                 {recordingState === 'recording' ? (
                     <div className="flex items-center gap-2 text-rose-600 animate-pulse">
                         <div className="w-3 h-3 bg-rose-600 rounded-full"></div>
                         <span className="text-xs font-bold uppercase tracking-widest">Gravando Agora...</span>
                     </div>
                 ) : recordingState === 'analyzing' ? (
                    <div className="flex items-center gap-2 text-blue-600 animate-bounce">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Processando IA...</span>
                    </div>
                 ) : (
                    <>
                        <button onClick={handleGenerateClassReport} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border border-slate-200 shadow-sm">
                            <FileText className="w-3 h-3 text-blue-600" /> Ver Parecer da Turma
                        </button>
                        <button onClick={handlePrintClassResults} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border border-slate-200 shadow-sm">
                            <Printer className="w-3 h-3 text-emerald-600" /> Baixar PDF
                        </button>
                    </>
                 )}
             </div>
          </div>
        </div>
      </header>

      {currentView === 'dashboard' ? (
        <main className="container mx-auto px-4 md:px-6 flex-grow">
            <Dashboard 
                students={filteredStudents} 
                allStudents={studentsWithCurrentStatus}
                currentClass={currentClass} 
                schoolName={schoolName}
                schoolDataMap={SCHOOL_DATA}
                onBack={() => setCurrentView('collection')} 
                evolutionPeriod={evolutionPeriod}
            />
        </main>
      ) : (
        <main className="container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-6 flex-grow">
            
            {/* Left Column: Student List */}
            <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h2 className="text-xs font-black uppercase text-slate-500 tracking-widest">
                    Alunos: <span className="text-blue-600">{currentClass}</span>
                    </h2>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={exportClassReport} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] px-3 py-2 rounded-full font-bold uppercase tracking-wide transition-all flex items-center gap-1" title="Exportar Relatório da Turma"><Download className="w-3 h-3" /> CSV</button>
                    <button onClick={addStudent} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-4 py-2 rounded-full font-bold uppercase tracking-wide transition-all flex items-center gap-1 shadow-lg shadow-blue-200"><Plus className="w-3 h-3" /> Adicionar</button>
                </div>
                </div>
                
                <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                    <tr className="text-slate-400 border-b border-slate-100 uppercase text-[10px] bg-slate-50">
                        <th className="p-4 text-left font-bold tracking-wider">Nome do Aluno</th>
                        <th className="p-4 text-center font-bold tracking-wider w-12">NEE</th>
                        <th className="p-4 text-center font-bold tracking-wider w-12">BF</th>
                        <th className="p-4 text-center font-bold tracking-wider w-16">Gravar</th>
                        <th className="p-4 text-center font-bold tracking-wider w-16">PPM</th>
                        <th className="p-4 text-center font-bold tracking-wider">Status</th>
                        <th className="p-4 text-center font-bold tracking-wider w-12">Laudo</th>
                        <th className="p-4 text-center font-bold tracking-wider w-10"></th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                        const isRecordingThis = activeStudentId === student.id;
                        const isSelected = viewStudentId === student.id;
                        return (
                        <tr key={student.id} onClick={() => !isPendingDiagnosis && setViewStudentId(student.id)} className={`group transition-all hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''} ${isRecordingThis ? 'bg-rose-50' : ''} ${isPendingDiagnosis && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <td className="p-4">
                                <div className="flex flex-col">
                                    <input className={`font-bold uppercase outline-none bg-transparent w-full transition-colors ${isRecordingThis ? 'text-rose-700' : 'text-slate-700 focus:text-blue-600'}`} value={student.name} onChange={(e) => updateStudentName(student.id, e.target.value)} />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {(student.status === 'Nível 1' || student.status === 'Nível 2' || student.longPauseDetected) && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-rose-100 text-rose-600 border border-rose-200 uppercase tracking-tighter">
                                                ⚠️ Requer Apoio Pedagógico
                                            </span>
                                        )}
                                        {student.nee && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-tighter">
                                                ♿ Suporte Especializado
                                            </span>
                                        )}
                                        {student.bolsaFamilia && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-tighter">
                                                🏠 Prioridade Social
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={(e) => { e.stopPropagation(); toggleNee(student.id); }} className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${student.nee ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                    {student.nee ? 'NEE' : 'Não'}
                                </button>
                            </td>
                            <td className="p-4 text-center">
                                <button onClick={(e) => { e.stopPropagation(); toggleBf(student.id); }} className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${student.bolsaFamilia ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                    {student.bolsaFamilia ? 'BF' : 'Não'}
                                </button>
                            </td>
                            <td className="p-4 text-center">
                                {(evolutionPeriod === 'Simulado 1' || evolutionPeriod === 'Simulado 2') ? (
                                    <button onClick={(e) => { e.stopPropagation(); toggleRecording(student.id); }} disabled={activeStudentId !== null && !isRecordingThis} className={`p-2 rounded-full transition-all transform hover:scale-110 shadow-sm ${isRecordingThis ? 'bg-rose-500 text-white shadow-rose-200 animate-pulse' : 'bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200'} ${activeStudentId !== null && !isRecordingThis ? 'opacity-30 cursor-not-allowed' : ''}`}>{isRecordingThis ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}</button>
                                ) : (
                                    <span className="text-slate-300 italic text-[10px]">Manual</span>
                                )}
                            </td>
                            <td className="p-4 text-center font-mono font-bold text-slate-600">{student.ppm}</td>
                            <td className="p-4 text-center">
                                {(evolutionPeriod === 'Entrada' || evolutionPeriod === 'Saída') ? (
                                    <select 
                                        value={student.history.find(h => h.period === evolutionPeriod)?.status || student.status} 
                                        onChange={(e) => handleManualStatusUpdate(student.id, e.target.value as FluencyLevel)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                                    >
                                        <option value="Nível 1">Nível 1</option>
                                        <option value="Nível 2">Nível 2</option>
                                        <option value="Nível 3">Nível 3</option>
                                        <option value="Nível 4">Nível 4</option>
                                        <option value="Leitor Iniciante">Leitor Iniciante</option>
                                        <option value="Leitor Fluente">Leitor Fluente</option>
                                    </select>
                                ) : (
                                    <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide ${getStatusBadgeClass(student.status)}`}>
                                        {student.status}
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-center">
                                {student.report && (
                                    <div className="flex gap-1 justify-center">
                                        <button onClick={(e) => { e.stopPropagation(); handleViewStudentReport(student); }} className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors" title="Ver Laudo Técnico">
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handlePrintIndividualReport(student); }} className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors" title="Imprimir Relatório Individual">
                                            <Printer className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </td>
                            <td className="p-4 text-center"><button onClick={(e) => { e.stopPropagation(); removeStudent(student.id); }} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-3 h-3" /></button></td>
                        </tr>
                        );
                    })}
                    {filteredStudents.length === 0 && (<tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Nenhum aluno nesta turma.</td></tr>)}
                    </tbody>
                </table>
                </div>
            </div>
            </div>

            {/* Right Column: Diagnostics & Charts */}
            <div className="lg:col-span-5 space-y-6">
            
            {(evolutionPeriod === 'Simulado 1' || evolutionPeriod === 'Simulado 2') ? (
                <>
                    {/* Step Tabs */}
                    <div className="flex gap-2 p-1 bg-slate-200 rounded-lg">
                        {[{ id: 0, label: "1. PALAVRAS" }, { id: 1, label: "2. PSEUDOPALAVRAS" }, { id: 2, label: "3. TEXTO" }].map(step => (
                        <button key={step.id} disabled={isPendingDiagnosis} onClick={() => setCurrentStep(step.id as 0 | 1 | 2)} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${currentStep === step.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isPendingDiagnosis ? 'cursor-not-allowed opacity-50' : ''}`}>{step.label}</button>
                        ))}
                    </div>

                    {/* Live Diagnostic Panel */}
                    <div className={`rounded-xl border-4 p-6 min-h-[400px] flex flex-col transition-all duration-300 relative overflow-hidden shadow-2xl ${recordingState === 'recording' ? 'bg-slate-900 border-rose-500' : 'bg-slate-900 border-slate-800'}`}>
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%]"></div>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-4 relative z-10">
                        <h2 className="text-blue-400 font-bold uppercase text-[10px] tracking-widest italic flex items-center gap-2"><Layers className="w-3 h-3" />{currentStep === 0 ? "Leitura de Palavras" : currentStep === 1 ? "Leitura de Pseudopalavras" : "Leitura de Texto"}</h2>
                        <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider ${recordingState === 'recording' ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}`}>{recordingState === 'recording' ? 'GRAVANDO' : recordingState === 'analyzing' ? 'PROCESSANDO' : 'VISUALIZANDO'}</span>
                        </div>
                        <div className="flex-grow font-mono text-xs leading-relaxed whitespace-pre-wrap relative z-10 overflow-y-auto max-h-64 custom-scrollbar">
                        {micError ? (
                            <div className="h-full flex flex-col justify-center items-center text-rose-400 gap-4 p-4 text-center">
                                <AlertTriangle className="w-12 h-12" />
                                <p className="font-bold uppercase tracking-tight">{micError}</p>
                                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                                    <button 
                                        onClick={() => setMicError(null)}
                                        className="w-full px-4 py-2 bg-rose-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-600 transition-all"
                                    >
                                        Tentar Novamente
                                    </button>
                                    <button 
                                        onClick={() => window.open(window.location.href, '_blank')}
                                        className="w-full px-4 py-2 bg-white border border-rose-200 text-rose-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-3 h-3" /> Abrir em Nova Aba
                                    </button>
                                </div>
                            </div>
                        ) : viewStudentId ? (
                            <>
                            <span className="text-slate-500 block mb-2">{recordingState === 'recording' ? `// Gravando etapa ${currentStep + 1}...` : `// Conteúdo gravado (Etapa ${currentStep + 1}):`}</span>
                            <span className={recordingState === 'recording' ? "text-rose-400" : "text-emerald-400"}>{displayTranscript || <span className="text-slate-600 italic">Nenhum áudio gravado para esta etapa.</span>}</span>
                            {recordingState === 'recording' && <span className="animate-pulse inline-block w-2 h-4 bg-rose-500 ml-1 align-middle"></span>}
                            </>
                        ) : (
                            <div className="h-full flex flex-col justify-center items-center text-slate-600 gap-2"><Mic className="w-8 h-8 opacity-20" /><p className="text-center">Selecione um aluno da lista<br/>para visualizar ou gravar.</p></div>
                        )}
                        </div>
                        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-800 pt-4 text-center relative z-10">
                        <div className="bg-slate-800/50 rounded p-2"><span className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">Tempo</span><span className={`font-bold text-lg font-mono ${recordingState === 'recording' && liveMetrics.time >= 55 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{recordingState === 'recording' ? liveMetrics.time : 0}s</span></div>
                        <div className="bg-slate-800/50 rounded p-2"><span className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">Palavras</span><span className="text-white font-bold text-lg font-mono">{recordingState === 'recording' ? liveMetrics.words : 0}</span></div>
                        <div className="bg-slate-800/50 rounded p-2 border border-slate-700"><span className="block text-[8px] text-slate-500 uppercase tracking-wider mb-1">PPM Atual</span><span className={`font-bold text-lg font-mono ${liveMetrics.ppm > 60 ? 'text-emerald-400' : 'text-blue-400'}`}>{recordingState === 'recording' ? liveMetrics.ppm : (currentStudent?.ppm || 0)}</span></div>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        {currentStep === 0 && viewStudentId && recordingState === 'idle' && (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <button 
                                    onClick={() => handleQuickTriage('Nível 2')}
                                    className="py-2 px-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <Zap className="w-3 h-3" /> O Aluno Soletrou
                                </button>
                                <button 
                                    onClick={() => handleQuickTriage('Nível 3')}
                                    className="py-2 px-3 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <Zap className="w-3 h-3" /> O Aluno Silabou
                                </button>
                            </div>
                        )}
                        <button 
                            onClick={triggerAnalysis} 
                            disabled={!viewStudentId || recordingState !== 'idle'} 
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                                !viewStudentId || recordingState !== 'idle' 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                    : isPendingDiagnosis 
                                        ? 'bg-emerald-600 text-white shadow-emerald-200 animate-bounce scale-105' 
                                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 hover:scale-[1.02]'
                            }`}
                        >
                            <Zap className={`w-5 h-5 ${isPendingDiagnosis ? 'fill-white' : 'fill-current'}`} /> 
                            Gerar Diagnóstico CAED
                        </button>
                        {isPendingDiagnosis && (
                            <p className="text-[10px] font-bold text-emerald-600 text-center animate-pulse uppercase tracking-wider">
                                Gravações concluídas. Clique acima para processar o nível do aluno com a IA.
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 uppercase">Lançamento Manual</h3>
                    <p className="text-sm text-slate-500">Neste período ({evolutionPeriod}), os resultados devem ser inseridos manualmente conforme os dados da plataforma CAED.</p>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 w-full">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Instruções</p>
                        <ul className="text-left text-xs text-slate-600 space-y-2">
                            <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div> Selecione o aluno na tabela ao lado.</li>
                            <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div> Escolha o nível de fluência no seletor da coluna "Status".</li>
                            <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div> O histórico será atualizado automaticamente para este período.</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Last Report View (Simplified here as modal exists) */}
            {currentStudent?.report && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-2">Diagnóstico Recente</h3>
                    <p className="text-xs text-slate-500 mb-4">O último diagnóstico gerado para {currentStudent.name} está disponível.</p>
                    <button onClick={() => handleViewStudentReport(currentStudent)} className="text-xs font-bold text-blue-600 uppercase border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50">Abrir Laudo Completo</button>
                </div>
            )}

            {/* Chart Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-6 text-center">Distribuição de Fluência ({currentClass})</h3>
                <FluencyChart students={filteredStudents} evolutionPeriod={evolutionPeriod} />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-0 overflow-hidden">
                <EvolutionChart 
                    students={filteredStudents} 
                    selectedPeriod={evolutionPeriod}
                    setSelectedPeriod={setEvolutionPeriod}
                    comparePeriod={comparePeriod}
                    setComparePeriod={setComparePeriod}
                />
            </div>

            <EvolutionMapTable 
                students={filteredStudents}
                currentPeriod={evolutionPeriod}
                comparePeriod={comparePeriod}
            />

            </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-slate-100 py-8 mt-auto border-t border-slate-200 no-print">
          <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              
              {/* Logotipo Altbit (Esquerda) */}
              <div className="flex items-center justify-center md:justify-start">
                  <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 transition-transform hover:scale-105">
                    <img 
                      src="/logoaltbit.jpeg" 
                      alt="Altbit Logo" 
                      className="h-10 md:h-12 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
              </div>

              {/* Autoria e Propósito (Centro) */}
              <div className="text-center">
                  <p className="text-xs tracking-wide text-slate-500 leading-relaxed mx-auto">
                     <span className="font-bold text-slate-700 whitespace-nowrap">PIPA Voice AI: Tecnologia a serviço da equidade e da redução de desigualdades na alfabetização.</span>
                     <span className="block mt-1 font-light text-slate-500">Desenvolvido por HENRIQUE MORAIS © 2026 - vPlus</span>
                  </p>
                  
                  {/* Status Indicator */}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      syncStatus === 'synced' ? 'bg-emerald-500' : 
                      syncStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 
                      'bg-rose-500'
                    }`}></div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      {syncStatus === 'synced' ? 'Sincronizado com Banco de Dados' : 
                       syncStatus === 'saving' ? 'Salvando...' : 
                       'Erro de Sincronização'}
                    </span>
                  </div>
              </div>

              {/* Logomarca HCC (Direita) */}
              <div className="flex items-center justify-center md:justify-end">
                  <img 
                    src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjUwIiB2aWV3Qm94PSIwIDAgMTQwIDUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjUwJSIgeT0iNTQlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSI0MCIgZmlsbD0iIzBmMTcyYSIgbGV0dGVyLXNwYWNpbmc9Ii0yIj5oY2M8L3RleHQ+PHJlY3QgeD0iNSIgeT0iMjYiIHdpZHRoPSIxMzAiIGhlaWdodD0iNCIgZmlsbD0iIzNiODJmNiIgb3BhY2l0eT0iMC44IiAvPjwvc3ZnPg==" 
                    alt="HCC Logo" 
                    className="h-10 w-auto opacity-90 hover:opacity-100 transition-opacity drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]"
                  />
              </div>

          </div>
      </footer>

      {/* Early Detection Modal */}
      {showEarlyDetectionModal && earlyDetectionData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-blue-600 fill-blue-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Detecção Precoce</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                O PIPA detectou um padrão de <span className="font-bold text-blue-600">{earlyDetectionData.pattern}</span>. Deseja encerrar o teste agora e classificar o estudante como <span className="font-bold text-blue-600">{earlyDetectionData.level}</span>?
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={handleEarlyClassification}
                  className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  SIM, CLASSIFICAR
                </button>
                <button 
                  onClick={() => setShowEarlyDetectionModal(false)}
                  className="w-full py-4 bg-slate-100 text-slate-500 font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-slate-200 transition-all"
                >
                  NÃO, CONTINUAR
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Regra de Otimização: Confiança &gt; 85%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;