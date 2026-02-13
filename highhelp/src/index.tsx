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
import classesRoutes from './routes/timetable'

import { getUser } from './utils'
import { PermissionLevel } from './permissions'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', async (c, next) => {
    
    if (c.req.path.startsWith('/api/auth')) return next();
    if (c.req.path.startsWith('/public')) return next();

    
    const host = c.req.header('host');
    if (host && host.includes('highhelp.org/login')) {
        const url = new URL(c.req.url);
        url.hostname = 'https://highhelp.sbhs27.workers.dev/';
        return c.redirect(url.toString(), 301);
    }


    const user = await getUser(c);
    if (user && user.permission_level === PermissionLevel.BANNED) {
        return c.text('You have been banned from HighHelp.', 403);
    }
    await next();
})


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
app.route('/', aboutRoutes)

export default app