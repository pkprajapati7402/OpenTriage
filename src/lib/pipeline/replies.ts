import { z } from "zod";
import { Item, DraftReply, DraftReplyType, DuplicateAssessment, PrAssessment } from "../schemas";
import { LLMProvider } from "../providers/types";
import { detectMissingInfo } from "./missingInfo";
import { truncateBody, sanitizePromptText } from "../util/truncate";
import {
  getDraftReplyPromptSystem,
  getDraftReplyPromptUser,
  PROMPT_VERSION,
} from "../prompts/templates";
import { logger } from "../util/logger";

const LLMReplySchema = z.object({
  text: z.string().min(5),
});

export class ReplyGenerator {
  public generateTemplateReply(
    item: Item,
    type: DraftReplyType,
    missingFields: string[],
    candidateDuplicates: { number: number; title: string }[] = []
  ): string {
    switch (type) {
      case "POSSIBLE_DUPLICATE": {
        const topDupe = candidateDuplicates[0];
        const dupeRef = topDupe ? `#${topDupe.number} ("${topDupe.title}")` : "an existing issue";
        return `Hi @${item.author}, thanks for reporting this! This looks very similar to ${dupeRef}. Could you please check that issue to see if it covers what you are experiencing? If this is a different bug, please let us know how it differs so we can investigate further.`;
      }
      case "NEEDS_INFO": {
        const missingList = missingFields.map((f) => `- ${f}`).join("\n");
        return `Hi @${item.author}, thank you for opening this issue! To help the maintainers reproduce and diagnose the problem effectively, could you please provide the following details?\n\n${missingList}\n\nOnce we have these details, we'll be glad to look into it!`;
      }
      case "PR_NEEDS_DESCRIPTION": {
        return `Hi @${item.author}, thank you for your pull request! Could you please add a short description to the PR body explaining the motivation for this change and link any related issue if applicable? Having this context helps us review your contribution much faster.`;
      }
      case "PR_LOW_EFFORT": {
        return `Hi @${item.author}, thanks for checking out the project! It looks like this pull request contains very minor or formatting-only changes without an accompanying description or linked issue. Please check out our contributing guidelines to see how to contribute substantive bug fixes or documentation improvements.`;
      }
      default:
        return "";
    }
  }

  public async generateDraftReply(
    item: Item,
    duplicates: DuplicateAssessment,
    prAssessment?: PrAssessment,
    llmProvider?: LLMProvider
  ): Promise<DraftReply> {
    // 1. Determine reply type
    let replyType: DraftReplyType = "NONE";
    const missingInfoResult = detectMissingInfo(item);

    if (item.kind === "pr") {
      if (prAssessment && prAssessment.band === "LIKELY_LOW_EFFORT") {
        replyType = "PR_LOW_EFFORT";
      } else if (missingInfoResult.hasMissingInfo) {
        replyType = "PR_NEEDS_DESCRIPTION";
      }
    } else {
      if (duplicates.isDuplicate && duplicates.candidates.length > 0) {
        replyType = "POSSIBLE_DUPLICATE";
      } else if (missingInfoResult.hasMissingInfo) {
        replyType = "NEEDS_INFO";
      }
    }

    if (replyType === "NONE") {
      return {
        type: "NONE",
        text: "",
        missingFields: [],
      };
    }

    const candidateDuplicates = duplicates.candidates.map((c) => ({
      number: c.number,
      title: c.title,
    }));

    // 2. Try LLM draft if provider available
    if (llmProvider) {
      try {
        const truncated = truncateBody(item.body, { headChars: 800, tailChars: 200 });
        const cleanBody = sanitizePromptText(truncated.text);
        const cleanTitle = sanitizePromptText(item.title);

        const system = getDraftReplyPromptSystem(item.kind);
        const user = getDraftReplyPromptUser({
          kind: item.kind,
          title: cleanTitle,
          body: cleanBody,
          replyType,
          missingFields: missingInfoResult.missingFields,
          candidateDuplicates,
        });

        const result = await llmProvider.generateJSON({
          system,
          user,
          schema: LLMReplySchema,
          maxTokens: 256,
          temperature: 0.3,
          promptVersion: PROMPT_VERSION,
        });

        return {
          type: replyType,
          text: result.data.text.trim(),
          model: `${llmProvider.name}/${llmProvider.model}`,
          missingFields: missingInfoResult.missingFields,
        };
      } catch (err) {
        logger.warn(`Draft reply LLM failed, using template reply:`, err);
      }
    }

    // 3. Deterministic template fallback
    const text = this.generateTemplateReply(
      item,
      replyType,
      missingInfoResult.missingFields,
      candidateDuplicates
    );

    return {
      type: replyType,
      text,
      model: "template",
      missingFields: missingInfoResult.missingFields,
    };
  }
}
