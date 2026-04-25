import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Database features will be disabled. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

const BUCKET_NAME = 'audio_pipa_vplus';

/**
 * Utility to upload an audio blob to Supabase Storage
 */
export const uploadAudio = async (blob: Blob, path: string) => {
  console.log(`Iniciando upload para: ${BUCKET_NAME}/${path}`);
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      contentType: 'audio/wav',
      upsert: true
    });

  if (error) {
    console.error("ERRO SUPABASE STORAGE DETALHADO:", error);
    // Adicionando tratamento para 403 Forbidden conforme instrução
    if ((error as any).status === 403) {
      console.warn("Possível erro de autenticação ou política RLS. Verifique os Secrets e a configuração do Bucket.");
    }
    throw error;
  }
  
  const { data: publicData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return publicData.publicUrl;
};

/**
 * Utility to save assessment result
 */
export interface AssessmentResult {
  student_id: number;
  student_name: string;
  class_name: string;
  school_name: string;
  ppm: number;
  status: string;
  report: string;
  audio_url?: string;
  period: string;
  long_pause: boolean;
}

export const saveAssessment = async (result: AssessmentResult) => {
  const { data, error } = await supabase
    .from('assessments')
    .insert([result]);

  if (error) throw error;
  return data;
};

/**
 * Utility for persisting student data (Alunos Fluencia)
 */
export interface AlunoFluencia {
  id?: string | number;
  escola_id?: string;
  nome_aluno: string;
  nee: boolean;
  bf: boolean;
  resultado_entrada?: string;
  simulado_1?: string;
  simulado_2?: string;
  resultado_saida?: string;
  ppm_atual: number;
  turma: string;
  school: string;
}

export const upsertStudent = async (student: AlunoFluencia) => {
  const { data, error } = await supabase
    .from('alunos_fluencia')
    .upsert([student]);

  if (error) throw error;
  return data;
};

export const fetchStudents = async (escolaId?: string, schoolName?: string) => {
  let query = supabase.from('alunos_fluencia').select('*');
  
  if (escolaId) {
    query = query.eq('escola_id', escolaId);
  } else if (schoolName) {
    query = query.eq('school', schoolName);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};
