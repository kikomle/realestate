import { test } from "node:test";
import assert from "node:assert/strict";
import { fillTemplate } from "./build-composition.mjs";

test("fillTemplate replaces every placeholder", () => {
  const out = fillTemplate("<h1>{{TITLE}}</h1><p>{{TITLE}}</p>", { TITLE: "Hi" });
  assert.equal(out, "<h1>Hi</h1><p>Hi</p>");
});

test("fillTemplate throws on a missing value", () => {
  assert.throws(() => fillTemplate("{{A}} {{B}}", { A: "x" }), /Missing template values: B/);
});
