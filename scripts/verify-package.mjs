import { execFile } from "node:child_process";
import { listPackage } from "@electron/asar";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const appPath = resolve("dist/mac-arm64/Chip Sim Workstation.app");
const appBinary = join(appPath, "Contents/MacOS/Chip Sim Workstation");
const resources = join(appPath, "Contents/Resources");
const solver = join(resources, "ngspice/darwin-arm64/ngspice");
const manifestPath = join(resources, "ngspice/darwin-arm64/manifest.json");
const noticePath = join(resources, "ngspice/NOTICE.md");
const appArchive = join(resources, "app.asar");

const appFile = (await execute("file", [appBinary])).stdout;
if (!appFile.includes("arm64"))
  throw new Error("Packaged Electron executable is not arm64");
const solverFile = (await execute("file", [solver])).stdout;
if (!solverFile.includes("arm64"))
  throw new Error("Packaged ngspice executable is not arm64");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.platform !== "darwin-arm64" || !manifest.files?.ngspice)
  throw new Error("Bundled solver manifest is invalid");
if (
  !(await readFile(noticePath, "utf8")).includes("GNU General Public License")
)
  throw new Error("Bundled solver notice is missing");
const applicationFiles = listPackage(appArchive);
if (!applicationFiles.includes("/out/preload/index.js"))
  throw new Error("Packaged CommonJS preload is missing");
if (!applicationFiles.some((path) => path.includes("editor.worker-")))
  throw new Error("Offline Monaco editor worker is missing");

const temporary = await mkdtemp(join(tmpdir(), "chip-sim-package-"));
try {
  const netlist = join(temporary, "smoke.cir");
  await writeFile(
    netlist,
    "* packaged solver smoke\nV1 rail 0 6\nR1 rail 0 1000\n.control\nop\nset wr_vecnames\nset wr_singlescale\nwrdata results.dat v(rail)\nquit\n.endc\n.end\n",
  );
  await execute(solver, ["-b", "smoke.cir"], {
    cwd: temporary,
    timeout: 10_000,
  });
  const result = await readFile(join(temporary, "results.dat"), "utf8");
  if (!result.includes("6.00000000e+00"))
    throw new Error("Packaged solver did not produce the expected 6 V result");
} finally {
  await rm(temporary, { recursive: true, force: true });
}

console.log(`Verified arm64 app and bundled ${manifest.version}`);
