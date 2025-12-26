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
                  primary: '#1e40af', // Blue-800
                  secondary: '#60a5fa', // Blue-400
                  background: '#eff6ff', // Blue-50
                },
              },
            },
          }
        </script>
      </head>
      <body class="bg-background text-gray-800 font-sans min-h-screen flex flex-col">
        <nav class="bg-primary text-white shadow-lg">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
              <div class="flex items-center">
                <a href="/" class="font-bold text-xl tracking-tight">HighHelp</a>
                <div class="hidden md:block">
                  <div class="ml-10 flex items-baseline space-x-4">
                    <a href="/resources" class="hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">Resources</a>
                    <a href="/announcements" class="hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">Announcements</a>
                    <a href="/past-papers" class="hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">Past Papers</a>
                    <a href="/forum" class="hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">Q&A</a>
                    <a href="/essays" class="hover:bg-blue-700 px-3 py-2 rounded-md text-sm font-medium">Essays</a>
                  </div>
                </div>
              </div>
              <div class="hidden md:block">
                <div class="ml-4 flex items-center md:ml-6 text-sm font-medium">
                  ${props.user ? html`
                    <span class="mr-4">Hello, ${props.user.first_name}</span>
                    <a href="/logout" class="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md">Logout</a>
                  ` : html`
                    <a href="/login" class="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md">Login</a>
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
