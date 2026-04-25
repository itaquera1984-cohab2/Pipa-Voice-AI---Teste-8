import os
from flask import Flask, render_template, send_from_directory, jsonify, request

# Inicialização do App Flask
# Os folders `templates` e `static` serão criados e preenchidos
# pelo script `vercel-build` durante o deploy no Vercel.
app = Flask(__name__, 
            template_folder='templates', # Aponta para o diretório que contém index.html
            static_folder='static'       # Aponta para o diretório que contém outros assets estáticos (ex: assets/, imagens raiz)
           )

# 1. Rotas da API
@app.route('/api/auth/google-url')
def get_google_url():
    # Placeholder para a URL de autenticação Google OAuth
    return jsonify({"url": "/auth/callback?code=dummy_code"})

@app.route('/auth/callback')
def auth_callback():
    # Simulação de callback de autenticação para o frontend React
    return """
    <html>
        <body>
            <script>
                if (window.opener) {
                    window.opener.postMessage({ 
                        type: 'OAUTH_AUTH_SUCCESS', 
                        user: { 
                            name: 'Henrique Morais', 
                            email: 'dados.educacionais@pindamonhangaba.sp.gov.br',
                            picture: 'https://placehold.co/100'
                        } 
                    }, '*');
                    window.close();
                } else {
                    window.location.href = '/';
                }
            </script>
        </body>
    </html>
    """

# Mock Data para o Dashboard (Migrado do Streamlit para API)
@app.route('/api/dashboard/data')
def get_dashboard_data():
    data = [
        {'Escola': 'EM André Franco Montoro', 'N1': 10, 'N2': 15, 'Proficiencia': 250},
        {'Escola': 'EM Arantes Vasques', 'N1': 5, 'N2': 8, 'Proficiencia': 280},
        {'Escola': 'EM Dulce Pedrosa', 'N1': 20, 'N2': 25, 'Proficiencia': 210},
    ]
    return jsonify(data)

# 2. Rotas do Frontend - Serve o Aplicativo React (SPA)
# Todas as outras rotas (exceto as APIs) devem servir o index.html do React.
# Isso permite que o React Router (ou similar) lide com o roteamento do lado do cliente.
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    # Tenta servir um arquivo estático específico se ele existir na pasta 'static'.
    # Isso cobre arquivos como /assets/bundle.js, /brasao.png, etc.
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    
    # Para qualquer outra rota (incluindo a raiz '/'), serve o index.html principal.
    # Isso é essencial para aplicações Single Page Application (SPA) com roteamento client-side.
    return render_template('index.html')

# O Vercel não precisa de app.run() no código de produção.
# Este bloco é apenas para desenvolvimento local.
if __name__ == "__main__":
    # Para rodar localmente, execute `npm run vercel-build` primeiro
    # para criar as pastas 'templates' e 'static'.
    app.run(debug=True)
