function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') ||
      (trimmed[0] === "'" && trimmed[trimmed.length - 1] === "'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineList(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  return trimmed.split(',').map((item) => stripQuotes(item));
}

export function parseFrontmatter(rawText) {
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  if (lines[0]?.trim() !== '---') {
    return { data: {}, content: text };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { data: {}, content: text };
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const content = lines.slice(closingIndex + 1).join('\n');
  const data = {};

  const blockListRe = /^(\w+):\s*$/;
  const blockItemRe = /^\s+-\s+(.*)$/;
  const inlineListRe = /^(\w+):\s*\[(.*)\]\s*$/;

  let i = 0;
  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const blockListMatch = line.match(blockListRe);
    if (blockListMatch) {
      const key = blockListMatch[1];
      const items = [];
      i++;
      while (i < frontmatterLines.length) {
        const itemMatch = frontmatterLines[i].match(blockItemRe);
        if (!itemMatch) break;
        items.push(stripQuotes(itemMatch[1]));
        i++;
      }
      data[key] = items;
      continue;
    }

    const inlineListMatch = line.match(inlineListRe);
    if (inlineListMatch) {
      const key = inlineListMatch[1];
      data[key] = parseInlineList(inlineListMatch[2]);
      i++;
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      const value = stripQuotes(line.slice(colonIndex + 1));
      data[key] = value;
    }
    i++;
  }

  return { data, content };
}
