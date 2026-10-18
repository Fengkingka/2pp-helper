/**
 * 把 engine 接到 PHP 網站：
 *  1. 打包 browser.ts → site/assets/js/engine.js（全域變數 Engine）
 *     打包 hk.ts → site/assets/js/opencc-hk.js（全域變數 OpenCCHK，簡轉繁）
 *  2. 複製劇本、評分準則和問卷 → site/data/scenarios、site/data/rubrics、site/data/questionnaires
 * 用法：npm run build:site（會先跑測試，測試不通過就不會覆蓋網站檔案）
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = process.env.SITE_DIR ?? join(root, "..", "site");
const expectedSite = resolve(root, '..', 'site');
if (!isAbsolute(site) || resolve(site) !== expectedSite) throw new Error('SITE_DIR must be the absolute current project site directory.');
for (const dir of ['scenarios', 'rubrics', 'questionnaires']) {
  if (resolve(site, 'data', dir) !== join(expectedSite, 'data', dir)) throw new Error('Invalid generated content target.');
}

await build({
  entryPoints: [join(root, "browser.ts")],
  bundle: true,
  format: "iife",
  globalName: "Engine",
  minify: true,
  target: ["es2019"],
  legalComments: "none",
  charset: "utf8",
  outfile: join(site, "assets", "js", "engine.js"),
});

await build({
  entryPoints: [join(root, "hk.ts")],
  bundle: true,
  format: "iife",
  globalName: "OpenCCHK",
  minify: true,
  target: ["es2019"],
  legalComments: "none",
  charset: "utf8",
  outfile: join(site, "assets", "js", "opencc-hk.js"),
});

for (const dir of ["scenarios", "rubrics", "questionnaires"]) {
  const out = join(site, "data", dir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const f of readdirSync(join(root, dir)).filter((f) => f.endsWith(".json"))) {
    cpSync(join(root, dir, f), join(out, f));
  }
}
console.log("已更新：", join(site, "assets", "js", "engine.js"), "及 site/data");
