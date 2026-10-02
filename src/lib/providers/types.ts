import { ZodSchema } from "zod";

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface GenerateJSONArgs<T> {
  system: string;
  user: string;
  schema: ZodSchema<T>;
  maxTokens?: number;
  temperature?: number;
  promptVersion?: string;
}

export interface GenerateJSONResult<T> {
  data: T;
  usage?: Usage;
  latencyMs: number;
  fromCache?: boolean;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generateJSON<T>(args: GenerateJSONArgs<T>): Promise<GenerateJSONResult<T>>;
  isAvailable(): Promise<boolean>;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
}
