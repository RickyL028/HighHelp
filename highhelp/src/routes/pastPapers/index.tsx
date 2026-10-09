import { Hono } from 'hono'
import { Bindings } from '../../types'

import browseApp from './browse'
import createApp from './create'
import viewApp from './view'
import attemptApp from './attempt'
import batchApp from './batch'
import mockApp from './mock'
import aiImportApp from './aiImport'
import drawingsApp from './drawings'

const app = new Hono<{ Bindings: Bindings }>()

app.route('/', browseApp)
app.route('/', createApp)
app.route('/', viewApp)
app.route('/', attemptApp)
app.route('/', batchApp)
app.route('/past-papers', mockApp)
app.route('/', aiImportApp)
app.route('/', drawingsApp)

export default app