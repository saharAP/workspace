const fs = require("fs");
const path = require("path");
const spawnSync = require("child_process").spawnSync;
const readline = require("readline");

const GLOBAL_NODE_DIR = path.resolve(__dirname, "../../../node_modules");
const NODE_DIR = path.resolve(__dirname, "../node_modules");
const INPUT_DIR = path.resolve(__dirname, "../contracts");
const CONFIG_DIR = path.resolve(__dirname, "../docgen");
const OUTPUT_DIR = path.resolve(__dirname, "../docgen/docs");
const SUMMARY_FILE = path.resolve(__dirname, "../docgen/SUMMARY.md")
const EXCLUDE_FILE = path.resolve(__dirname, "../docgen/exclude.txt");

const excludeList = lines(EXCLUDE_FILE).map((line) => INPUT_DIR + "/" + line);
const relativePath = path.relative(path.dirname(SUMMARY_FILE), OUTPUT_DIR);

let excludeListPathName = [];
let postCheckPathNameList = [];

function lines(pathName) {
  return fs
    .readFileSync(pathName, { encoding: "utf8" })
    .split("\r")
    .join("")
    .split("\n");
}

function scan(pathName, indentation) {
  if (!excludeList.includes(pathName)) {
    if (fs.lstatSync(pathName).isDirectory()) {
      fs.appendFileSync(
        SUMMARY_FILE,
        indentation + "* " + path.basename(pathName) + "\n"
      );
      for (const fileName of fs.readdirSync(pathName))
        scan(pathName + "/" + fileName, indentation + "  ");
    } else if (pathName.endsWith(".sol")) {
      const text = path.basename(pathName).slice(0, -4);
      const link = pathName.slice(INPUT_DIR.length, -4);
      fs.appendFileSync(
        SUMMARY_FILE,
        indentation + "* [" + text + "](" + relativePath + link + ".md)\n"
      );
      postCheckPathNameList.push(
        CONFIG_DIR + "/" + relativePath + link + ".md"
      );
    }
  } else {
    excludeListPathName.push(pathName);
  }
}

function fix(pathName) {
  if (fs.lstatSync(pathName).isDirectory()) {
    for (const fileName of fs.readdirSync(pathName))
      fix(pathName + "/" + fileName);
  } else if (pathName.endsWith(".md")) {
    fs.writeFileSync(
      pathName,
      lines(pathName)
        .filter((line) => line.trim().length > 0)
        .join("\n") + "\n"
    );
  }
}

fs.writeFileSync(SUMMARY_FILE, "# Summary\n");
fs.writeFileSync(".gitbook.yaml", "root: ./\n");
fs.appendFileSync(".gitbook.yaml", "structure:\n");
fs.appendFileSync(".gitbook.yaml", "  readme: docgen/README.md\n");
fs.appendFileSync(".gitbook.yaml", "  summary: docgen/SUMMARY.md\n");

scan(INPUT_DIR, "");

const args = [
  GLOBAL_NODE_DIR + "/@anthonymartin/solidity-docgen/dist/cli.js",
  "--input=" + INPUT_DIR,
  "--output=" + OUTPUT_DIR,
  "--helpers=" + GLOBAL_NODE_DIR + "/@anthonymartin/solidity-docgen/dist/handlebars",
  "--templates=" + CONFIG_DIR,
  "--exclude=" + excludeListPathName.toString(),
  "--solc-module=" + NODE_DIR + "/solc",
  "--solc-settings=" +
    JSON.stringify({ optimizer: { enabled: true, runs: 200 } }),
  "--output-structure=" + "contracts",
];

const result = spawnSync("node", args, {
  stdio: ["inherit", "inherit", "pipe"],
});
if (result.stderr.length > 0) throw new Error(result.stderr);

fix(OUTPUT_DIR);

console.log("\n\nDocify Report:");

async function generateDocReport(docPathNameList) {
  let count = 0;
  const re = new RegExp("Missing `(.*?)` for (.*?) `(.*?)`");
  for (const docPathName of docPathNameList) {
    const originalName = path.basename(docPathName).slice(0, -3) + ".sol";
    const fileStream = fs.createReadStream(docPathName);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const reMatch = line.match(re);
      if (reMatch) {
        count += 1;
        console.log(
          `${count}\tWarning: ${reMatch[2]} ${reMatch[3]} in ${originalName} is missing ${reMatch[1]}`
        );
      }
    }
  }
  console.log(`Total of ${count} missing documentations for contracts.`);
}

generateDocReport(postCheckPathNameList).then((_) => {});
