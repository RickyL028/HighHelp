import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()
app.get('/about', async (c) => {
    return c.html(
        <Layout title="About">
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
                    <p class="text-gray-700 leading-relaxed mb-12">
                        On this page, you will find information and guidelines for each section of this website.
                    </p>

                    <section id="mission" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">What is HighHelp?</h2>
                        <p class="text-gray-700 leading-relaxed">
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
                        <p class="text-gray-700 leading-relaxed">
                            Students can access resources, such as notes, uploaded by their peers on this page. We encourage any materials beneficial in any way - personal notes, class worksheets, exemplar essays etc.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            <ul class="list-disc list-inside text-gray-700 leading-relaxed">
                                <li>File size less than 25MB</li>
                                <li>Uploader must have agreed to website guidelines</li>
                            </ul>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            <ul class="list-disc list-inside text-gray-700 leading-relaxed">
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
                        <p class="text-gray-700 leading-relaxed">
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
                        <p class="text-gray-700 leading-relaxed">
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
                        <p class="text-gray-700 leading-relaxed">
                            Literally Q&A.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            Not banned.
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            <ul class="list-disc list-inside text-gray-700 leading-relaxed">
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
                        <p class="text-gray-700 leading-relaxed">
                            Students can upload their essays for others to read and learn from / give feedback or comment.

                            <h3 class="text-1xl font-bold mt-4 mb-1">Requirements</h3>
                            Not banned.
                            <br></br>
                            <br></br>
                            Additionally, to reward students giving genuine feedback, and to avoid over-reliance, there is a hidden points system. Though, it is very unlikely that you will be restricted due to this feature.
                            <h3 class="text-1xl font-bold mt-4 mb-1">Guidelines</h3>
                            <ul class="list-disc list-inside text-gray-700 leading-relaxed">
                                <li>No trolling</li>
                                <li>No swearing</li>
                                <li>No personal attacks</li>
                                <li>No spamming</li>
                            </ul>
                            <h3 class="text-1xl mt-4 mb-1">Failure in doing so results in suspension/ban.</h3>
                        </p>
                    </section>
                    <section id="application" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Applications</h2>
                        <p class="text-gray-700 leading-relaxed">
                            Applications are currently in the works and will be released in future via Google Forms. If you are interested in this project, please contact Ricky via 'notricky028' on Discord, or by emailing '457297106@student.sbhs.nsw.edu.au'.
                            The current application form is: N/A
                        </p>
                    </section>
                    <section id="faq" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">FAQs</h2>
                        <p class="text-gray-700 leading-relaxed">
                            <h3 class="text-1xl font-bold mt-4 mb-1">How do I log in?</h3>
                            To log into HighHelp, either create an account or log in via the SBHS portal.
                            <br></br>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Is there support for SBHS students outside of Class of 2027?</h3>
                            ricky please answer this question :p
                            <br></br>
                            <h3 class="text-1xl font-bold mt-4 mb-1">Where do I report a student breaking the guidelines?</h3>
                            also answer this one. thakn you kind sir
                            <br></br>
                            <h3 class="text-1xl font-bold mt-4 mb-1">I have found a bug! Where do I report it?</h3>
                            Please report all bugs as well as additional feedback via the <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Google Form</a>.
                        </p>
                    </section>
                    <section id="feedback" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Feedback</h2>
                        <p class="text-gray-700 leading-relaxed">
                            Report bugs and provide feedback via the <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Google Form</a>.
                        </p>
                    </section>
                    <section id="contact" class="mb-12 scroll-mt-20">
                        <h2 class="text-2xl font-bold mb-4">Contact</h2>
                        <p class="text-gray-700 leading-relaxed">
                            Please contact Ricky via 'notricky028' on Discord, or by emailing '457297106@student.sbhs.nsw.edu.au'.
                            <br></br>
                            will have a domain email after i buy
                        </p>
                    </section>


                </main>
            </div>
        </Layout>
    )
}

)

export default app
