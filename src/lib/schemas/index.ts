import { z } from "zod";

export const ItemKindSchema = z.enum(["issue", "pr"]);
export type ItemKind = z.infer<typeof ItemKindSchema>;

export const ChangedFileSchema = z.object({
  path: z.string(),
  additions: z.number().default(0),
  deletions: z.number().default(0),
  patch: z.string().optional(),
});
export type ChangedFile = z.infer<typeof ChangedFileSchema>;

export const PrDetailsSchema = z.object({
  changedFiles: z.array(ChangedFileSchema).default([]),
  totalAdditions: z.number().default(0),
  totalDeletions: z.number().default(0),
  changedFilesCount: z.number().default(0),
});
export type PrDetails = z.infer<typeof PrDetailsSchema>;

export const ItemSchema = z.object({
  id: z.number(),
  number: z.number(),
  kind: ItemKindSchema,
  title: z.string(),
  body: z.string().default(""),
  author: z.string().default("unknown"),
  authorAssociation: z.string().optional(),
  createdAt: z.string(),
  closedAt: z.string().optional().nullable(),
  state: z.enum(["open", "closed"]).default("open"),
  merged: z.boolean().optional(),
  labels: z.array(z.string()).default([]),
  duplicateOf: z.number().optional(),
  url: z.string().url().or(z.string()),
  pr: PrDetailsSchema.optional(),
});
export type Item = z.infer<typeof ItemSchema>;

export const RepoLabelSchema = z.object({
  name: z.string(),
  color: z.string().default("888888"),
  description: z.string().optional().default(""),
});
export type RepoLabel = z.infer<typeof RepoLabelSchema>;

export const SuggestedLabelItemSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type SuggestedLabelItem = z.infer<typeof SuggestedLabelItemSchema>;

export const LabelSuggestionSchema = z.object({
  labels: z.array(SuggestedLabelItemSchema).default([]),
  abstain: z.boolean().default(false),
  method: z.enum(["knn", "llm-zero", "llm-fewshot"]).default("llm-fewshot"),
  model: z.string().optional(),
  latencyMs: z.number().optional(),
});
export type LabelSuggestion = z.infer<typeof LabelSuggestionSchema>;

export const DuplicateCandidateSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  score: z.number().min(0).max(1),
  state: z.string().default("open"),
  matchedSnippet: z.string().optional(),
  reason: z.string().optional(),
});
export type DuplicateCandidate = z.infer<typeof DuplicateCandidateSchema>;

export const DuplicateAssessmentSchema = z.object({
  candidates: z.array(DuplicateCandidateSchema).default([]),
  isDuplicate: z.boolean().default(false),
  topScore: z.number().default(0),
});
export type DuplicateAssessment = z.infer<typeof DuplicateAssessmentSchema>;

export const PrSignalSchema = z.object({
  id: z.string(),
  weight: z.number(),
  evidence: z.string(),
});
export type PrSignal = z.infer<typeof PrSignalSchema>;

export const PrBandSchema = z.enum(["OK", "REVIEW", "LIKELY_LOW_EFFORT"]);
export type PrBand = z.infer<typeof PrBandSchema>;

export const PrAssessmentSchema = z.object({
  band: PrBandSchema.default("OK"),
  score: z.number().default(0),
  signals: z.array(PrSignalSchema).default([]),
  explanation: z.string().optional(),
});
export type PrAssessment = z.infer<typeof PrAssessmentSchema>;

export const DraftReplyTypeSchema = z.enum([
  "NEEDS_INFO",
  "POSSIBLE_DUPLICATE",
  "PR_NEEDS_DESCRIPTION",
  "PR_LOW_EFFORT",
  "NONE",
]);
export type DraftReplyType = z.infer<typeof DraftReplyTypeSchema>;

export const DraftReplySchema = z.object({
  type: DraftReplyTypeSchema,
  text: z.string(),
  model: z.string().optional(),
  missingFields: z.array(z.string()).default([]),
});
export type DraftReply = z.infer<typeof DraftReplySchema>;

export const ItemTriageSuggestionSchema = z.object({
  itemNumber: z.number(),
  labels: LabelSuggestionSchema,
  duplicates: DuplicateAssessmentSchema,
  prAssessment: PrAssessmentSchema.optional(),
  draftReply: DraftReplySchema.optional(),
  triagedAt: z.string(),
  model: z.string().optional(),
});
export type ItemTriageSuggestion = z.infer<typeof ItemTriageSuggestionSchema>;

export const FeedbackTargetSchema = z.enum(["labels", "duplicates", "pr", "reply"]);
export type FeedbackTarget = z.infer<typeof FeedbackTargetSchema>;

export const FeedbackSchema = z.object({
  itemNumber: z.number(),
  target: FeedbackTargetSchema,
  useful: z.boolean(),
  note: z.string().optional(),
  at: z.string(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

export const SignalConfigSchema = z.object({
  weight: z.number(),
  description: z.string(),
});

export const TriageConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  ignoredLabelPatterns: z.array(z.string()).default([]),
  duplicateThreshold: z.number().default(0.68),
  confidenceThreshold: z.number().default(0.5),
  maxItemsPerRun: z.number().default(50),
  historySplitRatio: z.number().default(0.7),
  minLabelCount: z.number().default(5),
  signals: z.record(SignalConfigSchema).default({}),
  bands: z.object({
    reviewScore: z.number().default(30),
    lowEffortScore: z.number().default(60),
  }).default({ reviewScore: 30, lowEffortScore: 60 }),
  replyTemplates: z.record(z.string()).default({}),
});
export type TriageConfig = z.infer<typeof TriageConfigSchema>;

export const ModelEvalMetricSchema = z.object({
  configName: z.string(),
  modelName: z.string(),
  where: z.enum(["Local", "Hosted"]),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  exactMatchRate: z.number(),
  top1HitRate: z.number(),
  abstainRate: z.number(),
  secondsPerItem: z.number(),
  totalEvaluated: z.number(),
});
export type ModelEvalMetric = z.infer<typeof ModelEvalMetricSchema>;

export const DuplicateEvalMetricSchema = z.object({
  recallAt3: z.number(),
  precisionAtThreshold: z.number(),
  threshold: z.number(),
  evaluatedPairs: z.number(),
});
export type DuplicateEvalMetric = z.infer<typeof DuplicateEvalMetricSchema>;

export const PrSignalsEvalMetricSchema = z.object({
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  lowEffortCount: z.number(),
  totalPrs: z.number(),
  falsePositivesSample: z.array(z.number()).default([]),
});
export type PrSignalsEvalMetric = z.infer<typeof PrSignalsEvalMetricSchema>;

export const FailureExampleSchema = z.object({
  itemNumber: z.number(),
  kind: ItemKindSchema,
  title: z.string(),
  actualLabels: z.array(z.string()),
  predictedLabels: z.array(z.string()),
  reason: z.string(),
});
export type FailureExample = z.infer<typeof FailureExampleSchema>;

export const EvalReportSchema = z.object({
  repo: z.string(),
  evaluatedAt: z.string(),
  historySize: z.number(),
  testSize: z.number(),
  labelMetrics: z.array(ModelEvalMetricSchema),
  duplicateMetrics: DuplicateEvalMetricSchema.optional(),
  prMetrics: PrSignalsEvalMetricSchema.optional(),
  failureGallery: z.array(FailureExampleSchema).default([]),
});
export type EvalReport = z.infer<typeof EvalReportSchema>;
