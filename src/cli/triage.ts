#!/usr/bin/env node

import { GitHubFetcher } from "../lib/github/fetcher";
import { TriagePipelineRunner } from "../lib/pipeline";
import { EvalRunner } from "../lib/eval/runner";
import { getLLMProvider, getEmbeddingProvider } from "../lib/providers/factory";
import { logger } from "../lib/util/logger";
import { spawn } from "child_process";

function printUsage(): void {
  console.log(`
🧭 OpenTriage CLI — Local-first, open-model triage assistant for open-source maintainers

USAGE:
  npm run triage -- <command> [options]

COMMANDS:
  fetch <owner/repo> [--limit N]
    Fetch public repository issues, PRs, diff summaries, and labels into local cache.

  run <owner/repo> [--model <model>] [--limit N] [--method knn|llm-fewshot]
    Run label suggestion, duplicate detection, PR signals, and draft reply generation.

  eval <owner/repo> [--models a,b] [--test-size N]
    Run reproducible evaluation harness comparing k-NN baseline with open models.

  serve [--port N]
    Start the local OpenTriage web dashboard.

EXAMPLES:
  npm run triage -- fetch expressjs/express --limit 100
  npm run triage -- run expressjs/express --limit 30
  npm run triage -- eval expressjs/express --models gemma3:1b --test-size 100
  npm run triage -- serve --port 3000
`);
}

function parseRepoArg(repoArg?: string): { owner: string; repo: string } {
  if (!repoArg || !repoArg.includes("/")) {
    console.error("Error: Please specify the repository in 'owner/repo' format (e.g. facebook/react).");
    process.exit(1);
  }
  const [owner, repo] = repoArg.split("/");
  return { owner: owner.trim(), repo: repo.trim() };
}

function getOption(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0].toLowerCase();

  try {
    switch (command) {
      case "fetch": {
        const { owner, repo } = parseRepoArg(args[1]);
        const limitStr = getOption(args, "--limit");
        const limit = limitStr ? parseInt(limitStr, 10) : 200;

        logger.info(`Fetching repository data for ${owner}/${repo} (limit: ${limit})...`);
        const fetcher = new GitHubFetcher(owner, repo);
        const items = await fetcher.fetchItems({ limit, useCache: false });
        const labels = await fetcher.fetchLabels(false);

        console.log(`\n✅ Successfully fetched and cached:`);
        console.log(`   - ${items.length} items (${items.filter((i) => i.kind === "issue").length} issues, ${items.filter((i) => i.kind === "pr").length} PRs)`);
        console.log(`   - ${labels.length} repository labels`);
        console.log(`   - Location: data/${owner.toLowerCase()}__${repo.toLowerCase()}/\n`);
        process.exit(0);
      }

      case "run": {
        const { owner, repo } = parseRepoArg(args[1]);
        const limitStr = getOption(args, "--limit");
        const limit = limitStr ? parseInt(limitStr, 10) : 50;
        const model = getOption(args, "--model") || process.env.OLLAMA_LLM_MODEL || "gemma3:1b";
        const methodStr = (getOption(args, "--method") || "llm-fewshot") as "knn" | "llm-zero" | "llm-fewshot";

        logger.info(`Running triage pipeline on ${owner}/${repo} using model '${model}'...`);
        const llm = getLLMProvider({ modelName: model });
        const embed = await getEmbeddingProvider(true);

        const runner = new TriagePipelineRunner(owner, repo);
        const suggestions = await runner.run({
          limit,
          method: methodStr,
          llmProvider: llm,
          embeddingProvider: embed,
        });

        console.log(`\n🎉 Triage complete! Generated suggestions for ${Object.keys(suggestions).length} items.`);
        console.log(`   View them in the dashboard: npm run triage -- serve\n`);
        process.exit(0);
      }

      case "eval": {
        const { owner, repo } = parseRepoArg(args[1]);
        const modelsStr = getOption(args, "--models") || "gemma3:1b";
        const models = modelsStr.split(",").map((m) => m.trim());
        const testSizeStr = getOption(args, "--test-size");
        const testSize = testSizeStr ? parseInt(testSizeStr, 10) : 100;

        logger.info(`Starting evaluation on ${owner}/${repo} with models: ${models.join(", ")}...`);
        const evalRunner = new EvalRunner(owner, repo);
        const report = await evalRunner.runEvaluation({
          models,
          testSize,
        });

        console.log(`\n📈 Evaluation Completed! Results summary:`);
        console.log(`   Repository: ${report.repo}`);
        console.log(`   History Items: ${report.historySize} | Test Items: ${report.testSize}`);
        for (const metric of report.labelMetrics) {
          console.log(`   • ${metric.configName}: Precision=${(metric.precision * 100).toFixed(1)}%, Recall=${(metric.recall * 100).toFixed(1)}%, F1=${(metric.f1 * 100).toFixed(1)}%`);
        }
        console.log(`\n   Saved full Markdown & JSON reports to: results/${owner.toLowerCase()}__${repo.toLowerCase()}/\n`);
        process.exit(0);
      }

      case "serve": {
        const port = getOption(args, "--port") || process.env.PORT || "3000";
        logger.info(`Starting OpenTriage Web Dashboard on port ${port}...`);

        const isWindows = process.platform === "win32";
        const npmCmd = isWindows ? "npm.cmd" : "npm";
        const child = spawn(npmCmd, ["run", "dev", "--", "-p", port], {
          stdio: "inherit",
          shell: true,
        });

        child.on("exit", (code) => {
          process.exit(code || 0);
        });
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("Command failed:", error.message);
    if (error.message.includes("rate limit")) {
      process.exit(2);
    }
    if (error.message.includes("unavailable") || error.message.includes("Ollama")) {
      process.exit(3);
    }
    process.exit(1);
  }
}

main();
