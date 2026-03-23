/**
 * Discord-flavoured markdown → Matrix HTML
 *
 * Supported syntax:
 *   ***bold italic***   **bold**   *italic*   _italic_   __underline__
 *   ~~strikethrough~~   ||spoiler||   `inline code`
 *   ```lang\ncode block\n```
 *   # / ## / ### headings
 *   > blockquote
 */

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function processInline(raw: string): { html: string; changed: boolean } {
	// Pull code spans out first so their content is never processed
	const spans: string[] = [];
	let s = raw.replace(/`([^`\n]+)`/g, (_, code) => {
		spans.push(`<code>${escapeHtml(code)}</code>`);
		return `\x02${spans.length - 1}\x03`;
	});
	const hadSpans = spans.length > 0;

	// Escape remaining HTML entities
	s = escapeHtml(s);

	// Apply inline formatting — longest/greedier markers first
	s = s.replace(/\|\|(.+?)\|\|/g, '<span data-mx-spoiler="">$1</span>');
	s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
	s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
	s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	s = s.replace(/__(.+?)__/g, '<u>$1</u>');
	s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
	s = s.replace(/_([^_\n]+?)_/g, '<em>$1</em>');

	// Restore code spans
	s = s.replace(/\x02(\d+)\x03/g, (_, i) => spans[+i]);

	return { html: s, changed: hadSpans || s !== escapeHtml(raw) };
}

export function parseMarkdown(input: string): { formattedBody: string; hasFormatting: boolean } {
	let hasFormatting = false;
	const lines = input.split('\n');
	const parts: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code block
		if (line.trimStart().startsWith('```')) {
			const langMatch = line.trimStart().match(/^```(\w*)/);
			const lang = langMatch?.[1] ?? '';
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
				codeLines.push(escapeHtml(lines[i]));
				i++;
			}
			// If no content but a language was specified, use the language string as content
			let langAttr = '';
			let codeContent: string;
			if (codeLines.length === 0 && lang) {
				codeContent = escapeHtml(lang);
			} else {
				langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
				codeContent = codeLines.join('\n');
			}
			parts.push(`<pre><code${langAttr}>${codeContent}</code></pre>`);
			hasFormatting = true;
			i++;
			continue;
		}

		// Blockquote
		if (line.startsWith('> ') || line === '>') {
			const content = line.startsWith('> ') ? line.slice(2) : '';
			const { html } = processInline(content);
			parts.push(`<blockquote>${html}</blockquote>`);
			hasFormatting = true;
			i++;
			continue;
		}

		// Headings (# / ## / ###)
		const hMatch = line.match(/^(#{1,3})\s+(.+)/);
		if (hMatch) {
			const level = hMatch[1].length;
			const { html } = processInline(hMatch[2]);
			parts.push(`<h${level}>${html}</h${level}>`);
			hasFormatting = true;
			i++;
			continue;
		}

		// Regular line with inline formatting
		const { html, changed } = processInline(line);
		if (changed) hasFormatting = true;
		parts.push(html);
		i++;
	}

	return { formattedBody: parts.join('<br>\n'), hasFormatting };
}
