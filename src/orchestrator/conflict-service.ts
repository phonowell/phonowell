import type { Drop } from "./types.js";

interface DeriveConflictInput {
  drops: Drop[];
  definitionOfDone: string[];
  acceptanceDropId: string;
}

export function deriveUnresolvedQuestions(input: DeriveConflictInput): string[] {
  const goal = input.drops.find((drop) => drop.type === "goal-origin");
  const questions: string[] = [];
  if (!goal || (goal.summary ?? "").trim().length < 12) {
    questions.push("Goal-origin intent is too short for reliable convergence.");
  }
  if (input.definitionOfDone.length === 0) {
    questions.push("Definition of done is empty.");
  }
  const hasAcceptance = input.drops.some((drop) => drop.dropId === input.acceptanceDropId);
  if (!hasAcceptance) {
    questions.push("Acceptance contract is not bound.");
  }
  return questions;
}
