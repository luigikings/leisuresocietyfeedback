import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cacheControlFor, contentTypeFor, resolveSafePath } from "../scripts/serve.mjs";

const ROOT = path.resolve("/srv/site");

test("contentTypeFor returns the right MIME type for known extensions", () => {
  assert.equal(contentTypeFor("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("js/app/main.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("scripts/serve.mjs"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("css/survey.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeFor("assets/flags/es.svg"), "image/svg+xml");
  assert.equal(contentTypeFor("data.json"), "application/json; charset=utf-8");
  assert.equal(contentTypeFor("assets/fonts/figtree-latin-400.woff2"), "font/woff2");
});

test("contentTypeFor is case-insensitive and falls back to octet-stream", () => {
  assert.equal(contentTypeFor("INDEX.HTML"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("file.unknownext"), "application/octet-stream");
  assert.equal(contentTypeFor("noextension"), "application/octet-stream");
});

test("cacheControlFor caches only the .woff2 fonts for a year; everything else is no-store (T33, user decision)", () => {
  for (const f of ["assets/fonts/figtree-latin-400.woff2", "assets/fonts/BIG-SHOULDERS-DISPLAY-LATIN-800.WOFF2"]) {
    assert.equal(cacheControlFor(f), "public, max-age=31536000", f);
  }
  for (const f of ["index.html", "js/app/main.js", "css/survey.css", "assets/flags/it.svg", "assets/fonts/OFL-Figtree.txt", "noext"]) {
    assert.equal(cacheControlFor(f), "no-store", f);
  }
});

test("resolveSafePath maps / to index.html", () => {
  assert.equal(resolveSafePath(ROOT, "/"), path.join(ROOT, "index.html"));
});

test("resolveSafePath maps a directory URL to its index.html", () => {
  assert.equal(resolveSafePath(ROOT, "/admin/"), path.join(ROOT, "admin", "index.html"));
});

test("resolveSafePath resolves normal files inside the root", () => {
  assert.equal(resolveSafePath(ROOT, "/js/app/main.js"), path.join(ROOT, "js", "app", "main.js"));
});

test("resolveSafePath ignores query string and hash", () => {
  assert.equal(resolveSafePath(ROOT, "/css/survey.css?v=2#x"), path.join(ROOT, "css", "survey.css"));
});

test("resolveSafePath decodes percent-encoded safe characters", () => {
  assert.equal(resolveSafePath(ROOT, "/assets/my%20file.svg"), path.join(ROOT, "assets", "my file.svg"));
});

test("resolveSafePath rejects plain ../ traversal", () => {
  assert.equal(resolveSafePath(ROOT, "/../secret.txt"), null);
  assert.equal(resolveSafePath(ROOT, "/js/../../secret.txt"), null);
  assert.equal(resolveSafePath(ROOT, "../secret.txt"), null);
});

test("resolveSafePath rejects encoded traversal", () => {
  assert.equal(resolveSafePath(ROOT, "/%2e%2e/secret.txt"), null);
  assert.equal(resolveSafePath(ROOT, "/%2E%2E%2Fsecret.txt"), null);
  assert.equal(resolveSafePath(ROOT, "/js/%2e%2e%2f%2e%2e%2fsecret.txt"), null);
});

test("resolveSafePath rejects backslash traversal", () => {
  assert.equal(resolveSafePath(ROOT, "/..\\secret.txt"), null);
  assert.equal(resolveSafePath(ROOT, "/%2e%2e%5csecret.txt"), null);
});

test("resolveSafePath rejects null bytes and malformed encoding", () => {
  assert.equal(resolveSafePath(ROOT, "/index.html%00.js"), null);
  assert.equal(resolveSafePath(ROOT, "/%E0%A4%A"), null);
});

test("resolveSafePath rejects sibling folders sharing the root prefix", () => {
  // /srv/site-evil must not be considered inside /srv/site
  assert.equal(resolveSafePath(ROOT, "/../site-evil/x.html"), null);
});
