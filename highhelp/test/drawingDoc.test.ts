import { describe, expect, it } from 'vitest';
import {
	DRAWING_KEY_PREFIX,
	DRAWING_MAX_BYTES,
	attemptDrawingUrls,
	checkSvgUpload,
	drawingContextForMode,
	drawingObjectKey,
	mockDrawingContext,
	mockDrawingUrls,
	withDrawingVersion,
	type DrawingContext
} from '../src/routes/pastPapers/drawingDoc';

// Shaped like js-draw's toSVG() output: grid background, a pressure stroke, typed text and a pasted image.
const jsDrawSvg = [
	'<svg viewBox="0 0 500 700" width="500" height="700" version="1.1" baseProfile="full" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
	'<g class="js-draw-image-background js-draw-image-background-grid js-draw-image-background-grid-25">',
	'<path d="M0,0L500,0L500,700L0,700Z" fill="#ffffff"/><path d="M0,25L500,25" fill="none" stroke="#f0f0f0" stroke-width="0.7"/>',
	'</g>',
	'<path d="M10,10Q20,30 40,35L42,37Q22,32 12,12Z" fill="#000000"/>',
	'<text style="transform: matrix(1, 0, 0, 1, 50, 80); font-family: sans-serif; font-size: 32px; fill: #000000;">if one=1 then &lt;script&gt; onload="x" stays text</text>',
	'<image href="data:image/png;base64,iVBORw0KGgo=" x="0" y="0" width="10" height="10"/>',
	'<image xlink:href="#local" width="1" height="1"/>',
	'</svg>'
].join('');

describe('drawingContextForMode', () => {
	it('maps review mode to its own context and everything else to practice', () => {
		expect(drawingContextForMode('review')).toBe('review');
		expect(drawingContextForMode('')).toBe('practice');
		expect(drawingContextForMode(undefined)).toBe('practice');
		expect(drawingContextForMode('REVIEW')).toBe('practice');
	});
});

describe('drawingObjectKey', () => {
	it('places each drawing under its question, then its owner', () => {
		expect(drawingObjectKey(12, 7, 'practice')).toBe('drawings/q12/u7/practice.svg');
		expect(drawingObjectKey(12, 7, 'review')).toBe('drawings/q12/u7/review.svg');
		expect(drawingObjectKey(12, 7, 'practice').startsWith(DRAWING_KEY_PREFIX)).toBe(true);
	});

	it('refuses ids that would produce a key no route can find again', () => {
		expect(() => drawingObjectKey(NaN, 7, 'practice')).toThrow();
		expect(() => drawingObjectKey(12, 0, 'practice')).toThrow();
		expect(() => drawingObjectKey(1.5, 7, 'practice')).toThrow();
	});

	it('keeps each mock exam separate and refuses contexts that are not one of the known shapes', () => {
		expect(drawingObjectKey(12, 7, mockDrawingContext(3))).toBe('drawings/q12/u7/mock-3.svg');
		for (const context of ['mock-0', 'mock-x', 'mock-', '../practice', 'practice/../review', 'Practice']) {
			expect(() => drawingObjectKey(12, 7, context as DrawingContext)).toThrow();
		}
	});
});

describe('mockDrawingContext', () => {
	it('names the exam and rejects ids that are not positive integers', () => {
		expect(mockDrawingContext(42)).toBe('mock-42');
		expect(() => mockDrawingContext(0)).toThrow();
		expect(() => mockDrawingContext(NaN)).toThrow();
		expect(() => mockDrawingContext(2.5)).toThrow();
	});
});

describe('mockDrawingUrls', () => {
	it('addresses one question within one mock exam', () => {
		expect(mockDrawingUrls(3, 9)).toEqual({
			svgUrl: '/past-papers/mock-exams/3/questions/9/drawing.svg',
			saveUrl: '/past-papers/mock-exams/3/questions/9/drawing'
		});
	});
});

describe('attemptDrawingUrls', () => {
	it('only carries the mode when it is a review attempt', () => {
		expect(attemptDrawingUrls(5, 'practice')).toEqual({
			svgUrl: '/past-papers/attempt/5/drawing.svg',
			saveUrl: '/past-papers/attempt/5/drawing'
		});
		expect(attemptDrawingUrls(5, 'review')).toEqual({
			svgUrl: '/past-papers/attempt/5/drawing.svg?mode=review',
			saveUrl: '/past-papers/attempt/5/drawing?mode=review'
		});
	});
});

describe('withDrawingVersion', () => {
	it('adds the saved-at stamp with the right separator', () => {
		expect(withDrawingVersion('/a/drawing.svg', '2026-10-09 12:00:00')).toBe('/a/drawing.svg?v=2026-10-09%2012%3A00%3A00');
		expect(withDrawingVersion('/a/drawing.svg?mode=review', 3)).toBe('/a/drawing.svg?mode=review&v=3');
	});

	it('leaves the URL alone when there is no version', () => {
		expect(withDrawingVersion('/a/drawing.svg', null)).toBe('/a/drawing.svg');
		expect(withDrawingVersion('/a/drawing.svg', '')).toBe('/a/drawing.svg');
	});
});

describe('checkSvgUpload', () => {
	it("accepts js-draw's own output, including text that merely looks like markup", () => {
		const result = checkSvgUpload(jsDrawSvg);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.byteLength).toBe(new TextEncoder().encode(jsDrawSvg).byteLength);
	});

	it('accepts an XML prolog and surrounding whitespace', () => {
		expect(checkSvgUpload(`\n<?xml version="1.0" encoding="UTF-8"?>\n${jsDrawSvg}\n`).ok).toBe(true);
	});

	it('rejects documents that are not SVG', () => {
		expect(checkSvgUpload('<html><body></body></html>')).toMatchObject({ ok: false, status: 400 });
		expect(checkSvgUpload('<svgx></svgx>')).toMatchObject({ ok: false, status: 400 });
		expect(checkSvgUpload('<svg>')).toMatchObject({ ok: false, status: 400 });
		expect(checkSvgUpload('')).toMatchObject({ ok: false, status: 400 });
	});

	it('rejects oversized drawings with 413', () => {
		const padding = 'x'.repeat(DRAWING_MAX_BYTES);
		expect(checkSvgUpload(`<svg><desc>${padding}</desc></svg>`)).toMatchObject({ ok: false, status: 413 });
	});

	it('rejects elements that can run script or embed documents', () => {
		for (const inner of ['<script>alert(1)</script>', '<SCRIPT/>', '<foreignObject><div/></foreignObject>', '<iframe src="x"/>', '<embed src="x"/>']) {
			expect(checkSvgUpload(`<svg>${inner}</svg>`)).toMatchObject({ ok: false, status: 400 });
		}
	});

	it('rejects event handler attributes however they are quoted', () => {
		for (const attr of ['onload="alert(1)"', "ONCLICK='x()'", 'onmouseover=x()', 'onbegin = "x"']) {
			expect(checkSvgUpload(`<svg><rect ${attr}/></svg>`)).toMatchObject({ ok: false, status: 400 });
		}
		expect(checkSvgUpload('<svg onload="alert(1)"></svg>')).toMatchObject({ ok: false, status: 400 });
	});

	it('does not let a ">" inside a quoted value hide a later attribute', () => {
		expect(checkSvgUpload('<svg><path d="a>b" onload="x"/></svg>')).toMatchObject({ ok: false, status: 400 });
	});

	it('only allows internal references and embedded images in links', () => {
		for (const href of ['javascript:alert(1)', 'java\tscript:alert(1)', ' JAVASCRIPT:alert(1)', 'https://example.com/x.png', 'data:text/html;base64,PHNjcmlwdD4=']) {
			expect(checkSvgUpload(`<svg><a href="${href}"><text>x</text></a></svg>`)).toMatchObject({ ok: false, status: 400 });
			expect(checkSvgUpload(`<svg><image xlink:href="${href}"/></svg>`)).toMatchObject({ ok: false, status: 400 });
		}
		expect(checkSvgUpload('<svg><use href="#shape"/><image href="data:image/jpeg;base64,AA=="/></svg>').ok).toBe(true);
	});

	it('rejects document type declarations', () => {
		expect(checkSvgUpload('<svg><!DOCTYPE x [<!ENTITY a "b">]></svg>')).toMatchObject({ ok: false, status: 400 });
	});
});
