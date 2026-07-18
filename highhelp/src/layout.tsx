import { html } from 'hono/html'

export const Layout = (props: { title: string; children: any; user?: any; hideFooter?: boolean; latex?: boolean }) => {
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
        <link rel="apple-touch-icon" href="/icon-512.png" />

        <title>${props.title} - HighHelp</title>
        <script src="https://cdn.tailwindcss.com"></script>
        
        

${props.latex ? html`
  <!-- KaTeX CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  
  <!-- KaTeX JS -->
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  
  <!-- KaTeX Auto-Render Extension -->
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  
  <script>
    document.addEventListener("DOMContentLoaded", function() {
        // defined inside the listener to access the window global after load
        if (window.renderMathInElement) {
            window.renderMathInElement(document.body, {
                delimiters: [
                  {left: '$$', right: '$$', display: true},
                  {left: '$', right: '$', display: false},
                  {left: '\\\\(', right: '\\\\)', display: false},
                  {left: '\\\\[', right: '\\\\]', display: true}
                ],
                throwOnError : false
            });
        } else {
            // Fallback in case scripts load slower than DOMContentLoaded
            window.addEventListener('load', function() {
                if (window.renderMathInElement) {
                    window.renderMathInElement(document.body, {
                        delimiters: [
                          {left: '$$', right: '$$', display: true},
                          {left: '$', right: '$', display: false},
                          {left: '\\\\(', right: '\\\\)', display: false},
                          {left: '\\\\[', right: '\\\\]', display: true}
                        ],
                        throwOnError : false
                    });
                }
            });
        }
    });
  </script>
` : ''}
        <script>
            // Theme initialization - run as early as possible to avoid flash
            (function() {
                const timetableTheme = localStorage.getItem('timetableTheme');
                if (timetableTheme === 'night') {
                    document.documentElement.classList.add('night');
                }
                const theme = localStorage.getItem('theme') || 'light';
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            })();

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
                /* Night theme */
                html.night body{background-color:#0A0E17!important;color:#fff!important}
                html.night nav{background-color:#0A0E17!important}
                html.night main,html.night footer{background-color:#0A0E17!important}
                html.night nav a:hover,html.night nav button:hover{background-color:rgba(168,85,247,.15)!important}
                html.night .bg-background,html.night .bg-white{background-color:#111827!important}
                html.night .border-gray-100,html.night .border-gray-200,html.night .dark\:border-neutral-700,html.night .dark\:border-neutral-800{border-color:#1e293b!important}
                html.night .bg-gray-50,html.night .bg-gray-50\/50,html.night .bg-gray-100,html.night .dark\:bg-neutral-800,html.night .dark\:bg-neutral-900,html.night .dark\:bg-neutral-950\/50{background-color:#111827!important}
                html.night .text-gray-800,html.night .text-gray-900,html.night .dark\:text-white,html.night .dark\:text-neutral-100,html.night .dark\:text-neutral-200{color:#fff!important}
                html.night .text-gray-400,html.night .text-gray-500,html.night .dark\:text-neutral-400,html.night .dark\:text-neutral-500,html.night .dark\:text-neutral-600{color:#94a3b8!important}
                html.night .dark\:bg-red-900\/20,html.night .dark\:bg-red-900\/30,html.night .dark\:bg-red-900\/40,html.night .bg-red-50,html.night .dark\:bg-red-500\/10,html.night .dark\:bg-red-500\/20{background-color:rgba(168,85,247,.1)!important}
                html.night .text-red-500,html.night .text-red-600,html.night .dark\:text-red-400,html.night .dark\:text-red-300,html.night .text-red-700{color:#a855f7!important}
                html.night .bg-red-500,html.night .bg-red-600{background-color:#a855f7!important}
                html.night .hover\:bg-red-50:hover,html.night .dark\:hover\:bg-red-500\/10:hover,html.night .dark\:hover\:bg-red-500\/20:hover{background-color:rgba(168,85,247,.1)!important}
                html.night .hover\:bg-red-600:hover{background-color:#9333ea!important}
                html.night .hover\:text-red-500:hover,html.night .hover\:text-red-600:hover{color:#a855f7!important}
                html.night .border-red-500{border-color:#a855f7!important}
                html.night .ring-red-500,html.night .dark\:ring-offset-neutral-900{--tw-ring-color:#a855f7!important}
                html.night .bg-red-100,html.night .dark\:bg-red-900\/30{background-color:rgba(168,85,247,.1)!important}
                html.night .text-red-700,html.night .dark\:text-red-400,html.night .text-red-600{color:#a855f7!important}
                html.night .dark\:bg-neutral-900\/50{background-color:rgba(17,24,39,.5)!important}
                html.night .bg-gray-50\/30,html.night .dark\:bg-neutral-900\/10,html.night .dark\:bg-neutral-900\/20,html.night .dark\:bg-neutral-900\/30{background-color:rgba(17,24,39,.2)!important}
                html.night .bg-gray-50\/50,html.night .dark\:bg-neutral-900\/30{background-color:rgba(17,24,39,.3)!important}
                html.night .border-gray-50,html.night .dark\:border-neutral-800\/50,html.night .dark\:border-neutral-700\/50{border-color:rgba(30,41,59,.5)!important}
                html.night .bg-red-50\/40,html.night .dark\:bg-red-900\/10{background-color:rgba(168,85,247,.05)!important}
                html.night .shadow-sm{box-shadow:0 1px 2px 0 rgba(0,0,0,.3)!important}
                html.night .shadow-lg{box-shadow:0 10px 15px -3px rgba(0,0,0,.4)!important}
                html.night .shadow-xl,html.night .shadow-2xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.5)!important}
                html.night .divide-gray-100>*>:not([hidden])~:not([hidden]){border-color:#1e293b!important}
                html.night .ring-gray-300{--tw-ring-color:#1e293b!important}
                html.night .placeholder-gray-400,html.night .dark\:placeholder-neutral-600::placeholder{color:#475569!important}
                html.night .bg-blue-50,html.night .dark\:bg-blue-900\/20,html.night .dark\:bg-blue-900\/30{background-color:rgba(168,85,247,.08)!important}
                html.night .text-blue-400,html.night .text-blue-500,html.night .dark\:text-blue-300,html.night .dark\:text-blue-400,html.night .text-blue-600,html.night .text-blue-700{color:#c4b5fd!important}
                html.night .bg-blue-100,html.night .hover\:bg-blue-100:hover{background-color:rgba(168,85,247,.1)!important}
                html.night .border-blue-300,html.night .dark\:border-blue-500\/40,html.night .hover\:border-blue-300:hover,html.night .dark\:hover\:border-blue-500\/40:hover{border-color:rgba(168,85,247,.3)!important}
                html.night .text-blue-600,html.night .hover\:text-blue-600:hover,html.night .dark\:hover\:text-blue-400:hover{color:#c4b5fd!important}
                html.night .bg-indigo-100,html.night .dark\:bg-indigo-900\/20,html.night .dark\:bg-indigo-900\/30{background-color:rgba(168,85,247,.08)!important}
                html.night .text-indigo-600,html.night .text-indigo-700,html.night .dark\:text-indigo-300{color:#c4b5fd!important}
                html.night .bg-orange-100,html.night .dark\:bg-orange-900\/20,html.night .dark\:bg-orange-900\/30{background-color:rgba(251,146,60,.1)!important}
                html.night .bg-green-100,html.night .dark\:bg-green-900\/20,html.night .dark\:bg-green-900\/30{background-color:rgba(52,211,153,.1)!important}
                html.night .bg-yellow-100,html.night .dark\:bg-yellow-900\/30{background-color:rgba(250,204,21,.1)!important}
                html.night .text-yellow-700,html.night .dark\:text-yellow-400{color:#fbbf24!important}
                html.night .bg-gray-800{background-color:#111827!important}
                html.night .text-gray-300,html.night .dark\:text-gray-200,html.night .dark\:text-gray-300{color:#e2e8f0!important}
                html.night .border-gray-600,html.night .dark\:border-gray-700{border-color:#1e293b!important}
                html.night .border-white\/50,html.night .dark\:border-neutral-700\/50{border-color:rgba(30,41,59,.5)!important}
                html.night .bg-gray-700{background-color:#1e293b!important}
                html.night #big-timer-display #bt-timer.night-gradient{background:linear-gradient(90deg,#7dd3fc,#a855f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
                html.night #big-timer-display{background:linear-gradient(135deg,#0f172a,#111827 40%,#0f172a)!important;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 25 30 30 T60 30' fill='none' stroke='%231e293b' stroke-width='0.5'/%3E%3Cpath d='M0 40 Q15 35 30 40 T60 40' fill='none' stroke='%231e293b' stroke-width='0.5'/%3E%3C/svg%3E")!important;background-size:60px 60px!important;border-color:#1e293b!important}
                html.night #daily-progress-bar{background-color:#1e293b!important}
                html.night .period-card>.absolute.left-0{width:1px!important;border-radius:0!important}
                html.night .period-card>.absolute.left-0::before{content:'';position:absolute;top:50%;left:-2.5px;width:6px;height:6px;border-radius:50%;background:inherit;transform:translateY(-50%)}
                html.night .period-card .font-bold[class*="text-gray-900"],html.night .period-card .font-bold[class*="dark\\:text-white"]{color:inherit!important}
                html.night .dark\:border-red-500\/40{border-color:rgba(168,85,247,.4)!important}
            </style>
          </head>
      <body class="bg-background dark:bg-neutral-900 text-gray-800 dark:text-gray-200 font-sans min-h-screen flex flex-col transition-colors duration-300">
        <nav class="bg-primary dark:bg-neutral-950 text-white shadow-lg">
          <div class="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-14">
              <div class="flex items-center">
                <a href="/home" class="font-bold text-xl tracking-tight">HighHelp</a>
                <div class="hidden md:block">
                  <div class="ml-10 flex items-baseline space-x-4">
                    <a href="/timetable" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Timetable</a>
                    <a href="/resources" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Resources</a>
                    <a href="/announcements" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Announcements</a>
                    <a href="/past-papers" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Past Papers</a>
                    <a href="/forum" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Q&A</a>
                    <a href="/essays" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Essays</a>
                    <a href="/leaderboard" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Leaderboard</a>
                    <a href="/atar" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">ATAR</a>
                    <a href="/feedback" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">Hmmm..!</a>
                    
                    <a href="/about" class="hover:bg-[#633200] dark:hover:bg-neutral-800 px-3 py-2 rounded-md text-sm font-medium transition-colors">About</a>
                  </div>
                </div>
              </div>
              <div class="hidden md:block">
                <div class="ml-4 flex items-center md:ml-6 text-sm font-medium gap-4">
                  <!-- Theme Toggle Button -->
                  <button id="theme-toggle" class="p-2 rounded-full hover:bg-[#633200] dark:hover:bg-neutral-800 transition-colors focus:outline-none" aria-label="Toggle dark mode">
                    <svg id="theme-toggle-dark-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                    <svg id="theme-toggle-light-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
                  </button>
                  ${props.user ? html`
  <div class="flex items-center">
    <button id="install-button" class="hidden items-center space-x-1 bg-[#633200] border border-white/20 hover:bg-[#b05800] px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-all mr-6 group">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 group-hover:bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Add to Dock</span>
    </button>
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
    <button id="install-button" class="hidden items-center space-x-1 bg-[#633200] border border-white/20 hover:bg-[#b05800] px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-all mr-6 group">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 group-hover:bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Add to Dock</span>
    </button>
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
            <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-[#4E342E] dark:bg-neutral-900">
              <a href="/timetable" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Timetable</a>
              <a href="/resources" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Resources</a>
              <a href="/announcements" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Announcements</a>
              <a href="/past-papers" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Past Papers</a>
              <a href="/forum" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Q&A</a>
              <a href="/essays" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Essays</a>
              <a href="/leaderboard" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Leaderboard</a>
              <a href="/atar" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">ATAR</a>
              <a href="/feedback" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">Hmmm..!</a>
              <a href="/about" class="text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium">About</a>
              <button id="mobile-theme-toggle" class="w-full text-left text-gray-100 hover:bg-[#633200] dark:hover:bg-neutral-800 block px-3 py-2 rounded-md text-base font-medium flex items-center justify-between">
                <span>Theme</span>
                <span id="mobile-theme-text">Light</span>
              </button>
            </div>
            <div class="pt-4 pb-4 border-t border-gray-700">
              <div class="px-5 mb-4">
                  <button id="mobile-install-button" class="hidden w-full items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-md text-white font-medium transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Add to Dock</span>
                  </button>
              </div>
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

                let currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                updateIcons(currentTheme);

                const toggleTheme = () => {
                    const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
                    if (newTheme === 'dark') {
                        document.documentElement.classList.add('dark');
                        localStorage.setItem('theme', 'dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                        localStorage.setItem('theme', 'light');
                    }
                    updateIcons(newTheme);
                };

                themeToggleBtn?.addEventListener('click', toggleTheme);
                mobileThemeToggle?.addEventListener('click', toggleTheme);
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

                // PWA Installation
                let deferredPrompt;
                const installBtn = document.getElementById('install-button');
                const mobileInstallBtn = document.getElementById('mobile-install-button');

                // Detect if it's Safari on macOS/iOS
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

                if (!isStandalone && isSafari) {
                    // For Safari, we can't trigger the prompt, but we can show the button 
                    // and provide instructions when clicked.
                    if (installBtn) {
                        installBtn.classList.remove('hidden');
                        installBtn.classList.add('flex');
                    }
                    if (mobileInstallBtn) {
                        mobileInstallBtn.classList.remove('hidden');
                        mobileInstallBtn.classList.add('flex');
                    }
                }

                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    deferredPrompt = e;
                    if (installBtn) {
                        installBtn.classList.remove('hidden');
                        installBtn.classList.add('flex');
                    }
                    if (mobileInstallBtn) {
                        mobileInstallBtn.classList.remove('hidden');
                        mobileInstallBtn.classList.add('flex');
                    }
                });

                const triggerInstall = async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                            if (installBtn) installBtn.classList.add('hidden');
                            if (mobileInstallBtn) mobileInstallBtn.classList.add('hidden');
                        }
                        deferredPrompt = null;
                    } else if (isSafari) {
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        if (isIOS) {
                            alert('To add to Home Screen: tap the Share button and select "Add to Home Screen".');
                        } else {
                            alert('To add to Dock: go to File > Add to Dock... in the Safari menu bar.');
                        }
                    }
                };

                if (installBtn) installBtn.addEventListener('click', triggerInstall);
                if (mobileInstallBtn) mobileInstallBtn.addEventListener('click', triggerInstall);

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
