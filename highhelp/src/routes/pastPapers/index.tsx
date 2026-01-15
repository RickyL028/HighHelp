import { Hono } from 'hono'
import { Bindings } from '../../types'

import browseApp from './browse'
import createApp from './create'
import viewApp from './view'
import attemptApp from './attempt'
import mockApp from './mock'

const app = new Hono<{ Bindings: Bindings }>()

// Mount sub-apps
// Note: Order matters for overlapping routes, but here the routes are distinct enough.
app.route('/', browseApp)
app.route('/', createApp)
app.route('/', viewApp)
app.route('/', attemptApp)
app.route('/past-papers', mockApp)

export default app