import { Hono } from 'hono'
import { Bindings } from './types'
import homeRoutes from './routes/home'
import authRoutes from './routes/auth'
import profileRoutes from './routes/profile'
import resourcesRoutes from './routes/resources'
import pastPapersRoutes from './routes/pastPapers'
import announcementsRoutes from './routes/announcements'
import forumRoutes from './routes/forum'
import essaysRoutes from './routes/essays'
import aboutRoutes from './routes/about'
import leaderboardRoutes from './routes/leaderboard'
import pointsRoutes from './routes/points'
import feedbackRoutes from './routes/feedback'
import classesRoutes from './routes/timetable'
import clipboardRoutes from './components/timetable/TimetableClipboard'
import atarRoutes from './routes/atar'
import atarExplainedRoutes from './routes/atar-explained'
import { processAIImportJob, AIImportJob } from './routes/pastPapers/aiQueueWorker'
import { getUser } from './utils'
import { PermissionLevel } from './permissions'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', async (c, next) => {

    if (c.req.path.startsWith('/api/auth')) return next();
    if (c.req.path.startsWith('/public')) return next();


    // const host = c.req.header('host');

    // if (host && host.includes('highhelp.org')) {
    //     const url = new URL(c.req.url);

    //     // 1. Change the destination hostname
    //     url.hostname = 'highhelp.sbhs27.workers.dev';

    //     // 2. Preserve the path (e.g., /about) but ensure it goes where you want
    //     // If you want EVERYTHING to go to /home, use: url.pathname = '/home';

    //     // 3. Add the "Anti-Cache" query parameter
    //     // This creates a unique URL every time, forcing the browser to skip the cache.
    //     url.searchParams.set('nocache', Date.now().toString());

    //     return c.redirect(url.toString(), 302);
    // }


    const user = await getUser(c);
    if (user && user.permission_level === PermissionLevel.BANNED) {
        return c.text('You have been banned from HighHelp.', 403);
    }


    await next();
});


app.get('/api/proxy/day-data', async (c) => {
    const date = c.req.query('date')
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !date) return c.json({ error: 'Invalid request' }, 400)
    try {
        const response = await fetch(`https://student.sbhs.net.au/api/timetable/daytimetable.json?date=${date}`, {
            headers: { 'Authorization': authHeader }
        })
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})

app.get('/api/proxy/notices', async (c) => {
    const date = c.req.query('date')
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !date) return c.json({ error: 'Invalid request' }, 400)
    try {
        const response = await fetch(`https://student.sbhs.net.au/api/dailynews/list.json?date=${date}`, {
            headers: { 'Authorization': authHeader }
        })
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})

app.get('/api/proxy/events', async (c) => {
    const date = c.req.query('date')
    const toDate = c.req.query('to') || date
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !date) return c.json({ error: 'Invalid request' }, 400)
    try {
        const response = await fetch(`https://student.sbhs.net.au/api/diarycalendar/events.json?from=${date}&to=${toDate}`, {
            headers: { 'Authorization': authHeader }
        })
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})

app.get('/api/proxy/awards', async (c) => {
    const authHeader = c.req.header('Authorization')
    const studentId = c.req.query('studentId')
    if (!authHeader || !studentId) return c.json({ error: 'Invalid request' }, 400)
    try {
        const response = await fetch(`https://api.sbhs.net.au/api/core/students/${studentId}/award-scheme/awards`, {
            headers: { 'Authorization': authHeader }
        })
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})

app.get('/api/proxy/all-awards', async (c) => {
    const authHeader = c.req.header('Authorization')
    const url = c.req.query('url')
    if (!authHeader) return c.json({ error: 'Invalid request' }, 400)
    const target = url || 'https://api.sbhs.net.au/api/core/award-scheme/awards'
    try {
        const response = await fetch(target, {
            headers: { 'Authorization': authHeader }
        })
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})
app.get('/api/proxy/scan-ins', async (c) => {
    const authHeader = c.req.header('Authorization')
    const studentId = c.req.query('studentId')
    if (!authHeader || !studentId) return c.json({ error: 'Invalid request' }, 400)
    try {
        const response = await fetch(`https://api.sbhs.net.au/api/core/students/${studentId}/attendance/scan-ins`, {
            headers: { 'Authorization': authHeader }
        })
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})
app.get('/api/proxy/clipboard-sessions', async (c) => {
    const authHeader = c.req.header('Authorization')
    const studentId = c.req.query('studentId')
    if (!authHeader || !studentId) return c.json({ error: 'Invalid request' }, 400)
    try {
        const context = c.req.query('context') || new Date().getFullYear().toString()
        const dateBefore = c.req.query('date[before]')
        const dateAfter = c.req.query('date[after]')

        const params = new URLSearchParams({
            _page: '1',
            _itemsPerPage: '200',
            context
        })
        if (dateBefore) params.set('date[before]', dateBefore)
        if (dateAfter) params.set('date[after]', dateAfter)

        const response = await fetch(
            `https://api.sbhs.net.au/api/core/students/${studentId}/clipboard/sessions?${params.toString()}`,
            { headers: { 'Authorization': authHeader } }
        )
        const data = await response.json()
        return c.json(data, response.status as any)
    } catch (e) {
        return c.json({ error: 'Proxy error' }, 500)
    }
})

app.route('/', homeRoutes)
app.route('/home', homeRoutes)
app.route('/', authRoutes)
app.route('/', profileRoutes)
app.route('/', resourcesRoutes)
app.route('/', pastPapersRoutes)
app.route('/', announcementsRoutes)
app.route('/', forumRoutes)
app.route('/', essaysRoutes)
app.route('/timetable', classesRoutes)
app.route('/', feedbackRoutes)
app.route('/', aboutRoutes)
app.route('/', leaderboardRoutes)
app.route('/', pointsRoutes)
app.route('/', atarRoutes)
app.route('/', atarExplainedRoutes)
app.route('/api/clipboard', clipboardRoutes)

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<AIImportJob>, env: Bindings) {
    for (const message of batch.messages) {
      try {
        await processAIImportJob(message.body, env)
        message.ack()
      } catch (err) {
        console.error('[Queue] Job failed:', err)
        message.ack()
      }
    }
  }
}