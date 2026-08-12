import { Hono } from 'hono'
import { html } from 'hono/html'
import { Bindings } from '../types'
import { Layout } from '../layout'
import { getUser } from '../utils'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/atar/how-it-works', async (c) => {
  const user = await getUser(c)

  return c.html(
    <Layout title="How the ATAR Calculator Works" user={user}>
      <div class="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <header class="border-b border-gray-200 dark:border-neutral-800 pb-4">
            <h1 class="text-4xl font-extrabold">How this thing works</h1>
        </header>

        <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
            The other day somebody told me that <a href="https://sydneyhigh.school/publications/document-library/doc_view/8833-hsc-results-2025-presentation#page=14" class="text-blue-600 hover:underline">school percentile to HSC mark is on the school website.</a>
            <br></br>
            So this thing converts your <u>school subject percentile</u> to HSC mark and to aggregated ATAR, and finally to your ATAR based on <u>2025 SBHS HSC results</u> and <a class="text-blue-600 hover:underline" href='https://uac.edu.au/assets/documents/scaling-reports/preliminary-report-on-the-scaling-of-the-hsc.pdf#page=30'> UAC Average ATAR aggregated to ATAR rank for 2021-2025</a>.

        </p>

        <section class="space-y-4">
            
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">How this works:</h2>
        <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
                1. You input your percentile within subjects.
                <br></br>
                e.g. Physics 30/140 = 78.5%
            </p>

            <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
                2. The calculator uses piecewise linear interpolation based on historical performance data with points at the 90th, 75th, and 50th percentiles to determine the expected HSC Mark.
                <br></br>e.g. Physics 75% is 84 HSC 77.6 ATAR, 90% is 91 HSC 86 ATAR... 78.5% is around 85.6 HSC 79.6 ATAR
            </p>
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
                3. Sum and Compare to ATAR table 
                <br></br>e.g. 447.8 aggregate = 99 ATAR, 459.4 aggregate = 99.5. So 450 is around 99.10
                
            </p>
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Is this accurate??</h2>
            
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
                Should be significantly more accurate than other websites requiring arbitrary HSC marks as inputs.<br></br>
                My calculation derives using subject PERCENTILEs from SB historical results - far more accurate than using raw marks to determine anything because e.g. physics
            <br>
            </br>
            
            <br></br>Limitations:
            <br>
            </br>
            Generally, less accurate when (1) cohort size for a subject is small (2) below 40%, or above 99% percentile for any subjects (3) Atar to rank
            </p>
        </section>
        
        
        <section class="space-y-4">
            
            <p class="text-sm text-gray-500 italic mt-4">
                Disclaimer: Accuracy not guaranteed.
            </p>
        </section>

        
      </div>
    </Layout>
  )
})

export default app
