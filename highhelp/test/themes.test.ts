import { describe, expect, it } from 'vitest';
import { THEME_BOOT_JS, THEME_CSS, THEME_IDS, THEME_PREVIEWS, THEMES } from '../src/themes';

describe('timetable themes', () => {
	it('gives every theme a light and a dark palette', () => {
		for (const t of THEMES) {
			expect(THEME_CSS).toContain(`html.${t.id}{--t-bg:`);
			expect(THEME_CSS).toContain(`html.${t.id}.dark{--t-bg:`);
		}
	});

	// hono's `html` helper cooks template strings, which once turned `.dark\:x` into the invalid
	// selector `.dark:x` and silently dropped most theme rules.
	it('keeps Tailwind variant selectors escaped', () => {
		expect(THEME_CSS).toContain('.dark\\:bg-neutral-800');
		expect(THEME_CSS).not.toMatch(/\.(dark|hover|focus):(?!not\()[a-z]/);
		expect(THEME_CSS).not.toMatch(/-\d+\/\d+[,{ ]/);
	});

	it('lists the same themes in the boot script and the settings tiles', () => {
		expect(THEME_BOOT_JS).toContain(`var THEMES = ${JSON.stringify(THEME_IDS)};`);
		expect(THEME_PREVIEWS.map((p) => p.id)).toEqual(['system', ...THEME_IDS]);
	});

	it('can be inlined in a script tag', () => {
		expect(THEME_BOOT_JS).not.toContain('</script');
	});
});
