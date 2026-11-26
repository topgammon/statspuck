import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

// Next's static export writes small .txt "flight payload" files next to every page.
// With ~5,000 pick pages they push the site past Cloudflare Pages' 20,000 file limit.
// Pages load fine from the HTML alone, so drop them after the build.
function strip(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      strip(full);
      if (readdirSync(full).length === 0) rmSync(full, { recursive: true, force: true });
    } else if (name.endsWith(".txt") && name !== "robots.txt") {
      rmSync(full);
    }
  }
}

strip("out");
