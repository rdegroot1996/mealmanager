import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const session = "-s=mealmanager-artwork";

// All CLI arguments are fixed or generated relative paths, never user/shell input.
function cli(args, inSession = true) {
  const cliArgs = inSession ? [session, ...args] : args;
  const windows = process.platform === "win32";
  const result = spawnSync(
    windows ? (process.env.ComSpec ?? "cmd.exe") : "playwright-cli",
    windows
      ? ["/d", "/s", "/c", `playwright-cli ${cliArgs.join(" ")}`]
      : cliArgs,
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (
    result.error ||
    result.status !== 0 ||
    /^### Error/m.test(result.stdout ?? "")
  ) {
    throw new Error(
      result.error?.message ||
        result.stderr ||
        result.stdout ||
        "Playwright CLI failed.",
    );
  }
  return result.stdout;
}

await fs.mkdir(path.join(root, ".playwright-cli"), { recursive: true });
const scratch = await fs.mkdtemp(
  path.join(root, ".playwright-cli/social-preview-"),
);
const relativeCapture = path
  .relative(root, path.join(scratch, "brand.js"))
  .replaceAll("\\", "/");
try {
  cli(["install", "--skills"], false);
  await fs.writeFile(
    path.join(scratch, "brand.js"),
    captureAppBrand.toString(),
  );
  cli(["open", "http://localhost:4200/login"]);
  const assets = path.join(root, "docs/assets");
  const app = path.join(root, "src/MealManager.App");
  const { format } = createRequire(path.join(app, "package.json"))("prettier");
  const capture = cli(["run-code", `--filename=${relativeCapture}`]);
  const result = capture.match(/### Result\r?\n([^\r\n]+)/)?.[1];
  if (!result) throw new Error("Missing Playwright CLI brand capture.");
  const { brand, theme } = JSON.parse(result);
  const fontLicenses = await Promise.all(
    ["lora", "dm-sans"].map(
      async (family) =>
        `${family}\n${await fs.readFile(path.join(app, `node_modules/@fontsource/${family}/LICENSE`), "utf8")}`,
    ),
  );
  const font = async (family, weight) => {
    const bytes = await fs.readFile(
      path.join(
        app,
        `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`,
      ),
    );
    return `@font-face{font-family:'${family === "lora" ? "Lora" : "DM Sans"}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${bytes.toString("base64")}) format('woff2');}`;
  };
  let html = await fs.readFile(
    path.join(assets, "social-preview.html"),
    "utf8",
  );
  html = html.replace(
    /<!-- font-licenses:start -->[\s\S]*?<!-- font-licenses:end -->\s*/,
    "",
  );
  html = html.replace(
    /<script[^>]*id="font-licenses"[^>]*>[\s\S]*?<\/script>\s*/,
    "",
  );
  html = html.replace(
    "<head>",
    () =>
      `<head>\n<script type="text/plain" id="font-licenses">${fontLicenses.join("\n\n")}</script>`,
  );
  html = html.replace(
    /:root\s*\{[^}]*\}/,
    `:root { ${Object.entries(theme)
      .map(([name, value]) => `--${name}: ${value};`)
      .join(" ")} }`,
  );
  html = html.replace(
    /<style id="fonts">[\s\S]*?<\/style>/,
    `<style id="fonts">${await font("lora", 500)}${await font("dm-sans", 400)}${await font("dm-sans", 500)}</style>`,
  );
  html = html.replace(
    /<!-- brand:start -->[\s\S]*?<!-- brand:end -->/,
    `<!-- brand:start -->${brand}<!-- brand:end -->`,
  );
  const icons = await fs.readFile(
    path.join(app, "src/app/shared/components/app-icon/app-icon.ts"),
    "utf8",
  );
  html = html.replace(
    /<span data-icon="(\w+)">[\s\S]*?<\/span>/g,
    (_, name) => {
      const paths = icons.match(
        new RegExp(`  ${name}: \\[([\\s\\S]*?)\\],`),
      )?.[1];
      if (!paths) throw new Error(`Missing canonical icon: ${name}`);
      return `<span data-icon="${name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${[...paths.matchAll(/'([^']+)'/g)].map((match) => `<path d="${match[1]}" />`).join("")}</svg></span>`;
    },
  );
  html = await format(html, { parser: "html" });
  await fs.writeFile(path.join(assets, "social-preview.html"), html);
  await fs.writeFile(
    path.join(scratch, "social.js"),
    `async page => { await page.setViewportSize({ width: 1280, height: 640 }); await page.setContent(${JSON.stringify(html)}); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: "docs/assets/social-preview.png" }); return { width: 1280, height: 640 }; }`,
  );
  console.log(
    "Generated docs/assets/social-preview.html from rendered AppBrand and local fonts.",
  );

  cli([
    "run-code",
    `--filename=${path.relative(root, path.join(scratch, "social.js")).replaceAll("\\", "/")}`,
  ]);
  console.log(
    "Updated docs/assets/social-preview.html and social-preview.png (1280 x 640).",
  );
} finally {
  try {
    cli(["close"]);
  } catch (error) {
    console.warn(error.message);
  }
  for (const file of ["brand.js", "social.js"]) {
    await fs.rm(path.join(scratch, file), { force: true });
  }
  await fs.rmdir(scratch);
}

async function captureAppBrand(page) {
  await page.goto("http://localhost:4200/login");
  await page.locator('app-brand[size="large"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const brand = await page
    .locator('app-brand[size="large"]')
    .evaluate((element) => {
      const wordmark = element.querySelector("span.font-display");
      if (
        !wordmark ||
        !getComputedStyle(wordmark).fontFamily.includes("Lora")
      ) {
        throw new Error(
          "The social preview requires the current Lora AppBrand wordmark.",
        );
      }
      const copy = element.cloneNode(true);
      const sources = [element, ...element.querySelectorAll("*")];
      const targets = [copy, ...copy.querySelectorAll("*")];
      const properties = [
        "display",
        "align-items",
        "justify-content",
        "flex-shrink",
        "gap",
        "width",
        "height",
        "border-radius",
        "background-color",
        "color",
        "font-family",
        "font-size",
        "font-weight",
        "line-height",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "overflow",
      ];
      sources.forEach((source, index) => {
        const styles = getComputedStyle(source);
        targets[index].removeAttribute("class");
        properties.forEach((property) =>
          targets[index].style.setProperty(
            property,
            styles.getPropertyValue(property),
          ),
        );
      });
      return copy.outerHTML;
    });
  const theme = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      Object.entries({
        cream: "base-200",
        ink: "base-content",
        primary: "primary",
        line: "base-300",
      }).map(([name, token]) => [
        name,
        styles.getPropertyValue(`--color-${token}`).trim(),
      ]),
    );
  });
  return { brand, theme };
}
