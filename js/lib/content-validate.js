// Validation of the content data (RF-4). Pure module: no DOM, no network, no file system.
import { OTHER_CODE } from "./sites.js";

export const OPTION_TYPES = Object.freeze(["normal", "open-required", "open-optional"]);

const LETTERS = ["A", "B", "C"];
const ISO_ALPHA2 = /^[A-Z]{2}$/;
const MIN_COUNTRIES = 6;
const MAX_COUNTRIES = 11; // + "Other" = 12 tiles at most (RF-4)
const QUESTION_COUNT = 10;
const MULTIPLE_ID = "q3"; // the only multiple-choice question the database accepts (RF-164)

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isFilled = (v) => typeof v === "string" && v.trim().length > 0;

/**
 * Validates the content data.
 * @param {object} content  { version, countries: [{code, name}], questions: [{id, site, text, options}] }
 * @param {string[]} siteIds  the leisure sites that exist in the city
 * @param {{ hasFlag?: (code: string) => boolean }} [options]  injected flag check (file system lives outside)
 * @returns {string[]} one readable message per broken rule; [] means valid
 */
export function validateContent(content, siteIds, { hasFlag } = {}) {
  const errors = [];
  if (!isObject(content)) return ["content must be an object"];

  if (!isFilled(content.version)) errors.push("version must be a non-empty string");

  validateQuestions(content.questions, siteIds, errors);
  validateCountries(content.countries, hasFlag, errors);
  return errors;
}

function validateQuestions(questions, siteIds, errors) {
  if (!Array.isArray(questions)) {
    errors.push(`content must have exactly ${QUESTION_COUNT} questions (found none)`);
    return;
  }
  if (questions.length !== QUESTION_COUNT) {
    errors.push(`content must have exactly ${QUESTION_COUNT} questions (found ${questions.length})`);
  }

  const seenIds = new Set();
  const seenSites = new Set();
  questions.forEach((q, i) => {
    if (!isObject(q)) {
      errors.push(`question #${i + 1} must be an object`);
      return;
    }
    let name = `question #${i + 1}`;
    if (!isFilled(q.id)) {
      errors.push(`question #${i + 1}: id must not be empty`);
    } else {
      name = `question ${q.id}`;
      if (seenIds.has(q.id)) errors.push(`duplicate question id "${q.id}"`);
      seenIds.add(q.id);
    }

    if (!isFilled(q.text)) errors.push(`${name}: text must not be empty`);

    if (!isFilled(q.site)) {
      errors.push(`${name}: must have a site`);
    } else if (!siteIds.includes(q.site)) {
      errors.push(`${name}: site "${q.site}" is not one of the city sites`);
    } else {
      if (seenSites.has(q.site)) errors.push(`${name}: duplicate site "${q.site}" (each question needs its own site)`);
      seenSites.add(q.site);
    }

    validateOptions(q.options, name, errors);
    validateMultiple(q, name, errors);
  });
}

// Q3 is multiple choice and no other question is; its options are all normal (RF-4, proposal 47).
function validateMultiple(q, name, errors) {
  if (q.multiple !== undefined && typeof q.multiple !== "boolean") {
    errors.push(`${name}: multiple must be a boolean (found ${JSON.stringify(q.multiple)})`);
  }
  const multiple = q.multiple === true;
  if (q.id === MULTIPLE_ID) {
    if (!multiple) errors.push(`${name} must be multiple choice`);
  } else if (multiple) {
    errors.push(`${name}: only ${MULTIPLE_ID} can be multiple choice`);
  }
  if (multiple && Array.isArray(q.options) && q.options.some((o) => isObject(o) && o.type !== "normal")) {
    errors.push(`${name}: multiple choice options must be normal`);
  }
}

function validateOptions(options, name, errors) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 3) {
    const found = Array.isArray(options) ? options.length : "none";
    errors.push(`${name}: must have 2 or 3 options (found ${found})`);
    if (!Array.isArray(options)) return;
  }

  const letters = options.map((o) => (isObject(o) ? o.letter : undefined));
  const expected = LETTERS.slice(0, letters.length);
  if (letters.length > LETTERS.length || letters.some((l, i) => l !== expected[i])) {
    errors.push(`${name}: option letters must be A, B (and C) in that order (found ${letters.join(", ")})`);
  }

  options.forEach((o, i) => {
    const label = `${name} option ${isObject(o) && isFilled(o.letter) ? o.letter : `#${i + 1}`}`;
    if (!isObject(o)) {
      errors.push(`${label}: must be an object`);
      return;
    }
    if (!isFilled(o.label)) errors.push(`${label}: label must not be empty`);
    if (!OPTION_TYPES.includes(o.type)) {
      errors.push(`${label}: invalid type "${o.type}" (expected ${OPTION_TYPES.join(", ")})`);
    }
  });
}

function validateCountries(countries, hasFlag, errors) {
  if (!Array.isArray(countries)) {
    errors.push(`content must have between ${MIN_COUNTRIES} and ${MAX_COUNTRIES} countries (found none)`);
    return;
  }
  if (countries.length < MIN_COUNTRIES || countries.length > MAX_COUNTRIES) {
    errors.push(`content must have between ${MIN_COUNTRIES} and ${MAX_COUNTRIES} countries (found ${countries.length})`);
  }

  const seen = new Set();
  countries.forEach((c, i) => {
    if (!isObject(c)) {
      errors.push(`country #${i + 1} must be an object`);
      return;
    }
    const code = c.code;
    const name = `country ${typeof code === "string" && code ? code : `#${i + 1}`}`;

    if (code === OTHER_CODE) {
      errors.push(`${name}: code "${OTHER_CODE}" is reserved for the Other option`);
    } else if (typeof code !== "string" || !ISO_ALPHA2.test(code)) {
      errors.push(`${name}: code must be ISO 3166-1 alpha-2 (two uppercase letters)`);
    }
    if (typeof code === "string" && code) {
      if (seen.has(code)) errors.push(`duplicate country code "${code}"`);
      seen.add(code);
    }

    if (!isFilled(c.name)) errors.push(`${name}: name must not be empty`);
    if (typeof hasFlag === "function" && typeof code === "string" && !hasFlag(code)) {
      errors.push(`${name}: flag file is missing`);
    }
  });
}
