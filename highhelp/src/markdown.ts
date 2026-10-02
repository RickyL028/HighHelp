// Minimal markdown renderer for user-authored announcement bodies.
//
// Everything is HTML-escaped before any other rule runs and only http(s)/mailto URLs are ever
// linked, so the output is safe to inject with dangerouslySetInnerHTML without a sanitiser.
// Supported: ATX headings, fenced code, blockquotes, ordered/unordered lists, horizontal rules,
// paragraphs with two-space line breaks, inline code, bold, italic, strikethrough, links and
// bare URLs.

const escapeHtml = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CODE_CLASS = 'px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-900 text-[0.9em] font-mono';
const LINK_CLASS = 'text-blue-600 dark:text-blue-400 hover:underline';
const HEADING_CLASS = 'font-bold text-gray-900 dark:text-white mt-4 mb-2 first:mt-0';

// Inlines the markdown rules that apply inside a single block. Code spans are lifted out first
// so their contents never see emphasis or link rules, then put back at the very end.
const inline = (raw: string): string => {
	const spans: string[] = [];
	let s = raw.replace(/`([^`\n]+)`/g, (_m, code: string) => {
		spans.push(`<code class="${CODE_CLASS}">${escapeHtml(code)}</code>`);
		return `\u0000SPAN${spans.length - 1}\u0000`;
	});

	s = escapeHtml(s);

	// [label](href) is only linked when the href carries an allow-listed scheme.
	s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) =>
		/^(https?:\/\/|mailto:)/i.test(href) ? `<a href="${href}" class="${LINK_CLASS}" rel="noopener noreferrer nofollow" target="_blank">${label}</a>` : match
	);

	// Bare URLs. \x00 is excluded so a trailing code-span placeholder is never swallowed.
	s = s.replace(
		/(^|[\s(])(https?:\/\/[^\s<>()\u0000-\u001f]+)/g,
		(_m, lead: string, url: string) => `${lead}<a href="${url}" class="${LINK_CLASS}" rel="noopener noreferrer nofollow" target="_blank">${url}</a>`
	);

	s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
	s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
	s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?![*\w])/g, '$1<em>$2</em>');
	s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

	return s.replace(/\u0000SPAN(\d+)\u0000/g, (_m, i: string) => spans[Number(i)]);
};

const isBlockStart = (line: string): boolean =>
	/^\s*$/.test(line) ||
	/^(#{1,6})\s/.test(line) ||
	/^>\s?/.test(line) ||
	/^\s*[-*+]\s+/.test(line) ||
	/^\s*\d+[.)]\s+/.test(line) ||
	/^(?:---|\*\*\*|___)\s*$/.test(line) ||
	/^\u0000BLOCK\d+\u0000$/.test(line);

export function renderMarkdown(md: string | null | undefined): string {
	if (!md) return '';

	// Fenced code is lifted out before any other rule so its body escapes the inline rules
	// untouched, then re-inserted verbatim as its own block.
	const fenced: string[] = [];
	let source = String(md)
		.replace(/\r\n?/g, '\n')
		.replace(/```([\w+#-]*)[ \t]*\n([\s\S]*?)(?:```|$)/g, (_m, lang: string, code: string) => {
			const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
			fenced.push(`<pre class="my-3 p-3 rounded-lg bg-gray-100 dark:bg-neutral-900 overflow-x-auto text-sm"><code${cls}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
			return `\u0000BLOCK${fenced.length - 1}\u0000`;
		});

	const lines = source.split('\n');
	const out: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		const block = /^\u0000BLOCK(\d+)\u0000$/.exec(line);
		if (block) {
			out.push(fenced[Number(block[1])]);
			i++;
			continue;
		}

		if (!line.trim()) {
			i++;
			continue;
		}

		if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
			out.push('<hr class="my-4 border-gray-200 dark:border-neutral-700" />');
			i++;
			continue;
		}

		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading) {
			const level = heading[1].length + 1; // h1 is the page title, so start at h2
			out.push(`<h${level} class="${HEADING_CLASS} text-xl">${inline(heading[2])}</h${level}>`);
			i++;
			continue;
		}

		if (/^>\s?/.test(line)) {
			const quote: string[] = [];
			while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
			out.push(`<blockquote class="my-3 pl-3 border-l-4 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300">${inline(quote.join('\n')).replace(/\n/g, '<br />')}</blockquote>`);
			continue;
		}

		const listMatch = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
		if (listMatch) {
			const ordered = /\d/.test(listMatch[2]);
			const items: string[] = [];
			while (i < lines.length) {
				const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
				// A different marker style ends the list; anything else continues the current item.
				if (!item || /\d/.test(item[2]) !== ordered) break;
				let body = item[3];
				i++;
				while (i < lines.length && !isBlockStart(lines[i])) body += `\n${lines[i++]}`;
				items.push(`<li class="my-0.5">${inline(body).replace(/\n/g, '<br />')}</li>`);
			}
			const tag = ordered ? 'ol' : 'ul';
			out.push(`<${tag} class="my-2 pl-6 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-gray-400 dark:marker:text-neutral-500">${items.join('')}</${tag}>`);
			continue;
		}

		const para: string[] = [line];
		i++;
		while (i < lines.length && !isBlockStart(lines[i])) para.push(lines[i++]);
		out.push(`<p class="my-2 first:mt-0 last:mb-0">${inline(para.join('\n')).replace(/ {2,}\n/g, '<br />').replace(/\n/g, '<br />')}</p>`);
	}

	return out.join('');
}