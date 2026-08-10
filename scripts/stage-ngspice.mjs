import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const projectRoot = process.cwd();
const sourceBinary =
  process.env.CHIP_SIM_NGSPICE ?? "/opt/homebrew/bin/ngspice";
const destination = join(projectRoot, "resources/ngspice/darwin-arm64");
const libraryDirectory = join(destination, "lib");
const stagedBinary = join(destination, "ngspice");

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function dependencies(path) {
  return run("otool", ["-L", path])
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(" ")[0])
    .filter(Boolean);
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

if (!run("file", [sourceBinary]).includes("arm64")) {
  throw new Error(
    `Expected an Apple Silicon ngspice binary at ${sourceBinary}`,
  );
}

await rm(destination, { recursive: true, force: true });
await mkdir(libraryDirectory, { recursive: true });
await copyFile(sourceBinary, stagedBinary);

const pending = dependencies(sourceBinary).filter((path) =>
  path.startsWith("/opt/homebrew/"),
);
const copied = new Map();

while (pending.length > 0) {
  const source = pending.shift();
  if (!source || copied.has(source)) continue;

  const destinationPath = join(libraryDirectory, basename(source));
  const nameCollision = [...copied.values()].find(
    (path) => basename(path) === basename(source),
  );
  if (nameCollision) {
    throw new Error(`Cannot bundle two libraries named ${basename(source)}`);
  }

  await copyFile(source, destinationPath);
  copied.set(source, destinationPath);
  pending.push(
    ...dependencies(source).filter((path) => path.startsWith("/opt/homebrew/")),
  );
}

for (const destinationPath of copied.values()) {
  run("install_name_tool", [
    "-id",
    `@loader_path/${basename(destinationPath)}`,
    destinationPath,
  ]);
  for (const dependency of dependencies(destinationPath)) {
    const bundled = copied.get(dependency);
    if (bundled) {
      run("install_name_tool", [
        "-change",
        dependency,
        `@loader_path/${basename(bundled)}`,
        destinationPath,
      ]);
    }
  }
  run("codesign", ["--force", "--sign", "-", destinationPath]);
}

for (const dependency of dependencies(stagedBinary)) {
  const bundled = copied.get(dependency);
  if (bundled) {
    run("install_name_tool", [
      "-change",
      dependency,
      `@executable_path/lib/${basename(bundled)}`,
      stagedBinary,
    ]);
  }
}
run("codesign", ["--force", "--sign", "-", stagedBinary]);

const version =
  run(stagedBinary, ["--version"])
    .split("\n")
    .find((line) => line.includes("ngspice")) ?? "ngspice";
const files = [stagedBinary, ...copied.values()];
const manifest = {
  platform: "darwin-arm64",
  version,
  files: Object.fromEntries(
    await Promise.all(
      files.map(async (path) => [
        path.slice(destination.length + 1),
        await sha256(path),
      ]),
    ),
  ),
};

await writeFile(
  join(destination, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await mkdir(dirname(join(projectRoot, "resources/ngspice/NOTICE.md")), {
  recursive: true,
});
await writeFile(
  join(projectRoot, "resources/ngspice/NOTICE.md"),
  "# ngspice runtime\n\nThis application bundles ngspice 46 and its required dynamic libraries for local circuit simulation. ngspice is distributed under the GNU General Public License. Source and license information: https://ngspice.sourceforge.io/\n",
);

console.log(
  `Staged ${version} with ${copied.size} libraries at ${destination}`,
);
