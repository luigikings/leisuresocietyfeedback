// "Responses" tab of /admin (plan §4.5): paints the entries that js/lib/admin-list.js chose and ordered, as a
// table from 768 px (RF-42) or as <details> cards below (RF-63), never both. Every text, from the content or
// from the database, goes in with textContent (RF-47); comments keep their line breaks by CSS (pre-wrap).
// The participant id is only a key for the open cards: it is never painted (RF-48).
import { describeEntry } from "../../lib/admin-list.js";
import { fromAdminPage } from "../../lib/admin-format.js";

/** RF-42 / RF-63: the table from 768 px of window width, the cards below. */
export const wideQuery = () => window.matchMedia("(min-width: 768px)");

const COLUMNS = ["Started", "Updated", "Country", "Status", "Answered"];
const QUESTIONS = 10;

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function flagImg(country) {
  const src = fromAdminPage(country.flag);
  if (!src) return null;
  const img = h("img", "flag");
  img.src = src;
  img.alt = ""; // the name is next to it
  img.width = 28;
  img.height = 20;
  return img;
}

function countryLabel(country) {
  const span = h("span", "country");
  const img = flagImg(country);
  if (img) span.append(img);
  span.append(h("span", "", country.name));
  return span;
}

/**
 * "A · label" (or "—") with the comment below, as plain text (RF-40, RF-47); in the multiple-choice question,
 * one line per marked option in order A, B, C, unknown letters included, and the single comment below (RF-73).
 */
function answerContent(parent, a) {
  if (a.lines.length === 0) parent.append(h("span", "answer answer--none", "—"));
  for (const line of a.lines) parent.append(h("span", "answer", line));
  if (a.comment !== null) parent.append(h("span", "comment", a.comment));
}

// --- Table (≥ 768 px) ---------------------------------------------------------------------------------------

/** Table shell: { box, body, make } where `body` receives one <tr> per entry. */
function tableShell() {
  const wrap = h("div", "table-wrap");
  wrap.tabIndex = 0; // the horizontal scroll can be used with the keyboard (RNF-7)
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", "Responses table");
  const table = h("table", "responses-table");
  const head = h("tr");
  for (const col of [...COLUMNS, ...Array.from({ length: QUESTIONS }, (_, i) => `Q${i + 1}`)]) {
    const kind = col.startsWith("Q") ? "col-q" : `col-${col.toLowerCase()}`;
    const th = h("th", col === "Started" ? `sticky ${kind}` : kind, col);
    th.scope = "col";
    head.append(th);
  }
  const thead = h("thead");
  thead.append(head);
  const tbody = h("tbody");
  table.append(thead, tbody);
  wrap.append(table);
  return { box: wrap, body: tbody, make: tableRow };
}

/** One <tr>: "Started" as the fixed row header, then Updated, Country, Status, Answered and Q1-Q10 (RF-42). */
function tableRow(entry, ctx) {
  const e = describeEntry(entry.row, ctx.content, ctx);
  const tr = h("tr");
  const started = h("th", "sticky", e.started);
  started.scope = "row";
  const country = h("td");
  country.append(countryLabel(e.country));
  tr.append(started, h("td", "nowrap", e.updated), country, h("td", "nowrap", e.status), h("td", "nowrap", `${e.answered}/10`));
  for (const a of e.answers) {
    const td = h("td", "qcell");
    answerContent(td, a);
    tr.append(td);
  }
  return tr;
}

// --- Cards (< 768 px) ---------------------------------------------------------------------------------------

/** The 10 answers, painted the first time a card opens (1000 closed cards stay light, RNF-8). */
function fillAnswers(details, e) {
  if (details.dataset.filled) return;
  details.dataset.filled = "1";
  const list = h("dl", "card__answers");
  for (const a of e.answers) {
    const item = h("div", "card__answer");
    const dd = h("dd");
    answerContent(dd, a);
    item.append(h("dt", "card__q", `Q${a.n}`), dd);
    list.append(item);
  }
  details.append(list);
}

function cardView(entry, ctx) {
  const key = entry.row.id;
  const e = describeEntry(entry.row, ctx.content, ctx);
  const details = h("details", "card");
  const summary = h("summary", "card__summary");
  const top = h("span", "card__top");
  top.append(countryLabel(e.country), h("span", "badge", e.status));
  summary.append(
    top,
    h("span", "card__meta", `Started ${e.started}`),
    h("span", "card__meta", `Updated ${e.updated}`),
    h("span", "card__meta card__answered", e.answeredText),
  );
  // RF-64: with a search or the "Comments" filter, the comments that make it match, even when closed
  if (ctx.filtered && entry.matched.length > 0) {
    const matches = h("span", "card__matches");
    for (const m of entry.matched) {
      const line = h("span", "match");
      line.append(h("span", "match__q", `Q${m.q}`), h("span", "comment", m.text));
      matches.append(line);
    }
    summary.append(matches);
  }
  details.append(summary);
  // RF-64: the open state lives in ctx.open (ids) and is reapplied on every repaint, so typing never
  // opens or closes a card.
  if (ctx.open.has(key)) {
    details.open = true;
    fillAnswers(details, e);
  }
  details.addEventListener("toggle", () => {
    if (details.open) fillAnswers(details, e);
    ctx.onToggle(key, details.open);
  });
  return details;
}

function cardsShell() {
  const list = h("div", "cards");
  return { box: list, body: list, make: cardView };
}

// RNF-8 (1000 rows, < 200 ms): the first entries are painted at once and the rest in small batches on the
// following tasks, so a keystroke updates the screen right away; a newer repaint cancels the batches left.
const FIRST = 40;
const BATCH = 120;
let job = 0;

function appendRange(shell, entries, from, to, ctx) {
  const frag = document.createDocumentFragment();
  for (let i = from; i < Math.min(to, entries.length); i++) frag.append(shell.make(entries[i], ctx));
  shell.body.append(frag);
}

/**
 * Repaints `root` with the entries of visibleEntries, in their order: the table when `wide`, the cards
 * otherwise. ctx: { content, timeZone, wide, filtered, open: Set of open card keys, onToggle(key, isOpen) }.
 */
export function renderList(root, entries, ctx) {
  const token = ++job;
  if (entries.length === 0) {
    root.replaceChildren();
    return;
  }
  const shell = ctx.wide ? tableShell() : cardsShell();
  appendRange(shell, entries, 0, FIRST, ctx);
  root.replaceChildren(shell.box);
  let at = FIRST;
  const next = () => {
    if (token !== job || at >= entries.length) return;
    appendRange(shell, entries, at, at + BATCH, ctx);
    at += BATCH;
    setTimeout(next, 0);
  };
  setTimeout(next, 0);
}
