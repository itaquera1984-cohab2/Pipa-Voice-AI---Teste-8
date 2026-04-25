import os
import json
from flask import Flask, request, jsonify
import google.generativeai as genai

app = Flask(__name__)

# Configure Gemini
# Use GEMINI_API_KEY from environment variables
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

@app.route('/api/gemini/analyze', methods=['POST'])
def analyze_reading_fluency_endpoint():
    try:
        data = request.json
        steps = data.get('studentSteps', ["", "", ""])
        ppm = data.get('studentPpm', 0)
        contexto_simulado = data.get('context', "")

        default_context = "O aluno deve ler palavras simples, pseudopalavras e um texto curto adequado à sua faixa etária."
        reference_context = contexto_simulado.strip() if contexto_simulado and contexto_simulado.strip() else default_context

        model = genai.GenerativeModel('gemini-1.5-flash') # Using 1.5-flash as it's more stable for these tasks
        
        prompt = f"""
          Atue como um especialista em avaliação de fluência leitora (padrão CAED/alfabetização).
          
          CONTEXTO DE REFERÊNCIA (Simulado/Prova Base):
          "{reference_context}"

          Analise o seguinte circuito de leitura de um aluno com base no contexto de referência acima:
          
          1. LEITURA DE PALAVRAS ISOLADAS:
          "{steps[0]}"
          
          2. LEITURA DE PSEUDOPALAVRAS (Decodificação):
          "{steps[1]}"
          
          3. LEITURA DE TEXTO CONECTADO:
          "{steps[2]}"
          
          DADOS QUANTITATIVOS (Do Texto):
          - Velocidade: {ppm} PPM
          
          DIRETRIZES DE CLASSIFICAÇÃO (OBRIGATÓRIAS):

          1. IDENTIFICAÇÃO DE SOLETRAÇÃO (NÍVEL 2):
          - Se o áudio contiver a enunciação de letras individuais seguidas ou não da palavra (ex: 'C-A-S-A' ou 'C... A... S... A...'), o aluno deve ser OBRIGATORIAMENTE classificado como 'Nível 2'.
          - Mesmo que ele acerte todas as letras da palavra, se houve soletração, ele não é Nível 1 (pré-leitor), ele já iniciou a decodificação alfabética.

          2. IDENTIFICAÇÃO DE SILABAÇÃO (NÍVEL 3):
          - Se o áudio contiver a emissão de sons por sílabas (ex: 'CA-SA', 'BO-NE-CA'), com pausas rítmicas entre elas, o aluno deve ser classificado como 'Nível 3'.
          - Diferencie a silabação da leitura hesitante (Nível 4). Na silabação, o esforço é na junção fonética.

          3. REGRA DE SILÊNCIO E PAUSA:
          - Pausas silenciosas ou tentativas frustradas de decodificação superiores a 4 segundos entre os fonemas confirmam o status de 'Requer Apoio Pedagógico' (longPauseDetected = true).

          CATEGORIAS OFICIAIS:
          - "Nível 1": Aluno não identifica nenhuma palavra ou apenas letras isoladas (Pré-leitor).
          - "Nível 2": Demonstra SOLETRAÇÃO (letras isoladas) ou lê pouquíssimas palavras.
          - "Nível 3": Demonstra SILABAÇÃO (sílabas isoladas) ou lê mais de 10 palavras.
          - "Nível 4": Lê as listas e iniciou a leitura do texto, mas com muitas pausas/hesitações (PPM entre 20 e 50).
          - "Leitor Iniciante": Lê o texto com poucas pausas, mas sem entonação (PPM 50 a 80).
          - "Leitor Fluente": Leitura fluida, respeitando pontuação e com PPM acima de 80.

          CRITÉRIO DE COMPARAÇÃO:
          Compare a transcrição do áudio (o que o aluno leu) com o CONTEXTO DE REFERÊNCIA (o que ele deveria ler). 
          Avalie a precisão (palavras lidas corretamente vs. erros/omissões).

          SAÍDA DE DADOS:
          Retorne ESTRITAMENTE um JSON com os campos:
          - report: Uma BREVE JUSTIFICATIVA PEDAGÓGICA (ex: 'O aluno demonstrou soletração rítmica em 60% das palavras apresentadas').
          - classification: A categoria oficial identificada.
          - longPauseDetected: Booleano indicando se houve pausas > 4 segundos.
        """

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        return jsonify(json.loads(response.text))
    except Exception as e:
        print(f"Error in analyze-fluency: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/class_analysis', methods=['POST'])
def generate_class_analysis_endpoint():
    try:
        data = request.json
        class_name = data.get('className', "Turma")
        students = data.get('studentsData', [])
        
        evaluated = [s for s in students if s.get('ppm', 0) > 0]
        if not evaluated:
            return jsonify({"report": "Não há dados suficientes para gerar um parecer da turma."})

        summary = "\n".join([f"- Aluno: {s.get('name')}, Nível: {s.get('status')}, PPM: {s.get('ppm')}" for s in evaluated])
        
        counts = {}
        for s in evaluated:
            status = s.get('status', 'Nível 1')
            counts[status] = counts.get(status, 0) + 1

        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
          Atue como um coordenador pedagógico sênior.
          Analise os dados consolidados da turma "{class_name}":
          
          Total Avaliados: {len(evaluated)}
          Distribuição: {json.dumps(counts)}
          
          Lista Detalhada:
          {summary}
          
          Gere um PARECER TÉCNICO DA TURMA (Máx 200 palavras) contendo:
          1. **Visão Geral**: Qual o perfil predominante da sala?
          2. **Pontos de Atenção**: Quais alunos ou grupos precisam de intervenção imediata?
          3. **Estratégia Coletiva**: Sugira 2 atividades para a turma toda baseadas no nível médio.
          
          Use tom profissional e acolhedor.
        """

        response = model.generate_content(prompt)
        return jsonify({"report": response.text})
    except Exception as e:
        print(f"Error in class-analysis: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/gemini/detect_early_pattern', methods=['POST'])
def detect_early_pattern_endpoint():
    try:
        data = request.json
        transcript = data.get('transcript', "")

        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
          Analise a seguinte transcrição de áudio de uma criança em fase de alfabetização:
          "{transcript}"

          Identifique se o padrão de leitura é predominantemente:
          1. "Soletração": Enunciação de letras individuais (ex: C-A-S-A).
          2. "Silabação": Emissão de sons por sílabas (ex: CA-SA).
          3. "Nenhum": Leitura de palavras inteiras ou padrão não identificado.

          Retorne um JSON com:
          - pattern: "Soletração", "Silabação" ou "Nenhum".
          - confidence: Um valor de 0 a 100 representando o grau de confiança na detecção.
        """

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            )
        )
        
        return jsonify(json.loads(response.text))
    except Exception as e:
        print(f"Error in detect-pattern: {e}")
        return jsonify({"error": str(e)}), 500

# Entry point for Vercel
if __name__ == "__main__":
    app.run(debug=True)
