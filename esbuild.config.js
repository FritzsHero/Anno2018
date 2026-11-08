const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const browserCoreShims = require("esbuild-plugin-polyfill-node").polyfillNode({
  polyfills: { events: true, stream: true, buffer: true, string_decoder: true },
});

const root = __dirname;
const outdir = path.join(root, "dist");
const isProduction = process.argv.includes("--production");
const git = (...args) => {
  try {
    return require("child_process")
      .execFileSync("git", args, {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
      })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
};

const version = git("describe", "--always", "--dirty");

function writeHtml({ serve = false, appFile } = {}) {
  fs.writeFileSync(
    path.join(outdir, "index.html"),
    `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, minimum-scale=1, width=device-width, height=device-height"><title>Anno 2018</title></head><body><script type="module" src="${serve ? "app.js" : appFile || fs.readFileSync(path.join(outdir, "app-name.txt"), "utf8").trim()}"></script></body></html>\n`,
  );
}

function copyFfmpeg() {
  for (const file of ["ffmpeg.js", "ffmpeg.js.mem"]) {
    fs.copyFileSync(
      path.join(root, "node_modules/smk2mp4/demo", file),
      path.join(outdir, file),
    );
  }
}

function licenseNotices() {
  const check = require("license-checker");
  const allowed =
    /^(MIT\*?|BSD-3-Clause|Apache-2\.0|ISC|Zlib|0BSD|GPL-3\.0-only|GPL-3\.0-or-later|GPL-2\.0-or-later|LGPL-2\.1-or-later|LGPL-3\.0|UNLICENSED|SEE LICENSE IN .+)$/;
  const overrides = {
    "pako@1.0.10": `zlib License\n\nCopyright (C) 1995-2017 Jean-loup Gailly and Mark Adler\n\nThis software is provided 'as-is', without any express or implied warranty. In no event will the authors be held liable for any damages arising from the use of this software.\n\nPermission is granted to anyone to use this software for any purpose, including commercial applications, and to alter it and redistribute it freely, subject to the following restrictions:\n\n1. The origin of this software must not be misrepresented; you must not claim that you wrote the original software. If you use this software in a product, an acknowledgment in the product documentation would be appreciated but is not required.\n2. Altered source versions must be plainly marked as such, and must not be misrepresented as being the original software.\n3. This notice may not be removed or altered from any source distribution.\n\nJean-loup Gailly        Mark Adler\njloup@gzip.org          madler@alumni.caltech.edu`,
    "mdcii-engine": fs.readFileSync(path.join(root, "COPYING.GPLv2"), "utf8"),
    "ffmpeg-wav": fs.readFileSync(path.join(root, "COPYING.LGPLv2.1"), "utf8"),
    "pixi-keyboard":
      "This project includes code based on pixi-keyboard by Celsius online, originally licensed under the MIT license.",
    "smk2mp4-ffmpeg": fs.readFileSync(path.join(root, "COPYING.GPLv2"), "utf8"),
    "smk2mp4-libx264": fs.readFileSync(
      path.join(root, "COPYING.GPLv2"),
      "utf8",
    ),
  };
  check.init(
    { start: root, production: true, excludePrivatePackages: true },
    (error, packages) => {
      if (error) throw error;
      Object.assign(packages, {
        "mdcii-engine": {
          licenses: "GPL-2.0-or-later",
          repository: "https://github.com/roybaer/mdcii-engine",
          licenseText: overrides["mdcii-engine"],
        },
        "ffmpeg-wav": {
          licenses: "LGPL-2.1-or-later",
          repository: "https://git.ffmpeg.org/ffmpeg.git",
          licenseText: overrides["ffmpeg-wav"],
        },
        "pixi-keyboard": {
          licenses: "MIT",
          repository: "https://github.com/Nazariglez/pixi-keyboard",
          licenseText: overrides["pixi-keyboard"],
        },
        "smk2mp4-ffmpeg": {
          licenses: "GPL-2.0-or-later",
          repository: "https://git.ffmpeg.org/ffmpeg.git",
          licenseText: overrides["smk2mp4-ffmpeg"],
        },
        "smk2mp4-libx264": {
          licenses: "GPL-2.0-or-later",
          repository: "https://code.videolan.org/videolan/x264.git",
          licenseText: overrides["smk2mp4-libx264"],
        },
      });
      const notices = Object.entries(packages)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, info]) => {
          const licenses = (info.licenses || "UNKNOWN").toString();
          if (
            !licenses
              .replace(/[()]/g, "")
              .split(/\s+(?:OR|AND)\s+/)
              .every((license) => allowed.test(license.trim()))
          ) {
            throw new Error(`Unapproved license for ${name}: ${licenses}`);
          }
          const packageName = name.replace(/@[^@]+$/, "");
          return `${name}\n${licenses}\n${info.repository || ""}\n${overrides[name] || overrides[packageName] || info.licenseText || ""}`;
        })
        .join("\n\n");
      fs.writeFileSync(path.join(outdir, "thirdparty.txt"), notices);
    },
  );
}

function metadata() {
  fs.writeFileSync(path.join(outdir, "VERSION"), `${version}\n`);
  fs.writeFileSync(
    path.join(outdir, "COMMITHASH"),
    `${git("rev-parse", "HEAD")}\n`,
  );
}

async function build() {
  fs.mkdirSync(outdir, { recursive: true });
  const result = await esbuild.build({
    entryPoints: ["src/index.ts"],
    outdir,
    entryNames: isProduction ? "app.[hash]" : "app",
    chunkNames: "vendors.[hash]",
    bundle: true,
    platform: "browser",
    format: "esm",
    splitting: true,
    target: ["es2015"],
    sourcemap: isProduction ? true : "inline",
    minify: isProduction,
    define: { __VERSION__: JSON.stringify(version) },
    metafile: true,
    plugins: [browserCoreShims],
    loader: { ".tsx": "tsx", ".ts": "ts" },
    logLevel: "info",
  });
  if (result.errors.length) process.exitCode = 1;
  const appFile = Object.keys(result.metafile.outputs).find((file) =>
    /app(?:\.[A-Za-z0-9]+)?\.js$/.test(file),
  );
  if (appFile) {
    fs.writeFileSync(
      path.join(outdir, "app-name.txt"),
      `${path.basename(appFile)}\n`,
    );
  }
  writeHtml({ appFile: path.basename(appFile) });
  copyFfmpeg();
  metadata();
  if (isProduction) licenseNotices();
}

if (process.argv.includes("--watch")) {
  esbuild
    .context({
      entryPoints: ["src/index.ts"],
      outdir,
      entryNames: "app",
      bundle: true,
      platform: "browser",
      format: "esm",
      splitting: true,
      chunkNames: "chunks/[name]",
      target: ["es2015"],
      sourcemap: "inline",
      define: { __VERSION__: JSON.stringify(version) },
      plugins: [browserCoreShims],
      logLevel: "info",
      metafile: true,
    })
    .then(async (context) => {
      fs.mkdirSync(outdir, { recursive: true });
      copyFfmpeg();
      metadata();
      const result = await context.rebuild();
      if (result.errors.length) {
        throw new Error("Initial esbuild compilation failed");
      }
      writeHtml({ serve: true });
      await context.watch();
    })
    .catch(() => (process.exitCode = 1));
} else {
  build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
