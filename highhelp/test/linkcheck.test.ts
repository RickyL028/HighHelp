import { describe, expect, it } from 'vitest';
import { parseStimulusCoordinates } from '../src/routes/pastPapers/practiceExport';

const buildLink = (referenceLink: string, stimKey?: string | null, qKey?: string | null) => {
	const page = parseStimulusCoordinates(stimKey ?? null)?.page
		?? parseStimulusCoordinates(qKey ?? null)?.page
		?? null;
	return {
		text: `Sydney Grammar 2024${page ? ` (Page ${page})` : ''}`,
		href: `${String(referenceLink).split('#')[0]}${page ? `#page=${page}` : ''}`,
	};
};

describe('batch source pdf link', () => {
	const crop = (page: number) => `pdf_crop:{"page":${page},"x":1,"y":2,"w":3,"h":4}`;

	it('deep-links and labels the page for a cropped stimulus', () => {
		expect(buildLink('/download/papers/23.pdf', crop(5))).toEqual({
			text: 'Sydney Grammar 2024 (Page 5)',
			href: '/download/papers/23.pdf#page=5',
		});
	});

	it('falls back to the question image crop when there is no stimulus crop', () => {
		expect(buildLink('/download/papers/23.pdf', null, crop(8)).href).toBe('/download/papers/23.pdf#page=8');
	});

	it('prefers the stimulus crop over the question image crop', () => {
		expect(buildLink('/download/papers/23.pdf', crop(2), crop(9)).href).toBe('/download/papers/23.pdf#page=2');
	});

	it('leaves the link bare for a plain stored image key', () => {
		expect(buildLink('/download/papers/23.pdf', 'stimuli/abc.png')).toEqual({
			text: 'Sydney Grammar 2024',
			href: '/download/papers/23.pdf',
		});
	});

	it('does not double up a fragment if the stored link already has one', () => {
		expect(buildLink('/download/papers/23.pdf#page=99', crop(5)).href).toBe('/download/papers/23.pdf#page=5');
	});

	it('ignores a malformed crop key instead of linking nowhere', () => {
		expect(buildLink('/download/papers/23.pdf', 'pdf_crop:{oops').href).toBe('/download/papers/23.pdf');
		expect(parseStimulusCoordinates('pdf_crop:{"page":"five","x":1,"y":2,"w":3,"h":4}')).toBeNull();
	});
});
