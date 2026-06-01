import { Hono } from 'hono'
import { html } from 'hono/html'
import { Bindings } from '../types'
import { Layout } from '../layout'
import { getUser } from '../utils'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/atar', async (c) => {
  const user = await getUser(c)

  return c.html(
    <Layout title="ATAR Calculator" user={user}>
      <div class="max-w-7xl mx-auto px-4 py-8 font-mono">
        <header class="mb-12">
            <h1 class="text-3xl font-bold uppercase tracking-tighter mb-2">ATAR Calculator</h1>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Subject Selection and Inputs */}
          <div class="lg:col-span-2 space-y-6">
            <div class="flex flex-col sm:flex-row gap-3">
              <select id="subject-dropdown" class="flex-grow border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none">
                <option value="" disabled selected>CHOOSE A SUBJECT...</option>
              </select>
              <button id="add-subject-btn" class="bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-sm px-6 py-2">
                ADD SUBJECT
              </button>
            </div>

            <div class="overflow-x-auto border border-gray-300 dark:border-neutral-700 mt-6">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700">
                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase">Subject</th>
                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase w-24">Units</th>
                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase w-32">Percentile</th>
                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase w-24 text-right">HSC Mark</th>
                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase w-24 text-right">Aggregated</th>
                    <th class="px-3 py-2 uppercase w-12 text-center">X</th>
                  </tr>
                </thead>
                <tbody id="selected-subjects-container">
                  <tr id="empty-state">
                    <td colspan="6" class="px-3 py-8 text-center text-gray-500 italic border-b border-gray-200 dark:border-neutral-800">No subjects selected.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Results */}
          <div class="space-y-6">
            <div class="border border-gray-300 dark:border-neutral-700 p-6 flex flex-col items-center justify-center">
              <h2 class="font-bold text-sm uppercase mb-4 bg-black text-white dark:bg-white dark:text-black px-2 py-1 self-start w-full text-center">Projected ATAR</h2>
              
              {/* Unit Selection Dropdown */}
              <div class="mb-6 w-full">
                <label for="target-units-select" class="block text-xs uppercase font-bold text-gray-500 dark:text-gray-400 mb-1">Best of</label>
                <select id="target-units-select" class="w-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none">
                  <option value="10">10 Units</option>
                  <option value="12">12 Units (moderated, y11)</option>
                </select>
              </div>

              <div class="text-center mb-8 w-full">
                <div class="text-5xl font-bold tracking-tighter mb-2" id="final-atar">
                  --.--
                </div>
              </div>

              <table class="w-full text-sm text-left border-collapse border-t border-gray-300 dark:border-neutral-700">
                <tbody>
                  <tr class="border-b border-gray-200 dark:border-neutral-800">
                    <td class="py-2">Total Aggregate</td>
                    <td class="py-2 text-right font-bold" id="total-aggregate">--</td>
                  </tr>
                  <tr>
                    <td class="py-2">Units Counted</td>
                    <td class="py-2 text-right font-bold" id="units-counted">0 / 10</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
        const subjectsData = {
          "Ancient History": { ext: false, marks: [{p: 90, hsc: 89, atar: 74.8}, {p: 75, hsc: 83, atar: 61.8}, {p: 50, hsc: 75, atar: 44.8}] },
          "Biology": { ext: false, marks: [{p: 90, hsc: 88, atar: 79.8}, {p: 75, hsc: 83, atar: 69.6}, {p: 50, hsc: 73.4, atar: 52.4}] },
          "Business Studies": { ext: false, marks: [{p: 90, hsc: 90, atar: 78.4}, {p: 75, hsc: 84, atar: 65.2}, {p: 50, hsc: 75.8, atar: 47.8}] },
          "Chemistry": { ext: false, marks: [{p: 90, hsc: 90, atar: 87.2}, {p: 75, hsc: 84, atar: 79.6}, {p: 50, hsc: 75.2, atar: 67.4}] },
          "Economics": { ext: false, marks: [{p: 90, hsc: 91, atar: 86.0}, {p: 75, hsc: 87, atar: 77.8}, {p: 50, hsc: 78, atar: 62.8}] },
          "Engineering Studies": { ext: false, marks: [{p: 90, hsc: 89, atar: 79.2}, {p: 75, hsc: 81, atar: 67.2}, {p: 50, hsc: 73.6, atar: 52.4}] },
          "English Advanced": { ext: false, marks: [{p: 90, hsc: 91, atar: 85.2}, {p: 75, hsc: 87, atar: 77.8}, {p: 50, hsc: 82.2, atar: 63.6}] },
          "English Extension 1": { ext: true, marks: [{p: 90, hsc: 94, atar: 87.8}, {p: 75, hsc: 92, atar: 81.8}, {p: 50, hsc: 88, atar: 73.8}] },
          "English Extension 2": { ext: true, marks: [{p: 90, hsc: 96, atar: 88.0}, {p: 75, hsc: 92, atar: 81.0}, {p: 50, hsc: 83, atar: 71.6}] },
          "Geography": { ext: false, marks: [{p: 90, hsc: 91, atar: 81.0}, {p: 75, hsc: 85, atar: 68.2}, {p: 50, hsc: 76, atar: 50.4}] },
          "Legal Studies": { ext: false, marks: [{p: 90, hsc: 91, atar: 79.8}, {p: 75, hsc: 86, atar: 68.8}, {p: 50, hsc: 75.6, atar: 50.6}] },
          "Mathematics Advanced": { ext: false, marks: [{p: 90, hsc: 94, atar: 85.8}, {p: 75, hsc: 89, atar: 77.8}, {p: 50, hsc: 79.2, atar: 63.8}] },
          "Mathematics Extension 1": { ext: true, marks: [{p: 90, hsc: 96, atar: 94.4}, {p: 75, hsc: 92, atar: 89.8}, {p: 50, hsc: 91.4, atar: 79.4}] },
          "Mathematics Extension 2": { ext: true, marks: [{p: 90, hsc: 94, atar: 95.8}, {p: 75, hsc: 92, atar: 93.2}, {p: 50, hsc: 87, atar: 89.4}] },
          "Modern History": { ext: false, marks: [{p: 90, hsc: 90, atar: 78.4}, {p: 75, hsc: 83, atar: 67.4}, {p: 50, hsc: 74.2, atar: 50.0}] },
          "History Extension": { ext: true, marks: [{p: 90, hsc: 94, atar: 83.6}, {p: 75, hsc: 90, atar: 76.8}, {p: 50, hsc: 84, atar: 67.2}] },
          "Music 2": { ext: false, marks: [{p: 90, hsc: 96, atar: 89.8}, {p: 75, hsc: 92, atar: 81.6}, {p: 50, hsc: 87.4, atar: 68.2}] },
          "Music Extension": { ext: true, marks: [{p: 90, hsc: 100, atar: 98.8}, {p: 75, hsc: 98, atar: 88.0}, {p: 50, hsc: 94, atar: 71.6}] },
          "PDHPE": { ext: false, marks: [{p: 90, hsc: 89, atar: 74.6}, {p: 75, hsc: 83, atar: 62.6}, {p: 50, hsc: 74.6, atar: 45.6}] },
          "Physics": { ext: false, marks: [{p: 90, hsc: 91, atar: 86.0}, {p: 75, hsc: 84, atar: 77.6}, {p: 50, hsc: 74, atar: 62.0}] },
          "Software Engineering": { ext: false, marks: [{p: 90, hsc: 89, atar: 81.0}, {p: 75, hsc: 83, atar: 69.2}, {p: 50, hsc: 75.2, atar: 53.4}] },
          "Studies of Religion 1-unit": { ext: true, marks: [{p: 90, hsc: 92, atar: 79.8}, {p: 75, hsc: 86, atar: 69.6}, {p: 50, hsc: 77.6, atar: 55.4}] },
          "Studies of Religion 2-unit": { ext: false, marks: [{p: 90, hsc: 90, atar: 81.0}, {p: 75, hsc: 86, atar: 70.8}, {p: 50, hsc: 77.8, atar: 54.6}] },
          "Visual Arts": { ext: false, marks: [{p: 90, hsc: 91, atar: 75.0}, {p: 75, hsc: 88, atar: 61.0}, {p: 50, hsc: 83, atar: 42.4}] },
          "Chinese Continuers": { ext: false, marks: [{p: 90, hsc: 97, atar: 87.0}, {p: 75, hsc: 95, atar: 80.4}, {p: 50, hsc: 87, atar: 65.6}] },
          "Chinese Extension": { ext: true, marks: [{p: 90, hsc: 96, atar: 88.8}, {p: 75, hsc: 94, atar: 82.4}, {p: 50, hsc: 89.2, atar: 74.6}] },
        };

        const atarMapping = [
          { atar: 99.95, agg: 478.7 },
          { atar: 99.50, agg: 458.64 },
          { atar: 99.00, agg: 448.0 },
          { atar: 98.00, agg: 433.56 },
          { atar: 95.00, agg: 404.6 },
          { atar: 90.00, agg: 369.72 },
          { atar: 85.00, agg: 340.22 },
          { atar: 80.00, agg: 312.76 },
          { atar: 75.00, agg: 286.86 },
          { atar: 70.00, agg: 261.54 },
          { atar: 65.00, agg: 236.72 },
          { atar: 60.00, agg: 212.62 },
          { atar: 55.00, agg: 189.06 },
          { atar: 50.00, agg: 165.24 },
        ];

        let selectedSubjects = [];
        let targetUnits = 10;

        function saveToStorage() {
          try {
            localStorage.setItem('atar_selected_subjects', JSON.stringify(selectedSubjects));
            localStorage.setItem('atar_target_units', targetUnits.toString());
          } catch (e) {
            console.error('Failed to save configuration to storage:', e);
          }
        }

        document.addEventListener('DOMContentLoaded', () => {
          const dropdown = document.getElementById('subject-dropdown');
          const targetUnitsSelect = document.getElementById('target-units-select');

          Object.keys(subjectsData).sort().forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            dropdown.appendChild(opt);
          });

          // Load from localStorage
          try {
            const saved = localStorage.getItem('atar_selected_subjects');
            if (saved) {
              selectedSubjects = JSON.parse(saved);
            }
            
            const savedUnits = localStorage.getItem('atar_target_units');
            if (savedUnits) {
              const parsedUnits = parseInt(savedUnits, 10);
              if (parsedUnits === 10 || parsedUnits === 12) {
                targetUnits = parsedUnits;
              }
            }
          } catch (e) {
            console.error('Failed to load selected configuration from storage:', e);
          }

          targetUnitsSelect.value = targetUnits.toString();

          // Listen for target units change
          targetUnitsSelect.addEventListener('change', (e) => {
            targetUnits = parseInt(e.target.value, 10);
            saveToStorage();
            renderSubjects();
          });

          renderSubjects();

          document.getElementById('add-subject-btn').addEventListener('click', () => {
            const val = dropdown.value;
            if (!val || selectedSubjects.find(s => s.name === val)) return;
            
            selectedSubjects.push({
              id: Date.now(),
              name: val,
              percentile: 90
            });
            saveToStorage();
            renderSubjects();
          });
        });

        function interpolate(x, points) {
          const fullPoints = [
            {p: 100, hsc: 100, atar: 100},
            ...points,
            {p: 0, hsc: 50, atar: 50}
          ];

          if (x >= 100) return { hsc: 100, atar: 100 };
          if (x <= 0) return { hsc: 50, atar: 50 };

          for (let i = 0; i < fullPoints.length - 1; i++) {
            const p1 = fullPoints[i];
            const p2 = fullPoints[i+1];
            if (x <= p1.p && x >= p2.p) {
              const ratio = (x - p2.p) / (p1.p - p2.p);
              const hsc = p2.hsc + ratio * (p1.hsc - p2.hsc);
              const atar = p2.atar + ratio * (p1.atar - p2.atar);
              return { hsc, atar };
            }
          }
          return { hsc: 50, atar: 50 };
        }

        function calculateATAR() {
          let hasExt2 = selectedSubjects.some(s => s.name === "Mathematics Extension 2");

          let results = selectedSubjects.map(sub => {
            const data = subjectsData[sub.name];
            let isExt = data.ext;
            let units = isExt ? 1 : 2;
            let exclude = false;

            if (hasExt2) {
              if (sub.name === "Mathematics Advanced") {
                exclude = true;
              } else if (sub.name === "Mathematics Extension 1" || sub.name === "Mathematics Extension 2") {
                isExt = false;
                units = 2;
              }
            }

            const metrics = interpolate(sub.percentile, data.marks);
            const aggregateContribution = isExt ? metrics.atar / 2 : metrics.atar;
            return { ...sub, hsc: metrics.hsc, atar: metrics.atar, units, aggregateContribution, exclude };
          });

          results.forEach(res => {
            if (res.exclude) {
              res.units = 0;
              res.aggregateContribution = 0;
            }
          });

          results.sort((a, b) => b.atar - a.atar);

          let totalAggregate = 0;
          let unitsCounted = 0;

          results.forEach(res => {
            res.countedUnits = 0;
            if (res.units > 0 && unitsCounted < targetUnits) {
              const unitsAvailable = targetUnits - unitsCounted;
              if (res.units <= unitsAvailable) {
                res.countedUnits = res.units;
              } else {
                res.countedUnits = unitsAvailable;
              }
              
              const proportion = res.countedUnits / res.units;
              totalAggregate += res.aggregateContribution * proportion;
              unitsCounted += res.countedUnits;
            }
          });

          document.getElementById('total-aggregate').textContent = totalAggregate.toFixed(1);
          document.getElementById('units-counted').textContent = \`\${unitsCounted} / \${targetUnits}\`;

          if (unitsCounted < targetUnits) {
            document.getElementById('final-atar').textContent = '--.--';
            return results;
          }

          
          const scalingFactor = targetUnits === 12? 1.15:1;

          let finalAtar = '< 50.00';
          if (totalAggregate >= atarMapping[0].agg * scalingFactor) {
            finalAtar = '99.95';
          } else {
            for (let i = 0; i < atarMapping.length - 1; i++) {
              const currentAgg = atarMapping[i].agg * scalingFactor;
              const nextAgg = atarMapping[i+1].agg * scalingFactor;
              if (totalAggregate <= currentAgg && totalAggregate > nextAgg) {
                const ratio = (totalAggregate - nextAgg) / (currentAgg - nextAgg);
                const atar = atarMapping[i+1].atar + ratio * (atarMapping[i].atar - atarMapping[i+1].atar);
                finalAtar = atar.toFixed(2);
                break;
              }
            }
          }

          document.getElementById('final-atar').textContent = finalAtar;
          return results;
        }

        window.updatePercentile = (id, value) => {
          const sub = selectedSubjects.find(s => s.id === id);
          if (sub) {
            let parsed = parseFloat(value);
            
            // Check if string contains fraction notation like "a/b"
            if (typeof value === 'string' && value.includes('/')) {
              const parts = value.split('/');
              if (parts.length === 2) {
                const num = parseFloat(parts[0]);
                const den = parseFloat(parts[1]);
                if (!isNaN(num) && !isNaN(den) && den !== 0) {
                  parsed = (num / den) * 100;
                }
              }
            }
            
            sub.percentile = Math.max(0, Math.min(100, isNaN(parsed) ? 0 : parsed));
            saveToStorage();
            renderSubjects();
          }
        };

        window.removeSubject = (id) => {
          selectedSubjects = selectedSubjects.filter(s => s.id !== id);
          saveToStorage();
          renderSubjects();
        };

        function renderSubjects() {
          const container = document.getElementById('selected-subjects-container');
          const emptyState = document.getElementById('empty-state');
          
          if (selectedSubjects.length === 0) {
            emptyState.style.display = 'table-row';
            document.querySelectorAll('.subject-row').forEach(e => e.remove());
            calculateATAR();
            return;
          }
          
          emptyState.style.display = 'none';
          
          const results = calculateATAR();
          
          // Clear old rows
          document.querySelectorAll('.subject-row').forEach(e => e.remove());

          results.forEach(res => {
            const isCounted = res.countedUnits > 0;
            const isExcluded = res.exclude;
            
            let unitsDisplay = \`\${res.units} U\`;
            if (isExcluded) {
                unitsDisplay = 'Ignored';
            } else if (res.countedUnits > 0 && res.countedUnits < res.units) {
                unitsDisplay += \` (\${res.countedUnits} counted)\`;
            }

            const row = document.createElement('tr');
            row.className = \`subject-row border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 \${!isCounted ? 'opacity-50' : ''}\`;
            
            // The output decimal string is parsed clean to handle decimal points nicely
            const displayedPercentile = Math.round(res.percentile * 100) / 100;

            row.innerHTML = \`
              <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase font-bold text-gray-900 dark:text-white">
                \${res.name}
              </td>
              <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-400 text-xs">
                \${unitsDisplay}
              </td>
              <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">
                <input type="text" value="\${displayedPercentile}" 
                  onchange="updatePercentile(\\ \${res.id} \\, this.value)"
                  class="w-full bg-transparent border-b border-gray-400 dark:border-gray-600 px-1 py-1 text-gray-900 dark:text-white focus:border-black dark:focus:border-white outline-none" />
              </td>
              <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-right">
                \${isExcluded ? '-' : res.hsc.toFixed(1)}
              </td>
              <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-right font-bold text-blue-600 dark:text-blue-400">
                \${isExcluded ? '-' : (res.aggregateContribution * (res.countedUnits / res.units || 0)).toFixed(1)}
              </td>
              <td class="px-3 py-2 text-center">
                <button onclick="removeSubject(\${res.id})" class="text-gray-400 hover:text-red-600 font-bold px-2 py-1 uppercase text-xs">
                  DEL
                </button>
              </td>
            \`;
            
            container.appendChild(row);
          });
        }
        `
      }} />
      
      <div class="text-xs text-gray-500 space-y-2">
              <p class="pt-2"><a href="/atar/how-it-works" class="text-blue-600 hover:underline">How does this work?</a></p>
            </div>
    </Layout>
  )
})

export default app