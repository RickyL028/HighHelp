import { Hono } from 'hono'
import { Bindings } from '../../types'

import browseApp from './browse'
import createApp from './create'
import viewApp from './view'
import attemptApp from './attempt'
import mockApp from './mock'

const app = new Hono<{ Bindings: Bindings }>()

app.route('/', browseApp)
app.route('/', createApp)
app.route('/', viewApp)
app.route('/', attemptApp)
app.route('/past-papers', mockApp)

export default app