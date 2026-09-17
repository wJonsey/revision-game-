/**
 * Marks a player's response to a question.
 * Every function here is pure so it can be unit tested without the UI.
 *
 * @typedef {{ correct: boolean, score: number, marksAwarded: number, marksAvailable: number }} Result
 */

/** Python output comparison: ignore Windows line endings, trailing spaces and surrounding blank lines. */
export function normaliseOutput(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** Short typed answers: case-insensitive, single spaces, no surrounding quotes. */
export function normaliseShortAnswer(text) {
  return String(text ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function result(score, marksAvailable = 1, passMark = 1) {
  const clamped = Math.max(0, Math.min(1, score));
  return {
    correct: clamped >= passMark,
    score: clamped,
    marksAwarded: Math.round(clamped * marksAvailable),
    marksAvailable,
  };
}

/**
 * @param {any} question a validated question
 * @param {any} response shape depends on question.type
 * @returns {Result}
 */
export function checkAnswer(question, response = {}) {
  switch (question.type) {
    case "multiple_choice":
      return result(response.choice === question.answer ? 1 : 0);

    case "true_false":
      return result(response.value === question.answer ? 1 : 0);

    case "predict_output": {
      const given = normaliseOutput(response.text);
      return result(question.answer.some((accepted) => normaliseOutput(accepted) === given) ? 1 : 0);
    }

    case "fill_blank": {
      const given = normaliseShortAnswer(response.text);
      return result(question.answer.some((accepted) => normaliseShortAnswer(accepted) === given) ? 1 : 0);
    }

    case "ordering": {
      const order = Array.isArray(response.order) ? response.order : [];
      const inPlace = question.items.filter((item, index) => order[index] === item).length;
      return result(inPlace / question.items.length);
    }

    case "match": {
      const chosen = response.pairs ?? {};
      const right = question.pairs.filter(([term, meaning]) => chosen[term] === meaning).length;
      return result(right / question.pairs.length);
    }

    case "open_response": {
      const ticked = new Set(
        (Array.isArray(response.ticked) ? response.ticked : []).filter(
          (index) => Number.isInteger(index) && index >= 0 && index < question.markPoints.length,
        ),
      );
      const marks = Math.min(ticked.size, question.marks);
      return result(marks / question.marks, question.marks, 0.5);
    }

    default:
      throw new Error(`Unknown question type "${question.type}"`);
  }
}

/** Human-readable correct answer for feedback screens. */
export function describeCorrectAnswer(question) {
  switch (question.type) {
    case "multiple_choice":
      return question.options[question.answer];
    case "true_false":
      return question.answer ? "True" : "False";
    case "predict_output":
    case "fill_blank":
      return question.answer[0];
    case "ordering":
      return question.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    case "match":
      return question.pairs.map(([term, meaning]) => `${term} → ${meaning}`).join("\n");
    case "open_response":
      return `Indicative mark points (any ${question.marks}):\n` +
        question.markPoints.map((point) => `• ${point}`).join("\n");
    default:
      return "";
  }
}
