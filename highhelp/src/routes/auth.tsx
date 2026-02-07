import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { Layout } from '../layout'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// --- AUTHENTICATION ROUTES ---

app.get('/api/auth/login', (c) => {
    const clientId = c.env.PORTAL_API_CLIENT_ID;
    const redirectUri = c.env.APP_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return c.text('Configuration Error: Missing Client ID or Redirect URI', 500);
    }

    // Generate random state
    const state = Math.random().toString(36).substring(7);
    setCookie(c, 'oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: !c.req.url.includes('localhost'),
        maxAge: 300, // 5 minutes
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

    // CSRF
    if (!code || !state || state !== savedState) {
        return c.text('Invalid State or Missing Code. Please try logging in again.', 400);
    }

    const clientId = c.env.PORTAL_API_CLIENT_ID;
    const clientSecret = c.env.PORTAL_API_CLIENT_SECRET;
    const redirectUri = c.env.APP_REDIRECT_URI;

    if (!clientSecret) {
        return c.text('Configuration Error: Missing Client Secret. add PORTAL_API_CLIENT_SECRET to .dev.vars or secrets.', 500);
    }

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


        if (!tokenData.access_token) {
            return c.text('Failed to retrieve access token: ' + JSON.stringify(tokenData), 400);
        }

        const accessToken = tokenData.access_token;

        // Get Info
        const userResponse = await fetch('https://student.sbhs.net.au/api/details/userinfo.json', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const userData: any = await userResponse.json();

        if (!userData.studentId) {
            return c.text('Failed to retrieve user info: ' + JSON.stringify(userData), 400);
        }

        // Check/Upsert
        let user = await c.env.DB.prepare('SELECT * FROM users WHERE student_id = ?').bind(userData.studentId).first();

        if (!user) {
            // new user
            const result = await c.env.DB.prepare(`
                INSERT INTO users (student_id, first_name, last_name, email, role, permission_level)
                VALUES (?, ?, ?, ?, 'student', 0)
                RETURNING *
            `).bind(
                userData.studentId,
                userData.givenName,
                userData.surname,
                userData.email
            ).first();
            user = result;
        }

        if (!user) return c.text('Database Error: Failed to create user', 500);

        // Fetch Timetable Data
        const timetableResponse = await fetch('https://student.sbhs.net.au/api/timetable/timetable.json', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const timetableData = await timetableResponse.json();

        // Fetch Calendar Data (Full Year to allow navigation)
        // Default only returns today, so we specific a range.
        const currentYear = new Date().getFullYear();
        const calendarResponse = await fetch(`https://student.sbhs.net.au/api/calendar/days.json?from=${currentYear}-01-01&to=${currentYear}-12-31`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const calendarData = await calendarResponse.json();

        const studentData = {
            timetable: timetableData,
            calendar: calendarData
        };

        // Set Cookie
        const isLocal = c.req.url.includes('localhost');
        setCookie(c, 'user_id', String(user.id), {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7, // 1 week
            sameSite: 'Lax'
        });

        // Return HTML to save to localStorage and redirect
        return c.html(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirecting...</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9fafb; color: #374151; }
                    .container { text-align: center; }
                    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="spinner"></div>
                    <p>Setting up your session...</p>
                </div>
                <script>
                    try {
                        const studentData = {
                            ...${JSON.stringify(studentData)},
                            accessToken: "${accessToken}"
                        };
                        localStorage.setItem('studentData', JSON.stringify(studentData));
                        window.location.href = '/';
                    } catch (e) {
                        console.error('Error saving data', e);
                        document.body.innerHTML = '<p style="color:red">Error saving session data. Please try again or contact support.</p>';
                    }
                </script>
            </body>
            </html>
        `);

    } catch (e: any) {
        return c.text(`Authentication Failed: ${e.message}`, 500);
    }
})

app.get('/login', (c) => {
    return c.html(
        <Layout title="Login">
            <div class="flex flex-col md:flex-row min-h-[600px]">


                <div class="w-full md:w-1/2 p-8 flex flex-col justify-center items-center bg-gray-50 border-r border-gray-200">
                    <h2 class="text-2xl font-bold mb-6 text-gray-800">Student Portal Login</h2>
                    <p class="text-gray-600 mb-6 text-center">Log in with your school account.</p>

                    <a href="/api/auth/login" class="w-3/4 bg-blue-600 text-white font-bold py-3 mb-6 rounded text-center hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2">
                        <span>Log In with Student Portal</span>
                    </a>
                    <p class="text-gray-600 mb-6 text-center">Note: This is purely for login and no sensitive information will be collected (to avoid Deputy)</p>
                </div>


                <div class="w-full md:w-1/2 p-8 flex flex-col justify-center">
                    <h2 class="text-2xl font-bold mb-6 text-blue-900">Manual Login (Timetable will NOT work)</h2>
                    <form action="/login" method="post" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Email Address</label>
                            <input type="email" name="email" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border" placeholder="student@student.sbhs.nsw.edu.au" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" name="password" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border" placeholder="••••••••" />
                        </div>
                        <button type="submit" class="w-full bg-blue-800 text-white font-bold py-3 mb-6 rounded hover:bg-blue-900 transition">
                            Log In
                        </button>
                        <p class="text-gray-600 mb-6 text-center">Note: Manual login is available only after logging in with the Student Portal the first time - and setting a password.</p>
                    </form>
                </div>

            </div>
        </Layout>
    )
})

app.post('/login', async (c) => {
    const body = await c.req.parseBody()
    const email = body['email'] as string
    const password = body['password'] as string

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?').bind(email, password).first()

    if (user) {
        const isLocal = c.req.url.includes('localhost');
        setCookie(c, 'user_id', String(user.id), {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'Lax'
        });
        return c.redirect('/')
    } else {
        return c.html(
            <Layout title="Login Error">
                <div class="p-4 bg-red-100 text-red-700 rounded text-center">
                    <p>Invalid email or password.</p>
                    <a href="/login" class="underline mt-2 inline-block">Try Again</a>
                </div>
            </Layout>
        )
    }
})

app.get('/logout', (c) => {
    deleteCookie(c, 'user_id')
    return c.redirect('/')
})

export default app
