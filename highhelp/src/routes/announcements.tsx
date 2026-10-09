import { Hono } from 'hono'
import { Layout } from '../layout'
import {
	getUser,
	loginRedirect,
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
import { renderMarkdown, markdownExcerpt as excerpt } from '../markdown'
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

const STATUS_META: Record<string, { label: string; text: string }> = {
	pending: { label: 'Pending review', text: 'text-amber-600 dark:text-amber-400' },
	published: { label: 'Published', text: 'text-gray-500 dark:text-neutral-400' },
	rejected: { label: 'Rejected', text: 'text-red-600 dark:text-red-400' },
}

const StatusLabel = ({ status }: { status: string }) => {
	const meta = STATUS_META[status] || STATUS_META.pending;
	return <span class={`text-[11px] font-bold  tracking-wider ${meta.text}`}>{meta.label}</span>;
}

// Outlined chips rather than filled pills, so the audience reads as quiet metadata sitting under
// the title instead of a row of buttons.
const AudienceChips = ({ targets, labelFor }: { targets: string[]; labelFor: (key: string) => string }) => (
	<span class="inline">
		{targets.map((t, i) => (
			<span
				class={`inline-block bg-transparent text-gray-600 dark:text-neutral-300 text-xs px-2 py-0.5 rounded font-bold border border-gray-300 dark:border-neutral-700 align-middle ${
					i > 0 ? 'ml-1' : ''
				}`}
			>
				{t === EVERYONE ? 'Everyone' : labelFor(t)}
			</span>
		))}
	</span>
)

const ReactionButton = ({ ann, back }: { ann: any; back: string }) => (
	<form action={`/announcements/${ann.id}/react`} method="post" class="inline">
		<input type="hidden" name="return" value={back} />
		<button
			type="submit"
			title={ann.reacted ? 'Remove your reaction' : 'React with a thumbs up'}
			aria-pressed={ann.reacted ? 'true' : 'false'}
			class={`inline-flex items-center gap-1 text-sm font-bold transition-colors hover:underline ${
				ann.reacted ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400'
			}`}
		>
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M14 9V5a3 3 0 00-3-3L7 11v11h11.28a2 2 0 002-1.72l1.38-9a2 2 0 00-2-2H14zM7 11H4a2 2 0 00-2 2v6a2 2 0 002 2h3"
				></path>
			</svg>
			<span>{Number(ann.reaction_count || 0)}</span>
		</button>
	</form>
)

const authorName = (a: any) => (a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown');

// A surface rather than an outlined card: background only, no border and no shadow, which is the
// app's established card pair (see forum/essays). The whole card opens the announcement via a
// stretched link overlay; the reaction form and the per-tab action sit above it on z-10 so they
// stay independently clickable.
//
// Every card is the same height: the title clamps to two lines, the preview to two, the target
// chips and the action row are always rendered, and min-h plus flex-1 bottom-aligns the action
// row so the thumbs-up and the edit/review link sit on the same line across the whole list.
const AnnouncementCard = ({
	a,
	user,
	labelFor,
	showStatus,
	back,
	extraAction,
}: {
	a: any;
	user: User | null;
	labelFor: (key: string) => string;
	showStatus?: boolean;
	back: string;
	extraAction?: { href: string; label: string };
}) => {
	const targets = parseTargets(a.target_tags).map(t => (t === EVERYONE ? 'Everyone' : labelFor(t)));
	const canReact = a.status === 'published' && !a.is_deleted && !!user;
	const rejectedNote = a.status === 'rejected' && a.review_feedback && a.author_id === user?.id;

	return (
		<article class="group relative rounded-lg bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700/70 transition-colors pl-5 pr-4 py-4">
			{/* Accent bar: invisible until hover, so the list stays calm. */}
			<span class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-transparent group-hover:bg-blue-500 dark:group-hover:bg-blue-400 transition-colors"></span>

			{/* One quiet meta line: audience on the left, date on the right. */}
			<div class="flex items-center justify-between gap-4 text-xs text-gray-500 dark:text-neutral-400">
				<span class="truncate font-bold  tracking-wider">{targets.join(' · ') || 'Everyone'}</span>
				<span class="flex items-center gap-3 shrink-0">
					{showStatus && <StatusLabel status={a.status} />}
					{showStatus && a.is_deleted && (
						<span class="text-[11px] font-bold  tracking-wider text-red-600 dark:text-red-400">Deleted</span>
					)}
					<span class="local-date" data-timestamp={a.published_at || a.created_at}>
						{formatDate(a.published_at || a.created_at)}
					</span>
				</span>
			</div>

			{/* Stretched link: the ::after covers the whole card; interactive bits sit above on z-10. */}
			<h2 class="mt-1.5 text-lg font-bold leading-snug text-gray-900 dark:text-white">
				<a href={`/announcements/${a.id}`} class="after:absolute after:inset-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
					{a.title}
				</a>
			</h2>

			<p class="mt-1 text-sm leading-relaxed text-gray-600 dark:text-neutral-300 line-clamp-2">{excerpt(a.content)}</p>

			{rejectedNote && (
				<p class="mt-2 text-xs text-red-700 dark:text-red-300">
					<b class="font-bold  tracking-wider">Rejected:</b> {a.review_feedback}
				</p>
			)}

			<div class="mt-3 flex items-center gap-3 text-sm">
				<span class="text-xs text-gray-500 dark:text-neutral-400">{authorName(a)}</span>
				<span class="flex-grow"></span>
				{canReact && (
					<span class="relative z-10 inline-flex">
						<ReactionButton ann={a} back={back} />
					</span>
				)}
				{extraAction && (
					<a
						href={extraAction.href}
						class="relative z-10 text-gray-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
					>
						{extraAction.label}
					</a>
				)}
			</div>
		</article>
	);
};

const Tabs = ({ active, reviewCount, showReview }: { active: string; reviewCount: number; showReview: boolean }) => {
	const tabs = [
		{ id: 'feed', label: 'Announcements', href: '/announcements' },
		{ id: 'mine', label: 'My Proposals', href: '/announcements?tab=mine' },
		...(showReview ? [{ id: 'pending', label: `Pending Review${reviewCount ? ` (${reviewCount})` : ''}`, href: '/announcements?tab=pending' }] : []),
	];

	// Plain links separated by rules, the way the batch toolbar separates its actions. The active
	// one is distinguished by weight and colour rather than a filled pill.
	return (
		<nav class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm pb-2 border-b border-gray-200 dark:border-neutral-800">
			{tabs.map((t, i) => (
				<>
					{i > 0 && <span class="text-gray-300 dark:text-neutral-700">|</span>}
					<a
						href={t.href}
						aria-current={active === t.id ? 'page' : undefined}
						class={`transition-colors ${
							active === t.id
								? 'text-blue-600 dark:text-blue-400 font-bold'
								: 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
						}`}
					>
						{t.label}
					</a>
				</>
			))}
		</nav>
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
	// Fields sit directly on the page background, separated by hairlines. Only the inputs keep
	// borders -- they need an edge to show where the click target is.
	<form action={action} method="post" class="max-w-2xl">
		{error && <p class="mb-4 text-sm font-bold text-red-600 dark:text-red-400">{error}</p>}

		<div class="pb-5">
			<label class="block text-xs font-bold  tracking-wider text-gray-500 dark:text-neutral-400 mb-2">Title</label>
			<input
				type="text"
				name="title"
				required
				maxLength={TITLE_MAX}
				value={values.title || ''}
				class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
				placeholder="Announcement title"
			/>
		</div>

		<fieldset class="pb-5">
			<legend class="block text-xs font-bold  tracking-wider text-gray-500 dark:text-neutral-400 mb-1">Target audience</legend>
			<p class="text-xs text-gray-500 dark:text-neutral-400 mb-3">
				Everyone who carries at least one of the selected tags will see this.
			</p>
			<div class="space-y-4 max-h-72 overflow-y-auto pr-1">
				{AUDIENCE_GROUPS.map(group => {
					const groupOptions = options.filter(o => o.group === group);
					if (groupOptions.length === 0) return null;
					return (
						<div>
							<p class="text-[11px] font-bold  tracking-wider text-gray-400 dark:text-neutral-500 mb-2">{group}</p>
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

		<div class="pb-5">
			<label class="block text-xs font-bold  tracking-wider text-gray-500 dark:text-neutral-400 mb-2">Content</label>
			<textarea
				name="content"
				rows={6}
				required
				maxLength={CONTENT_MAX}
				class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
				placeholder="Body Text... You can use markdown formatting like ## for subheadings *text* for italics **text** for bold."
			>
				{values.content || ''}
			</textarea>
			
		</div>

		<div class="pb-5">
			<label class="block text-xs font-bold  tracking-wider text-gray-500 dark:text-neutral-400 mb-1">Additional needs</label>
			<p class="text-xs text-gray-500 dark:text-neutral-400 mb-2">
				Anything you need from the reviewers, e.g. a poster printed or a link checked. Only you and the reviewers can see this.
			</p>
			<textarea
				name="private_note"
				rows={3}
				maxLength={NOTE_MAX}
				class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
				placeholder="Optional. Only visible to you and the admins reviewing this."
			>
				{values.private_note || ''}
			</textarea>
		</div>

		<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-neutral-800">
			<button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors rounded-lg">
				{submitLabel}
			</button>
		</div>
	</form>
)

const proposalPage = (c: any, user: User, opts: { options: AudienceOption[]; values?: any; error?: string; action: string; submitLabel: string; heading: string }) =>
	c.html(
		<Layout title="Propose an Announcement" user={user}>
			<div class="max-w-3xl mx-auto">
				<a href="/announcements?tab=mine" class="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors inline-block mb-4">
					&larr; Back to My Proposals
				</a>
				<h1 class="text-3xl font-bold text-gray-900 dark:text-white">{opts.heading}</h1>
				<p class="text-sm text-gray-600 dark:text-neutral-400 mt-2 mb-6">
					What you wanna say to your classmates..?
				</p>
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
			{/* Layout supplies max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8, so this page adds only a
				width cap and centring. max-w-6xl matches the resource view page, which keeps the
				announcements column consistent with the rest of the wide content pages. */}
			<div class="max-w-6xl mx-auto">
				<header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
					<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Announcements</h1>
					{canPostGeneral(user) && (
						<a href="/announcements/new" class="text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline transition-colors">
							Propose an Announcement
						</a>
					)}
				</header>

				<Tabs active={tab} reviewCount={pendingCount ? Number(pendingCount.n) : 0} showReview={isReviewer} />

				{tab === 'feed' && (
					<div>
						{!canPostGeneral(user) && (
							<p class="mt-3 text-sm text-red-600 dark:text-red-400">You are muted and cannot propose announcements.</p>
						)}

						{/* Underlined links rather than toggle pills -- the same shape as the batch toolbar's filters. */}
						{chips.length > 1 && (
							<div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 mb-4 text-sm">
								<a
									href="/announcements"
									class={`pb-0.5 transition-colors ${
										!activeAudience
											? 'text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400'
											: 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white border-b border-transparent hover:border-gray-300 dark:hover:border-neutral-600'
									}`}
								>
									All
								</a>
								{chips.map(chip => (
									<a
										href={`/announcements?audience=${encodeURIComponent(chip.key)}`}
										class={`pb-0.5 transition-colors ${
											activeAudience === chip.key
												? 'text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400'
												: 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white border-b border-transparent hover:border-gray-300 dark:hover:border-neutral-600'
										}`}
									>
										{labelFor(chip.key)} <span class="text-gray-400 dark:text-neutral-500">{chip.count}</span>
									</a>
								))}
							</div>
						)}

						{results && results.length > 0 ? (
							<div class="space-y-2 mt-4">
								{results.map((a: any) => (
									<AnnouncementCard a={a} user={user} labelFor={labelFor} back={back} />
								))}
							</div>
						) : (
							<p class="py-10 text-center text-sm italic text-gray-400 dark:text-neutral-500">
								No announcements for you yet. 
							</p>
						)}
					</div>
				)}

				{tab === 'mine' && (
					<div>
						{!canPostGeneral(user) && (
							<p class="mt-3 text-sm text-red-600 dark:text-red-400">You are muted and cannot propose announcements.</p>
						)}
						{results && results.length > 0 ? (
							<div class="space-y-2 mt-4">
								{results.map((a: any) => (
									<AnnouncementCard
										a={a}
										user={user}
										labelFor={labelFor}
										showStatus
										back={back}
										extraAction={a.status !== 'published' ? { href: `/announcements/${a.id}/edit`, label: 'edit' } : undefined}
									/>
								))}
							</div>
						) : (
							<p class="py-10 text-center text-sm italic text-gray-400 dark:text-neutral-500">You have not proposed any announcements yet.</p>
						)}
					</div>
				)}

				{tab === 'pending' && (
					<div>
						{results && results.length > 0 ? (
							<div class="space-y-2 mt-4">
								{results.map((a: any) => (
									<AnnouncementCard
										a={a}
										user={user}
										labelFor={labelFor}
										showStatus
										back={back}
										extraAction={{ href: `/announcements/${a.id}`, label: 'review' }}
									/>
								))}
							</div>
						) : (
							<p class="py-10 text-center text-sm italic text-gray-400 dark:text-neutral-500">The queue is empty. Nothing to review.</p>
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

	// The sidebar index is exactly the set the feed would show this viewer, so the two views can
	// never disagree. Reviewers see every published announcement, as on the feed.
	const { results: indexRows } = await c.env.DB
		.prepare(`
			${VIEWER_TAGS_CTE}
			SELECT a.id, a.title, a.published_at, a.created_at
			FROM announcements a
			WHERE a.status = 'published' AND a.is_deleted = 0${isReviewer ? '' : ` AND ${announcementAudienceMatch(VIEWER_TAGS_EXPR)}`}
			ORDER BY COALESCE(a.published_at, a.created_at) DESC
			LIMIT 60
		`)
		.bind(user?.tags ?? '{}')
		.all<{ id: number; title: string; published_at: string | null; created_at: string }>();

	// A proposal or a deleted post is not in the published set, but the reader is still looking at
	// it -- splice it in at the top so the index shows where they actually are.
	const indexItems: { id: number; title: string; published_at: string | null; created_at: string }[] = [...(indexRows || [])];
	if (!indexItems.some(r => Number(r.id) === Number(id))) {
		indexItems.unshift({ id: Number(id), title: ann.title, published_at: ann.published_at, created_at: ann.created_at });
	}

	return c.html(
		<Layout title={ann.title} user={user}>
			{/* Same two-column frame as the About page: index on the left, content on the right. */}
			<div class="flex flex-col md:flex-row gap-8">
				<aside class="md:w-64 flex-shrink-0">
					<div class="sticky top-8">
						
						<a
							href={ann.status === 'published' ? '/announcements' : '/announcements?tab=mine'}
							class="block text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors mb-4"
						>
							&larr; Back
						</a>
						<ul class="text-sm max-h-[60vh] overflow-y-auto pr-1 space-y-2">
							{indexItems.map(item => {
								const isCurrent = Number(item.id) === Number(id);
								return (
									<li class={isCurrent ? 'border-l-2 border-blue-500 dark:border-blue-400 pl-2' : 'border-l-2 border-transparent pl-2'}>
										<a
											href={`/announcements/${item.id}`}
											aria-current={isCurrent ? 'page' : undefined}
											class={`block leading-snug transition-colors ${
												isCurrent
													? 'font-bold text-gray-900 dark:text-white'
													: 'text-gray-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400'
											}`}
										>
											{item.title}
										</a>
										<span class="text-[11px] text-gray-400 dark:text-neutral-500 local-date" data-timestamp={item.published_at || item.created_at}>
											{formatDate(item.published_at || item.created_at)}
										</span>
									</li>
								);
							})}
						</ul>
					</div>
				</aside>

				<main class="flex-1 max-w-3xl min-w-0">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<StatusLabel status={ann.status} />
						{ann.is_deleted && <span class="text-[11px] font-bold  tracking-wider text-red-600 dark:text-red-400">Deleted</span>}
						<span class="text-[11px] font-bold  tracking-wider text-gray-400 dark:text-neutral-500 local-date" data-timestamp={ann.published_at || ann.created_at} data-format="datetime">
							{formatDate(ann.published_at || ann.created_at)}
						</span>
					</div>

					<h1 class="mt-1 text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">{ann.title}</h1>

					<div class="mt-2">
						<AudienceChips targets={targets} labelFor={labelFor} />
					</div>

					<p class="mt-2 text-gray-700 dark:text-neutral-300 leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
						<span>From</span>
						<span>{authorName(ann)}</span>
						<span class="local-date" data-timestamp={ann.published_at || ann.created_at} data-format="datetime">
							&middot; {formatDate(ann.published_at || ann.created_at)}
						</span>
					</p>

					<hr class="border-gray-200 dark:border-neutral-800 my-4" />

					<div class="text-gray-700 dark:text-neutral-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.content) }} />

					<hr class="border-gray-200 dark:border-neutral-800 my-4" />

					{/* The "additional needs" note: author and reviewers only. */}
					{(isAuthor || isReviewer) && ann.private_note && (
						<section class="mb-4">
							<h2 class="text-1xl font-bold mt-4 mb-1">Additional needs</h2>
							<p class="text-gray-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">{ann.private_note}</p>
						</section>
					)}

					{/* Rejection feedback belongs to the proposer alone, and only while it is rejected. */}
					{isAuthor && ann.status === 'rejected' && ann.review_feedback && (
						<section class="mb-4">
							<h2 class="text-1xl font-bold mt-4 mb-1 text-red-600 dark:text-red-400">Reviewer feedback</h2>
							<p class="text-gray-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">{ann.review_feedback}</p>
							{ann.reviewed_at && (
								<p class="text-xs text-gray-400 dark:text-neutral-500 mt-1 local-date" data-timestamp={ann.reviewed_at}>
									{formatDate(ann.reviewed_at)} &middot; {ann.reviewer_first_name ? `${ann.reviewer_first_name} ${ann.reviewer_last_name}` : 'Unknown'}
								</p>
							)}
						</section>
					)}

					{isReviewer && ann.status === 'pending' && !ann.is_deleted && (
						<section class="mb-4">
							<h2 class="text-1xl font-bold mt-4 mb-1">Review this proposal</h2>
							<p class="text-sm text-gray-500 dark:text-neutral-400 mb-3">
								Feedback is optional. It is shown to the proposer if you reject, and they can then edit and resubmit.
							</p>
							<form action={`/announcements/${ann.id}/review`} method="post">
								<textarea
									name="feedback"
									rows={4}
									maxLength={NOTE_MAX}
									class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
									placeholder="Optional. Why it was rejected, and what would make it approvable..."
								></textarea>
								<div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
									<button
										type="submit"
										name="action"
										value="reject"
										class="text-sm font-bold text-red-600 dark:text-red-400 hover:underline transition-colors"
									>
										Reject
									</button>
									<span class="text-gray-300 dark:text-neutral-700">|</span>
									<button
										type="submit"
										name="action"
										value="accept"
										class="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline transition-colors"
									>
										Accept &amp; publish
									</button>
								</div>
							</form>
						</section>
					)}

				{(canEdit || canDelete) && (
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
						{canEdit && (
							<a href={`/announcements/${ann.id}/edit`} class="text-gray-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">
								Edit &amp; resubmit
							</a>
						)}
						{canEdit && canDelete && <span class="text-gray-300 dark:text-neutral-700">|</span>}
						{canDelete && (
							<form action={`/announcements/${ann.id}/delete`} method="post" class="inline">
								<button
									type="submit"
									class="text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors"
									onclick="return confirm('Delete this announcement?')"
								>
									Delete
								</button>
							</form>
						)}
					</div>
				)}
				</main>
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
