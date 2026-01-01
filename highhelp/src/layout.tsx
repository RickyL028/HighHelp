import { html } from 'hono/html'

export const Layout = (props: { title: string; children: any; user?: any }) => {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
              <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          ${props.children}
        </main>

        <footer class="bg-white-800/10 text-blue-800/10 py-6">

          <div class="max-w-7xl mx-auto px-4 text-center">
            <p>&copy; 2025 HighHelp</p>
          </div>
        </footer>
      </body>
    </html>
  `
}
