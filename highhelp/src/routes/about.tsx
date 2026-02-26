import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { getUser } from '../utils'
import { PermissionLevel } from '../permissions'
const app = new Hono<{ Bindings: Bindings }>()

app.post('/about/verify', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    if (Number(user.permission_level) === PermissionLevel.DEFAULT) {
        await c.env.DB.prepare('UPDATE users SET permission_level = ? WHERE id = ?')
            .bind(PermissionLevel.VERIFIED, user.id)
            .run()
    }

    return c.redirect('/about#application')
})

app.get('/about', async (c) => {
    const user = await getUser(c)
    return c.html(
        <Layout title="About" user={user}>
            <div class="flex flex-col md:flex-row gap-8">
                {/* --- Sidebar Navigation --- */}
                <aside class="md:w-64 flex-shrink-0">
                    <nav class="sticky top-8 space-y-2 text-sm">
                        <p class="font-bold mt-4 mb-6 uppercase text-gray-500">On this page</p>
                        <a href="#mission" class="block hover:text-blue-600 transition-colors">What is HighHelp?</a>
                        <br></br>
                        <a href="#resources" class="block hover:text-blue-600 transition-colors">Resources</a>
                        <a href="#announcements" class="block hover:text-blue-600 transition-colors">Announcements</a>
                        <a href="#pp" class="block hover:text-blue-600 transition-colors">Past Papers</a>
                        <a href="#qa" class="block hover:text-blue-600 transition-colors">Q&A</a>
                        <a href="#essays" class="block hover:text-blue-600 transition-colors">Essays</a>
                        <br></br>
                        <a href="#application" class="block hover:text-blue-600 transition-colors">Applications</a>
                        <a href="#faq" class="block hover:text-blue-600 transition-colors">FAQs</a>
                        <a href="#feedback" class="block hover:text-blue-600 transition-colors">Feedback</a>
                        <a href="#contact" class="block hover:text-blue-600 transition-colors">Contact</a>
                    </nav>
                </aside>


                <main class="flex-1 max-w-3xl">
                    <h1 class="text-4xl font-extrabold mb-8">About HighHelp</h1>
                    <p class="text-gray-700 dark:text-neutral-300 leading-relaxed mb-12 dark:text-neutral-300">
                        On this page, you will find information and guidelines for each section of this website.
                    </p>

                    <section id="mission" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">What is HighHelp?</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed dark:text-neutral-300">
                            HighHelp is a proposed website designed and programmed specifically for, and by, class of 2027. The goal of this project is to improve the academic performance of our grade as a whole.
                            <br></br>
                            <br></br>
                            On 19th Nov 2025, a group of students proposed ideas of a project to bind our cohort together. After much discussion, we decided to present this idea via the format of a website.
                            <br></br>
                            <br></br>
                            After consultation with teachers, a survey was conducted, and the development started in Term 4 holidays of 2025.
                        </p>
                    </section>
                    <br></br>
                    <section id="resources" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Resources</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            Students can access resources, such as notes, uploaded by their peers on this page. We encourage any materials beneficial in any way - personal notes, class worksheets, exemplar essays etc.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            <ul class="list-disc list-inside text-gray-700 dark:text-neutral-300 leading-relaxed">
                                <li>File size less than 25MB</li>
                                <li>Uploader must have agreed to website guidelines</li>
                            </ul>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            <ul class="list-disc list-inside text-gray-700 dark:text-neutral-300 leading-relaxed">
                                <li>No deliberate misinformation</li>
                                <li>No plagiarism</li>
                                <li>No copyright infringement (e.g. Textbook)</li>
                                <li>No viruses</li>
                            </ul>
                            <h3 class="text-1xl mt-4 mb-1">Failure in doing so results in suspension/ban.</h3>


                        </p>
                    </section>
                    <section id="announcements" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Announcements</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            These are usually significant updates within a subject (e.g. release/change in notification) - or within our cohort (e.g. school events). Surprisingly this is the most wanted feature, according to the survey.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            All users receive identical announcements. However, we did limit access of posting announcements to avoid unnecessary chaos. Students interested in posting announcements can fill out a form at the end of this page :P

                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            No misinformation or spamming.
                            <h3 class="text-1xl mt-4 mb-1">Failure in doing so results in removal of permission.</h3>

                        </p>
                    </section>
                    <section id="pp" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Past Papers</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            <i>Erm, how is this different to THSC?</i>
                            <br></br>
                            We classified each question (of selected papers) into topics. As such, students can grind past papers specific to the exam notification. This further enables us to try questions from 'future' exams (yearlies, trials, or HSCs) without being hindered by content yet to be taught.
                            <br></br>
                            <br></br>
                            My heartfelt credit goes to Mr. Jackson's Bizzy website for inspiration for this feature, and for carrying my assessments.
                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            All users, not banned, can access.
                            <br></br>
                            <br></br>
                            Interested students in contributing to this feature can fill out the same form at the end of this page. Thanks to all students who has contributed.
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            Information should be accurate.
                            <h3 class="text-1xl mt-4 mb-1">Failure in doing so results in removal.</h3>
                        </p>
                    </section>
                    <section id="qa" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Q&A</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            Literally Q&A.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            Not banned.
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            <ul class="list-disc list-inside text-gray-700 dark:text-neutral-300 leading-relaxed">
                                <li>No trolling, for both the question and answer. We understand your urge to demonstrate your humour, but please keep it in check - you can laugh after HSC results.</li>
                                <li>No swearing</li>
                                <li>No personal attacks</li>
                                <li>No spamming</li>
                            </ul>
                            Imagine asking Deputies the question / Deputies asking you the question.
                            <h3 class="text-1xl mt-4 mb-1">Failure in doing so results in suspension/ban.</h3>
                        </p>
                    </section>
                    <section id="essays" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Essays</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            Students can upload their essays for others to read and learn from / give feedback or comment.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            Not banned.
                            <br></br>
                            <br></br>
                            Additionally, to reward students giving genuine feedback, and to avoid over-reliance, there is a hidden points system. Though, it is very unlikely that you will be restricted due to this feature.
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            <ul class="list-disc list-inside text-gray-700 dark:text-neutral-300 leading-relaxed">
                                <li>No trolling</li>
                                <li>No swearing</li>
                                <li>No personal attacks</li>
                                <li>No spamming</li>
                            </ul>
                            <h3 class="text-1xl mt-4 mb-1">Failure in doing so results in suspension/ban.</h3>
                        </p>
                    </section>
                    <section id="application" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Application</h2>
                        {user && Number(user.permission_level) === PermissionLevel.DEFAULT ? (
                            <div class="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
                                <p class="text-gray-700 dark:text-neutral-300 mb-6">
                                    To access all features of HighHelp, including the ability to upload resources and participate in our community, please review and agree to our guidelines.
                                </p>
                                <form action="/about/verify" method="post" class="space-y-4">
                                    <div class="grid gap-4">
                                        {[
                                            { id: 'misinfo', label: 'I will not post deliberate misinformation.' },
                                            { id: 'plagiarism', label: 'I will not engage in plagiarism.' },
                                            { id: 'copyright', label: 'I will not infringe on copyrights (e.g. uploading textbooks).' },
                                            { id: 'malicious', label: 'I will not upload viruses or malicious software.' },
                                            { id: 'respect', label: 'I will maintain a respectful environment (no trolling or personal attacks).' },
                                            { id: 'consequences', label: 'I understand that violating these rules will result in account suspension.' }
                                        ].map(item => (
                                            <label class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group border border-transparent hover:border-gray-200">
                                                <div class="mt-1">
                                                    <input type="checkbox" name={item.id} required class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                                                </div>
                                                <span class="text-gray-700 dark:text-neutral-300 group-hover:text-gray-900 transition-colors">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button type="submit" class="w-full mt-6 bg-[#633200] hover:bg-[#b05800] text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-md">
                                        Verify Account & Agree to Terms
                                    </button>
                                </form>
                            </div>
                        ) : user && Number(user.permission_level) >= PermissionLevel.VERIFIED ? (
                            <div class="bg-green-50 border border-green-200 rounded-xl p-6 flex items-center gap-4">
                                <div class="bg-green-100 p-2 rounded-full">
                                    <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-green-900">Verified Account</h3>
                                    <p class="text-green-700 text-sm">You have already agreed to the terms and services. Your account is fully verified and you have access to all standard features.</p>
                                </div>
                            </div>
                        ) : !user ? (
                            <div class="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                                <div class="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400">
                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg>
                                </div>
                                <h3 class="text-lg font-semibold text-gray-900 mb-2">Login Required</h3>
                                <p class="text-gray-600 mb-6">You need to be logged in to verify your account and agree to the terms.</p>
                                <a href="/login" class="inline-block bg-[#633200] hover:bg-[#b05800] text-white font-bold py-2 px-8 rounded-lg transition-all transform hover:scale-[1.05] active:scale-[0.95]">Log In</a>
                            </div>
                        ) : (
                            <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 flex items-center gap-4">
                                <div class="bg-yellow-100 p-2 rounded-full">
                                    <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-yellow-900">Restricted Account</h3>
                                    <p class="text-yellow-700 text-sm">Your account status does not allow for verification at this time or your permissions are currently restricted.</p>
                                </div>
                            </div>
                        )

                        }
                        <a href="https://forms.gle/vKmPN3crhgEPUg9r5"><u>Apply for roles here [click]</u></a>.
                    </section>
                    <section id="faq" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">FAQs</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            <h3 class="text-1xl font-bold mt-4 mb-1">What if data is lost before important exams?</h3>
                            The database and storage provider of this website is Cloudflare - which features a built-in backup system that allows for data to be restored to any snapshots in the past 30 days. Additionally, we will manually backup all the data before e.g. Trials and HSC.
                            <br></br>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Is there support for SBHS students outside of Class of 2027?</h3>
                            We do not currently support students outside of Class of 2027 (as the website was established so recently). However, resources will be passed down to the next cohort, and we may work on adding support for other cohorts in the future depending on demand.
                            <br></br>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Who is behind all this? Does the school know?</h3>
                            We are a group of students consisted mainly of subject duxes and students assuming leadership roles, as we gathered to discuss efficient methods to better our cohort academically. The website is programmed by a group of students taking Software Engineering.
                            <br></br>
                            We have inquired and consulted with Software Engineering teacher and our Year Advisors, and we express our sincere gratitude for their support.
                            <br></br>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Ask more questions in the Contact section!</h3>

                        </p>
                    </section>
                    <section id="feedback" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Feedback</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">
                            Report bugs and provide feedback via <a href="https://forms.gle/7af9Dq8mZiQtjfbs9"><u>Google Form</u></a>.
                        </p>
                    </section>
                    <section id="contact" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Contact</h2>
                        <p class="text-gray-700 dark:text-neutral-300 leading-relaxed">

                            <ul class="list-disc list-inside text-gray-700 dark:text-neutral-300 leading-relaxed">
                                <li>Use the above feedback form. We read each feedback carefully and will respond within one day.</li>
                                <li>Contact any SRCs for additional information.</li>
                                <li>Contact 457297106@student.sbhs.nsw.edu.au (Ricky Luo) for any inquiries or technical issues.</li>
                                <li>DM on Instagram: <a href="https://www.instagram.com/sydneyhighhsc/"><u>sydneyhighhsc</u></a></li>
                            </ul>


                            <br></br>
                        </p>
                    </section>


                </main>
            </div>
        </Layout>
    )
}

)

export default app
