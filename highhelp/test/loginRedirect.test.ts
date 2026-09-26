import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { loginRedirect, safeNext } from '../src/utils'

// Stands in for a guarded route: reports the login URL it would bounce to.
const app = new Hono()
app.get('/past-papers', (c) => c.text(loginRedirect(c)))
app.get('/timetable', (c) => c.text(loginRedirect(c)))
app.post('/forum', (c) => c.text(loginRedirect(c)))

const base = 'https://highhelp.org'

const get = (path: string) => app.request(new Request(base + path))
const post = (path: string, referer?: string) =>
	app.request(new Request(base + path, { method: 'POST', headers: referer ? { referer } : {} }))

describe('safeNext', () => {
	it('keeps same-origin relative paths', () => {
		expect(safeNext('/past-papers?subject=Math')).toBe('/past-papers?subject=Math')
		expect(safeNext('/')).toBe('/')
	})

	it('rejects anything that could leave the site', () => {
		expect(safeNext('https://evil.com')).toBeNull()
		expect(safeNext('//evil.com')).toBeNull()
		expect(safeNext('/\\evil.com')).toBeNull()
		expect(safeNext('javascript:alert(1)')).toBeNull()
		expect(safeNext('/x\r\nSet-Cookie: a=b')).toBeNull()
	})

	it('rejects markup, since the target lands in HTML and a script block', () => {
		expect(safeNext('/x</script><script>alert(1)</script>')).toBeNull()
		expect(safeNext('/x"onmouseover="alert(1)')).toBeNull()
		expect(safeNext('/x`${alert(1)}`')).toBeNull()
	})

	it('rejects the auth flow itself so login cannot loop', () => {
		expect(safeNext('/login')).toBeNull()
		expect(safeNext('/login?next=/login')).toBeNull()
		expect(safeNext('/logout')).toBeNull()
		expect(safeNext('/code-login')).toBeNull()
		expect(safeNext('/api/auth/callback')).toBeNull()
	})
})

describe('loginRedirect', () => {
	it('remembers the guarded page and its query string', async () => {
		const res = await get('/past-papers?subject=Math')
		expect(await res.text()).toBe('/login?next=%2Fpast-papers%3Fsubject%3DMath')
	})

	it('uses the full path of a mounted sub-app', async () => {
		const res = await get('/timetable')
		expect(await res.text()).toBe('/login?next=%2Ftimetable')
	})

	it('falls back to the referrer for form posts', async () => {
		const res = await post('/forum', `${base}/past-papers`)
		expect(await res.text()).toBe('/login?next=%2Fpast-papers')
	})

	it('ignores an off-site referrer', async () => {
		const res = await post('/forum', 'https://evil.com/x')
		expect(await res.text()).toBe('/login')
	})

	it('falls back when a post has no usable referrer', async () => {
		const res = await post('/forum')
		expect(await res.text()).toBe('/login')
	})
})
