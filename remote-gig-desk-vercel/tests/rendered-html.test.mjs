import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("declares development preview metadata in the Next layout", () => {
  const source=fs.readFileSync(new URL("../app/layout.tsx",import.meta.url),"utf8");
  const rendered='<meta name="codex-preview" content="development">';
  assert.match(source,/"codex-preview"\s*:\s*"development"/);
  assert.match(rendered,developmentPreviewMeta);
});
