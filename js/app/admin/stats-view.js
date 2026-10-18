// "Statistics" tab of /admin (plan §4.4): paints what js/lib (buildStatistics) computed, in the order of RF-70:
// summary (RF-29) → Q1-Q10 (RF-31 to RF-38) → "Participants by country" last (RF-30). Every text, from the
// content or from the database, goes in with textContent (RF-47). No animation (RNF-6): bars get their width
// at once, through the CSSOM (the page's CSP forbids style="" attributes).
import { countText, fromAdminPage } from "../../lib/admin-format.js";

function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Track + fill, decorative: the number and the % are always visible text beside it (RF-33). */
function bar(pct) {
  const track = h("div", "bar");
  track.setAttribute("aria-hidden", "true");
  const fill = h("div", "bar__fill");
  fill.style.width = `${pct}%`;
  track.append(fill);
  return track;
}

/** "count · p%" beside the bar (RF-32, RF-33). */
function value(count, pct) {
  return h("span", "bar-row__value", `${count} · ${pct}%`);
}

function summaryView(sum) {
  const list = h("dl", "summary");
  for (const [label, n] of [
    ["Participants", sum.participants],
    ["Completed", sum.completed],
    ["In progress", sum.inProgress],
  ]) {
    const item = h("div", "summary__item");
    item.append(h("dt", "summary__label", label), h("dd", "summary__value", String(n)));
    list.append(item);
  }
  return list;
}

function questionView(q, onSeeComments) {
  const block = h("article", "stat-block");
  block.setAttribute("aria-labelledby", `stat-${q.id}`);
  const title = h("h2", "stat-block__title");
  title.id = `stat-${q.id}`;
  title.append(h("span", "stat-block__number", `Q${q.n}`), " ", h("span", "stat-block__text", q.text));
  block.append(title, h("p", "stat-block__meta", countText(q.answers, "answer")));

  if (q.answers === 0) {
    block.append(h("p", "stat-block__empty", "No answers yet")); // RF-35
  } else {
    const list = h("ul", "bars");
    for (const o of q.options) {
      const item = h("li", "bar-row");
      item.append(h("span", "bar-row__label", `${o.letter} · ${o.label}`));
      const line = h("div", "bar-row__line");
      line.append(bar(o.percent), value(o.count, o.percent));
      item.append(line);
      list.append(item);
    }
    block.append(list);
    if (q.unknown) {
      block.append(
        h("p", "stat-block__warning", countText(q.unknown.count, "answer with an unknown option", "answers with an unknown option")),
      );
    }
  }

  const foot = h("div", "stat-block__foot");
  foot.append(h("p", "stat-block__comments", countText(q.comments, "comment")));
  if (q.comments > 0) {
    const button = h("button", "button button--ghost button--small", "See comments"); // RF-37, RF-38
    button.type = "button";
    button.setAttribute("aria-label", `See comments of Q${q.n}`);
    button.addEventListener("click", () => onSeeComments(q.n));
    foot.append(button);
  }
  block.append(foot);
  return block;
}

function countryView(countries) {
  const block = h("section", "stat-block stat-block--countries");
  block.setAttribute("aria-labelledby", "stat-countries");
  const title = h("h2", "stat-block__title", "Participants by country");
  title.id = "stat-countries";
  block.append(title);
  if (countries.length === 0) {
    block.append(h("p", "stat-block__empty", "No participants yet"));
    return block;
  }
  const list = h("ul", "bars");
  for (const c of countries) {
    const item = h("li", "bar-row");
    const label = h("span", "bar-row__label bar-row__label--country");
    const src = fromAdminPage(c.flag);
    if (src) {
      const img = h("img", "bar-row__flag");
      img.src = src;
      img.alt = ""; // the name is next to it
      img.width = 28;
      img.height = 20;
      label.append(img);
    }
    label.append(h("span", "", c.name));
    const line = h("div", "bar-row__line");
    line.append(bar(c.percent), value(c.count, c.percent));
    item.append(label, line);
    list.append(item);
  }
  block.append(list);
  return block;
}

/** Repaints the tab into `root` from buildStatistics(filtered set); `onSeeComments(n)` opens Responses. */
export function renderStatistics(root, stats, { onSeeComments }) {
  const frag = document.createDocumentFragment();
  frag.append(summaryView(stats.summary));
  for (const q of stats.questions) frag.append(questionView(q, onSeeComments));
  frag.append(countryView(stats.countries)); // last, RF-70
  root.replaceChildren(frag);
}
