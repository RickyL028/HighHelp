import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { getUser } from '../utils'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/points', async (c) => {
	const user = await getUser(c)

	if (!user) {
		return c.redirect('/login')
	}

	return c.html(
		<Layout title="Points" user={user}>
			<div class="max-w-4xl mx-auto px-4 py-8">
				<header class="mb-8">
					<h1 class="text-3xl font-mono font-bold uppercase tracking-tighter mb-2">Award Scheme</h1>
					<p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">Your school award points from the student portal.</p>
				</header>

				<div id="points-root">
					<div class="flex items-center justify-center py-12">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
						<span class="ml-3 font-mono text-sm text-gray-500 dark:text-neutral-400">Loading awards...</span>
					</div>
				</div>
			</div>

			<script dangerouslySetInnerHTML={{
				__html: `
				(async function() {
					var root = document.getElementById('points-root');
					var studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
					var token = studentData.accessToken;
					var studentId = studentData.studentId;

					if (!token || !studentId) {
						root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">No access token found. Please log in again.</p></div>';
						return;
					}

					try {
						var res = await fetch('/api/proxy/awards?studentId=' + encodeURIComponent(studentId), {
							headers: { 'Authorization': 'Bearer ' + token }
						});

						if (res.status === 401 || res.status === 403) {
							var refreshRes = await fetch('/api/auth/refresh');
							var refreshData = await refreshRes.json();
							if (refreshData.success && refreshData.accessToken) {
								studentData.accessToken = refreshData.accessToken;
								localStorage.setItem('studentData', JSON.stringify(studentData));
								var retryRes = await fetch('/api/proxy/awards?studentId=' + encodeURIComponent(studentId), {
									headers: { 'Authorization': 'Bearer ' + refreshData.accessToken }
								});
								if (!retryRes.ok) {
									root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">Failed to load awards. (HTTP ' + retryRes.status + ')</p></div>';
									return;
								}
								renderAwards(await retryRes.json());
								return;
							}
							root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">Session expired. Please <a href="/login" class="underline">log in</a> again.</p></div>';
							return;
						}

						if (!res.ok) {
							root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">Failed to load awards (HTTP ' + res.status + ')</p></div>';
							return;
						}

						renderAwards(await res.json());
					} catch (e) {
						console.error('Failed to fetch awards:', e);
						root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">Network error loading awards.</p></div>';
					}

					function renderAwards(data) {
						var items = (data.member || []);
						var totalPoints = 0;
						var totalHousePoints = 0;

						var allAwards = items.map(function(item) {
							var award = item.award || {};
							var cat = award.category || {};
							var pts = award.points || 0;
							var house = award.housePoints || 0;
							totalPoints += pts;
							totalHousePoints += house;
							return {
								name: award.name || 'Unnamed Award',
								points: pts,
								housePoints: house,
								category: cat.name || 'Uncategorised',
								tier: award.tier || 0,
								date: item.date || ''
							};
						});

						var categories = {};
						allAwards.forEach(function(a) {
							if (!categories[a.category]) categories[a.category] = [];
							categories[a.category].push(a);
						});
						var categoryNames = Object.keys(categories).sort();

						var catOptions = categoryNames.map(function(cat) {
							return '<option value="' + cat.replace(/"/g, '&quot;') + '">' + cat + '</option>';
						}).join('');

						root.innerHTML =
							'<div class="mb-6 flex flex-col sm:flex-row gap-4">' +
								'<div class="flex-1">' +
									'<input type="text" id="points-search" placeholder="Search awards..." class="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg font-mono text-sm bg-white dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />' +
								'</div>' +
								'<div class="flex gap-3 items-center">' +
									'<select id="points-category-filter" class="px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg font-mono text-sm bg-white dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">' +
										'<option value="">All Categories</option>' +
										catOptions +
									'</select>' +
								'</div>' +
							'</div>' +
							'<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">' +
								'<div class="border border-gray-200 dark:border-neutral-700 p-4 bg-gray-50 dark:bg-neutral-900">' +
									'<div class="font-mono text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Total Points</div>' +
									'<div class="font-mono text-2xl font-bold">' + totalPoints + '</div>' +
								'</div>' +
								'<div class="border border-gray-200 dark:border-neutral-700 p-4 bg-gray-50 dark:bg-neutral-900">' +
									'<div class="font-mono text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">House Points</div>' +
									'<div class="font-mono text-2xl font-bold">' + totalHousePoints + '</div>' +
								'</div>' +
								'<div class="border border-gray-200 dark:border-neutral-700 p-4 bg-gray-50 dark:bg-neutral-900">' +
									'<div class="font-mono text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Awards</div>' +
									'<div class="font-mono text-2xl font-bold">' + allAwards.length + '</div>' +
								'</div>' +
							'</div>' +
							'<div id="points-list"></div>' +
							'<div id="points-empty" class="hidden text-center py-12">' +
								'<p class="text-gray-500 dark:text-neutral-400 font-mono text-sm">No awards match your search.</p>' +
							'</div>';

						function renderList(filtered) {
							var listEl = document.getElementById('points-list');
							var emptyEl = document.getElementById('points-empty');

							if (filtered.length === 0) {
								listEl.innerHTML = '';
								emptyEl.classList.remove('hidden');
								return;
							}
							emptyEl.classList.add('hidden');

							var rows = filtered.map(function(a) {
								var tierBadge = a.tier !== 0
									? '<span class="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded">Tier ' + a.tier + '</span>'
									: '';
								var ptsClass = a.points > 0 ? 'text-green-600 dark:text-green-400' : a.points < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-neutral-400';
								var ptsPrefix = a.points > 0 ? '+' : '';
								var houseClass = a.housePoints > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-neutral-400';
								var dateStr = a.date ? '<div class="font-mono text-xs text-gray-400 dark:text-neutral-500 mt-0.5">' + a.date + '</div>' : '';

								return '<tr class="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 last:border-0">' +
									'<td class="px-4 py-3">' +
										'<div class="flex items-center">' +
											'<span class="font-mono text-sm font-medium dark:text-white">' + a.name.replace(/</g, '&lt;') + '</span>' +
											tierBadge +
										'</div>' +
										'<div class="font-mono text-xs text-gray-500 dark:text-neutral-400 mt-0.5">' + a.category + '</div>' +
										dateStr +
									'</td>' +
									'<td class="px-4 py-3 text-right">' +
										'<span class="font-mono text-sm font-bold ' + ptsClass + '">' + ptsPrefix + a.points + '</span>' +
									'</td>' +
									'<td class="px-4 py-3 text-right">' +
										'<span class="font-mono text-sm ' + houseClass + '">' + a.housePoints + '</span>' +
									'</td>' +
								'</tr>';
							}).join('');

							listEl.innerHTML =
								'<div class="overflow-x-auto border border-gray-200 dark:border-neutral-700">' +
									'<table class="w-full text-left border-collapse font-mono text-sm">' +
										'<thead>' +
											'<tr class="bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700">' +
												'<th class="px-4 py-3 border-r border-gray-300 dark:border-neutral-700">AWARD</th>' +
												'<th class="px-4 py-3 border-r border-gray-300 dark:border-neutral-700 text-right w-24">POINTS</th>' +
												'<th class="px-4 py-3 text-right w-24">HOUSE</th>' +
											'</tr>' +
										'</thead>' +
										'<tbody>' + rows + '</tbody>' +
									'</table>' +
								'</div>' +
								'<div class="mt-3 font-mono text-xs text-gray-400 dark:text-neutral-500">' +
									'Showing ' + filtered.length + ' of ' + allAwards.length + ' awards' +
								'</div>';
						}

						function applyFilters() {
							var search = (document.getElementById('points-search').value || '').toLowerCase();
							var category = document.getElementById('points-category-filter').value;
							var filtered = allAwards.filter(function(a) {
								var matchSearch = !search || a.name.toLowerCase().indexOf(search) !== -1 || a.category.toLowerCase().indexOf(search) !== -1;
								var matchCat = !category || a.category === category;
								return matchSearch && matchCat;
							});
							renderList(filtered);
						}

						document.getElementById('points-search').addEventListener('input', applyFilters);
						document.getElementById('points-category-filter').addEventListener('change', applyFilters);
						renderList(allAwards);
					}
				})();
				`
			}} />
		</Layout>
	)
})

export default app
