import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils';
import { User } from '../../types';

// Define the environment variables needed for Canvas
type Bindings = {
    CANVAS_API_TOKEN: string;
    CANVAS_BASE_URL: string;
}

// Define the shape of the Canvas API response
interface CanvasAssignment {
    id: number;
    name: string;
    due_at: string | null;
    html_url: string;
    points_possible: number;
}

// The Todo endpoint returns items wrapped with context (Course name, etc.)
interface CanvasTodoItem {
    type: 'submitting' | 'grading';
    assignment: CanvasAssignment;
    context_name: string; // The course name
    ignore: string; // URL to ignore this item
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c) as User | null

    // Initialize data containers
    let todoItems: CanvasTodoItem[] = [];
    let errorMessage: string | null = null;

    try {
        // 1. Validate Config
        if (!c.env.CANVAS_BASE_URL || !c.env.CANVAS_API_TOKEN) {
            throw new Error("Missing Canvas Configuration");
        }

        // 2. Fetch "Todo" items (Upcoming Assignments)
        // 
        const response = await fetch(`${c.env.CANVAS_BASE_URL}/api/v1/users/self/todo`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${c.env.CANVAS_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Canvas API Error: ${response.statusText}`);
        }

        todoItems = await response.json() as CanvasTodoItem[];

    } catch (e) {
        console.error("Canvas Fetch Error:", e);
        errorMessage = "Unable to load upcoming assignments at this time.";
    }

    // 3. Render the View
    return c.html(
        <Layout title="Canvas Dashboard" user={user}>
            <div class="mx-auto max-w-4xl p-6">
                <div class="mb-8 flex items-center justify-between">
                    <h1 class="text-3xl font-bold text-gray-900">Upcoming Assignments</h1>
                    <span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {todoItems.length} Due
                    </span>
                </div>

                {errorMessage ? (
                    <div class="rounded-md bg-red-50 p-4 text-red-700">
                        {errorMessage}
                    </div>
                ) : (
                    <div class="grid gap-4">
                        {todoItems.length === 0 ? (
                            <p class="text-gray-500">No upcoming assignments! 🎉</p>
                        ) : (
                            todoItems.map((item) => (
                                <a
                                    href={item.assignment.html_url}
                                    target="_blank"
                                    class="group block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-blue-500 hover:shadow-md"
                                >
                                    <div class="flex items-start justify-between">
                                        <div>
                                            <p class="text-sm font-medium text-blue-600 mb-1">
                                                {item.context_name}
                                            </p>
                                            <h2 class="text-xl font-semibold text-gray-900 group-hover:text-blue-700">
                                                {item.assignment.name}
                                            </h2>
                                        </div>
                                        <div class="text-right">
                                            <span class="block text-2xl font-bold text-gray-800">
                                                {item.assignment.points_possible}
                                            </span>
                                            <span class="text-xs text-gray-500">points</span>
                                        </div>
                                    </div>

                                    <div class="mt-4 flex items-center text-sm text-gray-500">
                                        <svg class="mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {item.assignment.due_at
                                            ? new Date(item.assignment.due_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : "No Due Date"
                                        }
                                    </div>
                                </a>
                            ))
                        )}
                    </div>
                )}
            </div>
        </Layout>
    )
})

export default app;