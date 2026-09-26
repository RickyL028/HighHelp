import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { createSessionCookie, buildUserTags, extractTimetableSubjects, safeNext, refererTarget } from '../utils'

const app = new Hono<{ Bindings: Bindings }>()

const LOGIN_NEXT_COOKIE = 'login_next';
const LOGIN_NEXT_TTL = 60 * 10; // 10 minutes

function isLocalDev(c: any): boolean {
    return c.env.LOCAL_DEV === true || c.env.LOCAL_DEV === 'true';
}

// Resolves the post-login target, stashes it in a short-lived cookie so it
// survives the off-site OAuth round trip, and returns it. Anything that isn't a
// safe same-origin relative path is discarded.
function setNext(c: any, raw: unknown): string {
    const target = safeNext(raw) ?? '/';

    if (target === '/') {
        deleteCookie(c, LOGIN_NEXT_COOKIE, { path: '/' });
    } else {
        setCookie(c, LOGIN_NEXT_COOKIE, target, {
            path: '/',
            httpOnly: true,
            secure: !isLocalDev(c),
            maxAge: LOGIN_NEXT_TTL,
            sameSite: 'Lax'
        });
    }

    return target;
}

// Preferred over the cookie when a form carried the target itself.
function postedNext(c: any, raw: unknown): string {
    return safeNext(raw) ?? safeNext(getCookie(c, LOGIN_NEXT_COOKIE)) ?? '/';
}

function clearNext(c: any) {
    deleteCookie(c, LOGIN_NEXT_COOKIE, { path: '/' });
}

function loginHref(target: string): string {
    return target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`;
}

function portalCreds(c: any) {
    const host = c.req.header('host') || '';
    if (!isLocalDev(c) && host.includes('highhelp.org')) {
        return {
            clientId: c.env.PORTAL_API_CLIENT_ID_full,
            clientSecret: c.env.PORTAL_API_CLIENT_SECRET_full,
            redirectUri: c.env.APP_REDIRECT_URI_full,
        };
    }
    return {
        clientId: c.env.PORTAL_API_CLIENT_ID,
        clientSecret: c.env.PORTAL_API_CLIENT_SECRET,
        redirectUri: c.env.APP_REDIRECT_URI,
    };
}

app.get('/api/auth/login', (c) => {

    const { clientId, redirectUri } = portalCreds(c);

    if (!clientId || !redirectUri) {
        return c.text('Configuration Error: Missing Client ID or Redirect URI', 500);
    }

    // Carry the return target across the portal round trip. A missing `next`
    // clears any stale one, so a plain re-auth link returns to the home page.
    setNext(c, c.req.query('next'));

    // random state
    const state = Math.random().toString(36).substring(7);
    setCookie(c, 'oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: !isLocalDev(c),
        maxAge: 300, // 5 minutes
        sameSite: 'Lax'
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'all-ro ns.sbhs.au/r/student_app',
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

    let { clientId, clientSecret, redirectUri } = portalCreds(c);

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
        // [NEW CODE STARTS HERE] ----------------------------
        const refreshToken = tokenData.refresh_token;

        if (refreshToken) {
            // Store refresh token in a secure, HTTP-only cookie for 30 days
            setCookie(c, 'sbhs_refresh_token', refreshToken, {
                path: '/api/auth', // Only send this cookie to auth endpoints
                httpOnly: true,    // JavaScript cannot read this (prevents XSS theft)
                secure: !isLocalDev(c),
                maxAge: 60 * 60 * 24 * 90, // 90 Days
                sameSite: 'Lax'
            });
        }

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


        const currentYear = new Date().getFullYear();
        const calendarResponse = await fetch(`https://student.sbhs.net.au/api/calendar/days.json?from=${currentYear}-01-01&to=${currentYear}-12-31`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const calendarData = await calendarResponse.json();

        // Tags are now display-only: auto-decorate with the student's subjects
        // (default hidden, value 0) and record the student's year group separately.
        const subjects = extractTimetableSubjects(timetableData);
        const newTags = buildUserTags(typeof user.tags === 'string' ? user.tags : null, subjects, userData.yearGroup);
        await c.env.DB.prepare('UPDATE users SET tags = ? WHERE id = ?')
            .bind(newTags, user.id).run();
        user.tags = newTags;

        const studentData = {
            timetable: timetableData,
            calendar: calendarData,
            studentId: userData.studentId
        };

        // Set Cookie
        const isLocal = isLocalDev(c);
        const sessionValue = await createSessionCookie(Number(user.id), c.env.SESSION_SECRET);
        setCookie(c, 'user_id', sessionValue, {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7, // 1 week
            sameSite: 'Lax'
        });

        // Send the user back to whatever they were trying to reach
        const next = postedNext(c, undefined);
        clearNext(c);

        // Return HTML to save to localStorage and redirect
        return c.html(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Redirecting...</title>
                <style>
                    body { font-family: 'Inter', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9fafb; color: #374151; }
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
                        localStorage.setItem('tokenRefreshedAt', String(Date.now()));
                        window.location.href = ${JSON.stringify(next)};
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
    // An explicit `?next` (from a guard) wins; otherwise fall back to the page
    // the visitor came from so plain "Login" links also return them to it.
    const next = setNext(c, c.req.query('next') ?? refererTarget(c));
    return c.html(
        <Layout title="Login">
            <div class="flex flex-col">

                <div class="w-full min-h-[calc(100vh_-_8rem)] p-8 flex flex-col justify-center items-center bg-gray-50 border-b border-gray-200">
                    <h2 class="text-2xl font-bold mb-6 text-gray-800">Student Portal Login</h2>
                    <p class="text-gray-600 mb-6 text-center">Log in with your school account.</p>

                    <a href={`/api/auth/login?next=${encodeURIComponent(next)}`} class="w-3/4 bg-blue-600 text-white font-bold py-3 mb-6 rounded text-center hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2">
                        <span>Log In with Student Portal</span>
                    </a>
                    <p class="text-gray-600 mb-6 text-center"></p>
                </div>

                <div class="w-full min-h-[calc(100vh_-_8rem)] flex flex-col justify-center items-center">
                    <h2 class="text-2xl font-bold mb-4 text-gray-800">Code</h2>
                    
                    <form action="/code-login" method="post" class="w-3/4 max-w-sm space-y-4">
                        <input type="hidden" name="next" value={next} />
                        <input type="text" name="code" required
                            class="block w-full rounded-md border-gray-300 shadow-sm p-3 border text-center text-lg tracking-widest font-mono uppercase"
                            placeholder="" maxLength={20} />
                        <button type="submit" class="w-full bg-gray-700 text-white font-bold py-3 rounded hover:bg-gray-800 transition">
                            Log In
                        </button>
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
    const next = postedNext(c, body['next'])

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?').bind(email, password).first()

    if (user) {
        const isLocal = isLocalDev(c);
        const sessionValue = await createSessionCookie(Number(user.id), c.env.SESSION_SECRET);
        setCookie(c, 'user_id', sessionValue, {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'Lax'
        });
        clearNext(c);
        return c.redirect(next)
    } else {
        return c.html(
            <Layout title="Login Error">
                <div class="p-4 bg-red-100 text-red-700 rounded text-center">
                    <p>Invalid email or password.</p>
                    <a href={loginHref(next)} class="underline mt-2 inline-block">Try Again</a>
                </div>
            </Layout>
        )
    }
})

app.post('/code-login', async (c) => {
    const body = await c.req.parseBody()
    const code = (body['code'] as string || '').trim()
    const next = postedNext(c, body['next'])

    if (!code) {
        return c.html(
            <Layout title="Code Login Error">
                <div class="p-4 bg-red-100 text-red-700 rounded text-center max-w-md mx-auto mt-8">
                    <p>Please enter a login code.</p>
                    <a href={loginHref(next)} class="underline mt-2 inline-block">Try Again</a>
                </div>
            </Layout>
        )
    }

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE password = ?').bind(code).first()

    if (user) {
        const isLocal = isLocalDev(c);
        const sessionValue = await createSessionCookie(Number(user.id), c.env.SESSION_SECRET);
        setCookie(c, 'user_id', sessionValue, {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'Lax'
        });
        clearNext(c);
        return c.redirect(next)
    } else {
        return c.html(
            <Layout title="Code Login Error">
                <div class="p-4 bg-red-100 text-red-700 rounded text-center max-w-md mx-auto mt-8">
                    <p>Invalid login code.</p>
                    <a href={loginHref(next)} class="underline mt-2 inline-block">Try Again</a>
                </div>
            </Layout>
        )
    }
})

app.get('/logout', (c) => {
    deleteCookie(c, 'user_id')
    return c.redirect('/')
})
app.get('/api/auth/refresh', async (c) => {
    const refreshToken = getCookie(c, 'sbhs_refresh_token');

    if (!refreshToken) {
        return c.json({ success: false, error: 'No refresh token' }, 401);
    }

    // Determine credentials based on env/host (reuse existing logic)
    const { clientId, clientSecret } = portalCreds(c);

    try {
        // Ask SBHS for a new access token
        const response = await fetch('https://student.sbhs.net.au/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret
            })
        });

        const data: any = await response.json();

        if (data.access_token) {
            // If we got a new refresh token (rotation), update the cookie
            if (data.refresh_token) {
                setCookie(c, 'sbhs_refresh_token', data.refresh_token, {
                    path: '/api/auth',
                    httpOnly: true,
                    secure: !isLocalDev(c),
                    maxAge: 60 * 60 * 24 * 90,
                    sameSite: 'Lax'
                });
            }

            return c.json({ success: true, accessToken: data.access_token });
        } else {
            return c.json({ success: false, error: 'Failed to refresh' }, 401);
        }
    } catch (e) {
        return c.json({ success: false, error: 'Network error' }, 500);
    }
});

export default app
