import { readFileSync, writeFileSync } from "fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifestJson = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = packageJson.version;

manifestJson.version = version;
writeFileSync("manifest.json", JSON.stringify(manifestJson, null, "\t") + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[version] = manifestJson.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
