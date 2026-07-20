import { Hono } from 'hono'
import ICAL from 'ical.js'

const app = new Hono()

const ICS_CACHE_TTL = 1800; // 30 minutes

function fixIcalFolding(rawText: string): string {
    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const fixedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const isFolded = /^[ \t]/.test(line);
        const hasToken = line.includes(':') || line.includes(';');
        const isTag = /^(BEGIN|END):/i.test(line);

        if (i > 0 && !isFolded && !hasToken && !isTag) {
            fixedLines[fixedLines.length - 1] += ' ' + line.trim();
        } else {
            fixedLines.push(line);
        }
    }

    return fixedLines.join('\r\n');
}

function dateInRange(dateStr: string, from: string, to: string): boolean {
    return dateStr >= from && dateStr <= to;
}

app.get('/events', async (c) => {
    const url = c.req.query('url')
    const dateStr = c.req.query('date')

    if (!url || !dateStr) {
        return c.json({ error: 'Missing url or date parameter' }, 400)
    }

    const fromStr = c.req.query('from') || dateStr
    const toStr = c.req.query('to') || dateStr

    try {
        const cacheKey = `https://internal/ics/${encodeURIComponent(url)}`
        const cache = caches.default
        let text: string | null = null

        const cachedResponse = await cache.match(cacheKey)
        if (cachedResponse) {
            text = await cachedResponse.text()
        } else {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; HighHelp/1.0)',
                    'Accept': 'text/calendar, text/plain, */*'
                }
            })
            if (!response.ok) {
                return c.json({ error: 'Failed to fetch calendar' }, 500)
            }
            text = await response.text()
            const cacheHeaders = new Headers({ 'Cache-Control': `public, max-age=${ICS_CACHE_TTL}` })
            await cache.put(cacheKey, new Response(text, { headers: cacheHeaders }))
        }

        const cleanedText = fixIcalFolding(text);
        const jcalData = ICAL.parse(cleanedText);
        const comp = new ICAL.Component(jcalData)
        const vevents = comp.getAllSubcomponents('vevent')

        const filteredEvents = vevents
            .map(vevent => new ICAL.Event(vevent))
            .filter(event => {
                try {
                    const jsDate = event.startDate.toJSDate();
                    const eventDateInSydney = jsDate.toLocaleDateString('en-CA', {
                        timeZone: 'Australia/Sydney',
                    });
                    return dateInRange(eventDateInSydney, fromStr, toStr);
                } catch (err) {
                    return false;
                }
            })
            .map(event => {
                const start = event.startDate;
                const end = event.endDate;
                return {
                    summary: event.summary,
                    description: event.description,
                    start: start.toString(),
                    end: end.toString(),
                    location: event.location,
                    allDay: event.startDate.isDate
                };
            })

        return c.json({ events: filteredEvents })

    } catch (e: any) {
        console.error('Calendar parse error:', e)
        return c.json({
            error: 'Failed to parse calendar',
            details: e.message
        }, 500)
    }
})

export default app
