import { Item } from "../schemas";

export interface MissingInfoResult {
  hasMissingInfo: boolean;
  missingFields: string[];
}

export function detectMissingInfo(item: Item): MissingInfoResult {
  if (item.kind === "pr") {
    // For PRs, check if body is empty or missing description
    const missing: string[] = [];
    if (!item.body || item.body.trim().length < 20) {
      missing.push("PR description explaining motivation and changes");
    }
    const hasIssueLink = /#\d+|fixes\s+#\d+|closes\s+#\d+|resolves\s+#\d+/i.test(item.body || "");
    if (!hasIssueLink) {
      missing.push("linked issue or context");
    }
    return {
      hasMissingInfo: missing.length > 0,
      missingFields: missing,
    };
  }

  // For Issues:
  const body = (item.body || "").toLowerCase();
  const missing: string[] = [];

  // Check version / environment
  const hasVersion = /v?\d+\.\d+(\.\d+)?|node\s+v?\d+|python\s+\d+|os:|platform:|environment:|version/i.test(body);
  if (!hasVersion) {
    missing.push("software/environment version");
  }

  // Check reproduction steps
  const hasSteps = /steps\s+to\s+reproduce|how\s+to\s+reproduce|reproduction|reproduce|to\s+reproduce|repro:|str:/i.test(body);
  if (!hasSteps) {
    missing.push("clear steps to reproduce");
  }

  // Check expected vs actual
  const hasExpected = /expected|actual|behavior|result/i.test(body);
  if (!hasExpected) {
    missing.push("expected vs actual behavior");
  }

  // Check error logs / stack trace
  const hasLogs = /error:|exception|traceback|stack\s*trace|```/i.test(body);
  const mentionsCrashOrError = /crash|error|fail|bug|broken|exception/i.test(body) || /crash|error|fail|bug|broken/i.test(item.title);
  if (mentionsCrashOrError && !hasLogs) {
    missing.push("error logs or console output");
  }

  return {
    hasMissingInfo: missing.length >= 2,
    missingFields: missing,
  };
}
