import { html } from 'hono/html'

export const Layout = (props: { title: string; children: any; user?: any }) => {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Welcome to the official website for High's Class of 2027" />
        
        <!-- Social Media Previews -->
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
                      background: '#F8F9FA', // Neutral Light
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
            </div>
          </div>
        </nav>

        <main class="flex-grow max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          ${props.children}
        </main>

        <footer class="bg-white-800/10 text-blue-800/10 py-6">

          <div class="max-w-[95%] mx-auto px-4 text-center">
            <p>&copy; 2025 HighHelp</p>
          </div>
        </footer>
        <script>
            // Client-side date hydration
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

                // Shared UI Logic: Search & View Toggle
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
                                // If inside a table row, we might need to handle empty states, but simpler is fine for now
                            } else {
                                item.classList.add('hidden');
                            }
                        });
                    });
                }

                // View Toggle Logic
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
            });
        </script>
      </body>
    </html>
  `
}
