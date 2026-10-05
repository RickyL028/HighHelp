import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, loginRedirect, renderTags, updatePoints, logAction, formatDate, markQuestionsRead, VIEWER_TAGS_CTE, VIEWER_TAGS_EXPR } from '../utils'
import { canPostGeneral, canViewDeleted, canCommentModeration } from '../permissions'
import { SubjectBadge } from '../components/SubjectBadge'
import { forumRelevanceMatch, forumSubjectKey, viewerSubjectKeys, askableSubjects, GENERAL_SUBJECT } from '../forumRelevance'
import { renderMarkdown, markdownExcerpt } from '../markdown'
import { Bindings, User } from '../types'
import { subjectLabel } from '../constants'

const app = new Hono<{ Bindings: Bindings }>()

const TITLE_MAX = 200
const CONTENT_MAX = 5000
const FEED_LIMIT = 100

const INPUT_CLASS =
	'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all'
const LABEL_CLASS = 'block text-xs font-bold tracking-wider text-gray-500 dark:text-neutral-400 mb-2'
const SUBMIT_CLASS = 'px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors rounded-lg'
const MARKDOWN_HINT = 'Markdown works here: **bold**, *italic*, `code`, lists, > quotes and links. Maths renders with $...$.'

const authorName = (p: any) => (p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown')

const Tags = ({ tags }: { tags: string | null }) => <span dangerouslySetInnerHTML={{ __html: renderTags(tags) }}></span>

// "New" means: in the viewer's subjects, by someone else, posted since their last visit to the feed.
const isNewFor = (p: any, user: User | null) =>
	!!user && !!p.relevant && !p.is_deleted && p.author_id !== user.id && !!user.forum_last_read_at && p.created_at > user.forum_last_read_at

const NewLabel = () => (
	<span class="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider text-red-600 dark:text-red-400">
		<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>New
	</span>
)

const DeletedLabel = () => <span class="text-[11px] font-bold tracking-wider text-red-600 dark:text-red-400">Deleted</span>

// Same surface as AnnouncementCard: background only, an accent bar on hover, and a stretched link
// so the whole card opens the question.
const QuestionCard = ({ p, user }: { p: any; user: User | null }) => (
	<article
		class={`search-item group relative rounded-lg pl-5 pr-4 py-4 transition-colors ${
			p.is_deleted ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700/70'
		}`}
		data-search-text={`${p.title} ${p.content} ${subjectLabel(p.subject)} ${authorName(p)}`}
	>
		<span class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-transparent group-hover:bg-blue-500 dark:group-hover:bg-blue-400 transition-colors"></span>

		<div class="flex items-center justify-between gap-4 text-xs text-gray-500 dark:text-neutral-400">
			<span class="flex items-center gap-3 min-w-0">
				<SubjectBadge subject={p.subject} tab="qa" />
				{isNewFor(p, user) && <NewLabel />}
			</span>
			<span class="flex items-center gap-3 shrink-0">
				{!!p.is_deleted && <DeletedLabel />}
				<span class="local-date" data-timestamp={p.created_at}>
					{formatDate(p.created_at)}
				</span>
			</span>
		</div>

		<h2 class="mt-1.5 text-lg font-bold leading-snug text-gray-900 dark:text-white">
			<a href={`/forum/post/${p.id}`} class="after:absolute after:inset-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
				{p.title}
			</a>
		</h2>

		<p class="mt-1 text-sm leading-relaxed text-gray-600 dark:text-neutral-300 line-clamp-2">{markdownExcerpt(p.content)}</p>

		<div class="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-neutral-400">
			<span class="flex items-center gap-1.5 min-w-0">
				{authorName(p)}
				<Tags tags={p.tags} />
			</span>
			<span class="flex-grow"></span>
			<span class="shrink-0">
				{Number(p.comment_count)} {Number(p.comment_count) === 1 ? 'answer' : 'answers'}
			</span>
		</div>
	</article>
)

// Underlined filter links, the same shape as the announcement audience chips.
const filterLinkClass = (active: boolean) =>
	`pb-0.5 transition-colors ${
		active
			? 'text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400'
			: 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white border-b border-transparent hover:border-gray-300 dark:hover:border-neutral-600'
	}`

// The /forum feed. One page serves all three views: every question, questions in the viewer's
// subjects (?view=mine), and a single subject (?subject=...).
app.get('/forum', async (c) => {
	const user = (await getUser(c)) as User | null
	const subject = c.req.query('subject') || null
	const view = !subject && c.req.query('view') === 'mine' && user ? 'mine' : 'all'
	const showDeleted = !!user && canViewDeleted(user)
	const viewerTags = user?.tags ?? '{}'
	const relevant = forumRelevanceMatch('p.subject', VIEWER_TAGS_EXPR)

	const bindings: unknown[] = [viewerTags]
	let where = `p.type = 'question'${showDeleted ? '' : ' AND p.is_deleted = 0'}`
	if (subject) {
		where += ' AND p.subject = ?'
		bindings.push(subject)
	}
	if (view === 'mine') where += ` AND ${relevant}`

	const { results: posts } = await c.env.DB
		.prepare(`
			${VIEWER_TAGS_CTE}
			SELECT p.*, u.first_name, u.last_name, u.tags,
				(SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.is_deleted = 0) AS comment_count,
				${relevant} AS relevant
			FROM posts p
			LEFT JOIN users u ON p.author_id = u.id
			WHERE ${where}
			ORDER BY p.created_at DESC
			${subject ? '' : `LIMIT ${FEED_LIMIT}`}
		`)
		.bind(...bindings)
		.all<any>()

	// Subject filters: every subject that has questions, the viewer's own subjects first.
	const { results: subjectRows } = await c.env.DB
		.prepare(`
			${VIEWER_TAGS_CTE}
			SELECT p.subject AS subject, COUNT(*) AS n, ${relevant} AS relevant
			FROM posts p
			WHERE p.type = 'question' AND p.is_deleted = 0
			GROUP BY p.subject
			ORDER BY relevant DESC, n DESC, p.subject ASC
		`)
		.bind(viewerTags)
		.all<{ subject: string; n: number; relevant: number }>()
	const subjects = [...(subjectRows || [])]
	if (subject && !subjects.some(s => s.subject === subject)) subjects.unshift({ subject, n: 0, relevant: 0 })

	// Opening the feed is what clears the dot. The badge was already counted for this request, so
	// it disappears on the next navigation -- the same behaviour as Announcements. Only the
	// cross-subject views clear it, since a single subject page doesn't show everything new.
	if (user && !subject) await markQuestionsRead(c.env.DB, user.id)

	const hasSubjects = viewerSubjectKeys(user?.tags).size > 0
	const heading = subject ? subjectLabel(subject) : 'Q&A'
	const askHref = subject ? `/forum/create?subject=${encodeURIComponent(subject)}` : '/forum/create'

	return c.html(
		<Layout title={subject ? `${subjectLabel(subject)} Q&A` : 'Q&A Forum'} user={user}>
			<div class="max-w-6xl mx-auto">
				<header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">{heading}</h1>
					{user && canPostGeneral(user) && (
						<a href={askHref} class="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline transition-colors">
							Ask a Question
						</a>
					)}
				</header>

				<nav class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm pb-2 border-b border-gray-200 dark:border-neutral-800">
					{[
						{ id: 'all', label: 'All questions', href: '/forum' },
						...(user ? [{ id: 'mine', label: 'My subjects', href: '/forum?view=mine' }] : []),
					].map((t, i) => {
						const active = !subject && view === t.id
						return (
							<>
								{i > 0 && <span class="text-gray-300 dark:text-neutral-700">|</span>}
								<a
									href={t.href}
									aria-current={active ? 'page' : undefined}
									class={`transition-colors ${
										active ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
									}`}
								>
									{t.label}
								</a>
							</>
						)
					})}
				</nav>

				{subjects.length > 0 && (
					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 mb-4 text-sm">
						{subjects.map(s => (
							<a href={`/forum?subject=${encodeURIComponent(s.subject)}`} class={filterLinkClass(subject === s.subject)}>
								{subjectLabel(s.subject)} <span class="text-gray-400 dark:text-neutral-500">{s.n}</span>
							</a>
						))}
					</div>
				)}

				{user && !canPostGeneral(user) && <p class="mt-3 text-sm text-red-600 dark:text-red-400">You are muted and cannot ask or answer questions.</p>}

				{posts && posts.length > 0 ? (
					<>
						<input type="text" id="search-input" placeholder="Search questions..." class={`${INPUT_CLASS} mt-2 text-sm`} />
						<div class="space-y-2 mt-4">
							{posts.map((p: any) => (
								<QuestionCard p={p} user={user} />
							))}
						</div>
					</>
				) : (
					<p class="py-10 text-center text-sm italic text-gray-400 dark:text-neutral-500">
						{view === 'mine' && !hasSubjects
							? 'Your profile has no subjects yet. Log in through the student portal to sync your timetable subjects.'
							: view === 'mine'
								? 'No questions in your subjects yet.'
								: subject
									? `No questions in ${subjectLabel(subject)} yet.`
									: 'No questions yet. Be the first to ask!'}
					</p>
				)}
			</div>
		</Layout>
	)
})

type QuestionValues = { title?: string; subject?: string; content?: string }

// `options` is what this asker may file under: their own tags plus Other, like the announcement
// audience picker only offering the proposer's own tags.
const QuestionForm = ({ options, values, error }: { options: string[]; values: QuestionValues; error?: string }) => (
	<form action="/forum" method="post" class="max-w-2xl">
		{error && <p class="mb-4 text-sm font-bold text-red-600 dark:text-red-400">{error}</p>}

		<div class="pb-5">
			<label class={LABEL_CLASS}>Title</label>
			<input type="text" name="title" required maxLength={TITLE_MAX} value={values.title || ''} class={INPUT_CLASS} placeholder="What's your question?" />
		</div>

		<div class="pb-5">
			<label class={LABEL_CLASS}>Subject</label>
			<select name="subject" required class={INPUT_CLASS}>
				<option value="" disabled selected={!values.subject}>
					Select a subject
				</option>
				{options.map(s => (
					<option value={s} selected={s === values.subject}>
						{s}
					</option>
				))}
			</select>
			<p class="text-xs text-gray-500 dark:text-neutral-400 mt-2">
				Pick from the subjects on your profile. Everyone taking it gets a notification. {GENERAL_SUBJECT} notifies nobody.
			</p>
		</div>

		<div class="pb-5">
			<label class={LABEL_CLASS}>Details</label>
			<textarea name="content" required rows={8} maxLength={CONTENT_MAX} class={`${INPUT_CLASS} resize-y`} placeholder="Provide more context...">
				{values.content || ''}
			</textarea>
			<p class="text-xs text-gray-500 dark:text-neutral-400 mt-2">{MARKDOWN_HINT}</p>
		</div>

		<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-neutral-800">
			<button type="submit" class={SUBMIT_CLASS}>
				Post question
			</button>
		</div>
	</form>
)

const questionPage = (c: any, user: User, values: QuestionValues, error?: string) =>
	c.html(
		<Layout title="Ask a Question" user={user}>
			<div class="max-w-3xl mx-auto">
				<a
					href={values.subject ? `/forum?subject=${encodeURIComponent(values.subject)}` : '/forum'}
					class="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors inline-block mb-4"
				>
					&larr; Back to Q&A
				</a>
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Ask a Question</h1>
				<p class="text-sm text-gray-600 dark:text-neutral-400 mt-2 mb-6">Stuck on something? Your classmates might know.</p>
				<QuestionForm options={askableSubjects(user.tags)} values={values} error={error} />
			</div>
		</Layout>
	)

app.get('/forum/create', async (c) => {
	const user = (await getUser(c)) as User | null
	if (!user) return c.redirect(loginRedirect(c))
	if (!canPostGeneral(user)) return c.redirect('/forum')

	// "Ask" from a subject page preselects the asker's own tag for that subject, if they have one --
	// an older page may be keyed "Physics (HSC)" while the tag reads "Physics Yr11".
	const from = c.req.query('subject') || ''
	const preselected = from ? askableSubjects(user.tags).find(s => forumSubjectKey(s) === forumSubjectKey(from)) : undefined
	return questionPage(c, user, { subject: preselected || '' })
})

app.post('/forum', async (c) => {
	const user = (await getUser(c)) as User | null
	if (!user) return c.redirect(loginRedirect(c))
	if (!canPostGeneral(user)) return c.text('You are muted.', 403)

	const body = await c.req.parseBody()
	const title = String(body['title'] ?? '').trim().slice(0, TITLE_MAX)
	const subject = String(body['subject'] ?? '')
	const content = String(body['content'] ?? '').trim().slice(0, CONTENT_MAX)

	if (!title || !content) return questionPage(c, user, { title, subject, content }, 'A title and details are both required.')
	// Only the asker's own tags (or Other) are accepted, so a crafted POST can't file elsewhere.
	if (!askableSubjects(user.tags).includes(subject)) return questionPage(c, user, { title, subject: '', content }, 'Pick one of your subjects.')

	const res = await c.env.DB.prepare('INSERT INTO posts (title, content, type, author_id, subject) VALUES (?, ?, ?, ?, ?)')
		.bind(title, content, 'question', user.id, subject)
		.run()

	await logAction(c.env.DB, user.id, 'CREATE_POST', `Created question '${title}' in ${subject}`, res.meta.last_row_id, 'posts')

	return c.redirect(`/forum/post/${res.meta.last_row_id}`)
})

app.get('/forum/post/:id', async (c) => {
	const user = (await getUser(c)) as User | null
	const postId = c.req.param('id')
	const showDeleted = !!user && canViewDeleted(user)

	const post = await c.env.DB.prepare(`
		SELECT p.*, u.first_name, u.last_name, u.tags
		FROM posts p
		LEFT JOIN users u ON p.author_id = u.id
		WHERE p.id = ? AND p.type = 'question'
	`)
		.bind(postId)
		.first<any>()

	if (!post) return c.notFound()
	if (post.is_deleted && !showDeleted) return c.notFound()

	const { results: comments } = await c.env.DB.prepare(`
		SELECT cm.*, u.first_name, u.last_name, u.tags
		FROM comments cm
		LEFT JOIN users u ON cm.author_id = u.id
		WHERE cm.post_id = ?
		${showDeleted ? '' : 'AND cm.is_deleted = 0'}
		ORDER BY cm.created_at ASC
	`)
		.bind(postId)
		.all<any>()

	// Sidebar: the rest of this subject's questions, like the announcement index.
	const { results: indexRows } = await c.env.DB.prepare(`
		SELECT id, title, created_at FROM posts
		WHERE type = 'question' AND is_deleted = 0 AND subject = ?
		ORDER BY created_at DESC
		LIMIT 60
	`)
		.bind(post.subject)
		.all<{ id: number; title: string; created_at: string }>()
	const indexItems = [...(indexRows || [])]
	if (!indexItems.some(r => Number(r.id) === Number(post.id))) indexItems.unshift({ id: post.id, title: post.title, created_at: post.created_at })

	const canDeletePost = !post.is_deleted && !!user && (canCommentModeration(user) || user.id === post.author_id)
	const answerCount = (comments || []).filter((cm: any) => !cm.is_deleted).length

	return c.html(
		<Layout title={post.title} user={user} latex>
			<div class="flex flex-col md:flex-row gap-8">
				<aside class="md:w-64 flex-shrink-0">
					<div class="sticky top-8">
						<a href={`/forum?subject=${encodeURIComponent(post.subject)}`} class="block text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors mb-4">
							&larr; {subjectLabel(post.subject)}
						</a>
						<ul class="text-sm max-h-[60vh] overflow-y-auto pr-1 space-y-2">
							{indexItems.map(item => {
								const isCurrent = Number(item.id) === Number(post.id)
								return (
									<li class={isCurrent ? 'border-l-2 border-blue-500 dark:border-blue-400 pl-2' : 'border-l-2 border-transparent pl-2'}>
										<a
											href={`/forum/post/${item.id}`}
											aria-current={isCurrent ? 'page' : undefined}
											class={`block leading-snug transition-colors ${
												isCurrent ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400'
											}`}
										>
											{item.title}
										</a>
										<span class="text-[11px] text-gray-400 dark:text-neutral-500 local-date" data-timestamp={item.created_at}>
											{formatDate(item.created_at)}
										</span>
									</li>
								)
							})}
						</ul>
					</div>
				</aside>

				<main class="flex-1 max-w-3xl min-w-0">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<SubjectBadge subject={post.subject} tab="qa" />
						{!!post.is_deleted && <DeletedLabel />}
					</div>

					<h1 class="mt-1 text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">{post.title}</h1>

					<p class="mt-2 text-gray-700 dark:text-neutral-300 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
						<span>Asked by</span>
						<span>{authorName(post)}</span>
						<Tags tags={post.tags} />
						<span class="local-date" data-timestamp={post.created_at} data-format="datetime">
							&middot; {formatDate(post.created_at)}
						</span>
					</p>

					<hr class="border-gray-200 dark:border-neutral-800 my-4" />

					<div class="text-gray-700 dark:text-neutral-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }} />

					{canDeletePost && (
						<form action={`/forum/post/${post.id}/delete`} method="post" class="mt-4 text-sm">
							<button
								type="submit"
								class="text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors"
								onclick="return confirm('Delete this question?')"
							>
								Delete
							</button>
						</form>
					)}

					<hr class="border-gray-200 dark:border-neutral-800 my-4" />

					<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3">
						{answerCount} {answerCount === 1 ? 'answer' : 'answers'}
					</h2>

					{comments && comments.length > 0 ? (
						<div class="space-y-2">
							{comments.map((cm: any) => (
								<article class={`rounded-lg px-5 py-4 ${cm.is_deleted ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-neutral-800'}`}>
									<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-neutral-400">
										<span class="flex items-center gap-1.5 min-w-0">
											<span class="text-sm font-bold text-gray-900 dark:text-white">{authorName(cm)}</span>
											<Tags tags={cm.tags} />
										</span>
										<span class="flex items-center gap-3 shrink-0">
											{!!cm.is_deleted && <DeletedLabel />}
											<span class="local-date" data-timestamp={cm.created_at} data-format="datetime">
												{formatDate(cm.created_at)}
											</span>
											{!cm.is_deleted && user && (canCommentModeration(user) || user.id === cm.author_id) && (
												<form action={`/forum/comment/${cm.id}/delete`} method="post" class="inline">
													<button
														type="submit"
														class="hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors"
														onclick="return confirm('Delete this answer?')"
													>
														Delete
													</button>
												</form>
											)}
										</span>
									</div>
									<div class="mt-2 text-gray-700 dark:text-neutral-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(cm.content) }} />
								</article>
							))}
						</div>
					) : (
						<p class="py-6 text-center text-sm italic text-gray-400 dark:text-neutral-500">No answers yet. Be the first to reply!</p>
					)}

					<section class="mt-6">
						{post.is_deleted ? null : user && canPostGeneral(user) ? (
							<form action="/forum/comment" method="post">
								<input type="hidden" name="post_id" value={String(post.id)} />
								<label class={LABEL_CLASS}>Your answer</label>
								<textarea name="content" required rows={5} maxLength={CONTENT_MAX} class={`${INPUT_CLASS} resize-y`} placeholder="Type your answer here..."></textarea>
								<div class="mt-2 flex flex-wrap items-start justify-between gap-3">
									<p class="text-xs text-gray-500 dark:text-neutral-400">{MARKDOWN_HINT}</p>
									<button type="submit" class={SUBMIT_CLASS}>
										Post answer
									</button>
								</div>
							</form>
						) : user ? (
							<p class="text-sm text-red-600 dark:text-red-400">Your account is muted, so you can't post answers right now.</p>
						) : (
							<p class="text-sm text-gray-500 dark:text-neutral-400">
								<a href={loginRedirect(c)} class="text-blue-600 dark:text-blue-400 font-bold hover:underline">
									Log in
								</a>{' '}
								to answer.
							</p>
						)}
					</section>
				</main>
			</div>
		</Layout>
	)
})

app.post('/forum/comment', async (c) => {
	const user = (await getUser(c)) as User | null
	if (!user) return c.redirect(loginRedirect(c))
	if (!canPostGeneral(user)) return c.text('You are muted.', 403)

	const body = await c.req.parseBody()
	const postId = String(body['post_id'] ?? '')
	const content = String(body['content'] ?? '').trim().slice(0, CONTENT_MAX)

	const post = await c.env.DB.prepare(`SELECT id FROM posts WHERE id = ? AND type = 'question' AND is_deleted = 0`).bind(postId).first<any>()
	if (!post) return c.notFound()

	if (content) {
		const res = await c.env.DB.prepare('INSERT INTO comments (post_id, content, author_id) VALUES (?, ?, ?)').bind(post.id, content, user.id).run()
		await logAction(c.env.DB, user.id, 'CREATE_COMMENT', `Commented on post ${post.id}`, res.meta.last_row_id, 'comments')
		await updatePoints(user.id, 0.3, c.env.DB)
	}

	return c.redirect(`/forum/post/${post.id}`)
})

app.post('/forum/post/:id/delete', async (c) => {
	const user = (await getUser(c)) as User | null
	if (!user) return c.redirect(loginRedirect(c))
	const id = c.req.param('id')

	const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
	if (!post) return c.notFound()
	if (!canCommentModeration(user) && user.id !== post.author_id) return c.text('Unauthorised', 403)

	await c.env.DB.prepare('UPDATE posts SET is_deleted = 1 WHERE id = ?').bind(id).run()
	await logAction(c.env.DB, user.id, 'DELETE_POST', `Deleted post ${id}`, Number(id), 'posts')

	return c.redirect(`/forum?subject=${encodeURIComponent(post.subject || '')}`)
})

app.post('/forum/comment/:id/delete', async (c) => {
	const user = (await getUser(c)) as User | null
	if (!user) return c.redirect(loginRedirect(c))
	const id = c.req.param('id')

	const comment = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<any>()
	if (!comment) return c.notFound()
	if (!canCommentModeration(user) && user.id !== comment.author_id) return c.text('Unauthorised', 403)

	await c.env.DB.prepare('UPDATE comments SET is_deleted = 1 WHERE id = ?').bind(id).run()
	await logAction(c.env.DB, user.id, 'DELETE_COMMENT', `Deleted comment ${id}`, Number(id), 'comments')

	return c.redirect(`/forum/post/${comment.post_id}`)
})

export default app
