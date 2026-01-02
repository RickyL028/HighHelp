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

const app = new Hono<{ Bindings: Bindings }>()

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