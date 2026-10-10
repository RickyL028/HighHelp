import { describe, expect, it } from 'vitest';
import { parseTopicHierarchy, topicHierarchyKey } from '../src/utils';

describe('parseTopicHierarchy', () => {
	it('splits at a section number', () => {
		expect(parseTopicHierarchy('Calculus 1.2 Differentiation')).toEqual({ topic: 'Calculus', subtopic: '1.2 Differentiation' });
		expect(parseTopicHierarchy('Module 5')).toEqual({ topic: 'Module', subtopic: '5' });
	});

	it('splits at a spaced dash, or any en or em dash', () => {
		expect(parseTopicHierarchy('Calculus - Integration')).toEqual({ topic: 'Calculus', subtopic: 'Integration' });
		expect(parseTopicHierarchy('Calculus -Integration')).toEqual({ topic: 'Calculus', subtopic: 'Integration' });
		expect(parseTopicHierarchy('Power and Authority – Nazi Germany')).toEqual({ topic: 'Power and Authority', subtopic: 'Nazi Germany' });
		expect(parseTopicHierarchy('Statistics—Bivariate Data')).toEqual({ topic: 'Statistics', subtopic: 'Bivariate Data' });
	});

	it('keeps hyphenated words whole', () => {
		expect(parseTopicHierarchy('Product-to-Sum Identities')).toEqual({ topic: 'Product-to-Sum Identities', subtopic: null });
		expect(parseTopicHierarchy('Z-scores')).toEqual({ topic: 'Z-scores', subtopic: null });
		expect(parseTopicHierarchy('Self-determination – Treaty')).toEqual({ topic: 'Self-determination', subtopic: 'Treaty' });
	});

	it('only treats a number as a section when it starts a word', () => {
		expect(parseTopicHierarchy('3D Vectors')).toEqual({ topic: '3D Vectors', subtopic: null });
		expect(parseTopicHierarchy('Vitamin B12')).toEqual({ topic: 'Vitamin B12', subtopic: null });
	});

	it('splits at whichever separator comes first, and drops the separator from both halves', () => {
		expect(parseTopicHierarchy('Calculus - 1.2 Differentiation')).toEqual({ topic: 'Calculus', subtopic: '1.2 Differentiation' });
		expect(parseTopicHierarchy('Mechanics – Projectiles 2')).toEqual({ topic: 'Mechanics', subtopic: 'Projectiles 2' });
	});

	it('leaves plain names alone and normalises spacing', () => {
		expect(parseTopicHierarchy('  Financial   Mathematics ')).toEqual({ topic: 'Financial Mathematics', subtopic: null });
		// A dangling separator is dropped, so the name joins its topic rather than starting a new one.
		expect(parseTopicHierarchy('Calculus -')).toEqual({ topic: 'Calculus', subtopic: null });
		expect(parseTopicHierarchy('–')).toEqual({ topic: '–', subtopic: null });
		expect(topicHierarchyKey(' Calculus  ')).toBe('calculus');
	});
});
