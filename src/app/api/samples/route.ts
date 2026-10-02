import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const samplesDir = path.resolve(process.cwd(), "samples");
  const samples: { owner: string; repo: string; key: string; hasData: boolean }[] = [];

  try {
    if (fs.existsSync(samplesDir)) {
      const dirs = await fs.promises.readdir(samplesDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory() && d.name.includes("__")) {
          const [owner, repo] = d.name.split("__");
          samples.push({
            owner,
            repo,
            key: `${owner}/${repo}`,
            hasData: true,
          });
        }
      }
    }
  } catch (err) {
    console.error("Error reading samples directory:", err);
  }

  return NextResponse.json({ samples });
}
