import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const PORT = 3000;

app.use(cookieParser());
app.use(express.json());

// Whitelist configuration
// In a real app, this might come from a database or environment variable
const ALLOWED_EMAILS = [
  'dados.educacionais@pindamonhangaba.sp.gov.br',
  // Add other authorized emails here
  'henrique.morais@pindamonhangaba.sp.gov.br',
  'coordenador@gmail.com', 
  'diretor@escola.com'
];

// OAuth Configuration
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Use APP_URL from environment if available, otherwise fallback to localhost
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// Ensure no trailing slash for consistency
const BASE_URL = APP_URL.endsWith('/') ? APP_URL.slice(0, -1) : APP_URL;
const REDIRECT_URI = `${BASE_URL}/auth/callback`;

console.log('OAuth Config:', { 
  CLIENT_ID: CLIENT_ID ? 'Set' : 'Not Set', 
  REDIRECT_URI 
});

const oauth2Client = new OAuth2Client(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// API Routes

// 1. Get OAuth URL
app.get('/api/auth/google-url', (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing OAuth credentials');
    return res.status(500).json({ error: 'OAuth not configured' });
  }
  
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    prompt: 'consent'
  });
  
  res.json({ url: authorizeUrl });
});

// 2. OAuth Callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name;
    const picture = payload?.picture;

    if (!email) {
       throw new Error('No email found in token');
    }

    console.log(`Login attempt: ${email}`);

    // Whitelist Check
    // Check if email is in whitelist OR if the domain matches (optional, but sticking to explicit list for now as requested)
    // The user asked for a "List of emails", so we check inclusion.
    const isAllowed = ALLOWED_EMAILS.includes(email) || ALLOWED_EMAILS.some(e => email === e); 
    
    if (!isAllowed) {
       console.log(`Access denied for: ${email}`);
       return res.send(`
        <html>
          <head>
            <title>Acesso Negado</title>
            <style>body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #334155; }</style>
          </head>
          <body>
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <h1 style="color: #ef4444; margin-bottom: 20px;">Acesso Negado</h1>
                <p>Acesso não autorizado. Entre em contato com o setor ADE.</p>
                <p style="font-size: 0.875rem; color: #64748b; margin-top: 20px;">Esta janela fechará em 5 segundos.</p>
            </div>
            <script>
              setTimeout(() => window.close(), 5000);
            </script>
          </body>
        </html>
      `);
    }

    console.log(`Access granted for: ${email}`);

    // Success
    const user = { email, name, picture };
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(user)} }, '*');
              window.close();
            } else {
              document.body.innerHTML = '<h1 style="font-family:sans-serif;text-align:center;margin-top:50px;">Autenticado! Pode fechar esta janela.</h1>';
              window.close();
            }
          </script>
          <p>Autenticação realizada com sucesso. Fechando...</p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #ef4444;">Erro de Autenticação</h1>
            <p>Ocorreu um erro ao processar o login. Tente novamente.</p>
            <script>setTimeout(() => window.close(), 5000);</script>
          </body>
        </html>
    `);
  }
});

// Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Failed to start Vite server', e);
    }
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'production' || (process.env.VERCEL !== '1' && process.env.NODE_ENV === 'production')) {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`OAuth Redirect URI: ${REDIRECT_URI}`);
      });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startServer();
}

export default app;
