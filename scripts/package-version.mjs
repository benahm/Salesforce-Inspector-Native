// Creates a package version, after copying the version number of sfdx-project.json
// (0.1.0.NEXT -> 0.1.0) into the VERSION shown by the app (lwc/utils/utils.js).
// Extra arguments go to `sf package version create`, e.g. --wait 90.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const PROJECT = "sfdx-project.json";
const UTILS = "force-app/main/default/lwc/utils/utils.js";

const project = JSON.parse(readFileSync(PROJECT, "utf8"));
const packageDir = project.packageDirectories.find((dir) => dir.default);
const version = packageDir.versionNumber.split(".").slice(0, 3).join(".");

const utils = readFileSync(UTILS, "utf8");
const updated = utils.replace(
  /export const VERSION = "[^"]*";/,
  `export const VERSION = "${version}";`
);
if (updated !== utils) {
  writeFileSync(UTILS, updated);
  console.log(`VERSION set to ${version} in ${UTILS}`);
}

const args = [
  "package",
  "version",
  "create",
  "--package",
  packageDir.package,
  "--installation-key-bypass",
  "--code-coverage",
  "--wait",
  "60",
  ...process.argv.slice(2)
];
// On Windows, sf is a .cmd script: it runs through the shell, which needs the spaces quoted.
const isWindows = process.platform === "win32";
const shellArgs = args.map((arg) =>
  isWindows && arg.includes(" ") ? `"${arg}"` : arg
);
console.log(`sf ${shellArgs.join(" ")}`);
const result = spawnSync("sf", shellArgs, {
  stdio: "inherit",
  shell: isWindows
});
process.exit(result.status ?? 1);
