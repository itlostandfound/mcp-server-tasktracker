import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

const md: MarkdownIt = new MarkdownIt("commonmark");

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

type Cursor = { i: number };

/**
 * Accepts either a pre-built TipTap JSON document (passed through unchanged)
 * or a Markdown/plain-text string, which is parsed into a TipTap doc.
 */
export function toTipTapDoc(content: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof content !== "string") return content;

  const tokens = md.parse(content, {});
  const body = parseBlocks(tokens, { i: 0 });
  return { type: "doc", content: body.length ? body : [{ type: "paragraph" }] };
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "codeBlock"]);

/**
 * Derives a plain-text mirror of a TipTap doc (one line per block node),
 * suitable for the content_text search field so callers don't have to write
 * the same content twice.
 */
export function extractPlainText(doc: Record<string, unknown>): string {
  const lines: string[] = [];
  collectText(doc as TipTapNode, lines);
  return lines.join("\n").trim();
}

function collectText(node: TipTapNode, lines: string[]): void {
  if (node.type === "text") {
    if (lines.length === 0) lines.push("");
    lines[lines.length - 1] += node.text ?? "";
    return;
  }
  if (node.type === "hardBreak") {
    if (lines.length === 0) lines.push("");
    lines[lines.length - 1] += "\n";
    return;
  }
  if (BLOCK_TYPES.has(node.type)) {
    lines.push("");
    for (const child of node.content ?? []) collectText(child, lines);
    return;
  }
  // Container types (doc, bulletList, orderedList, listItem, blockquote) contribute
  // no line of their own — their block children each push their own line.
  for (const child of node.content ?? []) collectText(child, lines);
}

function parseBlocks(tokens: Token[], cursor: Cursor, stopType?: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];

  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];

    if (stopType && token.type === stopType) {
      cursor.i++;
      return nodes;
    }

    switch (token.type) {
      case "heading_open": {
        const level = Number(token.tag.slice(1)) || 1;
        const inline = tokens[++cursor.i];
        cursor.i += 2; // inline, heading_close
        nodes.push({ type: "heading", attrs: { level }, content: parseInline(inline) });
        break;
      }
      case "paragraph_open": {
        const inline = tokens[++cursor.i];
        cursor.i += 2; // inline, paragraph_close
        const content = parseInline(inline);
        nodes.push(content.length ? { type: "paragraph", content } : { type: "paragraph" });
        break;
      }
      case "bullet_list_open": {
        cursor.i++;
        nodes.push({ type: "bulletList", content: parseListItems(tokens, cursor, "bullet_list_close") });
        break;
      }
      case "ordered_list_open": {
        const start = token.attrGet("start");
        cursor.i++;
        nodes.push({
          type: "orderedList",
          ...(start ? { attrs: { start: Number(start) } } : {}),
          content: parseListItems(tokens, cursor, "ordered_list_close"),
        });
        break;
      }
      case "blockquote_open": {
        cursor.i++;
        nodes.push({ type: "blockquote", content: parseBlocks(tokens, cursor, "blockquote_close") });
        break;
      }
      case "code_block":
      case "fence": {
        const text = token.content.replace(/\n$/, "");
        const language = token.info?.trim();
        nodes.push({
          type: "codeBlock",
          ...(language ? { attrs: { language } } : {}),
          ...(text ? { content: [{ type: "text", text }] } : {}),
        });
        cursor.i++;
        break;
      }
      case "hr": {
        nodes.push({ type: "horizontalRule" });
        cursor.i++;
        break;
      }
      default: {
        // Unrecognized block token (e.g. raw html_block). Rather than silently
        // dropping it, surface its raw source as a plain-text paragraph so the
        // content is never lost — just not fully converted.
        const text = token.content?.trim();
        if (text) nodes.push({ type: "paragraph", content: [{ type: "text", text }] });
        cursor.i++;
        break;
      }
    }
  }

  return nodes;
}

function parseListItems(tokens: Token[], cursor: Cursor, closeType: string): TipTapNode[] {
  const items: TipTapNode[] = [];

  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];

    if (token.type === closeType) {
      cursor.i++;
      return items;
    }

    if (token.type === "list_item_open") {
      cursor.i++;
      const content = parseBlocks(tokens, cursor, "list_item_close");
      items.push({ type: "listItem", content: content.length ? content : [{ type: "paragraph" }] });
    } else {
      cursor.i++;
    }
  }

  return items;
}

type Mark = { type: string; attrs?: Record<string, unknown> };

function parseInline(inlineToken: Token | undefined): TipTapNode[] {
  const children = inlineToken?.children ?? [];
  const nodes: TipTapNode[] = [];
  const markStack: Mark[] = [];

  for (const child of children) {
    switch (child.type) {
      case "text":
        pushText(nodes, child.content, markStack);
        break;
      case "code_inline":
        pushText(nodes, child.content, [...markStack, { type: "code" }]);
        break;
      case "softbreak":
      case "hardbreak":
        nodes.push({ type: "hardBreak" });
        break;
      case "strong_open":
        markStack.push({ type: "bold" });
        break;
      case "strong_close":
        popMark(markStack, "bold");
        break;
      case "em_open":
        markStack.push({ type: "italic" });
        break;
      case "em_close":
        popMark(markStack, "italic");
        break;
      case "link_open":
        markStack.push({ type: "link", attrs: { href: child.attrGet("href") ?? "" } });
        break;
      case "link_close":
        popMark(markStack, "link");
        break;
      case "image": {
        // TipTap's schema has no inline image mark, so there's no lossless
        // conversion here. Preserve the alt text (or the URL, if there's no alt
        // text) as plain text rather than silently dropping the image.
        const alt = child.content?.trim();
        const src = child.attrGet("src") ?? "";
        pushText(nodes, alt || (src ? `[image: ${src}]` : ""), markStack);
        break;
      }
      default:
        // Unrecognized inline token (e.g. raw html_inline tag itself) — skip.
        // Any surrounding plain text is a separate sibling token and is kept.
        break;
    }
  }

  return nodes;
}

function pushText(nodes: TipTapNode[], text: string, marks: Mark[]): void {
  if (!text) return;
  nodes.push(marks.length ? { type: "text", text, marks: marks.map((m) => ({ ...m })) } : { type: "text", text });
}

function popMark(stack: Mark[], type: string): void {
  const idx = stack.map((m) => m.type).lastIndexOf(type);
  if (idx !== -1) stack.splice(idx, 1);
}
