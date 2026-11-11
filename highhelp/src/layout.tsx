import { html, raw } from 'hono/html'
import { THEME_BOOT_JS, THEME_CSS } from './themes'
import { isExternalUser } from './utils'
import { canReviewAnnouncements } from './permissions'

// Recursively checks the hono/jsx node graph for a <pdf-crop> element.
// props.children is a JSX node (or array of nodes), never a string, so a
// `typeof === 'string'` check here always fails and the script never loads.
const containsPdfCrop = (node: any): boolean => {
	if (node == null || typeof node !== 'object') return false;
	if (Array.isArray(node)) return node.some(containsPdfCrop);
	if (node.tag === 'pdf-crop') return true;
	const kids = node.children ?? node.props?.children;
	return kids ? containsPdfCrop(kids) : false;
};

export const Layout = (props: { title: string; children: any; user?: any; hideFooter?: boolean; latex?: boolean; noScroll?: boolean; pdfCrop?: boolean; drawing?: boolean }) => {
	const needsPdfCrop = props.pdfCrop ?? containsPdfCrop(props.children);

	// Timetable, Attendance and Points are all fed by the student portal. Accounts that
	// signed in with a login code ("External" tag) have no portal data, so their tabs are
	// greyed out rather than hidden — the label stays visible, the link goes away.
	const external = isExternalUser(props.user);
	const disabledTitle = 'Not available for your account';
	const desktopTab = (href: string, label: string) => external
		? html`<span class="px-2 lg:px-3 py-2 text-sm font-medium whitespace-nowrap text-white/30 cursor-not-allowed select-none" title="${disabledTitle}" aria-disabled="true">${label}</span>`
		: html`<a href="${href}" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">${label}</a>`;
	const mobileTab = (href: string, label: string) => external
		? html`<span class="block px-4 py-2.5 text-base font-medium whitespace-nowrap text-gray-100/30 cursor-not-allowed select-none" title="${disabledTitle}" aria-disabled="true">${label}</span>`
		: html`<a href="${href}" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">${label}</a>`;

	// Announcements carries a red dot when there is something new waiting on that tab: either a
	// published announcement in the user's audience they have not seen yet, or -- for reviewers
	// only -- a proposal sitting in the queue. getUser counts both, so the dot costs no extra
	// work here and appears on every page.
	const unread = Number((props.user as any)?.unread_announcements || 0);
	const pending = props.user && canReviewAnnouncements(props.user) ? Number((props.user as any)?.pending_announcements || 0) : 0;
	const announcementsDot = (reason: string) => html`<span class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#4E342E] dark:ring-neutral-950" title="${reason}"></span>`;
	const announcementsReason = unread > 0 ? (unread === 1 ? '1 unread announcement' : `${unread} unread announcements`) : pending > 0 ? (pending === 1 ? '1 announcement waiting for review' : `${pending} announcements waiting for review`) : '';
	const dot = announcementsReason ? announcementsDot(announcementsReason) : '';
	// A top-level tab that can carry one of those dots.
	const dottedTab = (href: string, label: string, tabDot: unknown) => html`<a href="${href}" class="relative inline-flex items-center hover:bg-[#633200] dark:hover:bg-neutral-800 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">${label}${tabDot}</a>`;
	const mobileDottedTab = (href: string, label: string, tabDot: unknown) => html`<a href="${href}" class="relative flex items-center gap-2 text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">${label}${tabDot}</a>`;

	// Q&A gets the same dot for questions in the user's subjects, posted by someone else since they
	// last opened the Q&A feed (see forumRelevance.ts). It is a top-level tab so the dot is visible.
	const unreadQuestions = Number((props.user as any)?.unread_questions || 0);
	const questionsReason = unreadQuestions > 0 ? (unreadQuestions === 1 ? '1 new question in your subjects' : `${unreadQuestions} new questions in your subjects`) : '';
	const qaDot = questionsReason ? announcementsDot(questionsReason) : '';

	// Tabs after Timetable / Resources / Past Papers fold into the More menu one at a time, from the
	// right, as the desktop bar runs out of room. Each is rendered twice from groupedTabs below --
	// flat in .nav-flat and as a menu item -- and the script after </nav> decides how many fit.
	const menuItemClass = 'block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700';
	const menuDot = (reason: string) => reason ? html`<span class="inline-block ml-1.5 w-2 h-2 rounded-full bg-red-500 align-middle" title="${reason}"></span>` : '';
	const menuTab = (href: string, label: string, reason = '') => html`<a href="${href}" class="${menuItemClass}">${label}${menuDot(reason)}</a>`;
	// Portal-backed tabs keep the External greying inside the menu too.
	const menuPortalTab = (href: string, label: string) => external
		? html`<span class="block px-4 py-2 text-sm text-gray-400/60 dark:text-neutral-500/60 cursor-not-allowed select-none" title="${disabledTitle}" aria-disabled="true">${label}</span>`
		: menuTab(href, label);
	const linkTab = (href: string, label: string) => html`<a href="${href}" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">${label}</a>`;

	// In bar order; the last one folds first.
	const groupedTabs = [
		{ flat: dottedTab('/announcements', 'Announcements', dot), menu: menuTab('/announcements', 'Announcements', announcementsReason), reason: announcementsReason },
		{ flat: desktopTab('/attendance', 'Attendance'), menu: menuPortalTab('/attendance', 'Attendance'), reason: '' },
		{ flat: linkTab('/leaderboard', 'Leaderboard'), menu: menuTab('/leaderboard', 'Leaderboard'), reason: '' },
		{ flat: linkTab('/atar', 'ATAR'), menu: menuTab('/atar', 'ATAR'), reason: '' },
		{ flat: dottedTab('/forum', 'Q&A', qaDot), menu: menuTab('/forum', 'Q&A', questionsReason), reason: questionsReason },
		{ flat: desktopTab('/points', 'Points'), menu: menuPortalTab('/points', 'Points'), reason: '' },
		{ flat: linkTab('/feedback', 'Hmmm..!'), menu: menuTab('/feedback', 'Hmmm..!'), reason: '' },
	];
	// The More button carries a dot while a tab with one is folded inside it; the script shows it.
	const foldedReason = groupedTabs.map(t => t.reason).filter(Boolean).join(', ');
	const moreDot = foldedReason ? html`<span class="nav-more-dot">${announcementsDot(foldedReason)}</span>` : '';

  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Welcome to the official website for High's Class of 2027" />
        <meta property="og:title" content="${props.title} - HighHelp" />
        <meta property="og:description" content="Welcome to the official website for High's Class of 2027" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${props.title} - HighHelp" />
        <meta name="twitter:description" content="Welcome to the official website for High's Class of 2027" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3E2723" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HighHelp" />
        <link rel="apple-touch-icon" href="/icon-2.png" />

        <title>${props.title} - HighHelp</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        
        

${props.latex ? html`
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  
  <!-- KaTeX JS -->
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  
  <!-- KaTeX Auto-Render Extension -->
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  
  <script>
    (function () {
        // KaTeX is loaded from a CDN with \`defer\`, so it is normally ready by DOMContentLoaded.
        // Elements added later (e.g. "Load 50 more" rows) are typeset on demand through
        // window.__highhelpRenderMath, which queues them if the CDN is still in flight.
        var options = {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\\\(', right: '\\\\)', display: false},
                {left: '\\\\[', right: '\\\\]', display: true}
            ],
            throwOnError: false
        };
        var pending = [];
        var attempts = 0;

        function drain() {
            if (!window.renderMathInElement || !pending.length) return;
            var queued = pending.splice(0, pending.length);
            queued.forEach(function (node) {
                if (node && node.isConnected) window.renderMathInElement(node, options);
            });
        }

        window.__highhelpRenderMath = function (node) {
            if (!node) return;
            if (window.renderMathInElement) {
                window.renderMathInElement(node, options);
            } else {
                pending.push(node);
            }
        };

        window.addEventListener('load', drain);
        var timer = setInterval(function () {
            drain();
            if (window.renderMathInElement || ++attempts > 40) clearInterval(timer);
        }, 250);

        document.addEventListener('DOMContentLoaded', function () {
            window.__highhelpRenderMath(document.body);
        });
    })();
  </script>
` : ''}
        <script>
            // Theme, mode and appearance settings: applied before first paint to avoid a flash (src/themes.ts).
            ${raw(THEME_BOOT_JS)}

            tailwind.config = {
                darkMode: 'class',
                theme: {
                  extend: {
                    colors: {
                      primary: '#3E2723', // Deep Brown
                      secondary: '#3E2723', 
                      background: '#F8F9FA',
                      'brown-800': '#3E2723',
                      'blue-600': '#1E88E5',
                    },
                  },
                },
              }
            </script>
            <style>
                .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
                .scrollbar-hide::-webkit-scrollbar{display:none}
                html{background-color:#3E2723}
                html,body{font-family:'Inter',sans-serif}
                ${raw(THEME_CSS)}
            </style>
            ${props.noScroll ? html`<style>html,body{overflow:hidden!important;height:100%}</style>` : ''}
            ${props.drawing ? html`<script src="/drawing-editor.js" defer></script>` : ''}
          </head>
      <body class="bg-background dark:bg-neutral-900 text-gray-800 dark:text-gray-200 min-h-screen flex flex-col transition-colors duration-300">
        <nav id="site-nav" class="bg-primary dark:bg-neutral-950 text-white shadow-lg">
          <div class="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-14" data-nav-row>
              <div class="flex items-center" data-nav-left>
                <a href="/home" class="font-bold text-xl tracking-tight">HighHelp</a>
                <div class="hidden md:block">
                    <div class="ml-6 lg:ml-10 flex items-center gap-1 lg:gap-2 whitespace-nowrap">
                    ${desktopTab('/timetable', 'Timetable')}
                    
                    <a href="/resources" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">Resources</a>
                    <a href="/past-papers" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap">Past Papers</a>
                    <div class="nav-flat"><div class="nav-flat-inner flex items-center gap-1 lg:gap-2">
                      ${groupedTabs.map(t => html`<div class="flex" data-nav-item data-has-dot="${t.reason ? '1' : '0'}">${t.flat}</div>`)}
                    </div></div>
                    <div class="relative" id="more-dropdown">
                      <button class="relative hover:bg-[#633200] dark:hover:bg-neutral-800 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1">
                        More
                        <svg class="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        ${moreDot}
                      </button>
                      <div class="absolute left-0 top-full pt-1 w-44 hidden z-50" id="more-menu">
                        <div class="bg-white dark:bg-neutral-800 rounded-md shadow-lg py-1 border border-gray-200 dark:border-neutral-700">
                          ${groupedTabs.map(t => html`<div data-nav-fold-item>${t.menu}</div>`)}
                          <div class="nav-fold-divider border-t border-gray-100 dark:border-neutral-700 my-1"></div>
                          <a href="/essays" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700">Essays</a>
                          <a href="/about" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700">About</a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="hidden md:block" data-nav-right>
                <div class="ml-4 flex items-center md:ml-6 text-sm font-medium gap-4">
                  <!-- Theme Toggle Button -->
                  <button id="theme-toggle" class="p-2 rounded-full hover:bg-[#633200] dark:hover:bg-neutral-800 transition-colors focus:outline-none" aria-label="Toggle dark mode">
                    <svg id="theme-toggle-dark-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                    <svg id="theme-toggle-light-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                  </button>
                  ${props.user ? html`
  <div class="flex items-center">
  <div class="relative group">
      <button class="flex items-center space-x-2 text-white hover:text-blue-100 focus:outline-none py-2">
          <span>Hello, ${props.user.first_name}</span>
          <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
      </button>

      <div class="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-50">
          
          <div class="bg-white dark:bg-neutral-800 rounded-md shadow-lg py-1 border border-gray-200 dark:border-neutral-700">
              <a href="/profile" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700">My Profile</a>
              <a href="/profile/contributions" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700">My Contributions</a>
              <div class="border-t border-gray-100 dark:border-neutral-700 my-1"></div>
              <a href="/logout" class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-neutral-700">Logout</a>
          </div>

      </div>
  </div>
  </div>
` : html`
  <div class="flex items-center">
    <a href="/login" class="bg-[#633200] hover:bg-[#b05800] px-3 py-2 rounded-md">Login</a>
  </div>
`}

                </div>
              </div>
              
              
              <div class="-mr-2 flex md:hidden">
                <button type="button" class="inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:text-white hover:bg-[#633200] focus:outline-none" aria-controls="mobile-menu" aria-expanded="false" id="mobile-menu-btn">
                   <span class="sr-only">Open main menu</span>
                  
                  <svg class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" id="menu-icon-closed">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  
                  <svg class="hidden h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" id="menu-icon-open">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>


          <div class="hidden md:hidden" id="mobile-menu">
            <div class="px-3 pt-3 pb-3 space-y-1 sm:px-4 bg-[#4E342E] dark:bg-neutral-900">
              ${mobileTab('/timetable', 'Timetable')}
              
              <a href="/resources" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">Resources</a>
              <a href="/past-papers" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">Past Papers</a>
              ${mobileDottedTab('/announcements', 'Announcements', dot)}
              ${mobileTab('/attendance', 'Attendance')}
              <a href="/leaderboard" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">Leaderboard</a>
              <a href="/atar" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">ATAR</a>
              ${mobileDottedTab('/forum', 'Q&A', qaDot)}
              ${mobileTab('/points', 'Points')}
              <a href="/feedback" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">Hmmm..!</a>
              <details class="group">
                <summary class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap cursor-pointer list-none flex items-center justify-between">
                  More
                  <svg class="h-4 w-4 fill-current transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </summary>
                <div class="pl-4 space-y-1">
                  <a href="/essays" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">Essays</a>
                  <a href="/about" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-4 py-2.5 rounded-md text-base font-medium whitespace-nowrap">About</a>
                </div>
              </details>
              <button id="mobile-theme-toggle" class="w-full text-left text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium flex items-center justify-between">
                <span>Theme</span>
                <span id="mobile-theme-text">Light</span>
              </button>
            </div>
            <div class="pt-4 pb-4 border-t border-gray-700">
              ${props.user ? html`
                <div class="flex items-center px-5">
                    <div class="ml-3">
                        <div class="text-base font-medium leading-none text-white">${props.user.first_name} ${props.user.last_name}</div>
                        <div class="text-sm font-medium leading-none text-gray-300 mt-1">${props.user.email}</div>
                    </div>
                </div>
                <div class="mt-3 px-2 space-y-1">
                    <a href="/profile" class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#633200]">Your Profile</a>
                    <a href="/profile/contributions" class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-[#633200]">Contributions</a>
                    <a href="/logout" class="block px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-red-300 hover:bg-[#633200]">Sign out</a>
                </div>
              ` : html`
                <div class="mt-3 px-2 space-y-1">
                    <a href="/login" class="block px-3 py-2 rounded-md text-base font-medium text-white bg-[#633200] hover:bg-[#b05800]">Login</a>
                </div>
              `}
            </div>
          </div>
        </nav>
        <style>
          /* Folded tabs stay laid out (hidden, clipped off the end) so the bar can always be measured. */
          #site-nav .nav-flat { overflow-x: clip; overflow-y: visible; }
          #site-nav .nav-flat-inner { width: max-content; position: relative; }
          #site-nav [data-nav-fold-item], #site-nav .nav-fold-divider, #site-nav .nav-more-dot { display: none; }
        </style>
        <script>
          (function () {
            var nav = document.getElementById('site-nav');
            var row = nav && nav.querySelector('[data-nav-row]');
            var left = nav && nav.querySelector('[data-nav-left]');
            var right = nav && nav.querySelector('[data-nav-right]');
            var flat = nav && nav.querySelector('.nav-flat');
            var inner = nav && nav.querySelector('.nav-flat-inner');
            if (!row || !left || !right || !flat || !inner) return;
            var items = Array.prototype.slice.call(inner.querySelectorAll('[data-nav-item]'));
            var menuItems = Array.prototype.slice.call(nav.querySelectorAll('[data-nav-fold-item]'));
            var divider = nav.querySelector('.nav-fold-divider');
            var moreDot = nav.querySelector('.nav-more-dot');

            // Always re-applied, even for the same count: the tabs widen once fonts and styles load.
            function show(count) {
              // Clip the bar just past the last tab that fits (+6px so its red dot isn't cut off).
              flat.style.width = count === items.length ? '' : (count ? items[count - 1].offsetLeft + items[count - 1].offsetWidth + 6 : 0) + 'px';
              var dotFolded = false;
              items.forEach(function (item, i) {
                var folded = i >= count;
                item.style.visibility = folded ? 'hidden' : '';
                item.inert = folded;
                if (menuItems[i]) menuItems[i].style.display = folded ? 'block' : '';
                if (folded && item.getAttribute('data-has-dot') === '1') dotFolded = true;
              });
              if (divider) divider.style.display = count < items.length ? 'block' : '';
              if (moreDot) moreDot.style.display = dotFolded ? 'inline' : '';
            }

            function fit() {
              // Below md the desktop bar is hidden behind the hamburger menu.
              if (getComputedStyle(right).display === 'none') return show(items.length);
              var room = row.clientWidth - right.getBoundingClientRect().width - 24
                - (left.getBoundingClientRect().width - flat.getBoundingClientRect().width);
              var count = 0;
              while (count < items.length && items[count].offsetLeft + items[count].offsetWidth <= room) count++;
              show(count);
            }

            fit();
            // Re-check when the window resizes, when Tailwind/fonts finish styling the tabs, and when
            // the right side changes width. Folding never resizes an
            // observed element, so this can't loop.
            if (window.ResizeObserver) {
              var ro = new ResizeObserver(fit);
              ro.observe(row); ro.observe(right); ro.observe(inner);
            } else {
              window.addEventListener('resize', fit);
            }
            window.addEventListener('load', fit);
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
          })();
        </script>
        <script>
            // Mobile menu toggle
            document.addEventListener('DOMContentLoaded', () => {
                const btn = document.getElementById('mobile-menu-btn');
                const menu = document.getElementById('mobile-menu');
                const iconClosed = document.getElementById('menu-icon-closed');
                const iconOpen = document.getElementById('menu-icon-open');

                if (btn && menu) {
                    btn.addEventListener('click', () => {
                        const isExpanded = btn.getAttribute('aria-expanded') === 'true';
                        
                        
                        btn.setAttribute('aria-expanded', !isExpanded);
                        menu.classList.toggle('hidden');
                        
                        
                        if (isExpanded) { 
                            iconClosed.classList.remove('hidden');
                            iconClosed.classList.add('block');
                            iconOpen.classList.remove('block');
                            iconOpen.classList.add('hidden');
                        } else { 
                            iconClosed.classList.remove('block');
                            iconClosed.classList.add('hidden');
                            iconOpen.classList.remove('hidden');
                            iconOpen.classList.add('block');
                        }
                    });
                }

                // Theme Toggle Logic
                const themeToggleBtn = document.getElementById('theme-toggle');
                const darkIcon = document.getElementById('theme-toggle-dark-icon');
                const lightIcon = document.getElementById('theme-toggle-light-icon');
                const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
                const mobileThemeText = document.getElementById('mobile-theme-text');

                const updateIcons = (theme) => {
                    if (theme === 'dark') {
                        darkIcon?.classList.add('hidden');
                        lightIcon?.classList.remove('hidden');
                        if (mobileThemeText) mobileThemeText.textContent = 'Dark';
                    } else {
                        lightIcon?.classList.add('hidden');
                        darkIcon?.classList.remove('hidden');
                        if (mobileThemeText) mobileThemeText.textContent = 'Light';
                    }
                };

                const currentMode = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                updateIcons(currentMode());

                // Flips light/dark and keeps the timetable theme: every theme has both palettes.
                const toggleTheme = () => {
                    localStorage.setItem('theme', currentMode() === 'dark' ? 'light' : 'dark');
                    window.__ttAppearance.apply();
                    window.dispatchEvent(new CustomEvent('timetableThemeChanged'));
                };
                // Also fired by the timetable's Appearance settings.
                window.addEventListener('timetableThemeChanged', () => updateIcons(currentMode()));

                themeToggleBtn?.addEventListener('click', toggleTheme);
                mobileThemeToggle?.addEventListener('click', toggleTheme);

                // More dropdown click toggle
                const moreDropdown = document.getElementById('more-dropdown');
                const moreMenu = document.getElementById('more-menu');
                if (moreDropdown && moreMenu) {
                    moreDropdown.querySelector('button').addEventListener('click', (e) => {
                        e.stopPropagation();
                        moreMenu.classList.toggle('hidden');
                    });
                    document.addEventListener('click', (e) => {
                        if (!moreDropdown.contains(e.target)) {
                            moreMenu.classList.add('hidden');
                        }
                    });
                }
            });
        </script>

        <main class="flex-grow max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          ${props.children}
        </main>

        ${!props.hideFooter && html`
        <footer class="bg-white/5 dark:bg-neutral-900/50 text-gray-400 dark:text-neutral-500 py-6 mt-auto">
          <div class="max-w-[95%] mx-auto px-4 text-center">
            <p>&copy; 2025 ~ 2026 HighHelp</p>
          </div>
        </footer>
        `}
        ${needsPdfCrop ? html`
        <script>
            // PDF Crop Web Component
            class PdfCrop extends HTMLElement {
                constructor() {
                    super();
                    this.attachShadow({ mode: 'open' });
                    this.canvas = document.createElement('canvas');
                    this.canvas.style.maxWidth = '100%';
                    this.canvas.style.height = 'auto';
                    this.canvas.style.borderRadius = '0.5rem';
                    this.canvas.style.border = '1px solid #e5e7eb';
                    this.shadowRoot.appendChild(this.canvas);
                }

                async connectedCallback() {
                    const url = this.getAttribute('pdf-url');
                    const cropStr = this.getAttribute('crop-data');
                    if (!url || !cropStr) return;

                    let crop;
                    try {
                        crop = JSON.parse(cropStr);
                    } catch (e) {
                        console.error("Invalid crop data:", cropStr);
                        return;
                    }

                    // Load pdf.js dynamically if not present
                    if (!window.pdfjsLib) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                            script.onload = () => {
                                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                                resolve();
                            };
                            script.onerror = reject;
                            document.head.appendChild(script);
                        });
                    }

                    // Cache pdf document fetching to avoid downloading the same PDF multiple times per page
                    window._pdfCache = window._pdfCache || {};
                    let pdfDoc;
                    try {
                        if (!window._pdfCache[url]) {
                            window._pdfCache[url] = window.pdfjsLib.getDocument(url).promise;
                        }
                        pdfDoc = await window._pdfCache[url];
                    } catch (error) {
                        console.error("Failed to load PDF", error);
                        const ctx = this.canvas.getContext('2d');
                        ctx.fillText("Failed to load PDF", 10, 50);
                        return;
                    }

                    try {
                        const pageNum = crop.page || 1;
                        const page = await pdfDoc.getPage(pageNum);

                        // Use a scale that provides good resolution
                        const scale = window.devicePixelRatio || 2.0; 
                        const viewport = page.getViewport({ scale: scale });

                        // Calculate crop bounding box in PDF points (relative to original page size)
                        // crop.x, y, w, h are percentages (0-100)
                        const cropX = (crop.x / 100) * viewport.width;
                        const cropY = (crop.y / 100) * viewport.height;
                        const cropW = (crop.w / 100) * viewport.width;
                        const cropH = (crop.h / 100) * viewport.height;

                        this.canvas.width = cropW;
                        this.canvas.height = cropH;

                        const ctx = this.canvas.getContext('2d');
                        
                        const renderContext = {
                            canvasContext: ctx,
                            viewport: viewport,
                            transform: [1, 0, 0, 1, -cropX, -cropY]
                        };

                        await page.render(renderContext).promise;
                    } catch (error) {
                        console.error("Error rendering PDF page", error);
                    }
                }
            }
            if (!customElements.get('pdf-crop')) {
                customElements.define('pdf-crop', PdfCrop);
            }
        </script>
        ` : ''}
        <script>
            // TEMP-VERIFY: auto-trigger "Load 50 more" for headless KaTeX testing
            if (location.search.includes('autoload=1')) {
                window.addEventListener('load', function () {
                    setTimeout(function () {
                        var b = document.getElementById('practice-load-more');
                        if (b) b.click();
                    }, 300);
                });
            }
        </script>
        <script>
            // date & localisation
            document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('.local-date').forEach(el => {
                    const ts = el.getAttribute('data-timestamp');
                    const format = el.getAttribute('data-format');
                    if (ts) {
                        const date = new Date(ts);
                        const d = String(date.getDate()).padStart(2, '0');
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const y = String(date.getFullYear()).slice(-2);
                        const dateFormatted = \`\${ d } -\${ m } -\${ y } \`;

                        if (format === 'datetime') {
                             const hours = String(date.getHours()).padStart(2, '0');
                             const minutes = String(date.getMinutes()).padStart(2, '0');
                             el.textContent = \`\${ dateFormatted } \${ hours }:\${ minutes } \`;
                        } else {
                             el.textContent = dateFormatted;
                        }
                    }
                });

                
                const searchInput = document.getElementById('search-input');
                const viewGridBtn = document.getElementById('view-grid');
                const viewListBtn = document.getElementById('view-list');
                const gridContainer = document.getElementById('grid-view-container');
                const listContainer = document.getElementById('list-view-container');

                // Search Logic
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        const term = e.target.value.toLowerCase();
                        document.querySelectorAll('.search-item').forEach(item => {
                            const text = item.getAttribute('data-search-text') || '';
                            if (text.toLowerCase().includes(term)) {
                                item.classList.remove('hidden');
                            } else {
                                item.classList.add('hidden');
                            }
                        });
                    });
                }
                if (viewGridBtn && viewListBtn && gridContainer && listContainer) {
                    viewGridBtn.addEventListener('click', () => {
                        gridContainer.classList.remove('hidden');
                        listContainer.classList.add('hidden');
                        
                        viewGridBtn.classList.add('bg-blue-100', 'text-blue-700');
                        viewGridBtn.classList.remove('text-gray-500', 'hover:bg-gray-50');
                        viewListBtn.classList.remove('bg-blue-100', 'text-blue-700');
                        viewListBtn.classList.add('text-gray-500', 'hover:bg-gray-50');
                    });

                    viewListBtn.addEventListener('click', () => {
                        gridContainer.classList.add('hidden');
                        listContainer.classList.remove('hidden');

                        viewListBtn.classList.add('bg-blue-100', 'text-blue-700');
                        viewListBtn.classList.remove('text-gray-500', 'hover:bg-gray-50');
                        viewGridBtn.classList.remove('bg-blue-100', 'text-blue-700');
                        viewGridBtn.classList.add('text-gray-500', 'hover:bg-gray-50');
                    });
                }

                // timetable sync *important
                (function() {
                    if (!window.location.pathname.startsWith('/timetable')) return;
                    const raw = localStorage.getItem('studentData');
                    if (!raw) return;
                    try {
                        const studentData = JSON.parse(raw);
                        if (!studentData.accessToken) return;
                        
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const todayStr = year + '-' + month + '-' + day;

                        fetch('/api/proxy/day-data?date=' + todayStr, {
                            headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
                        })
                        .then(r => r.json())
                        .then(data => {
                            if (data && data.status === 'OK') {
                                localStorage.setItem('todayData_' + todayStr, JSON.stringify(data));
                                window.dispatchEvent(new CustomEvent('todayDataRefreshed', { detail: { date: todayStr, data } }));
                            }
                        })
                        .catch(err => console.error('Global sync error:', err));
                    } catch(e) { console.error(e); }
                })();

                // Service Worker Registration
                if ('serviceWorker' in navigator) {
                    window.addEventListener('load', () => {
                        navigator.serviceWorker.register('/sw.js')
                            .then(reg => console.log('SW registered'))
                            .catch(err => console.error('SW registration failed', err));
                    });
                }
            });
        </script>
      </body>
    </html>
  `
}
