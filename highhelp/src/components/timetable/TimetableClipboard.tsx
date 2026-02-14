import { Hono } from 'hono'
import ICAL from 'ical.js'

const app = new Hono()

/**
 * Fixes malformed ICS strings where newlines in descriptions 
 * are not properly indented (folded) as per RFC 5545.
 */
function fixIcalFolding(rawText: string): string {
    // 1. Normalize line endings to \n
    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const fixedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines
        if (!line.trim()) continue;

        // An iCal line is valid if:
        // 1. It starts with a space or tab (it's already folded)
        // 2. It contains a ':' or ';' which usually denotes a KEY:VALUE pair
        // 3. It's a BEGIN/END tag
        const isFolded = /^[ \t]/.test(line);
        const hasToken = line.includes(':') || line.includes(';');
        const isTag = /^(BEGIN|END):/i.test(line);

        if (i > 0 && !isFolded && !hasToken && !isTag) {
            // This is a "naked" line (like your error message). 
            // We fix it by prepending a space, making it a valid continuation of the previous line.
            fixedLines[fixedLines.length - 1] += ' ' + line.trim();
        } else {
            fixedLines.push(line);
        }
    }

    // Join with standard iCal line endings
    return fixedLines.join('\r\n');
}

app.get('/events', async (c) => {
    const url = c.req.query('url')
    const dateStr = c.req.query('date')

    if (!url || !dateStr) {
        return c.json({ error: 'Missing url or date parameter' }, 400)
    }

    try {
        const response = await fetch(url)
        if (!response.ok) {
            return c.json({ error: 'Failed to fetch calendar' }, 500)
        }

        let text = await response.text()

        // --- SANITIZATION STEP ---
        const cleanedText = fixIcalFolding(text);

        // Parse the sanitized ICS data
        const jcalData = ICAL.parse(cleanedText);
        const comp = new ICAL.Component(jcalData)
        const vevents = comp.getAllSubcomponents('vevent')

        const [targetYear, targetMonth, targetDay] = dateStr.split('-').map(Number)
        
        const dayEvents = vevents
            .map(vevent => new ICAL.Event(vevent))
            .filter(event => {
                try {
                    const start = event.startDate.toJSDate()
                    return (
                        start.getFullYear() === targetYear &&
                        (start.getMonth() + 1) === targetMonth &&
                        start.getDate() === targetDay
                    )
                } catch (err) {
                    return false; // Skip events with invalid dates
                }
            })
            .map(event => ({
                summary: event.summary,
                description: event.description,
                start: event.startDate.toJSDate().toISOString(),
                end: event.endDate.toJSDate().toISOString(),
                location: event.location,
                allDay: event.startDate.isDate
            }))

        return c.json({ events: dayEvents })
    } catch (e: any) {
        console.error('Calendar parse error:', e)
        return c.json({
            error: 'Failed to parse calendar',
            details: e.message
        }, 500)
    }
})

export default app