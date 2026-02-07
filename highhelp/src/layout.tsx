import { html } from 'hono/html'

export const Layout = (props: { title: string; children: any; user?: any; hideFooter?: boolean }) => {
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

        <title>${props.title} - HighHelp</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
            tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      primary: '#3E2723', // Deep Brown
                      secondary: '#3E2723', // Blue
                      background: '#F8F9FA', // Neutral Light // TODO: modify this during if light/dark mode
                      'brown-800': '#3E2723',
                      'blue-600': '#1E88E5',
                    },
                  },
                },
              }
            </script>
          </head>
      <body class="bg-background text-gray-800 font-sans min-h-screen flex flex-col">
        <nav class="bg-primary text-white shadow-lg">
          <div class="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-14">
              <div class="flex items-center">
                <a href="/" class="font-bold text-xl tracking-tight">HighHelp</a>
                <div class="hidden md:block">
                  <div class="ml-10 flex items-baseline space-x-4">
                    <a href="/timetable" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">Timetable</a>
                    <a href="/resources" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">Resources</a>
                    <a href="/announcements" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">Announcements</a>
                    <a href="/past-papers" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">Past Papers</a>
                    <a href="/forum" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">Q&A</a>
                    <a href="/essays" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">Essays</a>
                    <a href="/about" class="hover:bg-[#633200] px-3 py-2 rounded-md text-sm font-medium transition-colors">About</a>
                  </div>
                </div>
              </div>
              <div class="hidden md:block">
                <div class="ml-4 flex items-center md:ml-6 text-sm font-medium">
                  ${props.user ? html`
  <div class="relative group">
      <button class="flex items-center space-x-2 text-white hover:text-blue-100 focus:outline-none py-2">
          <span>Hello, ${props.user.first_name}</span>
          <svg class="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
      </button>

      <div class="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-50">
          
          <div class="bg-white rounded-md shadow-lg py-1 border border-gray-200">
              <a href="/profile" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">My Profile</a>
              <a href="/profile/contributions" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">My Contributions</a>
              <div class="border-t border-gray-100 my-1"></div>
              <a href="/logout" class="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Logout</a>
          </div>

      </div>
  </div>
` : html`
  <a href="/login" class="bg-[#633200] hover:bg-[#b05800] px-3 py-2 rounded-md">Login</a>
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
            <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-[#4E342E]">
              <a href="/timetable" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">Timetable</a>
              <a href="/resources" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">Resources</a>
              <a href="/announcements" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">Announcements</a>
              <a href="/past-papers" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">Past Papers</a>
              <a href="/forum" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">Q&A</a>
              <a href="/essays" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">Essays</a>
              <a href="/about" class="text-gray-100 hover:bg-[#633200] block px-3 py-2 rounded-md text-base font-medium">About</a>
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
            });
        </script>

        <main class="flex-grow max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          ${props.children}
        </main>

        ${!props.hideFooter && html`
        <footer class="bg-white-800/10 text-blue-800/10 py-6">

          <div class="max-w-[95%] mx-auto px-4 text-center">
            <p>&copy; 2025 HighHelp</p>
          </div>
        </footer>
        `}
        <script>
            // date & localisation
            document.addEventListener('DOMContentLoaded', () => {
                document.querySelectorAll('.local-date').forEach(el => {
                    const ts = el.getAttribute('data-timestamp');
                    const format = el.getAttribute('data-format');
                    if (ts) {
                        const date = new Date(ts);
                        if (format === 'datetime') {
                             el.textContent = date.toLocaleString();
                        } else {
                             el.textContent = date.toLocaleDateString();
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
            });
        </script>
      </body>
    </html>
  `
}
