import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { Layout } from '../layout'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/auth/login', (c) => {
    const clientId = c.env.PORTAL_API_CLIENT_ID;
    const redirectUri = c.env.APP_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return c.text('Configuration Error: Missing Client ID or Redirect URI', 500);
    }

    const state = Math.random().toString(36).substring(7);
    setCookie(c, 'oauth_state', state, {
        path: '/',
        httpOnly: true, // Security: JS cannot read this
        secure: !c.req.url.includes('localhost'), // Security: HTTPS only in prod
        maxAge: 300, 
        sameSite: 'Lax'
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'all-ro',
        state: state
    });

    return c.redirect(`https://student.sbhs.net.au/api/authorize?${params.toString()}`);
})

app.get('/api/auth/callback', async (c) => {
    const error = c.req.query('error');
    if (error) return c.text(`Auth Error: ${error}`, 400);

    const code = c.req.query('code');
    const state = c.req.query('state');
    const savedState = getCookie(c, 'oauth_state');

    if (!code || !state || state !== savedState) {
        return c.text('Invalid State or Missing Code. Please try logging in again.', 400);
    }

    const clientId = c.env.PORTAL_API_CLIENT_ID;
    const clientSecret = c.env.PORTAL_API_CLIENT_SECRET;
    const redirectUri = c.env.APP_REDIRECT_URI;

    try {
        const tokenResponse = await fetch('https://student.sbhs.net.au/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri
            })
        });

        const tokenData: any = await tokenResponse.json();
        if (!tokenData.access_token) return c.text('Failed to retrieve token', 400);
        
        const accessToken = tokenData.access_token;

        // Fetch User Info
        const userResponse = await fetch('https://student.sbhs.net.au/api/details/userinfo.json', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userData: any = await userResponse.json();

        // Database Ops
        let user = await c.env.DB.prepare('SELECT * FROM users WHERE student_id = ?').bind(userData.studentId).first();

        if (!user) {
            user = await c.env.DB.prepare(`
                INSERT INTO users (student_id, first_name, last_name, email, role, permission_level)
                VALUES (?, ?, ?, ?, 'student', 0)
                RETURNING *
            `).bind(userData.studentId, userData.givenName, userData.surname, userData.email).first();
        }

        // Set Session Cookie
        const isLocal = c.req.url.includes('localhost');
        setCookie(c, 'user_id', String(user.id), {
            path: '/',
            httpOnly: true, // Important: Prevents XSS attacks stealing the session
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'Lax'
        });
        
        // RECOMMENDATION: Store the accessToken in the DB instead of sending to client
        // For now, we redirect to home.
        return c.redirect('/');

    } catch (e: any) {
        return c.text(`Authentication Failed: ${e.message}`, 500);
    }
})

app.get('/login', (c) => {
    return c.html(
        <Layout title="Login">
            <div class="flex flex-col w-full min-h-screen justify-center items-center">
                <div class="max-w-md w-full flex flex-col items-center p-8 rounded-xl">
                    <h2 class="text-3xl font-bold mb-6 text-gray-800">Student Portal Login</h2>
                    <p class="text-gray-600 mb-8 text-center text-lg">Log in via SBHS</p>

                    <a href="/api/auth/login" class="w-full bg-blue-600 text-white font-bold py-4 rounded-lg text-center hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2 text-xl">
                        <span>Log In with SBHS</span>
                    </a>
                </div>
            </div>
        </Layout>
    )
})

app.get('/logout', (c) => {
    deleteCookie(c, 'user_id')
    return c.redirect('/')
})

export default app