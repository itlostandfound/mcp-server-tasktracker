import { describe, expect, it } from "vitest";
import { extractPlainText, toTipTapDoc } from "../src/richText.js";

describe("toTipTapDoc", () => {
  it("passes an existing TipTap object through unchanged", () => {
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    expect(toTipTapDoc(doc)).toBe(doc);
  });

  it("wraps plain text in a single paragraph", () => {
    expect(toTipTapDoc("hello world")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello world" }] }],
    });
  });

  it("converts headings", () => {
    expect(toTipTapDoc("## Sub-tasks")).toEqual({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sub-tasks" }] }],
    });
  });

  it("converts an ordered list", () => {
    const result = toTipTapDoc("1. Create directory\n2. Init package.json");
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Create directory" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Init package.json" }] }],
            },
          ],
        },
      ],
    });
  });

  it("preserves a non-default ordered list start", () => {
    const result = toTipTapDoc("3. Third\n4. Fourth");
    expect((result.content as { attrs?: { start: number } }[])[0].attrs).toEqual({ start: 3 });
  });

  it("converts bold, italic, code, and link marks", () => {
    const result = toTipTapDoc("**bold** _italic_ `code` [link](https://example.com)");
    const content = (result.content as { content: unknown[] }[])[0].content as {
      text: string;
      marks?: { type: string; attrs?: Record<string, unknown> }[];
    }[];

    expect(content).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "code", marks: [{ type: "code" }] },
      { type: "text", text: " " },
      { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
    ]);
  });

  it("converts fenced code blocks with a language attr", () => {
    expect(toTipTapDoc("```ts\nconst x = 1;\n```")).toEqual({
      type: "doc",
      content: [{ type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x = 1;" }] }],
    });
  });

  it("falls back to an empty paragraph for empty input", () => {
    expect(toTipTapDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("preserves an image's alt text instead of silently dropping it", () => {
    const result = toTipTapDoc("Before ![a diagram](https://example.com/pic.png) after");
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before " },
            { type: "text", text: "a diagram" },
            { type: "text", text: " after" },
          ],
        },
      ],
    });
  });

  it("falls back to the URL when an image has no alt text", () => {
    const result = toTipTapDoc("![](https://example.com/pic.png)");
    expect(result).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "[image: https://example.com/pic.png]" }] }],
    });
  });

  it("preserves a raw HTML block's text instead of silently dropping it", () => {
    const result = toTipTapDoc("<div>a raw html block</div>");
    expect(result).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "<div>a raw html block</div>" }] }],
    });
  });

  it("keeps surrounding plain text when inline HTML tags are stripped", () => {
    const result = toTipTapDoc("Some <b>raw html</b> inline text.");
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Some " },
            { type: "text", text: "raw html" },
            { type: "text", text: " inline text." },
          ],
        },
      ],
    });
  });

  it("degrades a table to literal plain text rather than dropping it", () => {
    const result = toTipTapDoc("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "| a | b |" },
            { type: "hardBreak" },
            { type: "text", text: "|---|---|" },
            { type: "hardBreak" },
            { type: "text", text: "| 1 | 2 |" },
          ],
        },
      ],
    });
  });
});

describe("extractPlainText", () => {
  it("joins block nodes with newlines, one line per block", () => {
    const doc = toTipTapDoc("## Sub-tasks\n\n1. Create directory\n2. Init package.json");
    expect(extractPlainText(doc)).toBe("Sub-tasks\nCreate directory\nInit package.json");
  });

  it("concatenates inline text and marks within a single block onto one line", () => {
    const doc = toTipTapDoc("hello **world**");
    expect(extractPlainText(doc)).toBe("hello world");
  });

  it("returns an empty string for an empty document", () => {
    expect(extractPlainText({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
  });
});
