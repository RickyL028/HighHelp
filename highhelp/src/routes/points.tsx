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
			<div class="max-w-5xl mx-auto px-4 py-8">


				<div class="flex gap-0 border-b border-gray-200 dark:border-neutral-700 mb-6 justify-start" id="main-tabs">
					<button data-tab="my-awards" class="px-4 py-2 -mb-px border-b-2 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors">Me</button>
					<button data-tab="all-awards" class="px-4 py-2 -mb-px border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 text-sm transition-colors">All</button>
					<button data-tab="blazer" class="px-4 py-2 -mb-px border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 text-sm transition-colors">Blazer</button>
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
							if (btn.dataset.tab === 'all-awards' && !window._allAwardsLoaded) {
								window._allAwardsLoaded = true;
								loadAllAwards();
							}
							if (btn.dataset.tab === 'blazer' && !window._blazerLoaded) {
								window._blazerLoaded = true;
								loadBlazer();
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
							
							// FIX 2: Calculate percentage based on 30 points (next nomination), not a relative max
							var pct = Math.min(100, Math.round((adjusted / 30) * 100)); 
							
							var barColor = adjusted > 0 ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-300 dark:bg-neutral-600';
							var nomLabel = '<span class="text-xs text-gray-400 dark:text-neutral-500 ml-2">x'+nomCount+'</span>'
							var tpts = '<span class="text-xs text-gray-400 dark:text-neutral-500 ml-2">'+pts+' total</span>'
							progressCard +=
								'<div>' +
									'<div class="flex justify-between items-center mb-1">' +
										'<span class="text-xs font-medium dark:text-white">' + esc(cat)  + nomLabel + tpts + '</span>' +
										'<span class="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 dark:bg-neutral-700 dark:text-white font-mono">' + adjusted + '</span>' +
									'</div>' +
									'<div class="w-full h-2 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden">' +
										'<div class="h-full '+barColor+' rounded-full transition-all" style="width:'+pct+'%"></div>' +
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

						root.innerHTML = topRow + nomCard + awardsCard;

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
				})();
				`
			}} />
		</Layout>
	)
})

export default app