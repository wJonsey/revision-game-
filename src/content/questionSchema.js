import { getSection } from "./specIndex.js";

export const DIFFICULTIES = ["beginner", "easy", "medium", "hard", "expert", "boss"];

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "predict_output",
  "fill_blank",
  "ordering",
  "match",
  "open_response",
];

export const ORIGINS = ["verified", "generated", "legacy-past-paper", "user"];

/** Command words from the specification's command word taxonomy (Appendix 1). */
export const COMMAND_WORDS = [
  "give", "state", "name", "identify", "write", "describe", "explain",
  "explain with additional justification", "discuss", "evaluate", "draw", "complete",
];

export const TYPE_LABELS = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  predict_output: "Predict the output",
  fill_blank: "Fill in the blank",
  ordering: "Put in order",
  match: "Match the terms",
  open_response: "Written answer",
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isStringList = (value, min) =>
  Array.isArray(value) && value.length >= min && value.every(isNonEmptyString);
const hasDuplicates = (values) => new Set(values).size !== values.length;

/**
 * Validates one question. Returns a list of human-readable problems (empty when valid).
 * @param {any} question
 */
export function validateQuestion(question) {
  const errors = [];
  if (question === null || typeof question !== "object" || Array.isArray(question)) {
    return ["Question must be an object"];
  }
  const label = isNonEmptyString(question.id) ? question.id : "(missing id)";
  const fail = (message) => errors.push(`${label}: ${message}`);

  if (!isNonEmptyString(question.id)) fail("id is required");
  if (!isNonEmptyString(question.prompt)) fail("prompt is required");
  if (!isNonEmptyString(question.explanation)) fail("explanation is required");
  if (!DIFFICULTIES.includes(question.difficulty)) fail(`difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  if (!QUESTION_TYPES.includes(question.type)) fail(`type must be one of ${QUESTION_TYPES.join(", ")}`);
  if (question.code !== undefined && typeof question.code !== "string") fail("code must be a string");
  if (question.commonMistake !== undefined && !isNonEmptyString(question.commonMistake)) {
    fail("commonMistake must be a non-empty string when present");
  }

  const section = getSection(question.specRef);
  if (!section) {
    fail(`specRef "${question.specRef}" is not a section in spec-map.json`);
  } else if (section.map !== question.map) {
    fail(`specRef ${question.specRef} belongs to map "${section.map}", not "${question.map}"`);
  }

  if (!question.source || !ORIGINS.includes(question.source.origin)) {
    fail(`source.origin must be one of ${ORIGINS.join(", ")}`);
  } else if (!isNonEmptyString(question.source.reference)) {
    fail("source.reference is required");
  }

  switch (question.type) {
    case "multiple_choice":
      if (!isStringList(question.options, 2) || question.options.length > 6) {
        fail("options must be 2-6 non-empty strings");
      } else if (hasDuplicates(question.options)) {
        fail("options must be unique");
      } else if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
        fail("answer must be the index of the correct option");
      }
      if (question.optionFeedback !== undefined &&
        (!Array.isArray(question.optionFeedback) || question.optionFeedback.length !== question.options?.length)) {
        fail("optionFeedback must have one entry per option");
      }
      break;
    case "true_false":
      if (typeof question.answer !== "boolean") fail("answer must be true or false");
      break;
    case "predict_output":
      if (!isNonEmptyString(question.code)) fail("code is required for predict_output");
      if (!isStringList(question.answer, 1)) fail("answer must be a list of accepted outputs");
      break;
    case "fill_blank":
      if (!question.prompt?.includes("___")) fail('prompt must contain a "___" blank');
      if (!isStringList(question.answer, 1)) fail("answer must be a list of accepted answers");
      break;
    case "ordering":
      if (!isStringList(question.items, 3)) fail("items must list at least 3 steps in the correct order");
      else if (hasDuplicates(question.items)) fail("items must be unique");
      break;
    case "match":
      if (!Array.isArray(question.pairs) || question.pairs.length < 3 ||
        !question.pairs.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isNonEmptyString))) {
        fail("pairs must be at least 3 [term, meaning] pairs");
      } else if (hasDuplicates(question.pairs.map((p) => p[0])) || hasDuplicates(question.pairs.map((p) => p[1]))) {
        fail("pair terms and meanings must be unique");
      }
      break;
    case "open_response":
      if (!isStringList(question.markPoints, 1)) fail("markPoints must list at least one mark point");
      if (!Number.isInteger(question.marks) || question.marks < 1 ||
        (Array.isArray(question.markPoints) && question.marks > question.markPoints.length)) {
        fail("marks must be between 1 and the number of mark points");
      }
      if (!COMMAND_WORDS.includes(question.commandWord)) fail("commandWord must be a spec command word");
      break;
  }
  return errors;
}

/**
 * Validates a question pack: { packId, title, questions: [...] }.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePack(pack) {
  if (pack === null || typeof pack !== "object" || !Array.isArray(pack.questions)) {
    return { valid: false, errors: ["Pack must be an object with a questions array"] };
  }
  const errors = [];
  if (!isNonEmptyString(pack.packId)) errors.push("packId is required");
  if (!isNonEmptyString(pack.title)) errors.push("title is required");
  const ids = new Set();
  for (const question of pack.questions) {
    errors.push(...validateQuestion(question));
    if (question && ids.has(question.id)) errors.push(`${question.id}: duplicate id`);
    if (question) ids.add(question.id);
  }
  return { valid: errors.length === 0, errors };
}
