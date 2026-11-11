// Timetable themes: palettes, the shared stylesheet and the boot script that applies them.
//
// A theme is a class on <html> (`night`, `paper`, ...) plus `tt`; `dark` picks its dark palette.
// Palettes become CSS variables, so the utility-class mapping below is written once for every theme.
// The CSS is built with String.raw on purpose: hono's `html` helper uses cooked template strings,
// which turns `.dark\:bg-neutral-800` into the invalid selector `.dark:bg-neutral-800`.

type Palette = {
	/** Page background: a colour or a full `background` value. */
	bg: string;
	/** Flat r,g,b of the page background, for veils and ring offsets. */
	bgRgb: string;
	nav: string;
	/** Card surface as r,g,b; `sa` is its alpha. */
	surfaceRgb: string;
	sa?: number;
	/** Solid background for popovers, tooltips and modals. */
	pop: string;
	line: string;
	text: string;
	text2: string;
	muted: string;
	accent: string;
	accentHover: string;
	/** Filled buttons; defaults to the accent. */
	solid?: string;
	solidHover?: string;
	solidInk: string;
	/** Links and the blue/indigo family. */
	accent2: string;
	shadowSm: string;
	shadowLg: string;
	extra?: Record<string, string>;
};

type Theme = { id: string; label: string; filled?: boolean; light: Palette; dark: Palette };

const wave = (stroke: string) =>
	`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 25 30 30 T60 30' fill='none' stroke='%23${stroke}' stroke-width='0.5'/%3E%3Cpath d='M0 40 Q15 35 30 40 T60 40' fill='none' stroke='%23${stroke}' stroke-width='0.5'/%3E%3C/svg%3E")`;

const grid = (line: string, base: string) =>
	`linear-gradient(${line} 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,${line} 1px,transparent 1px) 0 0/24px 24px,${base}`;

export const THEMES: Theme[] = [
	{
		id: 'night',
		label: 'Night',
		light: {
			bg: '#F3F1FA', bgRgb: '243,241,250', nav: '#1E1B3A', surfaceRgb: '255,255,255', pop: '#FFFFFF', line: '#DDD8EE',
			text: '#1E1B3A', text2: '#3B3760', muted: '#6E6A91', accent: '#7C3AED', accentHover: '#6D28D9', solidInk: '#FFFFFF', accent2: '#5B4FCF',
			shadowSm: '0 1px 2px rgba(30,27,58,.08)', shadowLg: '0 12px 28px rgba(30,27,58,.16)',
			extra: { '--t-timer-grad': 'linear-gradient(90deg,#0284C7,#7C3AED)', '--t-wave': wave('DDD8EE') },
		},
		dark: {
			bg: '#0A0E17', bgRgb: '10,14,23', nav: '#0A0E17', surfaceRgb: '17,24,39', pop: '#111827', line: '#1E293B',
			text: '#FFFFFF', text2: '#E2E8F0', muted: '#94A3B8', accent: '#A855F7', accentHover: '#9333EA', solidInk: '#FFFFFF', accent2: '#C4B5FD',
			shadowSm: '0 1px 2px rgba(0,0,0,.3)', shadowLg: '0 20px 25px -5px rgba(0,0,0,.5)',
			extra: { '--t-timer-grad': 'linear-gradient(90deg,#7DD3FC,#A855F7)', '--t-wave': wave('1E293B') },
		},
	},
	{
		id: 'paper',
		label: 'Paper',
		light: {
			bg: '#F5F5F0', bgRgb: '245,245,240', nav: '#F5F5F0', surfaceRgb: '245,245,240', sa: 0, pop: '#F5F5F0', line: '#B5AEA5',
			text: '#3D3535', text2: '#5A5050', muted: '#8A8078', accent: '#B8452F', accentHover: '#9C3823',
			solid: '#4A6278', solidHover: '#3D5060', solidInk: '#F5F5F0', accent2: '#4A6278',
			shadowSm: 'none', shadowLg: '2px 2px 0 rgba(61,53,53,.1)',
		},
		dark: {
			bg: '#1F1D1A', bgRgb: '31,29,26', nav: '#1F1D1A', surfaceRgb: '31,29,26', sa: 0, pop: '#1F1D1A', line: '#5E574E',
			text: '#ECE6DA', text2: '#CFC8BA', muted: '#A0988B', accent: '#E38B75', accentHover: '#EDA391',
			solid: '#9DB9D1', solidHover: '#B4CBDE', solidInk: '#1F1D1A', accent2: '#9DB9D1',
			shadowSm: 'none', shadowLg: '2px 2px 0 rgba(0,0,0,.35)',
		},
	},
	{
		id: 'glass',
		label: 'Glass',
		light: {
			bg: 'linear-gradient(180deg,#E3EBF2,#C5D3E0)', bgRgb: '212,223,233', nav: 'rgba(44,53,67,.88)', surfaceRgb: '255,255,255', sa: 0.5,
			pop: 'rgba(244,247,250,.97)', line: 'rgba(30,41,59,.12)', text: '#1E293B', text2: '#334155', muted: '#5F6F82',
			accent: '#3F6479', accentHover: '#345568', solid: 'rgba(63,100,121,.9)', solidHover: '#3F6479', solidInk: '#FFFFFF', accent2: '#3F6479',
			shadowSm: '0 1px 2px rgba(30,41,59,.08)', shadowLg: '0 8px 32px rgba(30,41,59,.16)',
			extra: {
				'--g-panel': 'rgba(255,255,255,.55)', '--g-panel-hover': 'rgba(255,255,255,.85)', '--g-list': 'rgba(255,255,255,.3)',
				'--g-nocover': 'rgba(190,120,130,.4)', '--g-card-a': '.3',
			},
		},
		dark: {
			bg: 'linear-gradient(180deg,#2C3543,#3B4758)', bgRgb: '51,62,77', nav: 'rgba(30,36,46,.85)', surfaceRgb: '0,0,0', sa: 0.25,
			pop: 'rgba(30,36,46,.97)', line: 'rgba(255,255,255,.08)', text: '#FFFFFF', text2: '#E2E8F0', muted: '#94A3B8',
			accent: '#7FA0B0', accentHover: '#9DBAC8', solid: 'rgba(95,123,140,.3)', solidHover: 'rgba(95,123,140,.45)', solidInk: '#FFFFFF', accent2: '#7FA0B0',
			shadowSm: '0 1px 2px rgba(0,0,0,.2)', shadowLg: '0 8px 32px rgba(0,0,0,.3)',
			extra: {
				'--g-panel': 'rgba(0,0,0,.3)', '--g-panel-hover': 'rgba(0,0,0,.5)', '--g-list': 'rgba(0,0,0,.15)',
				'--g-nocover': 'rgba(137,109,115,.45)', '--g-card-a': '.35',
			},
		},
	},
	{
		id: 'blueprint',
		label: 'Blueprint',
		light: {
			bg: grid('rgba(29,95,209,.09)', '#F5F9FD'), bgRgb: '245,249,253', nav: '#12305A', surfaceRgb: '255,255,255', sa: 0.75, pop: '#FFFFFF',
			line: 'rgba(29,95,209,.38)', text: '#12305A', text2: '#27497A', muted: '#5F7BA1', accent: '#1D5FD1', accentHover: '#174DAB',
			solidInk: '#FFFFFF', accent2: '#B45309', shadowSm: 'none', shadowLg: '0 0 0 1px rgba(29,95,209,.3),0 12px 30px rgba(18,48,90,.15)',
		},
		dark: {
			bg: grid('rgba(140,190,255,.07)', '#0E2742'), bgRgb: '14,39,66', nav: '#0A1D33', surfaceRgb: '120,180,255', sa: 0.07, pop: '#0F2D4D',
			line: 'rgba(150,200,255,.32)', text: '#EAF4FF', text2: '#C8DEF5', muted: '#8DB0D6', accent: '#5CE1E6', accentHover: '#8AEBEF',
			solidInk: '#06243D', accent2: '#FFD166', shadowSm: 'none', shadowLg: '0 0 0 1px rgba(150,200,255,.32),0 12px 30px rgba(0,0,0,.4)',
		},
	},
	{
		id: 'pop',
		label: 'Pop',
		filled: true,
		light: {
			bg: '#FFF3D1', bgRgb: '255,243,209', nav: '#111111', surfaceRgb: '255,255,255', pop: '#FFFFFF', line: '#111111',
			text: '#111111', text2: '#2B2B2B', muted: '#5C5648', accent: '#F0386B', accentHover: '#D92458', solidInk: '#111111', accent2: '#2447F9',
			shadowSm: '2px 2px 0 #111111', shadowLg: '5px 5px 0 #111111',
		},
		dark: {
			bg: '#17151F', bgRgb: '23,21,31', nav: '#0E0D14', surfaceRgb: '38,35,52', pop: '#262334', line: '#F3EEDF',
			text: '#F3EEDF', text2: '#D9D3C4', muted: '#A69FB5', accent: '#FFD23F', accentHover: '#FFDF70', solidInk: '#111111', accent2: '#7DE3FF',
			shadowSm: '2px 2px 0 #F3EEDF', shadowLg: '5px 5px 0 #F3EEDF',
		},
	},
	{
		id: 'forest',
		label: 'Forest',
		light: {
			bg: '#EFEDE1', bgRgb: '239,237,225', nav: '#263A2C', surfaceRgb: '251,250,244', pop: '#FBFAF4', line: '#D8D4C0',
			text: '#26362A', text2: '#3D5142', muted: '#76826E', accent: '#3C7A55', accentHover: '#2F6344', solidInk: '#FFFFFF', accent2: '#9A6A2B',
			shadowSm: '0 1px 2px rgba(38,54,42,.07)', shadowLg: '0 14px 30px rgba(38,54,42,.16)',
			extra: { '--t-timer-bg': 'linear-gradient(135deg,#FBFAF4,#E3EAD6)' },
		},
		dark: {
			bg: '#131A15', bgRgb: '19,26,21', nav: '#0E140F', surfaceRgb: '28,38,31', pop: '#1C261F', line: '#2D3C31',
			text: '#E9E6D8', text2: '#CFCDBD', muted: '#8C9C8C', accent: '#82C795', accentHover: '#9BD6AB', solidInk: '#0F2016', accent2: '#DDB670',
			shadowSm: '0 1px 2px rgba(0,0,0,.3)', shadowLg: '0 14px 30px rgba(0,0,0,.5)',
			extra: { '--t-timer-bg': 'linear-gradient(135deg,#1C261F,#16231A)' },
		},
	},
];

export const THEME_IDS = THEMES.map((t) => t.id);

function rgbOf(hex: string): string {
	const n = parseInt(hex.slice(1), 16);
	return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

function paletteVars(p: Palette): string {
	const vars: Record<string, string> = {
		'--t-bg': p.bg,
		'--t-bg-rgb': p.bgRgb,
		'--t-nav': p.nav,
		'--t-surface-rgb': p.surfaceRgb,
		'--t-sa': String(p.sa ?? 1),
		'--t-pop': p.pop,
		'--t-line': p.line,
		'--t-text': p.text,
		'--t-text2': p.text2,
		'--t-muted': p.muted,
		'--t-accent': p.accent,
		'--t-accent-rgb': rgbOf(p.accent),
		'--t-accent-hover': p.accentHover,
		'--t-solid': p.solid ?? p.accent,
		'--t-solid-hover': p.solidHover ?? p.accentHover,
		'--t-solid-ink': p.solidInk,
		'--t-accent2': p.accent2,
		'--t-accent2-rgb': rgbOf(p.accent2),
		'--t-shadow-sm': p.shadowSm,
		'--t-shadow-lg': p.shadowLg,
		...p.extra,
	};
	return Object.entries(vars)
		.map(([k, v]) => `${k}:${v}`)
		.join(';');
}

const PALETTE_CSS = THEMES.map((t) => `html.${t.id}{${paletteVars(t.light)}}\nhtml.${t.id}.dark{${paletteVars(t.dark)}}`).join('\n');

// Shared mapping. `html.tt` = a theme is on; `html.tt-a` = the accent is themed (a theme, or a custom accent on the default look).
const SHARED_CSS = String.raw`
html:not(.tt){--t-bg-rgb:248,249,250}
html.dark:not(.tt){--t-bg-rgb:23,23,23}
html.tt{background:var(--t-bg)!important}
html.tt body[class]{background:var(--t-bg)!important;color:var(--t-text)!important}
html.tt #site-nav{background:var(--t-nav)!important}
html.tt #site-nav a:hover,html.tt #site-nav button:hover{background-color:rgba(var(--t-accent-rgb),.18)!important}
html.tt main,html.tt footer{background:transparent!important}
html.tt .bg-white,html.tt .bg-gray-50,html.tt .bg-gray-100,html.tt .dark\:bg-neutral-800,html.tt :not(body).dark\:bg-neutral-900{background-color:rgba(var(--t-surface-rgb),calc(var(--t-sa,1)*var(--t-ca,1)))!important}
html.tt .bg-gray-50\/30,html.tt .bg-gray-50\/50,html.tt .dark\:bg-neutral-900\/10,html.tt .dark\:bg-neutral-900\/20,html.tt .dark\:bg-neutral-900\/30,html.tt .dark\:bg-neutral-900\/50,html.tt .dark\:bg-neutral-950\/30,html.tt .dark\:bg-neutral-950\/50,html.tt .bg-gray-700{background-color:rgba(var(--t-surface-rgb),calc(var(--t-sa,1)*.5))!important}
html.tt .bg-gray-200,html.tt .bg-gray-300,html.tt .dark\:bg-neutral-700{background-color:var(--t-line)!important}
html.tt .bg-white.shadow-lg,html.tt .bg-white.shadow-xl,html.tt .bg-white.shadow-2xl,html.tt .bg-gray-800.shadow-xl{background-color:var(--t-pop)!important;color:var(--t-text)!important;border:1px solid var(--t-line)}
html.tt .bg-gray-800 .text-gray-300,html.tt #site-nav .bg-white a{color:var(--t-text2)!important}
html.tt .bg-background,html.tt .bg-background\/90,html.tt .dark\:bg-neutral-900\/90{background-color:rgb(var(--t-bg-rgb))!important}
html.tt .border-gray-50,html.tt .border-gray-100,html.tt .border-gray-200,html.tt .border-gray-300,html.tt .border-gray-600,html.tt .dark\:border-neutral-600,html.tt .dark\:border-neutral-700,html.tt .dark\:border-neutral-800,html.tt .dark\:border-neutral-700\/50,html.tt .dark\:border-neutral-800\/50,html.tt .divide-gray-100>:not([hidden])~:not([hidden]){border-color:var(--t-line)!important}
html.tt .text-black,html.tt .text-gray-800,html.tt .text-gray-900,html.tt .dark\:text-white,html.tt .dark\:text-neutral-100,html.tt .dark\:text-neutral-200,html.tt .dark\:text-gray-100{color:var(--t-text)!important}
html.tt .text-gray-600,html.tt .text-gray-700,html.tt .dark\:text-neutral-300,html.tt .dark\:text-gray-200,html.tt .dark\:text-gray-300,html.tt .hover\:text-gray-700:hover,html.tt .dark\:hover\:text-neutral-200:hover{color:var(--t-text2)!important}
html.tt .text-gray-400,html.tt .text-gray-500,html.tt .dark\:text-neutral-400,html.tt .dark\:text-neutral-500,html.tt .dark\:text-neutral-600{color:var(--t-muted)!important}
html.tt ::placeholder{color:var(--t-muted)!important;opacity:.65}
html.tt .shadow-sm{box-shadow:var(--t-shadow-sm)!important}
html.tt .shadow-lg,html.tt .shadow-xl,html.tt .shadow-2xl{box-shadow:var(--t-shadow-lg)!important}
html.tt .ring-gray-300{--tw-ring-color:var(--t-line)!important}
html.tt .ring-offset-2,html.tt .ring-offset-1{--tw-ring-offset-color:rgb(var(--t-bg-rgb))!important}
html.tt .bg-blue-50,html.tt .bg-blue-100,html.tt .bg-indigo-50,html.tt .bg-indigo-100,html.tt .dark\:bg-blue-900\/20,html.tt .dark\:bg-blue-900\/30,html.tt .dark\:bg-indigo-900\/20,html.tt .dark\:bg-indigo-900\/30,html.tt .hover\:bg-blue-100:hover{background-color:rgba(var(--t-accent2-rgb),.12)!important}
html.tt .text-blue-400,html.tt .text-blue-500,html.tt .text-blue-600,html.tt .text-blue-700,html.tt .text-indigo-600,html.tt .text-indigo-700,html.tt .dark\:text-blue-300,html.tt .dark\:text-blue-400,html.tt .dark\:text-indigo-300,html.tt .hover\:text-blue-600:hover,html.tt .dark\:hover\:text-blue-400:hover{color:var(--t-accent2)!important}
html.tt .border-blue-300,html.tt .border-blue-500,html.tt .dark\:border-blue-500\/40,html.tt .hover\:border-blue-300:hover,html.tt .dark\:hover\:border-blue-500\/40:hover{border-color:rgba(var(--t-accent2-rgb),.45)!important}
html.tt #daily-progress-bar{background-color:var(--t-line)!important}
html.tt #big-timer-display{border-color:var(--t-line)!important}
html.tt .period-card [data-accent-text]{white-space:nowrap}

html.tt-a .text-red-400,html.tt-a .text-red-500,html.tt-a .text-red-600,html.tt-a .text-red-700,html.tt-a .dark\:text-red-300,html.tt-a .dark\:text-red-400,html.tt-a .dark\:text-red-500,html.tt-a .hover\:text-red-500:hover,html.tt-a .hover\:text-red-600:hover,html.tt-a .hover\:text-red-700:hover,html.tt-a .dark\:hover\:text-red-300:hover,html.tt-a .dark\:hover\:text-red-400:hover{color:var(--t-accent)!important}
html.tt-a .bg-red-50,html.tt-a .bg-red-100,html.tt-a .bg-red-50\/40,html.tt-a .bg-red-50\/50,html.tt-a .dark\:bg-red-500\/10,html.tt-a .dark\:bg-red-500\/20,html.tt-a .dark\:bg-red-900\/10,html.tt-a .dark\:bg-red-900\/20,html.tt-a .dark\:bg-red-900\/30,html.tt-a .dark\:bg-red-900\/40{background-color:rgba(var(--t-accent-rgb),.13)!important}
html.tt-a .hover\:bg-red-50:hover,html.tt-a .hover\:bg-red-100:hover,html.tt-a .dark\:hover\:bg-red-500\/10:hover,html.tt-a .dark\:hover\:bg-red-500\/20:hover{background-color:rgba(var(--t-accent-rgb),.2)!important}
html.tt-a .bg-red-500,html.tt-a .bg-red-600{background-color:var(--t-solid)!important}
html.tt-a .bg-red-500.text-white,html.tt-a .bg-red-600.text-white{color:var(--t-solid-ink)!important}
html.tt-a .hover\:bg-red-600:hover,html.tt-a .hover\:bg-red-700:hover{background-color:var(--t-solid-hover)!important}
html.tt-a .border-red-500,html.tt-a .dark\:border-red-500\/40,html.tt-a .focus\:border-red-400:focus,html.tt-a .focus\:border-red-500:focus{border-color:var(--t-accent)!important}
html.tt-a input[type=range],html.tt-a .accent-red-500{accent-color:var(--t-accent)!important}
html.tt-a .ring-red-500,html.tt-a .focus\:ring-red-400:focus,html.tt-a .focus\:ring-red-500:focus{--tw-ring-color:var(--t-accent)!important}
`;

const NIGHT_CSS = String.raw`
html.night #big-timer-display{background:var(--t-wave) 0 0/60px 60px,rgba(var(--t-surface-rgb),calc(.55*var(--t-ca,1)))!important}
html.night #big-timer-display #bt-timer.night-gradient{background:var(--t-timer-grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
html.night .period-card>.absolute.left-0{width:4px!important;border-radius:0!important}
html.night .period-card>.absolute.left-0::before{content:'';position:absolute;top:50%;left:-3px;width:8px;height:8px;border-radius:50%;background:inherit;transform:translateY(-50%)}
html.night .period-card [data-accent-text]{color:color-mix(in srgb,var(--strip-color) 55%,var(--t-text))!important}
html.night.dark .period-card [data-accent-text]{color:var(--strip-color)!important}
`;

const PAPER_CSS = String.raw`
html.paper,html.paper body[class]{font-family:'Courier New',Courier,monospace!important}
html.paper #site-nav{border-bottom:2px solid var(--t-text)!important;box-shadow:none!important}
html.paper #site-nav a,html.paper #site-nav button,html.paper #site-nav .text-white,html.paper #site-nav .text-gray-300{color:var(--t-text)!important}
html.paper #site-nav a:hover,html.paper #site-nav button:hover{background:rgba(var(--t-accent2-rgb),.1)!important}
html.paper #app-container{border:2px solid var(--t-text)!important;border-radius:255px 15px 225px 15px/15px 225px 15px 255px!important;padding:2rem 1.5rem!important;background:rgba(var(--t-bg-rgb),var(--t-ca,1))!important}
html.paper #big-timer-display{background:transparent!important;border:2px solid var(--t-text)!important;border-radius:255px 15px 225px 15px/15px 225px 15px 255px!important}
html.paper #big-timer-display>.absolute{display:none!important}
html.paper #bt-timer{color:var(--t-accent2)!important}
html.paper #bt-label{color:var(--t-muted)!important;text-transform:lowercase!important;font-variant:small-caps!important}
html.paper #tt-tabs{border-bottom:2px solid var(--t-text)!important}
html.paper #tt-tabs svg{display:none!important}
html.paper #tt-tabs button{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem!important}
html.paper #btn-prev,html.paper #btn-next{width:auto!important;padding:0 .4rem!important;border-color:var(--t-accent2)!important}
html.paper #btn-prev::before{content:'[ PREV ]'}
html.paper #btn-next::before{content:'[ NEXT ]'}
html.paper #btn-prev::before,html.paper #btn-next::before{font-weight:700;font-size:.7rem;color:var(--t-accent2);letter-spacing:.05em;white-space:nowrap}
html.paper #btn-prev svg,html.paper #btn-next svg{display:none!important}
html.paper #btn-reset{border-color:var(--t-accent2)!important;color:var(--t-accent2)!important}
html.paper .period-card{border:1px solid var(--t-line)!important;border-left:4px solid var(--t-text)!important;border-radius:4px!important;box-shadow:1px 1px 0 rgba(0,0,0,.08)!important;background:rgba(var(--t-bg-rgb),var(--t-ca,1))!important}
html.paper .period-card:hover{box-shadow:2px 2px 0 rgba(0,0,0,.14)!important}
html.paper .period-card>.absolute.left-0{width:4px!important;border-radius:0!important}
html.paper .period-card>.absolute.left-0::before{content:'';position:absolute;top:50%;left:-3px;width:8px;height:8px;border-radius:50%;background:inherit;transform:translateY(-50%)}
html.paper .period-card.ring-2{border:2px solid var(--t-accent2)!important;box-shadow:2px 2px 0 rgba(var(--t-accent2-rgb),.2)!important;--tw-ring-color:transparent!important;--tw-ring-offset-width:0px!important}
html.paper .fixed.bg-black\/60{background:rgba(var(--t-bg-rgb),.9)!important}
html.paper .bg-white.shadow-2xl,html.paper .bg-white.shadow-xl,html.paper .bg-white.shadow-lg,html.paper .bg-gray-800.shadow-xl{border:2px solid var(--t-text)!important;border-radius:4px!important}
html.paper .sticky.top-0{background:rgb(var(--t-bg-rgb))!important}
html.paper .animate-pulse{animation:none!important}
`;

const GLASS_SURFACES = ['.bg-white', '.bg-gray-50', '.bg-gray-100', '.dark\\:bg-neutral-800', ':not(body).dark\\:bg-neutral-900'].map((s) => `html.glass ${s}`).join(',');

const GLASS_CSS =
	`\n${GLASS_SURFACES}{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}` +
	String.raw`
html.glass #site-nav{backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 1px 0 rgba(255,255,255,.06)!important}
html.glass #site-nav a:hover,html.glass #site-nav button:hover{background:rgba(255,255,255,.08)!important}
html.glass footer{background:var(--g-list)!important;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
html.glass #big-timer-display{background:var(--g-panel)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--t-line)!important;border-radius:1rem!important}
html.glass #big-timer-display>.absolute{display:none!important}
html.glass #bt-label{color:var(--t-muted)!important;text-transform:none!important}
html.glass #daily-progress-bar{background-color:rgba(var(--t-accent-rgb),.3)!important}
html.glass #tt-tabs svg{display:none!important}
html.glass #tt-tabs button{font-size:.75rem!important;letter-spacing:.06em!important;font-weight:400!important}
html.glass #tt-tabs button.border-red-500{font-weight:600!important;color:var(--t-text)!important}
html.glass #btn-prev svg,html.glass #btn-next svg{display:none!important}
html.glass #btn-prev,html.glass #btn-next,html.glass #btn-reset{background:var(--g-panel)!important;border:1px solid var(--t-line)!important;color:var(--t-muted)!important;border-radius:9999px!important}
html.glass #btn-prev,html.glass #btn-next{width:auto!important;min-width:4rem!important;padding:0 .75rem!important}
html.glass #btn-prev::before{content:'\276E  PREV'}
html.glass #btn-next::before{content:'NEXT  \276F'}
html.glass #btn-prev::before,html.glass #btn-next::before{font-weight:600;font-size:.7rem;letter-spacing:.06em;white-space:nowrap}
html.glass #btn-prev:hover,html.glass #btn-next:hover,html.glass #btn-reset:hover{background:var(--g-panel-hover)!important}
html.glass #timetable-list{background:var(--g-list);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-radius:1rem;padding:.5rem;border:1px solid var(--t-line)}
html.glass .period-card{background:rgba(var(--strip-rgb,95,123,140),calc(var(--g-card-a)*var(--t-ca,1)))!important;border:none!important;border-radius:.75rem!important;padding:.6rem .8rem!important;box-shadow:0 2px 8px rgba(0,0,0,.12)!important;transition:all .15s ease!important}
html.glass .period-card.tt-nocover{background:var(--g-nocover)!important}
html.glass .period-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.2)!important;transform:translateY(-1px)}
html.glass .period-card>.absolute.left-0{display:none!important}
html.glass .period-card>div:not(.tooltip-content),html.glass .period-card>div:not(.tooltip-content) span:not(.rounded){color:var(--t-text)!important}
html.glass .period-card>.pl-3.flex.items-center.gap-4{justify-content:flex-end;flex-shrink:0}
html.glass .period-card.ring-2{box-shadow:0 0 0 2px rgba(var(--t-accent-rgb),.55),0 4px 20px rgba(var(--t-accent-rgb),.2)!important;--tw-ring-color:transparent!important;--tw-ring-offset-width:0px!important}
html.glass .fixed.bg-black\/60{background:rgba(30,36,46,.6)!important;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
html.glass .bg-white.shadow-2xl,html.glass .bg-white.shadow-xl,html.glass .bg-white.shadow-lg,html.glass .bg-gray-800.shadow-xl{border-radius:1rem!important;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
html.glass .sticky.top-0{background:var(--g-panel)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
html.glass .animate-pulse{animation:none!important}
`;

const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;

const BLUEPRINT_CSS =
	`\nhtml.blueprint #tt-tabs button,html.blueprint #bt-timer,html.blueprint #bt-label,html.blueprint #date-display,html.blueprint #btn-reset,html.blueprint #timetable-list .w-24{font-family:${MONO}!important}` +
	String.raw`
html.blueprint #app-container .rounded-md,html.blueprint #app-container .rounded-lg,html.blueprint #app-container .rounded-xl,html.blueprint #app-container .rounded-2xl,html.blueprint #app-container .rounded-l-lg{border-radius:2px!important}
html.blueprint #tt-tabs{border-bottom:1px dashed var(--t-line)!important}
html.blueprint #tt-tabs button{text-transform:uppercase;letter-spacing:.1em;font-size:.68rem!important}
html.blueprint #big-timer-display{background:rgba(var(--t-surface-rgb),calc(var(--t-sa)*var(--t-ca,1)))!important;border:1px dashed var(--t-line)!important}
html.blueprint #big-timer-display>.absolute{display:none!important}
html.blueprint #big-timer-display::before,html.blueprint #big-timer-display::after{content:'';position:absolute;width:10px;height:10px;border:2px solid var(--t-accent);pointer-events:none}
html.blueprint #big-timer-display::before{top:6px;left:6px;border-right:0;border-bottom:0}
html.blueprint #big-timer-display::after{bottom:6px;right:6px;border-left:0;border-top:0}
html.blueprint #bt-timer{color:var(--t-accent)!important;font-weight:500!important}
html.blueprint #bt-label{color:var(--t-muted)!important;letter-spacing:.14em}
html.blueprint #btn-prev,html.blueprint #btn-next,html.blueprint #btn-reset{text-transform:uppercase;letter-spacing:.08em}
html.blueprint .period-card{border:1px solid var(--t-line)!important;box-shadow:none!important}
html.blueprint .period-card:hover{border-color:var(--t-accent)!important}
html.blueprint .period-card>.absolute.left-0{width:3px!important;border-radius:0!important}
html.blueprint .period-card.border-l-4{border-left-width:3px!important;border-left-color:var(--strip-color,var(--t-accent2))!important}
html.blueprint .period-card [data-accent-text]{letter-spacing:.02em}
html.blueprint .fixed.bg-black\/60{background:rgba(var(--t-bg-rgb),.8)!important}
`;

const POP_CSS = String.raw`
html.pop #tt-tabs{border-bottom:0!important;gap:.35rem;padding-bottom:4px}
html.pop #tt-tabs button{font-weight:800!important;border:2px solid transparent!important;border-radius:9999px!important;padding:.3rem .75rem!important}
html.pop #tt-tabs button.border-red-500{background:var(--t-accent)!important;color:var(--t-solid-ink)!important;border-color:var(--t-line)!important;box-shadow:2px 2px 0 var(--t-line)}
html.pop #big-timer-display{background:var(--t-accent)!important;border:2px solid var(--t-line)!important;border-radius:14px!important;box-shadow:5px 5px 0 var(--t-line)}
html.pop #big-timer-display>.absolute{display:none!important}
html.pop #big-timer-display h2,html.pop #bt-subject,html.pop #bt-details,html.pop #bt-details>span.font-bold,html.pop #bt-timer,html.pop #bt-label{color:var(--t-solid-ink)!important}
html.pop #bt-details .rounded-full,html.pop #bt-details .rounded{background:var(--t-pop)!important;border:1.5px solid #111111}
html.pop #bt-timer{font-weight:800!important}
html.pop #btn-prev,html.pop #btn-next,html.pop #btn-reset,html.pop #date-display{font-weight:700!important}
html.pop #btn-prev,html.pop #btn-next,html.pop #btn-reset{background:rgb(var(--t-surface-rgb))!important;color:var(--t-text)!important;border:2px solid var(--t-line)!important;box-shadow:2px 2px 0 var(--t-line)}
html.pop #btn-prev:hover,html.pop #btn-next:hover,html.pop #btn-reset:hover{background:var(--t-accent)!important;color:var(--t-solid-ink)!important}
html.pop #content>div>.flex-grow.border{border:2px solid var(--t-line)!important}
html.pop .period-card{background:var(--strip-color,rgb(var(--t-surface-rgb)))!important;color:var(--strip-ink,var(--t-text))!important;border:2px solid var(--t-line)!important;border-radius:10px!important;box-shadow:3px 3px 0 var(--t-line)!important;font-weight:700}
html.pop .period-card:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--t-line)!important}
html.pop .period-card>.absolute.left-0{display:none!important}
html.pop .period-card>div:not(.tooltip-content),html.pop .period-card>div:not(.tooltip-content) span:not(.rounded){color:inherit!important}
html.pop .period-card>div:not(.tooltip-content) span.rounded{background:var(--t-pop)!important;color:var(--t-text)!important;border:1.5px solid #111111}
html.pop .period-card.tt-nocover{background:repeating-linear-gradient(135deg,var(--t-pop),var(--t-pop) 8px,rgba(var(--t-accent-rgb),.35) 8px,rgba(var(--t-accent-rgb),.35) 16px)!important;color:var(--t-text)!important}
html.pop .period-card.ring-2{--tw-ring-color:var(--t-accent2)!important}
html.pop .bg-white.shadow-2xl,html.pop .bg-white.shadow-xl,html.pop .bg-white.shadow-lg,html.pop .bg-gray-800.shadow-xl{border:2px solid var(--t-line)!important}
html.pop .bg-red-500.text-white,html.pop .bg-red-600.text-white{border:2px solid var(--t-line)!important;font-weight:700}
html.pop .fixed.bg-black\/60{background:rgba(var(--t-bg-rgb),.85)!important}
`;

const FOREST_CSS = String.raw`
html.forest,html.forest body[class]{font-family:'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif!important}
html.forest #bt-timer{font-family:'Inter',sans-serif;font-variant-numeric:tabular-nums;font-weight:600!important;color:var(--t-accent)!important}
html.forest #big-timer-display{background:var(--t-timer-bg)!important;border-radius:20px!important}
html.forest #big-timer-display>.absolute{display:none!important}
html.forest #bt-label{color:var(--t-muted)!important;letter-spacing:.12em}
html.forest #tt-tabs button{font-size:.85rem!important}
html.forest #btn-prev,html.forest #btn-next,html.forest #btn-reset,html.forest #content>div>.flex-grow.border{border-radius:9999px!important}
html.forest .period-card{border:1px solid var(--t-line)!important;border-radius:14px!important;padding:.7rem .8rem .7rem 1.1rem!important}
html.forest .period-card>.absolute.left-0{top:9px!important;bottom:9px!important;left:8px!important;width:4px!important;border-radius:4px!important}
html.forest .period-card.border-l-4{border-left:1px solid var(--t-line)!important;background:rgba(var(--strip-rgb,60,122,85),.1)!important}
html.forest .period-card.border-l-4::before{content:'';position:absolute;top:9px;bottom:9px;left:8px;width:4px;border-radius:4px;background:var(--strip-color,var(--t-accent))}
html.forest .fixed.bg-black\/60{background:rgba(var(--t-bg-rgb),.75)!important}
`;

// Custom background, card opacity and font. Kept last so they win over a theme at equal specificity.
const CUSTOM_CSS = String.raw`
html.tt-bg{background:var(--tt-bg-color)!important}
html.tt-bg body[class]{background:var(--tt-bg-color)!important}
html.tt-bg-img body[class]{background:transparent!important}
html.tt-bg main,html.tt-bg footer,html.tt-bg-img main,html.tt-bg-img footer{background:transparent!important}
html.tt-bg-img body::before{content:'';position:fixed;inset:-24px;z-index:-2;background:var(--tt-bg-image) center/cover no-repeat;filter:blur(var(--tt-bg-blur,0px))}
html.tt-bg-img body::after{content:'';position:fixed;inset:0;z-index:-1;background:rgba(var(--t-bg-rgb),var(--tt-bg-dim,.55))}
html.tt-bg .sticky.top-0{background:var(--tt-bg-color)!important}
html.tt-bg-img .sticky.top-0{background:rgba(var(--t-bg-rgb),.6)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
html.tt-bg .ring-offset-2,html.tt-bg-img .ring-offset-2{--tw-ring-offset-width:0px!important}
html.tt-cards #app-container{--t-ca:var(--tt-card-alpha,1)}
html.tt-cards:not(.tt) #app-container :is(.bg-white,.bg-gray-50,.bg-gray-100,.dark\:bg-neutral-800,.dark\:bg-neutral-900):not(.shadow-2xl):not(.shadow-xl){--tw-bg-opacity:var(--tt-card-alpha,1)!important}
html.tt-cards.tt-bg-img #content .period-card,html.tt-cards.tt-bg-img #big-timer-display{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
html.tt-font,html.tt-font body[class]{font-family:var(--tt-font)!important}
`;

export const THEME_CSS = [PALETTE_CSS, SHARED_CSS, NIGHT_CSS, PAPER_CSS, GLASS_CSS, BLUEPRINT_CSS, POP_CSS, FOREST_CSS, CUSTOM_CSS].join('\n');

/** What the settings tiles need to draw a miniature of each theme. */
export const THEME_PREVIEWS = [
	{
		id: 'system',
		label: 'Classic',
		filled: false,
		light: { bg: '#F8F9FA', card: '#F3F4F6', line: '#E5E7EB', text: '#111827', accent: '#EF4444' },
		dark: { bg: '#171717', card: '#262626', line: '#404040', text: '#FFFFFF', accent: '#EF4444' },
	},
	...THEMES.map((t) => {
		const mini = (p: Palette) => ({ bg: p.bg, card: `rgba(${p.surfaceRgb},${p.sa ?? 1})`, line: p.line, text: p.text, accent: p.accent });
		return { id: t.id, label: t.label, filled: !!t.filled, light: mini(t.light), dark: mini(t.dark) };
	}),
];

// Runs in <head> before first paint, and again whenever a setting changes (window.__ttAppearance.apply()).
// Storage: `timetableTheme` (theme id), `theme` (light|dark), `timetableAppearance` (JSON: accent, bg, cardOpacity, font)
// and `timetableBgImage` (data: or https: URL).
export const THEME_BOOT_JS = String.raw`
(function () {
    var THEMES = __THEME_IDS__;
    var FONTS = {
        sans: "'Inter',system-ui,sans-serif",
        serif: "'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif",
        mono: "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace",
        rounded: "ui-rounded,'SF Pro Rounded','Nunito','Varela Round',system-ui,sans-serif"
    };
    var ACCENT_VARS = ['--t-accent', '--t-accent-rgb', '--t-accent-hover', '--t-solid', '--t-solid-hover', '--t-solid-ink'];

    function read() {
        try {
            var a = JSON.parse(localStorage.getItem('timetableAppearance') || '{}');
            return a && typeof a === 'object' ? a : {};
        } catch (e) { return {}; }
    }
    function rgb(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return null;
        var n = parseInt(m[1], 16);
        return [n >> 16, (n >> 8) & 255, n & 255];
    }
    function hex(c) {
        return '#' + c.map(function (v) { return ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join('');
    }
    // Perceived brightness, 0 (black) to 255 (white).
    function brightness(c) { return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000; }
    function imageUrl() {
        var v = localStorage.getItem('timetableBgImage') || '';
        return /^(data:image\/|https:\/\/)/i.test(v) && !/["\\\n\r]/.test(v) ? v : '';
    }
    function set(st, name, value) {
        if (value === null || value === undefined || value === '') st.removeProperty(name);
        else st.setProperty(name, value);
    }

    function apply() {
        var root = document.documentElement, cl = root.classList, st = root.style;
        var theme = localStorage.getItem('timetableTheme');
        if (THEMES.indexOf(theme) < 0) theme = null;
        // Night and Glass used to be dark-only, so they default to dark when no mode was ever saved.
        var mode = localStorage.getItem('theme') || (theme === 'night' || theme === 'glass' ? 'dark' : 'light');
        THEMES.forEach(function (t) { cl.toggle(t, t === theme); });
        cl.toggle('tt', !!theme);
        cl.toggle('dark', mode === 'dark');

        var a = read();
        var acc = rgb(a.accent);
        cl.toggle('tt-a', !!theme || !!acc);
        if (acc) {
            var bright = brightness(acc) > 150;
            var hover = hex(acc.map(function (v) { return bright ? v * 0.88 : v + (255 - v) * 0.16; }));
            set(st, '--t-accent', hex(acc));
            set(st, '--t-accent-rgb', acc.join(','));
            set(st, '--t-accent-hover', hover);
            set(st, '--t-solid', hex(acc));
            set(st, '--t-solid-hover', hover);
            set(st, '--t-solid-ink', bright ? '#111111' : '#ffffff');
        } else {
            ACCENT_VARS.forEach(function (v) { st.removeProperty(v); });
        }

        var bg = a.bg && typeof a.bg === 'object' ? a.bg : {};
        var here = bg.scope === 'site' || location.pathname === '/timetable';
        var col = here && bg.type === 'color' ? rgb(bg.color) : null;
        var img = here && bg.type === 'image' ? imageUrl() : '';
        var dim = Number(bg.dim), blur = Number(bg.blur);
        cl.toggle('tt-bg', !!col);
        cl.toggle('tt-bg-img', !!img);
        set(st, '--tt-bg-color', col ? hex(col) : null);
        set(st, '--tt-bg-image', img ? 'url("' + img + '")' : null);
        set(st, '--tt-bg-dim', img ? String((isFinite(dim) ? Math.max(0, Math.min(95, dim)) : 55) / 100) : null);
        set(st, '--tt-bg-blur', img ? (isFinite(blur) ? Math.max(0, Math.min(30, blur)) : 0) + 'px' : null);

        var ca = Number(a.cardOpacity);
        var cards = isFinite(ca) && ca >= 10 && ca < 100;
        cl.toggle('tt-cards', cards);
        set(st, '--tt-card-alpha', cards ? String(ca / 100) : null);

        var font = FONTS[a.font];
        cl.toggle('tt-font', !!font);
        set(st, '--tt-font', font || null);
        if (a.font === 'rounded' && !document.getElementById('tt-font-rounded')) {
            var link = document.createElement('link');
            link.id = 'tt-font-rounded';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap';
            document.head.appendChild(link);
        }
    }

    window.__ttAppearance = { apply: apply, read: read, rgb: rgb, brightness: brightness, image: imageUrl, themes: THEMES };
    apply();
})();
`.replace('__THEME_IDS__', JSON.stringify(THEME_IDS));
