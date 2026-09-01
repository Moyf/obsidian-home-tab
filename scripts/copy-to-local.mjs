import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envResult = findEnvValue("VAULT_PATH", rootDir);
const configuredPath = process.env.VAULT_PATH?.trim() || envResult?.value;
if (!configuredPath) throw new Error("VAULT_PATH is not set. Add it to .env in this repository or a parent directory.");

const vaultPath = isAbsolute(configuredPath) ? configuredPath : resolve(envResult?.directory ?? rootDir, configuredPath);
const obsidianDir = join(vaultPath, ".obsidian");
if (!existsSync(vaultPath)) throw new Error(`Vault directory does not exist: ${vaultPath}`);
if (!existsSync(obsidianDir)) throw new Error(`Vault directory does not contain .obsidian: ${vaultPath}`);

const manifest = JSON.parse(readFileSync(join(rootDir, "manifest.json"), "utf8"));
const pluginDir = join(obsidianDir, "plugins", manifest.id);
mkdirSync(pluginDir, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
	const source = join(rootDir, file);
	if (existsSync(source)) copyFileSync(source, join(pluginDir, file));
	else if (file !== "styles.css") throw new Error(`Required build artifact is missing: ${source}`);
}
const hotreload = join(pluginDir, ".hotreload");
if (!existsSync(hotreload)) writeFileSync(hotreload, "");
console.log(`Copied ${manifest.id} to ${pluginDir}`);

function findEnvValue(key, startDirectory) {
	let directory = resolve(startDirectory);
	const root = parse(directory).root;
	while (true) {
		const envPath = join(directory, ".env");
		if (existsSync(envPath)) {
			const value = parseEnvValue(readFileSync(envPath, "utf8"), key);
			if (value !== undefined) return { value, directory };
		}
		if (directory === root) return null;
		directory = dirname(directory);
	}
}

function parseEnvValue(contents, key) {
	for (const line of contents.split(/\r?\n/u)) {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
		if (!match || match[1] !== key) continue;
		const raw = match[2].trim();
		if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1);
		return raw.replace(/\s+#.*$/u, "").trim();
	}
	return undefined;
}
