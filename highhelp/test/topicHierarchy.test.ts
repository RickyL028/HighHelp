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

	it('splits at the first number even inside a word, as Browse groups them', () => {
		expect(parseTopicHierarchy('M1.1 - abc')).toEqual({ topic: 'M', subtopic: '1.1 - abc' });
		expect(parseTopicHierarchy('M1.2 abc')).toEqual({ topic: 'M', subtopic: '1.2 abc' });
		expect(parseTopicHierarchy('MA-C1 Differentiation')).toEqual({ topic: 'MA-C', subtopic: '1 Differentiation' });
		expect(parseTopicHierarchy('Vitamin B12')).toEqual({ topic: 'Vitamin B', subtopic: '12' });
	});

	it('ignores a number with nothing before it', () => {
		expect(parseTopicHierarchy('3D Vectors')).toEqual({ topic: '3D Vectors', subtopic: null });
		expect(parseTopicHierarchy('3D Vectors 2')).toEqual({ topic: '3D Vectors', subtopic: '2' });
	});

	it('makes everything before a section number the topic, even past a dash', () => {
		expect(parseTopicHierarchy('Mechanics – Projectiles 2')).toEqual({ topic: 'Mechanics – Projectiles', subtopic: '2' });
		expect(parseTopicHierarchy('Statistics - Bivariate 3.1 Correlation')).toEqual({ topic: 'Statistics - Bivariate', subtopic: '3.1 Correlation' });
		// A separator left at the seam is dropped from both halves.
		expect(parseTopicHierarchy('Calculus - 1.2 Differentiation')).toEqual({ topic: 'Calculus', subtopic: '1.2 Differentiation' });
		expect(parseTopicHierarchy('Calculus-1.2 Differentiation')).toEqual({ topic: 'Calculus', subtopic: '1.2 Differentiation' });
		expect(parseTopicHierarchy('Calculus: 1.2 Differentiation')).toEqual({ topic: 'Calculus', subtopic: '1.2 Differentiation' });
	});

	it('only splits at a dash when there is no section number', () => {
		expect(parseTopicHierarchy('Calculus – Integration')).toEqual({ topic: 'Calculus', subtopic: 'Integration' });
		// A leading number can't start a subtopic, so the dash still splits.
		expect(parseTopicHierarchy('3D Vectors - Lines')).toEqual({ topic: '3D Vectors', subtopic: 'Lines' });
	});

	it('leaves plain names alone and normalises spacing', () => {
		expect(parseTopicHierarchy('  Financial   Mathematics ')).toEqual({ topic: 'Financial Mathematics', subtopic: null });
		// A dangling separator is dropped, so the name joins its topic rather than starting a new one.
		expect(parseTopicHierarchy('Calculus -')).toEqual({ topic: 'Calculus', subtopic: null });
		expect(parseTopicHierarchy('–')).toEqual({ topic: '–', subtopic: null });
		expect(topicHierarchyKey(' Calculus  ')).toBe('calculus');
	});
});
