import { readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const instructionDirectory = join(
  scriptDirectory,
  "..",
  "public",
  "master-data",
  "instructions",
);
const manifestPath = join(instructionDirectory, "manifest.json");
const temporaryManifestPath = `${manifestPath}.tmp`;

const compareAscii = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

const generateInstructionManifest = async () => {
  console.info("[instruction-manifest] start", { instructionDirectory });
  try {
    const entries = await readdir(instructionDirectory, {
      withFileTypes: true,
    });
    const files = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".json") &&
          entry.name !== "manifest.json",
      )
      .map(({ name }) => name)
      .sort(compareAscii);
    const manifest = `${JSON.stringify({ files }, null, 2)}\n`;
    await writeFile(temporaryManifestPath, manifest, "utf8");
    await rename(temporaryManifestPath, manifestPath);
    console.info("[instruction-manifest] complete", {
      manifestPath,
      fileCount: files.length,
    });
  } catch (error) {
    console.error("[instruction-manifest] failed", {
      instructionDirectory,
      manifestPath,
      error,
    });
    process.exitCode = 1;
  }
};

await generateInstructionManifest();
