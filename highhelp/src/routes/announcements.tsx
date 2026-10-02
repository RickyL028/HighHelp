import { Hono } from 'hono'
import { Layout } from '../layout'
import {
	getUser,
	loginRedirect,
	renderTags,
	logAction,
	formatDate,
	safeNext,
	markAnnouncementsRead,
	announcementAudienceMatch,
	VIEWER_TAGS_CTE,
	VIEWER_TAGS_EXPR,
	VIEWER_CTE,
	VIEWER_ID_EXPR,
} from '../utils'
import { canPostGeneral, canReviewAnnouncements, canViewDeleted } from '../permissions'
import { SUBJECTS, subjectLabel } from '../constants'
import { renderMarkdown } from '../markdown'
import { Bindings, User } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

const EVERYONE = 'all'
const TITLE_MAX = 200
const CONTENT_MAX = 5000
const NOTE_MAX = 2000

type AudienceGroup = 'Everyone' | 'Year groups' | 'Tags'
type AudienceOption = { key: string; label: string; group: AudienceGroup }

// Order the picker so Everyone sits on top, year groups next, then the subject tags.
const AUDIENCE_GROUPS: AudienceGroup[] = ['Everyone', 'Year groups', 'Tags']

// The tag keys a single user actually carries: their subject tags plus their year group.
const viewerTagKeys = (tagsJson: string | null | undefined): { names: Set<string>; year: string | null } => {
	const names = new Set<string>();
	let year: string | null = null;
	try {
		const parsed = tagsJson ? JSON.parse(tagsJson) : null;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			for (const key of Object.keys(parsed)) {
				if (parsed[key] === null || parsed[key] === undefined) continue;
				if (key === 'Year') year = String(parsed[key]);
				else names.add(key);
			}
		}
	} catch (e) {
		// A malformed tags column just means "no tags" here.
	}
	return { names, year };
};

// Every audience a proposal can target, discovered from the tags users carry: each distinct
// visibility tag plus each distinct Year value. 'Year' is pulled out of the tag list because it
// stores a value ("7") rather than a 0/1 toggle, so it becomes a year group.
//
// Pass the proposer's own tags to narrow this to what they can actually target -- the picker
// offers their own subjects and year group rather than the whole school's. Without it the full
// set is returned, which is what label lookups need: a reviewer looking at a proposal aimed at
// a tag they don't carry still gets a readable name.
async function getAudienceOptions(db: D1Database, viewerTagsJson?: string | null): Promise<AudienceOption[]> {
	const { results } = await db
		.prepare(`
			SELECT 'tag:' || je.key AS key, je.key AS label
			FROM users u, json_each(COALESCE(u.tags, '{}')) je
			WHERE je.key <> 'Year'
			GROUP BY je.key
			UNION ALL
			SELECT 'year:' || CAST(json_extract(u.tags, '$.Year') AS TEXT) AS key,
			       'Year ' || CAST(json_extract(u.tags, '$.Year') AS TEXT) AS label
			FROM users u
			WHERE json_extract(u.tags, '$.Year') IS NOT NULL
			GROUP BY CAST(json_extract(u.tags, '$.Year') AS TEXT)
		`)
		.all<{ key: string; label: string }>()

	const tagOptions = (results || []).map(r => ({
		key: r.key,
		// Subject keys are stored under their bare name but render with the year suffix.
		label: r.key.startsWith('tag:') && (SUBJECTS as readonly string[]).includes(r.label) ? subjectLabel(r.label) : r.label,
		group: r.key.startsWith('tag:') ? ('Tags' as const) : ('Year groups' as const),
	}))

	tagOptions.sort((a, b) => a.label.localeCompare(b.label))

	const everyone = { key: EVERYONE, label: 'Everyone', group: 'Everyone' as const }
	if (viewerTagsJson === undefined) return [everyone, ...tagOptions]

	const { names, year } = viewerTagKeys(viewerTagsJson)
	const mine = tagOptions.filter(o => (o.key.startsWith('tag:') ? names.has(o.key.slice(4)) : year !== null && year === o.key.slice(5)))
	return [everyone, ...mine]
}

const parseTargets = (json: string | null | undefined): string[] => {
	try {
		const parsed = JSON.parse(json || '[]');
		return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
	} catch (e) {
		return [];
	}
}

// Hono's parseBody keeps only the last value of a repeated field unless every field is asked
// for as an array, so the audience checkboxes are read with `all: true` and unwrapped here.
type FormBody = Record<string, string | File | (string | File)[] | undefined>;

const formText = (body: FormBody, key: string): string => {
	const value = body[key];
	return String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
};

const formTexts = (body: FormBody, key: string): string[] => {
	const value = body[key];
	if (value === undefined || value === null) return [];
	return (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string');
};

// Read a proposal form, keeping only audience keys that the proposer actually carries so a
// crafted POST cannot target audiences outside their own tags.
async function readProposal(c: any, db: D1Database, viewerTagsJson: string | null | undefined) {
	const body: FormBody = await c.req.parseBody({ all: true });
	const options = await getAudienceOptions(db, viewerTagsJson);
	const valid = new Set(options.map(o => o.key));

	return {
		options,
		title: formText(body, 'title').trim().slice(0, TITLE_MAX),
		content: formText(body, 'content').trim().slice(0, CONTENT_MAX),
		privateNote: formText(body, 'private_note').trim().slice(0, NOTE_MAX),
		targets: formTexts(body, 'targets').filter(t => valid.has(t)),
	};
}

const STATUS_META: Record<string, { label: string; badge: string }> = {
	pending: { label: 'Pending review', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
	published: { label: 'Published', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
	rejected: { label: 'Rejected', badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300' },
}

const StatusPill = ({ status }: { status: string }) => {
	const meta = STATUS_META[status] || STATUS_META.pending;
	return (
		<span class={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${meta.badge}`}>{meta.label}</span>
	);
}

const AudienceChips = ({ targets, labelFor }: { targets: string[]; labelFor: (key: string) => string }) => (
	<div class="flex flex-wrap gap-1.5">
		{targets.map(t => (
			<span class="inline-block bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 px-2 py-0.5 rounded-full text-xs font-semibold">
				{t === EVERYONE ? 'Everyone' : labelFor(t)}
			</span>
		))}
	</div>
)

const ReactionButton = ({ ann, back }: { ann: any; back: string }) => (
	<form action={`/announcements/${ann.id}/react`} method="post" class="inline">
		<input type="hidden" name="return" value={back} />
		<button
			type="submit"
			title={ann.reacted ? 'Remove your reaction' : 'React with a thumbs up'}
			aria-pressed={ann.reacted ? 'true' : 'false'}
			class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
				ann.reacted
					? 'bg-blue-600 dark:bg-blue-600 border-blue-600 text-white'
					: 'bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700'
			}`}
		>
			<span aria-hidden="true">👍</span>
			<span>{Number(ann.reaction_count || 0)}</span>
		</button>
	</form>
)

const authorName = (a: any) => (a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown');

const AnnouncementCard = ({
	a,
	user,
	labelFor,
	showStatus,
	back,
}: {
	a: any;
	user: User | null;
	labelFor: (key: string) => string;
	showStatus?: boolean;
	back: string;
}) => (
	<div class={`bg-white dark:bg-neutral-800 rounded-xl border border-gray-300 dark:border-neutral-700 shadow-sm p-5 ${a.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}>
		<div class="flex flex-wrap items-start justify-between gap-3 mb-2">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white leading-snug">
				<a href={`/announcements/${a.id}`} class="hover:text-blue-700 dark:hover:text-blue-400 transition-colors">{a.title}</a>
			</h2>
			{showStatus && <StatusPill status={a.status} />}
		</div>

		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-neutral-400 mb-3">
			<span class="local-date" data-timestamp={a.published_at || a.created_at}>{formatDate(a.published_at || a.created_at)}</span>
			<span class="text-gray-300 dark:text-neutral-700">•</span>
			<span class="flex items-center">
				{authorName(a)}
				<span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(a.author_tags) }}></span>
			</span>
			{a.is_deleted && <span class="font-bold text-red-600 dark:text-red-400 uppercase">Deleted</span>}
		</div>

		<div class="mb-3">
			<AudienceChips targets={parseTargets(a.target_tags)} labelFor={labelFor} />
		</div>

<div
			class="text-gray-700 dark:text-neutral-300 text-sm line-clamp-3 leading-relaxed mb-4"
			dangerouslySetInnerHTML={{ __html: renderMarkdown(a.content) }}
		/>

		{a.status === 'rejected' && a.review_feedback && a.author_id === user?.id && (
			<div class="mb-4 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 px-4 py-3">
				<p class="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">Reviewer feedback</p>
				<p class="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">{a.review_feedback}</p>
			</div>
		)}

		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-neutral-700/50 pt-3">
			{a.status === 'published' && !a.is_deleted && user ? <ReactionButton ann={a} back={back} /> : <span></span>}
			<a href={`/announcements/${a.id}`} class="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">Open</a>
		</div>
	</div>
)

const Tabs = ({ active, reviewCount, showReview }: { active: string; reviewCount: number; showReview: boolean }) => {
	const tabs = [
		{ id: 'feed', label: 'Announcements', href: '/announcements' },
		{ id: 'mine', label: 'My Proposals', href: '/announcements?tab=mine' },
		...(showReview ? [{ id: 'pending', label: `Pending Review${reviewCount ? ` (${reviewCount})` : ''}`, href: '/announcements?tab=pending' }] : []),
	];

	return (
		<div class="border-b border-gray-200 dark:border-neutral-700 mb-8">
			<nav class="-mb-px flex space-x-8">
				{tabs.map(t => (
					<a
						href={t.href}
						class={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
							active === t.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:border-gray-300 dark:hover:border-neutral-600'
						}`}
					>
						{t.label}
					</a>
				))}
			</nav>
		</div>
	);
}

const ProposalForm = ({
	options,
	selected,
	values,
	error,
	action,
	submitLabel,
}: {
	options: AudienceOption[];
	selected: string[];
	values: { title?: string; content?: string; private_note?: string };
	error?: string;
	action: string;
	submitLabel: string;
}) => (
	<div class="bg-white dark:bg-neutral-800 rounded-xl border border-gray-300 dark:border-neutral-700 shadow-sm mb-8 overflow-hidden">
		{error && (
			<div class="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 px-8 py-3 text-sm font-medium text-red-700 dark:text-red-400">
				{error}
			</div>
		)}
		<form action={action} method="post" class="p-8 space-y-6">
			<div>
				<label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Title</label>
				<input
					type="text"
					name="title"
					required
					maxLength={TITLE_MAX}
					value={values.title || ''}
					class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
					placeholder="Announcement title e.g. Chemistry lab moved to B12"
				/>
			</div>

			<fieldset>
				<legend class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Target audience</legend>
				<p class="text-xs text-gray-500 dark:text-neutral-400 mb-3">
					Everyone who carries at least one of the selected tags will see this once it is approved.
				</p>
				<div class="space-y-4 max-h-72 overflow-y-auto pr-1">
					{AUDIENCE_GROUPS.map(group => {
						const groupOptions = options.filter(o => o.group === group);
						if (groupOptions.length === 0) return null;
						return (
							<div>
								<p class="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-2">{group}</p>
								<div class="flex flex-wrap gap-x-5 gap-y-2">
									{groupOptions.map(o => (
										<label class="flex items-center gap-2 cursor-pointer text-sm">
											<input
												type="checkbox"
												name="targets"
												value={o.key}
												checked={selected.includes(o.key)}
												class="rounded border-gray-300 dark:border-neutral-600"
											/>
											<span class="text-gray-700 dark:text-neutral-300">{o.label}</span>
										</label>
									))}
								</div>
							</div>
						);
					})}
				</div>
			</fieldset>

			<div>
				<label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Content</label>
				<textarea
					name="content"
					rows={6}
					required
					maxLength={CONTENT_MAX}
					class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
					placeholder="Write your message here..."
				>
					{values.content || ''}
				</textarea>
				<p class="text-xs text-gray-500 dark:text-neutral-400 mt-1">
					Markdown supported: <code class="px-1 rounded bg-gray-100 dark:bg-neutral-900">**bold**</code>,{' '}
					<code class="px-1 rounded bg-gray-100 dark:bg-neutral-900">*italic*</code>,{' '}
					<code class="px-1 rounded bg-gray-100 dark:bg-neutral-900">- lists</code>,{' '}
					<code class="px-1 rounded bg-gray-100 dark:bg-neutral-900"># headings</code>, links and{' '}
					<code class="px-1 rounded bg-gray-100 dark:bg-neutral-900">code blocks</code>.
				</p>
			</div>

			<div>
				<label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Additional needs</label>
				<p class="text-xs text-gray-500 dark:text-neutral-400 mb-2">
					Anything you need from the reviewers, e.g. a poster printed or a link checked. Only you and the reviewers can see this.
				</p>
				<textarea
					name="private_note"
					rows={3}
					maxLength={NOTE_MAX}
					class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
					placeholder="Optional. Only visible to you and the admins reviewing this."
				>
					{values.private_note || ''}
				</textarea>
			</div>

			<div class="flex justify-end border-t border-gray-100 dark:border-neutral-800 pt-4">
				<button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm">
					{submitLabel}
				</button>
			</div>
		</form>
	</div>
)

const proposalPage = (c: any, user: User, opts: { options: AudienceOption[]; values?: any; error?: string; action: string; submitLabel: string; heading: string }) =>
	c.html(
		<Layout title="Propose an Announcement" user={user}>
			<div class="max-w-3xl mx-auto py-8 px-4 sm:px-6">
				<div class="mb-6">
					<a href="/announcements?tab=mine" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
						&larr; Back to My Proposals
					</a>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white mt-2">{opts.heading}</h1>
					<p class="text-sm text-gray-600 dark:text-neutral-400 mt-2">
						Your proposal starts as pending. An admin reviews it before it reaches your audience.
					</p>
				</div>
				<ProposalForm
					options={opts.options}
					selected={(opts.values?.targets || []) as string[]}
					values={opts.values || {}}
					error={opts.error}
					action={opts.action}
					submitLabel={opts.submitLabel}
				/>
			</div>
		</Layout>
	);

app.get('/announcements', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));

	const options = await getAudienceOptions(c.env.DB);
	const labelFor = (key: string) => options.find(o => o.key === key)?.label ?? key;
	const isReviewer = canReviewAnnouncements(user);
	const tab = c.req.query('tab') === 'mine' ? 'mine' : c.req.query('tab') === 'pending' && isReviewer ? 'pending' : 'feed';
	const viewerTags = user.tags ?? '{}';

	const reactionMeta = `
		(SELECT COUNT(*) FROM announcement_reactions r WHERE r.announcement_id = a.id) AS reaction_count,
		EXISTS (SELECT 1 FROM announcement_reactions r WHERE r.announcement_id = a.id AND r.user_id = ${VIEWER_ID_EXPR}) AS reacted`;
	const selectFrom = `SELECT a.*, u.first_name, u.last_name, u.tags AS author_tags, ${reactionMeta}
		FROM announcements a
		LEFT JOIN users u ON u.id = a.author_id`;

	// Positional binds only, in the order the CTEs declare them.
	const bindings: unknown[] = [viewerTags, user.id];
	const activeAudience = c.req.query('audience');
	let sql = VIEWER_CTE;

	if (tab === 'feed') {
		// Only a key that is a real audience can filter, so the query cannot be fed junk.
		const audience = options.some(o => o.key === activeAudience) && activeAudience !== EVERYONE ? activeAudience : null;
		let audienceFilter = '';
		if (audience) {
			audienceFilter = ` AND EXISTS (SELECT 1 FROM json_each(a.target_tags) je WHERE je.value = ?)`;
			bindings.push(audience);
		}
		// Reviewers moderate the whole feature, so they see every published announcement --
		// including ones aimed at tags they don't carry.
		const audienceGate = isReviewer ? '' : ` AND ${announcementAudienceMatch(VIEWER_TAGS_EXPR)}`;
		sql += ` ${selectFrom}
			WHERE a.status = 'published' AND a.is_deleted = 0${audienceGate}${audienceFilter}
			ORDER BY COALESCE(a.published_at, a.created_at) DESC`;
	} else if (tab === 'mine') {
		sql += ` ${selectFrom}
			WHERE a.author_id = ${VIEWER_ID_EXPR} AND a.is_deleted = 0
			ORDER BY a.created_at DESC`;
	} else {
		sql += ` ${selectFrom}
			WHERE a.status = 'pending' AND a.is_deleted = 0
			ORDER BY a.created_at ASC`;
	}

	const { results } = await c.env.DB.prepare(sql).bind(...bindings).all<any>();

	const pendingCount =
		isReviewer
			? await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM announcements WHERE status = 'pending' AND is_deleted = 0`).first<any>()
			: null;

	// Chips only advertise audiences this viewer actually has something published for.
	let chips: { key: string; count: number }[] = [];
	if (tab === 'feed') {
		const { results: chipRows } = await c.env.DB
			.prepare(`
				${VIEWER_TAGS_CTE}
				SELECT je.value AS key, COUNT(*) AS count
				FROM announcements a, json_each(a.target_tags) je
				WHERE a.status = 'published' AND a.is_deleted = 0 AND ${announcementAudienceMatch(VIEWER_TAGS_EXPR)}
				GROUP BY je.value
			`)
			.bind(viewerTags)
			.all<{ key: string; count: number }>();
		chips = chipRows || [];
	}

	if (tab === 'feed') await markAnnouncementsRead(c.env.DB, user.id);

	const back = `/announcements${tab === 'feed' && activeAudience ? `?audience=${encodeURIComponent(activeAudience)}` : tab === 'feed' ? '' : `?tab=${tab}`}`;

	return c.html(
		<Layout title="Announcements" user={user}>
			<div class="max-w-4xl mx-auto py-8 px-4 sm:px-6">
				<header class="flex flex-wrap items-center justify-between gap-4 mb-6">
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Announcements</h1>
					{canPostGeneral(user) && (
						<a href="/announcements/new" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm">
							Propose an Announcement
						</a>
					)}
				</header>

				<Tabs active={tab} reviewCount={pendingCount ? Number(pendingCount.n) : 0} showReview={isReviewer} />

				{tab === 'feed' && (
					<div class="space-y-6">
						{!canPostGeneral(user) && (
							<div class="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 mb-6">
								You are muted and cannot propose announcements.
							</div>
						)}

						{chips.length > 1 && (
							<div class="flex flex-wrap gap-2 mb-6">
								<a
									href="/announcements"
									class={`px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all ${
										!activeAudience ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900'
									}`}
								>
									All
								</a>
								{chips.map(chip => (
									<a
										href={`/announcements?audience=${encodeURIComponent(chip.key)}`}
										class={`px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all ${
											activeAudience === chip.key
												? 'bg-blue-600 text-white'
												: 'bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900'
										}`}
									>
										{labelFor(chip.key)} <span class="opacity-60">{chip.count}</span>
									</a>
								))}
							</div>
						)}

						{results && results.length > 0 ? (
							results.map((a: any) => <AnnouncementCard a={a} user={user} labelFor={labelFor} back={back} />)
						) : (
							<div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700">
								<p class="font-semibold text-gray-600 dark:text-neutral-300">No announcements for you yet.</p>
								<p class="text-sm mt-2">
									Announcements are targeted by tag. Tick the subjects you care about in your profile to widen what you see.
								</p>
							</div>
						)}
					</div>
				)}

				{tab === 'mine' && (
					<div class="space-y-4">
						{!canPostGeneral(user) && (
							<div class="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-lg text-sm font-medium text-red-700 dark:text-red-400">
								You are muted and cannot propose announcements.
							</div>
						)}
						{results && results.length > 0 ? (
							results.map((a: any) => (
								<div>
									<AnnouncementCard a={a} user={user} labelFor={labelFor} showStatus back={back} />
									{a.status !== 'published' && (
										<a
											href={`/announcements/${a.id}/edit`}
											class="inline-block mt-2 ml-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
										>
											Edit proposal
										</a>
									)}
								</div>
							))
						) : (
							<div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700">
								You have not proposed any announcements yet.
							</div>
						)}
					</div>
				)}

				{tab === 'pending' && (
					<div class="space-y-4">
						{results && results.length > 0 ? (
							results.map((a: any) => (
								<div>
									<AnnouncementCard a={a} user={user} labelFor={labelFor} showStatus back={back} />
									<div class="mt-2 ml-1 flex flex-wrap gap-2">
										<a
											href={`/announcements/${a.id}`}
											class="inline-block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
										>
											Review
										</a>
									</div>
								</div>
							))
						) : (
							<div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700">
								The queue is empty. Nothing to review.
							</div>
						)}
					</div>
				)}
			</div>
		</Layout>
	);
});

app.get('/announcements/new', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));
	if (!canPostGeneral(user)) return c.text('You cannot propose announcements.', 403);

	const options = await getAudienceOptions(c.env.DB, user.tags);
	return proposalPage(c, user, { options, action: '/announcements', submitLabel: 'Submit for review', heading: 'Propose an Announcement' });
});

// Any user can propose. The announcement is stored as pending and only reviewers can see it.
app.post('/announcements', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));
	if (!canPostGeneral(user)) return c.text('You cannot propose announcements.', 403);

	const { options, title, content, privateNote, targets } = await readProposal(c, c.env.DB, user.tags);

	const reRender = (error: string) =>
		proposalPage(c, user, {
			options,
			values: { title, content, private_note: privateNote, targets },
			error,
			action: '/announcements',
			submitLabel: 'Submit for review',
			heading: 'Propose an Announcement',
		});

	if (!title || !content) return reRender('A title and content are both required.');
	if (targets.length === 0) return reRender('Pick at least one target audience.');

	const res = await c.env.DB
		.prepare(`INSERT INTO announcements (title, content, target_tags, private_note, status, author_id) VALUES (?, ?, ?, ?, 'pending', ?)`)
		.bind(title, content, JSON.stringify(targets), privateNote || null, user.id)
		.run();

	await logAction(c.env.DB, user.id, 'PROPOSE_ANNOUNCEMENT', `Proposed announcement '${title}'`, res.meta.last_row_id, 'announcements');

	return c.redirect('/announcements?tab=mine');
});

app.get('/announcements/:id', async (c) => {
	const user = (await getUser(c)) as User | null;
	const id = c.req.param('id');

	const ann = await c.env.DB
		.prepare(`
			${VIEWER_CTE}
			SELECT a.*, u.first_name, u.last_name, u.tags AS author_tags, rv.first_name AS reviewer_first_name, rv.last_name AS reviewer_last_name,
				${announcementAudienceMatch(VIEWER_TAGS_EXPR)} AS audience_match,
				(SELECT COUNT(*) FROM announcement_reactions r WHERE r.announcement_id = a.id) AS reaction_count,
				EXISTS (SELECT 1 FROM announcement_reactions r WHERE r.announcement_id = a.id AND r.user_id = ${VIEWER_ID_EXPR}) AS reacted
			FROM announcements a
			LEFT JOIN users u ON u.id = a.author_id
			LEFT JOIN users rv ON rv.id = a.reviewed_by
			WHERE a.id = ?
		`)
		.bind(user?.tags ?? '{}', user?.id ?? -1, id)
		.first<any>();

	if (!ann) return c.notFound();
	if (ann.is_deleted && (!user || !canViewDeleted(user))) return c.notFound();

	const isAuthor = !!user && user.id === ann.author_id;
	const isReviewer = !!user && canReviewAnnouncements(user);

	// Pending and rejected announcements stay inside the proposal/review loop.
	if (ann.status !== 'published' && !isAuthor && !isReviewer) return c.notFound();
	// Audience matching only gates ordinary readers; a reviewer can open anything.
	if (ann.status === 'published' && !ann.audience_match && !isReviewer) return c.notFound();

	const options = await getAudienceOptions(c.env.DB);
	const labelFor = (key: string) => options.find(o => o.key === key)?.label ?? key;
	const targets = parseTargets(ann.target_tags);

	// A published announcement is in the viewer's audience, but only a signed-in user has a
	// read state to advance.
	if (ann.status === 'published' && user) await markAnnouncementsRead(c.env.DB, user.id);

	const canEdit = isAuthor && (ann.status === 'pending' || ann.status === 'rejected');
	const canDelete = isReviewer || (isAuthor && ann.status !== 'published');

	return c.html(
		<Layout title={ann.title} user={user}>
			<div class="mx-auto max-w-3xl px-4 sm:px-6 py-8">
				<a href={ann.status === 'published' ? '/announcements' : '/announcements?tab=mine'} class="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1 font-medium transition-colors mb-4">
					&larr; Back to announcements
				</a>

				<div class={`bg-white dark:bg-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden mb-6 shadow-sm ${ann.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}>
					<div class="p-8 border-b border-gray-100 dark:border-neutral-700/50">
						{ann.is_deleted && <span class="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-4 block tracking-widest">Deleted</span>}
						<div class="flex flex-wrap items-center gap-3 mb-5">
							<StatusPill status={ann.status} />
							<span class="text-gray-400 dark:text-neutral-500 text-sm font-mono local-date" data-timestamp={ann.published_at || ann.created_at} data-format="datetime">
								{formatDate(ann.published_at || ann.created_at)}
							</span>
						</div>
						<h1 class="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-5 leading-tight tracking-tight">{ann.title}</h1>
						<div class="mb-6">
							<AudienceChips targets={targets} labelFor={labelFor} />
						</div>
						<div
						class="text-gray-800 dark:text-neutral-200 leading-relaxed text-lg"
						dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.content) }}
					/>
					</div>

					<div class="bg-gray-50 dark:bg-neutral-900/50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
						<div class="text-sm text-gray-600 dark:text-neutral-400 flex items-center">
							<span class="font-bold mr-2 text-gray-900 dark:text-neutral-100">Proposed by:</span> {authorName(ann)}
							<span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(ann.author_tags) }}></span>
						</div>
						{ann.status === 'published' && !ann.is_deleted && user && <ReactionButton ann={ann} back={`/announcements/${ann.id}`} />}
					</div>
				</div>

				{/* The "additional needs" note: author and reviewers only. */}
				{(isAuthor || isReviewer) && ann.private_note && (
					<div class="bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-900/40 rounded-xl p-5 mb-6">
						<p class="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-2">Additional needs</p>
						<p class="text-sm text-purple-900 dark:text-purple-100 whitespace-pre-wrap">{ann.private_note}</p>
					</div>
				)}

				{/* Rejection feedback belongs to the proposer alone, and only while it is rejected. */}
				{isAuthor && ann.status === 'rejected' && ann.review_feedback && (
					<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl p-5 mb-6">
						<p class="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-2">Reviewer feedback</p>
						<p class="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap">{ann.review_feedback}</p>
						{ann.reviewed_at && (
							<p class="text-xs text-red-600 dark:text-red-400 mt-2 local-date" data-timestamp={ann.reviewed_at}>
								{formatDate(ann.reviewed_at)} &middot; {ann.reviewer_first_name ? `${ann.reviewer_first_name} ${ann.reviewer_last_name}` : 'Unknown'}
							</p>
						)}
					</div>
				)}

				{isReviewer && ann.status === 'pending' && !ann.is_deleted && (
					<div class="bg-white dark:bg-neutral-800 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-sm p-6 mb-6">
						<h2 class="text-lg font-bold text-gray-900 dark:text-white mb-1">Review this proposal</h2>
<p class="text-sm text-gray-500 dark:text-neutral-400 mb-5">Feedback is optional. It is shown to the proposer if you reject, and they can then edit and resubmit.</p>
						<form action={`/announcements/${ann.id}/review`} method="post" class="space-y-4">
							<div>
								<label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Feedback</label>
								<textarea
									name="feedback"
									rows={4}
									maxLength={NOTE_MAX}
									class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
									placeholder="Optional. Why it was rejected, and what would make it approvable..."
								></textarea>
							</div>
							<div class="flex flex-wrap gap-3 justify-end">
								<button
									type="submit"
									name="action"
									value="reject"
									class="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm"
								>
									Reject
								</button>
								<button
									type="submit"
									name="action"
									value="accept"
									class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm"
								>
									Accept &amp; publish
								</button>
							</div>
						</form>
					</div>
				)}

				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex flex-wrap gap-4">
						{canEdit && (
							<a href={`/announcements/${ann.id}/edit`} class="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">
								Edit &amp; resubmit
							</a>
						)}
						{canDelete && (
							<form action={`/announcements/${ann.id}/delete`} method="post" class="inline">
								<button type="submit" class="text-sm font-bold text-red-600 dark:text-red-400 hover:underline" onclick="return confirm('Delete this announcement?')">
									Delete
								</button>
							</form>
						)}
					</div>
				</div>
			</div>
		</Layout>
	);
});

// Author-only resubmission. Anything that has already been published is frozen.
app.get('/announcements/:id/edit', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));

	const ann = await c.env.DB.prepare(`SELECT * FROM announcements WHERE id = ? AND is_deleted = 0`).bind(c.req.param('id')).first<any>();
	if (!ann) return c.notFound();
	if (ann.author_id !== user.id) return c.text('You can only edit your own proposals.', 403);
	if (ann.status === 'published') return c.text('Published announcements cannot be edited.', 403);

	const options = await getAudienceOptions(c.env.DB, user.tags);
	return proposalPage(c, user, {
		options,
		values: { title: ann.title, content: ann.content, private_note: ann.private_note || '', targets: parseTargets(ann.target_tags) },
		action: `/announcements/${ann.id}/edit`,
		submitLabel: 'Resubmit for review',
		heading: 'Edit proposal',
	});
});

app.post('/announcements/:id/edit', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));

	const id = c.req.param('id');
	const ann = await c.env.DB.prepare(`SELECT * FROM announcements WHERE id = ? AND is_deleted = 0`).bind(id).first<any>();
	if (!ann) return c.notFound();
	if (ann.author_id !== user.id) return c.text('You can only edit your own proposals.', 403);
	if (ann.status === 'published') return c.text('Published announcements cannot be edited.', 403);

	const { options, title, content, privateNote, targets } = await readProposal(c, c.env.DB, user.tags);

	const reRender = (error: string) =>
		proposalPage(c, user, {
			options,
			values: { title, content, private_note: privateNote, targets },
			error,
			action: `/announcements/${id}/edit`,
			submitLabel: 'Resubmit for review',
			heading: 'Edit proposal',
		});

	if (!title || !content) return reRender('A title and content are both required.');
	if (targets.length === 0) return reRender('Pick at least one target audience.');

	// Back to pending, and the previous verdict is cleared so the reviewer sees the new draft.
	await c.env.DB
		.prepare(`
			UPDATE announcements
			SET title = ?, content = ?, target_tags = ?, private_note = ?, status = 'pending',
			    review_feedback = NULL, reviewed_by = NULL, reviewed_at = NULL, published_at = NULL
			WHERE id = ?
		`)
		.bind(title, content, JSON.stringify(targets), privateNote || null, id)
		.run();

	await logAction(c.env.DB, user.id, 'EDIT_ANNOUNCEMENT', `Resubmitted announcement '${title}'`, Number(id), 'announcements');

	return c.redirect(`/announcements/${id}`);
});

app.post('/announcements/:id/review', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));
	if (!canReviewAnnouncements(user)) return c.text('You are not authorized to review announcements.', 403);

	const id = c.req.param('id');
	const ann = await c.env.DB.prepare(`SELECT * FROM announcements WHERE id = ? AND is_deleted = 0`).bind(id).first<any>();
	if (!ann) return c.notFound();
	if (ann.status !== 'pending') return c.text('This announcement has already been reviewed.', 400);

	const body: FormBody = await c.req.parseBody({ all: true });
	const action = formText(body, 'action');
	if (action !== 'accept' && action !== 'reject') return c.text('Unknown review action.', 400);

	const feedback = formText(body, 'feedback').trim().slice(0, NOTE_MAX);

	if (action === 'accept') {
		await c.env.DB
			.prepare(`
				UPDATE announcements
				SET status = 'published', published_at = CURRENT_TIMESTAMP, review_feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`)
			.bind(feedback || null, user.id, id)
			.run();
		await logAction(c.env.DB, user.id, 'ACCEPT_ANNOUNCEMENT', `Accepted announcement '${ann.title}'`, Number(id), 'announcements');
	} else {
		await c.env.DB
			.prepare(`UPDATE announcements SET status = 'rejected', review_feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`)
			.bind(feedback || null, user.id, id)
			.run();
		await logAction(c.env.DB, user.id, 'REJECT_ANNOUNCEMENT', `Rejected announcement '${ann.title}'`, Number(id), 'announcements');
	}

	return c.redirect(`/announcements/${id}`);
});

// Thumbs-up only, one row per user per announcement. Clicking again removes it.
app.post('/announcements/:id/react', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));

	const id = c.req.param('id');
	const ann = await c.env.DB
		.prepare(`
			${VIEWER_TAGS_CTE}
			SELECT a.id FROM announcements a
			WHERE a.id = ? AND a.status = 'published' AND a.is_deleted = 0
			  AND (${announcementAudienceMatch(VIEWER_TAGS_EXPR)} OR ?)
		`)
		.bind(user.tags ?? '{}', id, canReviewAnnouncements(user) ? 1 : 0)
		.first<any>();
	if (!ann) return c.notFound();

	const existing = await c.env.DB.prepare(`SELECT id FROM announcement_reactions WHERE announcement_id = ? AND user_id = ?`).bind(id, user.id).first<any>();

	if (existing) {
		await c.env.DB.prepare(`DELETE FROM announcement_reactions WHERE id = ?`).bind(existing.id).run();
	} else {
		await c.env.DB.prepare(`INSERT OR IGNORE INTO announcement_reactions (announcement_id, user_id) VALUES (?, ?)`).bind(id, user.id).run();
	}

	const body: FormBody = await c.req.parseBody({ all: true });
	const back = safeNext(formText(body, 'return')) || '/announcements';
	return c.redirect(back);
});

app.post('/announcements/:id/delete', async (c) => {
	const user = (await getUser(c)) as User | null;
	if (!user) return c.redirect(loginRedirect(c));

	const id = c.req.param('id');
	const ann = await c.env.DB.prepare(`SELECT * FROM announcements WHERE id = ?`).bind(id).first<any>();
	if (!ann) return c.notFound();

	const isReviewer = canReviewAnnouncements(user);
	// Authors can withdraw their own proposal; published announcements are admin-only.
	if (!isReviewer && !(ann.author_id === user.id && ann.status !== 'published')) {
		return c.text('You are not authorized to delete this announcement.', 403);
	}

	await c.env.DB.prepare(`UPDATE announcements SET is_deleted = 1 WHERE id = ?`).bind(id).run();
	await logAction(c.env.DB, user.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement '${ann.title}'`, Number(id), 'announcements');

	return c.redirect(ann.status === 'published' ? '/announcements' : '/announcements?tab=mine');
});

export default app;
