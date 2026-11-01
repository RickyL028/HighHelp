import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { createSessionCookie, getSessionUserId, buildUserTags, extractTimetableSubjects, safeNext, refererTarget, isExternalUser, updatePoints } from '../utils'
import { REFRESH_COOKIE, heldAccessToken, portalClient, portalCredsFor, replaceHeldTokens, requestTokenRefresh, setRefreshCookie } from '../portalTokens'

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
    return portalCredsFor(c.env, portalClient(c));
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
            // Store refresh token in a secure, HTTP-only cookie for 90 days
            setRefreshCookie(c, refreshToken);
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

        // Students with timetable alerts on have their token held server-side; move that copy onto this
        // newest login, which also resumes alerts that paused when the old token expired.
        if (refreshToken) {
            try {
                await replaceHeldTokens(c.env, Number(user.id), portalClient(c), {
                    accessToken,
                    refreshToken,
                    expiresIn: Number(tokenData.expires_in) || undefined
                });
            } catch (e: any) {
                console.error('[auth] could not update held portal tokens', e?.message);
            }
        }

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

        // External accounts have no portal data, so logging in is the only thing that counts
        // towards their score. Checked after the tag rebuild so a just-added tag applies.
        if (isExternalUser(user as any)) {
            await updatePoints(Number(user.id), 1, c.env.DB);
        }

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
            <div class="flex flex-col scroll-smooth">

                <div class="w-full min-h-[calc(100vh_-_8rem)] p-8 flex flex-col justify-center items-center bg-gray-50 border-b border-gray-200">
                    <h2 class="text-2xl font-bold mb-6 text-gray-800">Student Portal Login</h2>
                    <p class="text-gray-600 mb-6 text-center">Log in with your school account.</p>

                    <a href={`/api/auth/login?next=${encodeURIComponent(next)}`} class="w-3/4 bg-blue-600 text-white font-bold py-3 mb-6 rounded text-center hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2">
                        <span>Log In with Student Portal</span>
                    </a>
                    
                    {/* Optional: Add a quick button for users to skip directly down */}
                    
                </div>

                {/* 1. Added id="code" here */}
                <div id="code" class="w-full min-h-[calc(100vh_-_8rem)] flex flex-col justify-center items-center">
                    <h2 class="text-2xl font-bold mb-4 text-gray-800">Code</h2>
                    
                    <form action="/code-login" method="post" class="w-3/4 max-w-sm space-y-4">
                        <input type="hidden" name="next" value={next} />
                        <input type="text" id="code-input" name="code" required
                            class="block w-full rounded-md border-gray-300 shadow-sm p-3 border text-center text-lg tracking-widest font-mono uppercase"
                            placeholder="" maxLength={20} />
                        <button type="submit" class="w-full bg-gray-700 text-white font-bold py-3 rounded hover:bg-gray-800 transition">
                            Log In
                        </button>
                    </form>
                </div>

            </div>

            {/* 2. Optional: Auto-focus the input box if the URL contains #code */}
            <script dangerouslySetInnerHTML={{ __html: `
                if (window.location.hash === '#code') {
                    const el = document.getElementById('code-input');
                    if (el) el.focus();
                }
            `}} />
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
        // External accounts can't earn points from the portal-backed features, so each
        // code login counts as a contribution instead.
        if (isExternalUser(user as any)) {
            await updatePoints(Number(user.id), 1, c.env.DB);
        }

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
    // Also switch off timetable alerts on this device, so a shared computer doesn't keep showing the
    // last student's timetable changes. Unsubscribing only needs the endpoint, not the session.
    return c.html(`<!DOCTYPE html>
        <html><head><title>Logging out...</title></head><body>
        <script>
            (function () {
                var done = function () { location.replace('/'); };
                setTimeout(done, 3000);
                if (!('serviceWorker' in navigator)) return done();
                navigator.serviceWorker.getRegistration().then(function (reg) {
                    return reg && reg.pushManager ? reg.pushManager.getSubscription() : null;
                }).then(function (sub) {
                    if (!sub) return;
                    return fetch('/api/auth/push/unsubscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ endpoint: sub.endpoint })
                    }).catch(function () {}).then(function () { return sub.unsubscribe(); });
                }).catch(function () {}).then(done);
            })();
        </script>
        </body></html>`)
})
app.get('/api/auth/refresh', async (c) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE);

    if (!refreshToken) {
        return c.json({ success: false, error: 'No refresh token' }, 401);
    }

    // With timetable alerts on, the server holds this user's token and the cron may have rotated it since
    // this cookie was set, so the held copy wins. The cookie is still required: a session alone never
    // yields a portal token.
    const userId = await getSessionUserId(c);
    if (userId) {
        try {
            const held = await heldAccessToken(c.env, userId, true);
            if (held.status === 'ok') {
                if (held.refreshToken && held.refreshToken !== refreshToken) setRefreshCookie(c, held.refreshToken);
                return c.json({ success: true, accessToken: held.accessToken });
            }
        } catch (e: any) {
            console.error('[auth] held token refresh failed', e?.message);
        }
    }

    try {
        // Ask SBHS for a new access token
        const result = await requestTokenRefresh(c.env, portalClient(c), refreshToken);

        if (result.ok) {
            // If we got a new refresh token (rotation), update the cookie
            if (result.refreshToken) {
                setRefreshCookie(c, result.refreshToken);
            }

            return c.json({ success: true, accessToken: result.accessToken });
        } else {
            return c.json({ success: false, error: 'Failed to refresh' }, 401);
        }
    } catch (e) {
        return c.json({ success: false, error: 'Network error' }, 500);
    }
});

export default app
