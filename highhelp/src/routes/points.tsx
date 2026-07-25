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
			<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
			<div class="max-w-5xl mx-auto px-4 py-8">


				<div class="flex gap-0 border-b border-gray-200 dark:border-neutral-700 mb-6 justify-start" id="main-tabs">
					<button data-tab="my-awards" class="px-4 py-2 -mb-px border-b-2 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors">Me</button>
					<button data-tab="all-awards" class="px-4 py-2 -mb-px border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 text-sm transition-colors">All</button>
				<button data-tab="blazer" class="px-4 py-2 -mb-px border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 text-sm transition-colors">Blazer</button>
					<button data-tab="plan" class="px-4 py-2 -mb-px border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 text-sm transition-colors">Plan</button>
				</div>

				<div id="tab-my-awards">
					<div id="points-root">
						<div class="flex items-center justify-center py-12">
							<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
							<span class="ml-3 text-sm text-gray-500 dark:text-neutral-400">Loading awards...</span>
						</div>
					</div>
				</div>

				<div id="tab-all-awards" class="hidden">
					<div id="all-awards-root">
						<div class="flex items-center justify-center py-12">
							<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
							<span class="ml-3 text-sm text-gray-500 dark:text-neutral-400">Loading all awards...</span>
						</div>
					</div>
				</div>

			<div id="tab-blazer" class="hidden">
				<div id="blazer-root">
					<div class="flex items-center justify-center py-12">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
						<span class="ml-3 text-sm text-gray-500 dark:text-neutral-400">Loading blazer badges...</span>
					</div>
				</div>
			</div>

			<div id="tab-plan" class="hidden">
				<div id="plan-root">
					<div class="flex items-center justify-center py-12">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
						<span class="ml-3 text-sm text-gray-500 dark:text-neutral-400">Loading plan...</span>
					</div>
				</div>
			</div>
			</div>

			<script dangerouslySetInnerHTML={{
				__html: `
				(function() {
					function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

					var PROGRESS_CATEGORIES = [
						'Academic',
						'Sports',
						'Co-Curricular Teams',
						'Co-Curricular Performing Arts',
						'High Spirit',
						'School & Community Service, Clubs and Societies',
						'Leadership'
					];

					function matchProgressCategory(nomName) {
						var upper = nomName.toUpperCase().replace(/\\s+\\d+$/, '');
						for (var i = 0; i < PROGRESS_CATEGORIES.length; i++) {
							var cat = PROGRESS_CATEGORIES[i].toUpperCase();
							if (cat.indexOf(upper) === 0 || upper.indexOf(cat) === 0) return PROGRESS_CATEGORIES[i];
						}
						return null;
					}

					// --- Tab switching ---
					var tabBtns = document.querySelectorAll('#main-tabs button');
					tabBtns.forEach(function(btn) {
						btn.addEventListener('click', function() {
							tabBtns.forEach(function(b) {
								b.classList.remove('border-blue-500','dark:border-blue-400','text-blue-600','dark:text-blue-400','font-bold');
								b.classList.add('border-transparent','text-gray-500','dark:text-neutral-400');
							});
							btn.classList.add('border-blue-500','dark:border-blue-400','text-blue-600','dark:text-blue-400','font-bold');
							btn.classList.remove('border-transparent','text-gray-500','dark:text-neutral-400');
						document.getElementById('tab-my-awards').classList.toggle('hidden', btn.dataset.tab !== 'my-awards');
						document.getElementById('tab-all-awards').classList.toggle('hidden', btn.dataset.tab !== 'all-awards');
						document.getElementById('tab-blazer').classList.toggle('hidden', btn.dataset.tab !== 'blazer');
						document.getElementById('tab-plan').classList.toggle('hidden', btn.dataset.tab !== 'plan');
						if (btn.dataset.tab === 'all-awards' && !window._allAwardsLoaded) {
							window._allAwardsLoaded = true;
							loadAllAwards();
						}
						if (btn.dataset.tab === 'blazer' && !window._blazerLoaded) {
							window._blazerLoaded = true;
							loadBlazer();
						}
						if (btn.dataset.tab === 'plan' && !window._planLoaded) {
							window._planLoaded = true;
							loadPlanAwards();
						}
						});
					});

					// --- My Awards ---
					(async function() {
						var root = document.getElementById('points-root');
						var studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
						var token = studentData.accessToken;
						var studentId = studentData.studentId;

						if (!token || !studentId) {
							root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">No access token found. Please log in again.</p></div>';
							return;
						}

						var cacheKey = 'awardsCache_' + studentId;
						var cached = null;
						try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch(e) {}
						if (cached && cached.awards && cached.prizes) {
							renderMyAwards(cached.awards, cached.prizes);
						}

						try {
							var prizesUrl = '/api/proxy/all-awards?url=' + encodeURIComponent('https://api.sbhs.net.au/api/core/award-scheme/prizes');
							var [res, prizesRes] = await Promise.all([
								fetch('/api/proxy/awards?studentId=' + encodeURIComponent(studentId), {
									headers: { 'Authorization': 'Bearer ' + token }
								}),
								fetch(prizesUrl, {
									headers: { 'Authorization': 'Bearer ' + token }
								})
							]);

							if (res.status === 401 || res.status === 403) {
								var refreshRes = await fetch('/api/auth/refresh');
								var refreshData = await refreshRes.json();
								if (refreshData.success && refreshData.accessToken) {
									studentData.accessToken = refreshData.accessToken;
									localStorage.setItem('studentData', JSON.stringify(studentData));
									var [retryRes, retryPrizesRes] = await Promise.all([
										fetch('/api/proxy/awards?studentId=' + encodeURIComponent(studentId), {
											headers: { 'Authorization': 'Bearer ' + refreshData.accessToken }
										}),
										fetch(prizesUrl, {
											headers: { 'Authorization': 'Bearer ' + refreshData.accessToken }
										})
									]);
									if (!retryRes.ok) { if (!cached) root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Failed to load awards. (HTTP ' + retryRes.status + ')</p></div>'; return; }
									var awardsData = await retryRes.json();
									var prizesData = await retryPrizesRes.json();
									try { localStorage.setItem(cacheKey, JSON.stringify({ awards: awardsData, prizes: prizesData })); } catch(e) {}
									renderMyAwards(awardsData, prizesData);
									return;
								}
								if (!cached) root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Session expired. Please <a href="/login" class="underline">log in</a> again.</p></div>';
								return;
							}

							if (!res.ok) { if (!cached) root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Failed to load awards (HTTP ' + res.status + ')</p></div>'; return; }
							var awardsData = await res.json();
							var prizesData = await prizesRes.json();
							try { localStorage.setItem(cacheKey, JSON.stringify({ awards: awardsData, prizes: prizesData })); } catch(e) {}
							renderMyAwards(awardsData, prizesData);
						} catch (e) {
							console.error('Failed to fetch awards:', e);
							if (!cached) root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Network error loading awards.</p></div>';
						}
					})();

					function renderMyAwards(data, prizesData) {
						var root = document.getElementById('points-root');
						var items = data.member || [];
						var allAwards = items.map(function(item) {
							var aw = item.award || {};
							var cat = aw.category || {};
							return { name: aw.name||'Unnamed Award', points: aw.points||0, housePoints: aw.housePoints||0, category: cat.name||'Uncategorised', tier: aw.tier||0, date: item.date||'' };
						});

						var isNomination = function(a) { return a.category.toUpperCase().indexOf('NOMINATION') !== -1; };
						var nominations = allAwards.filter(isNomination);
						var awards = allAwards.filter(function(a) { return !isNomination(a); });

						var totalPoints = awards.reduce(function(s,a){return s+a.points;},0);
						var totalHouse = awards.reduce(function(s,a){return s+a.housePoints;},0);

						var thisYear = new Date().getFullYear().toString();
						var thisYearAwards = awards.filter(function(a){return a.date && a.date.substring(0,4) === thisYear;});
						var thisYearPoints = thisYearAwards.reduce(function(s,a){return s+a.points;},0);
						var thisYearHouse = thisYearAwards.reduce(function(s,a){return s+a.housePoints;},0);

						// --- Prize Tier logic (from /award-scheme/prizes) ---
						var prizes = (prizesData && prizesData.member) || [];
						var nomCount = nominations.length;
						var tierMap = {};
						prizes.forEach(function(p) { tierMap[p.tier] = p.name; });
						var sortedPrizes = prizes.slice().sort(function(a,b) { return a.tier - b.tier; });
						var currentPrize = null;
						var nextPrize = null;
						for (var i = 0; i < sortedPrizes.length; i++) {
							if (nomCount >= sortedPrizes[i].nominationsRequired) {
								currentPrize = sortedPrizes[i];
								nextPrize = i < sortedPrizes.length - 1 ? sortedPrizes[i + 1] : null;
							}
						}
						var currentTierName = currentPrize ? currentPrize.name : 'None';
						var nextTierName = nextPrize ? nextPrize.name : 'Max';
						var nextTierRequired = nextPrize ? nextPrize.nominationsRequired : null;

						// Points Progress: 7 fixed categories
						var nomByCategory = {};
						nominations.forEach(function(n) {
							var matched = matchProgressCategory(n.name);
							if (matched) {
								if (!nomByCategory[matched]) nomByCategory[matched] = { count: 0 };
								nomByCategory[matched].count++;
							}
						});

						var awardByCategory = {};
						awards.forEach(function(a) {
							// FIX 1: Match against the actual category of the award, not the award's name
							var matched = matchProgressCategory(a.category); 
							if (matched) {
								if (!awardByCategory[matched]) awardByCategory[matched] = { points: 0 };
								awardByCategory[matched].points += a.points;
							}
						});

						var yearMap = {};
						awards.forEach(function(a){var yr=a.date?a.date.substring(0,4):'Unknown';if(!yearMap[yr])yearMap[yr]=[];yearMap[yr].push(a);});
						var years = Object.keys(yearMap).sort().reverse();

						var nomYearMap = {};
						nominations.forEach(function(a){var yr=a.date?a.date.substring(0,4):'Unknown';if(!nomYearMap[yr])nomYearMap[yr]={};var key=a.name;if(!nomYearMap[yr][key])nomYearMap[yr][key]=0;nomYearMap[yr][key]++;});
						var nomYears = Object.keys(nomYearMap).sort().reverse();

						// --- Prize Tier card ---
						var tierProgressHtml = '';
						if (nextPrize && currentPrize) {
							var prevReq = currentPrize.nominationsRequired;
							var nextReq = nextPrize.nominationsRequired;
							var range = nextReq - prevReq;
							var progress = nomCount - prevReq;
							var pct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;
							tierProgressHtml =
								'<div class="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700">' +
									'<div class="flex justify-between items-center mb-1">' +
										'<span class="text-xs text-gray-500 dark:text-neutral-400">Next: ' + esc(nextPrize.name) + '</span>' +
										'<span class="text-xs font-semibold dark:text-white">' + nomCount + ' / ' + nextReq + '</span>' +
									'</div>' +
									'<div class="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">' +
										'<div class="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all" style="width:' + pct + '%"></div>' +
									'</div>' +
									
								'</div>';
						} else if (!nextPrize && currentPrize) {
							tierProgressHtml =
								'<div class="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700">' +
									'<p class="text-xs text-green-600 dark:text-green-400 font-semibold">Maximum tier reached!</p>' +
								'</div>';
						}

						var tierCard =
							'<div class="border border-gray-200 dark:border-neutral-700 rounded-lg p-6 bg-gray-50 dark:bg-neutral-900">' +
								'<h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-4">Prize Tier</h2>' +
								'<div class="flex flex-col items-center mb-4">' +
									'<div class="w-20 h-20 rounded-full border-4 border-amber-500 dark:border-amber-400 flex items-center justify-center mb-3"><span class="text-2xl font-bold text-amber-600 dark:text-amber-400">'+esc(currentTierName.charAt(0))+'</span></div>' +
									'<span class="text-sm font-semibold text-amber-600 dark:text-amber-400">'+esc(currentTierName)+'</span>' +
								'</div>' +
								'<div class="space-y-2 text-sm">' +
									'<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Nominations</span><span class="font-semibold dark:text-white">'+nomCount+'</span></div>' +
									'<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Points</span><span class="font-semibold dark:text-white">'+thisYearPoints+' <span class="text-gray-400 dark:text-neutral-500 font-normal">('+totalPoints+')</span></span></div>' +
									'<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">House Points</span><span class="font-semibold dark:text-white">'+thisYearHouse+' <span class="text-gray-400 dark:text-neutral-500 font-normal">('+totalHouse+')</span></span></div>' +
									'<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Awards</span><span class="font-semibold dark:text-white">'+thisYearAwards.length+' <span class="text-gray-400 dark:text-neutral-500 font-normal">('+awards.length+')</span></span></div>' +
								'</div>' +
								tierProgressHtml +
							'</div>';

						// --- Points Progress card ---
						var progressCard =
							'<div class="border border-gray-200 dark:border-neutral-700 rounded-lg p-6 bg-gray-50 dark:bg-neutral-900">' +
								'<h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-4">Points Progress</h2>' +
								'<div class="space-y-3">';

						PROGRESS_CATEGORIES.forEach(function(cat) {
							var pts = (awardByCategory[cat] && awardByCategory[cat].points) || 0;
							var nomCount = (nomByCategory[cat] && nomByCategory[cat].count) || 0;
							var adjusted = Math.max(0, pts - (nomCount * 30));
							
							var pct = Math.min(100, Math.round((adjusted / 30) * 100));
							
							var barColor = adjusted >= 30 ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-400';
							var nomLabel = nomCount > 0 ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ml-2">x' + nomCount + '</span>' : '';
							progressCard +=
								'<div>' +
									'<div class="flex justify-between items-center mb-1">' +
										'<span class="text-xs font-medium dark:text-white">' + esc(cat) + nomLabel + '</span>' +
										'<span class="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-neutral-700 dark:text-white font-mono">' + adjusted + '</span>' +
									'</div>' +
									'<div class="relative w-full h-2.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">' +
										(pct > 0 ? '<div class="absolute inset-y-0 left-0 ' + barColor + ' rounded-full transition-all" style="width:' + pct + '%"></div>' : '') +
									'</div>' +
								'</div>';
						});

						progressCard += '</div></div>';

						var topRow = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">' + tierCard + progressCard + '</div>';

						// --- Nominations card ---
						var nomCard = '<div class="border border-gray-200 dark:border-neutral-700 rounded-lg p-6 bg-gray-50 dark:bg-neutral-900 mb-6"><h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-4">Nominations</h2>';
						if (nomYears.length === 0) {
							nomCard += '<p class="text-gray-400 dark:text-neutral-500 text-sm">No nominations yet.</p>';
						} else {
							nomCard += '<div class="space-y-4">';
							nomYears.forEach(function(yr){
								var names=nomYearMap[yr];var nameEntries=Object.keys(names).sort();
								var pills=nameEntries.map(function(name){return '<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300">'+esc(name)+(names[name]>1?' \\u00d7'+names[name]:'')+'</span>';}).join('');
								nomCard+='<div class="flex flex-col sm:flex-row sm:items-start gap-2"><span class="text-sm font-semibold dark:text-white shrink-0 w-16">'+esc(yr)+'</span><div class="flex flex-wrap gap-2">'+pills+'</div></div>';
							});
							nomCard += '</div>';
						}
						nomCard += '</div>';

						// --- Latest Awards Points card ---
						var awardsCard = '<div class="border border-gray-200 dark:border-neutral-700 rounded-lg p-6 bg-gray-50 dark:bg-neutral-900 mb-6"><h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-4">Latest Awards Points</h2><div class="flex gap-0 border-b border-gray-200 dark:border-neutral-700 mb-4" id="year-tabs">';
						years.forEach(function(yr,i){
							var active=i===0?'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 font-bold':'border-transparent text-gray-500 dark:text-neutral-400';
							awardsCard+='<button data-year="'+esc(yr)+'" class="px-4 py-2 -mb-px border-b-2 text-sm transition-colors '+active+'">'+esc(yr)+'</button>';
						});
						awardsCard += '</div><div id="awards-timeline"></div></div>';

						// --- Statistics card ---
						var statsCard =
							'<div class="border border-gray-200 dark:border-neutral-700 rounded-lg p-6 bg-gray-50 dark:bg-neutral-900 mb-6">' +
								'<div class="flex items-center justify-between mb-4">' +
									'<h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300">Statistics</h2>' +
									'<div class="flex gap-0 border-b border-gray-200 dark:border-neutral-700" id="stats-tabs">' +
										'<button data-stat="nominations" class="px-3 py-1 -mb-px border-b-2 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 text-xs font-medium transition-colors">Nominations</button>' +
										'<button data-stat="points" class="px-3 py-1 -mb-px border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 text-xs transition-colors">Points</button>' +
									'</div>' +
								'</div>' +
								'<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
									'<div><h3 class="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2">Trend</h3><div style="position:relative;height:220px"><canvas id="stats-trend"></canvas></div></div>' +
									'<div><h3 class="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2">Distribution</h3><div style="position:relative;height:220px"><canvas id="stats-pie"></canvas></div></div>' +
								'</div>' +
							'</div>';

						root.innerHTML = topRow + nomCard + awardsCard + statsCard;

						function renderYear(yr){
							var list=yearMap[yr]||[];
							var sorted=list.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
							var el=document.getElementById('awards-timeline');
							if(!el)return;
							if(sorted.length===0){el.innerHTML='<div class="text-center py-8 text-gray-400 dark:text-neutral-500 text-sm">No awards for this year.</div>';return;}
							var month=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
							var rows=sorted.map(function(a,i){
								var dp=a.date.split('-');
								var dateLabel=parseInt(dp[2],10)+' '+(month[parseInt(dp[1],10)]||'');
								var isLast=i===sorted.length-1;
								var ptsClass=a.points>0?'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700':'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border-gray-300 dark:border-neutral-600';
								var connector=isLast?'':'<div class="absolute left-[11px] top-8 w-0.5 h-full bg-gray-200 dark:bg-neutral-700"></div>';
								return '<div class="relative flex gap-4 pb-6">'+connector+'<div class="relative z-10 shrink-0 w-6 h-6 rounded-full bg-gray-300 dark:bg-neutral-600 border-2 border-white dark:border-neutral-900 mt-0.5"></div><div class="flex-1 flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-xs text-gray-400 dark:text-neutral-500 mb-1">'+esc(dateLabel)+'</div><div class="text-sm font-medium dark:text-white">'+esc(a.name)+'</div><span class="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300">'+esc(a.category)+'</span></div><div class="shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold font-mono '+ptsClass+'">'+(a.points>0?'':'')+a.points+'</div></div></div>';
							}).join('');
							el.innerHTML='<div class="pl-2">'+rows+'</div>';
						}

						var tabBtns=document.querySelectorAll('#year-tabs button');
						tabBtns.forEach(function(btn){btn.addEventListener('click',function(){
							tabBtns.forEach(function(b){b.classList.remove('border-blue-500','dark:border-blue-400','text-blue-600','dark:text-blue-400','font-bold');b.classList.add('border-transparent','text-gray-500','dark:text-neutral-400');});
							btn.classList.add('border-blue-500','dark:border-blue-400','text-blue-600','dark:text-blue-400','font-bold');btn.classList.remove('border-transparent','text-gray-500','dark:text-neutral-400');
							renderYear(btn.dataset.year);
						});});
						if(years.length>0)renderYear(years[0]);

						// --- Statistics charts ---
						var catColors = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];
						var trendChart = null, pieChart = null;

						var prizeLineColors = { 'Bronze': '#cd7f32', 'Silver': '#a8a8a8', 'Gold': '#ffd700' };
						var defaultPrizeColor = '#9ca3af';

						function prizeLinesPlugin() {
							return {
								id: 'prizeLines',
								afterDraw: function(chart) {
									var lines = chart.options.plugins.prizeLines;
									if (!lines || !lines.length) return;
									var yAxis = chart.scales.y;
									var ctx = chart.ctx;
									var chartArea = chart.chartArea;
									lines.forEach(function(line) {
										var y = yAxis.getPixelForValue(line.value);
										if (y < chartArea.top || y > chartArea.bottom) return;
										ctx.save();
										ctx.beginPath();
										ctx.setLineDash(line.dashed ? [6, 4] : []);
										ctx.strokeStyle = line.color;
										ctx.lineWidth = 1.5;
										ctx.moveTo(chartArea.left, y);
										ctx.lineTo(chartArea.right, y);
										ctx.stroke();
										ctx.fillStyle = line.color;
										ctx.font = '10px sans-serif';
										ctx.textAlign = 'right';
										ctx.fillText(line.label, chartArea.right - 4, y - 4);
										ctx.restore();
									});
								}
							};
						}

						function getMonthKey(dateStr) {
							if (!dateStr || dateStr.length < 7) return null;
							return dateStr.substring(0, 7);
						}

						function buildChartData(mode) {
							var source = mode === 'nominations' ? nominations : awards;
							var byCat = {};
							PROGRESS_CATEGORIES.forEach(function(c) { byCat[c] = {}; });

							source.forEach(function(item) {
								var matched = matchProgressCategory(mode === 'nominations' ? item.name : item.category);
								if (!matched) return;
								var mk = getMonthKey(item.date);
								if (!mk) return;
								if (!byCat[matched][mk]) byCat[matched][mk] = 0;
								if (mode === 'nominations') {
									byCat[matched][mk]++;
								} else {
									byCat[matched][mk] += item.points || 0;
								}
							});

							var allMonths = {};
							PROGRESS_CATEGORIES.forEach(function(c) {
								Object.keys(byCat[c]).forEach(function(m) { allMonths[m] = true; });
							});
							var months = Object.keys(allMonths).sort();

							var datasets = PROGRESS_CATEGORIES.filter(function(c) { return Object.keys(byCat[c]).length > 0; }).map(function(c, i) {
								var cum = 0;
								var data = months.map(function(m) {
									cum += (byCat[c][m] || 0);
									return cum;
								});
								return { label: c, data: data, borderColor: catColors[i % catColors.length], backgroundColor: catColors[i % catColors.length] + '20', tension: 0.3, pointRadius: 2, fill: false };
							});

							// Total line
							if (months.length > 0) {
								var totalCum = 0;
								var totalData = months.map(function(m) {
									var monthTotal = 0;
									PROGRESS_CATEGORIES.forEach(function(c) { monthTotal += (byCat[c][m] || 0); });
									totalCum += monthTotal;
									return totalCum;
								});
								datasets.unshift({ label: 'Total', data: totalData, borderColor: '#1f2937', borderWidth: 2.5, tension: 0.3, pointRadius: 3, fill: false, borderDash: [] });
							}

							return { labels: months, datasets: datasets };
						}

						function buildPieData(mode) {
							var source = mode === 'nominations' ? nominations : awards;
							var totals = {};
							PROGRESS_CATEGORIES.forEach(function(c) { totals[c] = 0; });

							source.forEach(function(item) {
								var matched = matchProgressCategory(mode === 'nominations' ? item.name : item.category);
								if (!matched) return;
								if (mode === 'nominations') {
									totals[matched]++;
								} else {
									totals[matched] += item.points || 0;
								}
							});

							var labels = [], data = [], colors = [];
							PROGRESS_CATEGORIES.forEach(function(c, i) {
								if (totals[c] > 0) {
									labels.push(c);
									data.push(totals[c]);
									colors.push(catColors[i % catColors.length]);
								}
							});

							return { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] };
						}

						function renderCharts(mode) {
							var trendData = buildChartData(mode);
							var pieData = buildPieData(mode);

							if (trendChart) trendChart.destroy();
							if (pieChart) pieChart.destroy();

							// Prize lines for trend chart (nominations only)
							var prizeLines = [];
							var yMax = null;
							if (mode === 'nominations') {
								var sortedP = prizes.slice().sort(function(a,b){ return a.tier - b.tier; });
								var nomCount = nominations.length;
								for (var i = 0; i < sortedP.length; i++) {
									var p = sortedP[i];
									var achieved = nomCount >= p.nominationsRequired;
									var color = prizeLineColors[p.name] || defaultPrizeColor;
									prizeLines.push({
										value: p.nominationsRequired,
										label: p.name + ' (' + p.nominationsRequired + ')',
										color: color,
										dashed: !achieved
									});
									if (!achieved && yMax === null) {
										yMax = p.nominationsRequired;
									}
								}
								if (yMax === null && sortedP.length > 0) {
									yMax = sortedP[sortedP.length - 1].nominationsRequired;
								}
							}

							trendChart = new Chart(document.getElementById('stats-trend'), {
								type: 'line',
								data: trendData,
								plugins: [prizeLinesPlugin()],
								options: {
									responsive: true, maintainAspectRatio: false,
									plugins: {
										legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
										prizeLines: prizeLines
									},
									scales: {
										x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
										y: { beginAtZero: true, suggestedMax: yMax || undefined, ticks: { font: { size: 10 } } }
									}
								}
							});

							pieChart = new Chart(document.getElementById('stats-pie'), {
								type: 'doughnut',
								data: pieData,
								options: {
									responsive: true, maintainAspectRatio: false,
									plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } }
								}
							});
						}

						renderCharts('nominations');

						var statBtns = document.querySelectorAll('#stats-tabs button');
						statBtns.forEach(function(btn) {
							btn.addEventListener('click', function() {
								statBtns.forEach(function(b) {
									b.classList.remove('border-blue-500','dark:border-blue-400','text-blue-600','dark:text-blue-400','font-bold');
									b.classList.add('border-transparent','text-gray-500','dark:text-neutral-400');
								});
								btn.classList.add('border-blue-500','dark:border-blue-400','text-blue-600','dark:text-blue-400','font-bold');
								btn.classList.remove('border-transparent','text-gray-500','dark:text-neutral-400');
								renderCharts(btn.dataset.stat);
							});
						});
					}

					// --- All Awards ---
					function loadAllAwards(url) {
						var root = document.getElementById('all-awards-root');
						var studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
						var token = studentData.accessToken;
						if (!token) { root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">No access token.</p></div>'; return; }

						var cacheKey = 'allAwardsCache';
						if (!url) {
							var cached = null;
							try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch(e) {}
							if (cached) renderAllAwards(root, cached);
						}

						var fetchUrl = url || '/api/proxy/all-awards';
						fetch(fetchUrl, { headers: { 'Authorization': 'Bearer ' + token } })
							.then(function(res) {
								if (!res.ok) throw new Error('HTTP ' + res.status);
								return res.json();
							})
							.then(function(data) {
								if (!url) try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch(e) {}
								renderAllAwards(root, data);
							})
							.catch(function(e) {
								if (!url) {
									var cached = null;
									try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch(ex) {}
									if (!cached) root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Failed to load all awards.</p></div>';
								} else {
									root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Failed to load all awards.</p></div>';
								}
							});
					}

					function renderAllAwards(root, data) {
						var allItems = data.member || [];
						var totalItems = data.totalItems || allItems.length;
						var view = data.view || {};

						var catSet = {};
						allItems.forEach(function(item) {
							var cat = (item.category && item.category.name) || 'Uncategorised';
							catSet[cat] = true;
						});
						var catNames = Object.keys(catSet).sort();

						root.innerHTML =
							'<div class="mb-4 flex flex-col sm:flex-row gap-4">' +
								'<div class="flex-1">' +
									'<input type="text" id="all-awards-search" placeholder="Search items..." class="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />' +
								'</div>' +
								'<select id="all-awards-cat-filter" class="px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">' +
									'<option value="">All Categories</option>' +
									catNames.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('') +
								'</select>' +
							'</div>' +
							'<div class="mb-3 text-xs text-gray-400 dark:text-neutral-500">' + totalItems + ' total items</div>' +
							'<div id="all-awards-list"></div>' +
							'<div id="all-awards-nav" class="mt-4 flex justify-between items-center"></div>';

						var allAwards = allItems.map(function(item) {
							return {
								name: item.name || 'Unnamed Award',
								points: item.points || 0,
								housePoints: item.housePoints || 0,
								category: (item.category && item.category.name) || 'Uncategorised',
								tier: item.tier || 0,
								archived: item.archived || false
							};
						});

						function renderTable(list) {
							var el = document.getElementById('all-awards-list');
							if (!el) return;
							if (list.length === 0) { el.innerHTML = '<div class="text-center py-8 text-gray-400 dark:text-neutral-500 text-sm">No awards match your search.</div>'; return; }

							var rows = list.map(function(a) {
								var houseClass = a.housePoints > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-neutral-400';
								var archBadge = a.archived ? '<span class="ml-2 text-xs text-gray-400 dark:text-neutral-500">(archived)</span>' : '';

								return '<tr class="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 last:border-0">' +
									'<td class="px-4 py-3">' +
										'<div class="flex items-center">' +
											'<span class="text-sm font-medium dark:text-white">' + esc(a.name) + '</span>' +
											archBadge +
										'</div>' +
										'<div class="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">' + esc(a.category) + '</div>' +
									'</td>' +
									'<td class="px-4 py-3 text-right"><span class="text-sm font-mono ' + houseClass + '">' + a.housePoints + '</span></td>' +
								'</tr>';
							}).join('');

							el.innerHTML =
								'<div class="overflow-x-auto border border-gray-200 dark:border-neutral-700 rounded-lg">' +
									'<table class="w-full text-left border-collapse text-sm">' +
										'<thead><tr class="bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700">' +
											'<th class="px-4 py-3 border-r border-gray-300 dark:border-neutral-700">AWARD</th>' +
											'<th class="px-4 py-3 text-right w-24">HOUSE</th>' +
										'</tr></thead>' +
										'<tbody>' + rows + '</tbody>' +
									'</table>' +
								'</div>';
						}

						function applyFilters() {
							var search = (document.getElementById('all-awards-search').value || '').toLowerCase();
							var cat = document.getElementById('all-awards-cat-filter').value;
							var filtered = allAwards.filter(function(a) {
								var matchSearch = !search || a.name.toLowerCase().indexOf(search) !== -1 || a.category.toLowerCase().indexOf(search) !== -1;
								var matchCat = !cat || a.category === cat;
								return matchSearch && matchCat;
							});
							renderTable(filtered);
						}

						var navEl = document.getElementById('all-awards-nav');
						var navHtml = '';
						if (view.previous) {
							navHtml += '<button id="all-awards-prev" class="px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors dark:text-white">\\u2190 Previous</button>';
						} else {
							navHtml += '<div></div>';
						}
						navHtml += '<span class="text-xs text-gray-400 dark:text-neutral-500">' + allItems.length + ' of ' + totalItems + '</span>';
						if (view.next) {
							navHtml += '<button id="all-awards-next" class="px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors dark:text-white">Next \\u2192</button>';
						} else {
							navHtml += '<div></div>';
						}
						navEl.innerHTML = navHtml;

						if (view.previous) {
							document.getElementById('all-awards-prev').addEventListener('click', function() {
								loadAllAwards(view.previous);
							});
						}
						if (view.next) {
							document.getElementById('all-awards-next').addEventListener('click', function() {
								loadAllAwards(view.next);
							});
						}

						document.getElementById('all-awards-search').addEventListener('input', applyFilters);
						document.getElementById('all-awards-cat-filter').addEventListener('change', applyFilters);
						applyFilters();
					}

					// --- Blazer ---
					function loadBlazer() {
						var root = document.getElementById('blazer-root');
						var studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
						var token = studentData.accessToken;
						var studentId = studentData.studentId;
						if (!token || !studentId) {
							root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">No access token found. Please log in again.</p></div>';
							return;
						}

						var cacheKey = 'blazerCache_' + studentId;
						var cached = null;
						try { cached = JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch(e) {}
						if (cached) renderBlazer(root, cached);

						var badgesUrl = '/api/proxy/all-awards?url=' + encodeURIComponent('https://api.sbhs.net.au/api/core/students/' + encodeURIComponent(studentId) + '/award-scheme/badges');
						fetch(badgesUrl, { headers: { 'Authorization': 'Bearer ' + token } })
							.then(function(res) {
								if (res.status === 401 || res.status === 403) {
									return fetch('/api/auth/refresh').then(function(r) { return r.json(); }).then(function(refreshData) {
										if (refreshData.success && refreshData.accessToken) {
											studentData.accessToken = refreshData.accessToken;
											localStorage.setItem('studentData', JSON.stringify(studentData));
											return fetch(badgesUrl, { headers: { 'Authorization': 'Bearer ' + refreshData.accessToken } });
										}
										throw new Error('Session expired');
									});
								}
								return res;
							})
							.then(function(res) {
								if (!res.ok) throw new Error('HTTP ' + res.status);
								return res.json();
							})
							.then(function(data) {
								try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch(e) {}
								renderBlazer(root, data);
							})
							.catch(function(e) {
								console.error('Failed to fetch blazer badges:', e);
								if (!cached) root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Failed to load blazer badges.</p></div>';
							});
					}

function renderBlazer(root, data) {
    var items = data.member || [];
    if (items.length === 0) {
        root.innerHTML = '<div class="text-center py-12"><p class="text-gray-400 dark:text-neutral-500 text-sm">No blazer badges earned yet.</p></div>';
        return;
    }

    // Helper for HTML escaping if not defined globally
    var safeEsc = typeof esc === 'function' ? esc : function(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    var rows = items.map(function(item) {
        var award = item.award || {};
        var nomination = item.nomination || {};
        var cat = award.category || {};
        var date = item.date || '';
        var dateLabel = '';

        if (date) {
            var dp = date.split('T')[0].split('-');
            var month = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            dateLabel = parseInt(dp[2], 10) + ' ' + (month[parseInt(dp[1], 10)] || '') + ' ' + dp[0];
        }

        var activityName = safeEsc(award.name || 'Unnamed Activity');
        var lineOrBadge = safeEsc((cat.name || '').toUpperCase());
        var additional = safeEsc(nomination.name || '');

        return '<tr class="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">' +
            '<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-neutral-400 font-mono">' + dateLabel + '</td>' +
            '<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">' + activityName + '</td>' +
            
            '<td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">' + additional + '</td>' +
        '</tr>';
    }).join('');

    root.innerHTML =
        '<div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">' +
            '<table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-700 text-left ">' +
                '<thead class="bg-gray-50 dark:bg-neutral-800 text-xs font-semibold text-gray-700 dark:text-neutral-300 uppercase tracking-wider">' +
                    '<tr>' +
                        '<th scope="col" class="px-4 py-3">Date</th>' +
                        '<th scope="col" class="px-4 py-3">Line</th>' +
                        
                        '<th scope="col" class="px-4 py-3">Additional</th>' +
                    '</tr>' +
                '</thead>' +
                '<tbody class="divide-y divide-gray-200 dark:divide-neutral-700 bg-white dark:bg-neutral-900">' +
                    rows +
                '</tbody>' +
            '</table>' +
        '</div>';

					}

					// --- Plan Tab ---
					var planState = {
						planned: [],
						allAwards: [],
						prizesData: null,
						currentNominations: 0,
						currentCatPoints: {}
					};

					function loadPlanAwards() {
						var root = document.getElementById('plan-root');
						var studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
						var token = studentData.accessToken;
						var studentId = studentData.studentId;
						if (!token) { root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">No access token.</p></div>'; return; }

						// Load saved plan
						var planCacheKey = 'planAwards_' + studentId;
						try { planState.planned = JSON.parse(localStorage.getItem(planCacheKey) || '[]'); } catch(e) { planState.planned = []; }

						// Fetch current nominations + prizes + all awards in parallel
						var prizesUrl = '/api/proxy/all-awards?url=' + encodeURIComponent('https://api.sbhs.net.au/api/core/award-scheme/prizes');
						Promise.all([
							fetch('/api/proxy/awards?studentId=' + encodeURIComponent(studentId), { headers: { 'Authorization': 'Bearer ' + token } }),
							fetch(prizesUrl, { headers: { 'Authorization': 'Bearer ' + token } }),
							fetch('/api/proxy/all-awards', { headers: { 'Authorization': 'Bearer ' + token } })
						]).then(function(results) {
							var awardsRes = results[0], prizesRes = results[1], allAwardsRes = results[2];

							if (awardsRes.status === 401 || awardsRes.status === 403) {
								return fetch('/api/auth/refresh').then(function(r){return r.json();}).then(function(rd) {
									if (!rd.success || !rd.accessToken) throw new Error('Session expired');
									studentData.accessToken = rd.accessToken;
									localStorage.setItem('studentData', JSON.stringify(studentData));
									return Promise.all([
										fetch('/api/proxy/awards?studentId=' + encodeURIComponent(studentId), { headers: { 'Authorization': 'Bearer ' + rd.accessToken } }),
										fetch(prizesUrl, { headers: { 'Authorization': 'Bearer ' + rd.accessToken } }),
										fetch('/api/proxy/all-awards', { headers: { 'Authorization': 'Bearer ' + rd.accessToken } })
									]);
								});
							}
							return results;
						}).then(function(resolved) {
							if (!resolved) throw new Error('Session expired');
							return Promise.all(resolved.map(function(r) { return r.json(); }));
						}).then(function(datas) {
							// Count current nominations
							var items = (datas[0].member || []);
							var noms = items.filter(function(item) {
								var aw = item.award || {};
								return (aw.category && aw.category.name || '').toUpperCase().indexOf('NOMINATION') !== -1;
							});
							planState.currentNominations = noms.length;
							planState.prizesData = datas[1];

							// Current points per category
							var currentCatPoints = {};
							PROGRESS_CATEGORIES.forEach(function(c) { currentCatPoints[c] = 0; });
							var realAwards = items.filter(function(item) {
								var aw = item.award || {};
								return (aw.category && aw.category.name || '').toUpperCase().indexOf('NOMINATION') === -1;
							});
							realAwards.forEach(function(item) {
								var aw = item.award || {};
								var catName = (aw.category && aw.category.name) || '';
								var matched = matchProgressCategory(catName);
								if (matched) currentCatPoints[matched] += (aw.points || 0);
							});
							planState.currentCatPoints = currentCatPoints;

							// All awards for catalog
							var allItems = datas[2].member || [];
							planState.allAwards = allItems.map(function(item) {
								return {
									name: item.name || 'Unnamed Award',
									points: item.points || 0,
									housePoints: item.housePoints || 0,
									category: (item.category && item.category.name) || 'Uncategorised',
									tier: item.tier || 0,
									archived: item.archived || false
								};
							});

							renderPlanTab();
						}).catch(function(e) {
							console.error('Failed to load plan data:', e);
							root.innerHTML = '<div class="text-center py-12"><p class="text-gray-500 dark:text-neutral-400 text-sm">Failed to load plan data.</p></div>';
						});
					}

					function savePlan() {
						var studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
						var studentId = studentData.studentId;
						if (!studentId) return;
						try { localStorage.setItem('planAwards_' + studentId, JSON.stringify(planState.planned)); } catch(e) {}
					}

					function resetPlan() {
						planState.planned = [];
						savePlan();
						updatePlanProjection();
					}

					function addToPlan(award, cat) {
						planState.planned.push({
							name: award.name,
							points: award.points,
							housePoints: award.housePoints,
							category: award.category,
							matchedCategory: cat,
							_id: Date.now() + '_' + Math.random().toString(36).substr(2, 5)
						});
						savePlan();
						updatePlanProjection();
					}

					function removeFromPlan(id) {
						planState.planned = planState.planned.filter(function(p) { return p._id !== id; });
						savePlan();
						updatePlanProjection();
					}

					function getPlanProjection() {
						var catData = {};
						PROGRESS_CATEGORIES.forEach(function(c) {
							catData[c] = { points: (planState.currentCatPoints[c] || 0), plannedPoints: 0, noms: 0 };
						});

						planState.planned.forEach(function(p) {
							if (p.matchedCategory && catData[p.matchedCategory]) {
								catData[p.matchedCategory].plannedPoints += p.points;
							}
						});

						// Also count current nominations per category from the existing data
						// We need to fetch this from My Awards or calculate from the student data
						// For now, we just track planned points per category

						// Calculate planned nominations per category
						PROGRESS_CATEGORIES.forEach(function(c) {
							var totalPts = catData[c].points + catData[c].plannedPoints;
							catData[c].totalPoints = totalPts;
							catData[c].noms = Math.floor(totalPts / 30);
						});

						// Projected nominations: total points (current + planned) per category, floor divided by 30
						var projectedTotal = 0;
						PROGRESS_CATEGORIES.forEach(function(c) {
							projectedTotal += Math.floor(catData[c].totalPoints / 30);
						});

						var totalPlannedNoms = Math.max(0, projectedTotal - planState.currentNominations);

						// Find projected prize
						var prizes = (planState.prizesData && planState.prizesData.member) || [];
						var sortedPrizes = prizes.slice().sort(function(a,b) { return a.tier - b.tier; });
						var currentPrize = null, nextPrize = null;
						for (var i = 0; i < sortedPrizes.length; i++) {
							if (planState.currentNominations >= sortedPrizes[i].nominationsRequired) {
								currentPrize = sortedPrizes[i];
							}
						}
						var projectedPrize = null, projectedNextPrize = null;
						for (var i = 0; i < sortedPrizes.length; i++) {
							if (projectedTotal >= sortedPrizes[i].nominationsRequired) {
								projectedPrize = sortedPrizes[i];
								projectedNextPrize = i < sortedPrizes.length - 1 ? sortedPrizes[i + 1] : null;
							}
						}

						return {
							catData: catData,
							currentNoms: planState.currentNominations,
							plannedNoms: totalPlannedNoms,
							projectedTotal: projectedTotal,
							currentPrize: currentPrize,
							projectedPrize: projectedPrize,
							projectedNextPrize: projectedNextPrize,
							sortedPrizes: sortedPrizes
						};
					}

					function updatePlanProjection() {
						var proj = getPlanProjection();

						// Update projection panel
						var projEl = document.getElementById('plan-projection');
						if (projEl) {
							var currentTierName = proj.currentPrize ? proj.currentPrize.name : 'None';
							var projectedTierName = proj.projectedPrize ? proj.projectedPrize.name : 'None';

							var progressHtml = '';
							if (proj.projectedNextPrize && proj.projectedPrize) {
								var prevReq = proj.projectedPrize.nominationsRequired;
								var nextReq = proj.projectedNextPrize.nominationsRequired;
								var range = nextReq - prevReq;
								var progress = proj.projectedTotal - prevReq;
							var pct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;
							progressHtml =
									'<div class="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700">' +
										'<div class="flex justify-between items-center mb-1">' +
											'<span class="text-xs text-gray-500 dark:text-neutral-400">Next: ' + esc(proj.projectedNextPrize.name) + '</span>' +
											'<span class="text-xs font-semibold dark:text-white">' + proj.projectedTotal + ' / ' + nextReq + '</span>' +
										'</div>' +
										'<div class="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">' +
											'<div class="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all" style="width:' + pct + '%"></div>' +
										'</div>' +
									'</div>';
							} else if (!proj.projectedNextPrize && proj.projectedPrize) {
								progressHtml =
									'<div class="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700">' +
										'<p class="text-xs text-green-600 dark:text-green-400 font-semibold">Maximum tier reached!</p>' +
									'</div>';
							}

						projEl.innerHTML =
								'<div class="border border-gray-200 dark:border-neutral-700 rounded-lg p-6 bg-gray-50 dark:bg-neutral-900">' +
									'<h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-4">Projection</h2>' +
									'<div class="space-y-2 text-sm">' +
										'<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Current</span><span class="font-semibold dark:text-white">' + esc(currentTierName) + ' (' + proj.currentNoms + ')</span></div>' +
										'<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Planned</span><span class="font-semibold text-blue-600 dark:text-blue-400">+' + proj.plannedNoms + '</span></div>' +
										'<div class="flex justify-between border-t border-gray-200 dark:border-neutral-700 pt-2"><span class="text-gray-500 dark:text-neutral-400">Projected</span><span class="font-bold dark:text-white">' + esc(projectedTierName) + ' (' + proj.projectedTotal + ')</span></div>' +
								'</div>' +
								progressHtml +
							'</div>';
						}

						// Update category panels
						PROGRESS_CATEGORIES.forEach(function(cat) {
						var panel = document.getElementById('plan-cat-' + cat.replace(/[^a-zA-Z]/g, ''));
						if (!panel) return;
						var cd = proj.catData[cat];
						var pct = Math.min(100, Math.round((cd.totalPoints % 30) / 30 * 100));
						var barColor = (cd.totalPoints % 30) >= 30 ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-400';

						var chips = planState.planned.filter(function(p) { return p.matchedCategory === cat; });
						var nomsLabel = cd.noms > 0 ? '<span class="text-xs font-medium text-blue-600 dark:text-blue-400 ml-1">x' + cd.noms + '</span>' : '';
						var ptsLabel = cd.plannedPoints > 0
							? '<span class="text-xs font-mono dark:text-white">' + cd.points + ' + <span class="text-blue-500 dark:text-blue-400">' + cd.plannedPoints + '</span> = ' + cd.totalPoints + '</span>'
							: '<span class="text-xs font-mono dark:text-white">' + cd.points + '</span>';

						var chipsHtml = chips.map(function(p) {
							return '<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">' +
								esc(p.name) + ' (+' + p.points + ')' +
								'<button data-plan-id="' + p._id + '" class="plan-remove ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200">&times;</button>' +
							'</span>';
						}).join(' ');

						panel.innerHTML =
							'<div class="w-44 shrink-0">' +
								'<span class="text-xs font-medium dark:text-white">' + esc(cat) + nomsLabel + '</span>' +
							'</div>' +
							'<div class="flex-1 min-w-0">' +
								'<div class="relative w-full h-1.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">' +
									(pct > 0 ? '<div class="absolute inset-y-0 left-0 ' + barColor + ' rounded-full transition-all" style="width:' + pct + '%"></div>' : '') +
								'</div>' +
								(chipsHtml ? '<div class="flex flex-wrap gap-1 mt-1.5">' + chipsHtml + '</div>' : '') +
							'</div>' +
							'<div class="w-28 shrink-0 text-right">' + ptsLabel + '</div>';
						});

						// Re-bind remove buttons
						document.querySelectorAll('.plan-remove').forEach(function(btn) {
							btn.addEventListener('click', function(e) {
								e.stopPropagation();
								removeFromPlan(btn.dataset.planId);
							});
						});

						// Update catalog highlight
						updateCatalogCount();
					}

					function updateCatalogCount() {
						var countEl = document.getElementById('plan-catalog-count');
						if (countEl) {
							countEl.textContent = planState.planned.length + ' selected';
						}
					}

					function renderPlanTab() {
						var root = document.getElementById('plan-root');
						var proj = getPlanProjection();

						// Build category panels
						var catPanels = PROGRESS_CATEGORIES.map(function(cat) {
							var catId = 'plan-cat-' + cat.replace(/[^a-zA-Z]/g, '');
							return '<div id="' + catId + '" class="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-neutral-800 last:border-0" data-category="' + esc(cat) + '"></div>';
						}).join('');

						root.innerHTML =
							'<div class="space-y-6">' +
								// Top: Awards Catalog
								'<div>' +
									'<div class="border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-900">' +
										'<div class="px-4 py-3 border-b border-gray-200 dark:border-neutral-700">' +
											'<h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Awards Catalog</h2>' +
											'<div class="flex gap-2">' +
												'<input type="text" id="plan-search" placeholder="Search awards..." class="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />' +
												'<select id="plan-cat-filter" class="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">' +
													'<option value="">All Categories</option>' +
													PROGRESS_CATEGORIES.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('') +
												'</select>' +
											'</div>' +
											'<p id="plan-catalog-count" class="text-xs text-gray-400 dark:text-neutral-500 mt-2">' + planState.planned.length + ' selected</p>' +
										'</div>' +
										'<div id="plan-catalog-list" class="max-h-[40vh] overflow-y-auto"></div>' +
									'</div>' +
								'</div>' +
								// Middle: Category Drop Zones
								'<div>' +
									'<div class="flex items-center justify-between mb-3">' +
										'<h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300">Your Plan</h2>' +
										(planState.planned.length > 0 ? '<button id="plan-reset" class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Reset</button>' : '') +
									'</div>' +
									'<div class="border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">' + catPanels + '</div>' +
								'</div>' +
								// Bottom: Prize Projection
								'<div>' +
									'<div id="plan-projection"></div>' +
								'</div>' +
							'</div>';

						// Render catalog list
						function renderCatalog(search, catFilter) {
							var s = (search || '').toLowerCase();
							var cat = catFilter || '';
							var filtered = planState.allAwards.filter(function(a) {
								var matchSearch = !s || a.name.toLowerCase().indexOf(s) !== -1 || a.category.toLowerCase().indexOf(s) !== -1;
								var matchCat = !cat || matchProgressCategory(a.category) === cat;
								return matchSearch && matchCat;
							});

							var el = document.getElementById('plan-catalog-list');
							if (!el) return;

							if (filtered.length === 0) {
								el.innerHTML = '<div class="p-4 text-center text-gray-400 dark:text-neutral-500 text-sm">No awards found</div>';
								return;
							}

							el.innerHTML = filtered.map(function(a, i) {
								var origIdx = planState.allAwards.indexOf(a);
								var archBadge = a.archived ? '<span class="ml-1 text-xs text-gray-400 dark:text-neutral-500">(archived)</span>' : '';
								return '<div class="plan-catalog-item px-4 py-3 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-grab border-b border-gray-100 dark:border-neutral-800 last:border-0 active:cursor-grabbing" draggable="true" data-award-idx="' + origIdx + '">' +
									'<div class="flex items-start justify-between gap-2">' +
										'<div class="min-w-0">' +
											'<div class="text-sm font-medium dark:text-white truncate">' + esc(a.name) + archBadge + '</div>' +
											'<div class="text-xs text-gray-500 dark:text-neutral-400">' + esc(a.category) + '</div>' +
										'</div>' +
										'<div class="shrink-0 text-right">' +
											'<div class="text-sm font-mono text-blue-600 dark:text-blue-400">+' + a.points + '</div>' +
										'</div>' +
									'</div>' +
								'</div>';
							}).join('');

							// Bind drag + click events on catalog items
							el.querySelectorAll('.plan-catalog-item').forEach(function(item) {
								item.addEventListener('dragstart', function(e) {
									e.dataTransfer.setData('text/plain', item.dataset.awardIdx);
									e.dataTransfer.effectAllowed = 'copy';
									item.style.opacity = '0.5';
								});
								item.addEventListener('dragend', function(e) {
									item.style.opacity = '1';
								});
								item.addEventListener('click', function() {
									var idx = parseInt(item.dataset.awardIdx, 10);
									var award = planState.allAwards[idx];
									if (!award) return;
									var cat = matchProgressCategory(award.category);
									if (cat) addToPlan(award, cat);
								});
							});
						}

						// Bind catalog search and filter
						var searchInput = document.getElementById('plan-search');
						var catFilter = document.getElementById('plan-cat-filter');
						if (searchInput) searchInput.addEventListener('input', function() {
							renderCatalog(searchInput.value, catFilter.value);
						});
						if (catFilter) catFilter.addEventListener('change', function() {
							renderCatalog(searchInput.value, catFilter.value);
						});

						renderCatalog('', '');
						updatePlanProjection();

						// Drop anywhere on plan area auto-categorizes
						var planRoot = document.getElementById('plan-root');
						planRoot.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
						planRoot.addEventListener('drop', function(e) {
							e.preventDefault();
							var awardIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
							if (!isNaN(awardIdx) && planState.allAwards[awardIdx]) {
								var award = planState.allAwards[awardIdx];
								var cat = matchProgressCategory(award.category);
								if (cat) addToPlan(award, cat);
							}
						});

						var resetBtn = document.getElementById('plan-reset');
						if (resetBtn) resetBtn.addEventListener('click', function() { resetPlan(); renderPlanTab(); });
					}
				})();
				`
			}} />
		</Layout>
	)
})

export default app