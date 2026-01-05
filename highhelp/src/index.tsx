import { Hono } from 'hono'
import { Bindings } from './types'

// Import Routes
import homeRoutes from './routes/home'
import authRoutes from './routes/auth'
import profileRoutes from './routes/profile'
import resourcesRoutes from './routes/resources'
import pastPapersRoutes from './routes/pastPapers'
import announcementsRoutes from './routes/announcements'
import forumRoutes from './routes/forum'
import essaysRoutes from './routes/essays'

import { getUser } from './utils'
import { PermissionLevel } from './permissions'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', async (c, next) => {
    // Whitelist public assets if needed, but Hono usually serves static separate/handled.
    // Allow login/auth related to avoid lockout loops or if they need to fetch auth status.
    // However, goal is "cannot view anything".
    // We allow /api/auth paths so they can logout.
    if (c.req.path.startsWith('/api/auth')) return next();
    if (c.req.path.startsWith('/public')) return next(); // If static

    const user = await getUser(c);
    if (user && user.permission_level === PermissionLevel.BANNED) {
        return c.text('You have been banned from HighHelp.', 403);
    }
    await next();
})

// Mount Routes
app.route('/', homeRoutes)
app.route('/', authRoutes)
app.route('/', profileRoutes)
app.route('/', resourcesRoutes)
app.route('/', pastPapersRoutes)
app.route('/', announcementsRoutes)
app.route('/', forumRoutes)
app.route('/', essaysRoutes)

export default app