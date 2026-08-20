const { execSync, spawn } = require("child_process");
const path = require("path");

const desktopDir = path.join(__dirname, "..");
const args = process.argv.slice(2);
const hostPlatform = process.platform; // 'win32', 'darwin', 'linux'

function runElectronBuilder(flag, cwd) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npx.cmd" : "npx";
    const child = spawn(cmd, ["electron-builder", flag], {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    });

    let compressionTimer = null;
    let startTime = null;
    let frameIdx = 0;
    let isCompressing = false;
    const hourglassFrames = ["⏳", "⌛"];
    const dotsFrames = ["...", "   ", ".  ", ".. "];

    function renderSpinner() {
      if (!isCompressing) return;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      const formattedTime = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const hourglass = hourglassFrames[Math.floor(frameIdx / 2) % hourglassFrames.length];
      const dots = dotsFrames[frameIdx % dotsFrames.length];
      frameIdx++;

      process.stdout.write(`\r\x1b[K   ${hourglass} Compressing installer archive${dots} (elapsed: ${formattedTime})`);
    }

    function startCompressionTimer() {
      if (isCompressing) return;
      isCompressing = true;
      startTime = Date.now();
      frameIdx = 0;

      console.log("\n📦 [7-Zip Compression in Progress]");
      console.log("   Compressing offline Next.js server runtime and application files into the installer package.");
      console.log("   This step takes a few minutes depending on CPU & disk speed — please wait...\n");

      renderSpinner();
      compressionTimer = setInterval(renderSpinner, 500);
    }

    function stopCompressionTimer() {
      if (isCompressing) {
        clearInterval(compressionTimer);
        compressionTimer = null;
        isCompressing = false;
        const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const formattedTime = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        process.stdout.write(`\r\x1b[K   ✓ Compression step finished! (${formattedTime})\n\n`);
      }
    }

    function handleData(chunk, isStderr = false) {
      const text = chunk.toString();
      if (
        text.includes("building        target=nsis") ||
        text.includes("building        target=portable") ||
        text.includes("building        target=AppImage") ||
        text.includes("7za.exe")
      ) {
        startCompressionTimer();
      }
      if (
        text.includes("building block map") ||
        text.includes("signing with signtool.exe  path=release\\D2A Setup") ||
        text.includes("building        target=tar.gz") ||
        text.includes("packaging complete")
      ) {
        stopCompressionTimer();
      }

      if (isStderr) {
        if (isCompressing) process.stdout.write("\r\x1b[K");
        process.stderr.write(chunk);
        if (isCompressing) renderSpinner();
      } else {
        if (isCompressing) process.stdout.write("\r\x1b[K");
        process.stdout.write(chunk);
        if (isCompressing) renderSpinner();
      }
    }

    child.stdout.on("data", (data) => handleData(data, false));
    child.stderr.on("data", (data) => handleData(data, true));

    child.on("close", (code) => {
      stopCompressionTimer();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`electron-builder exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      stopCompressionTimer();
      reject(err);
    });
  });
}

async function run() {
  // 1. Generate multi-resolution icons
  console.log("==> [1/3] Generating application icons...");
  execSync("node scripts/generate-icons.js", {
    stdio: "inherit",
    cwd: desktopDir,
  });

  // 2. Compile Electron TypeScript
  console.log("\n==> [2/3] Compiling Electron TypeScript...");
  execSync("npx tsc -p tsconfig.electron.json", {
    stdio: "inherit",
    cwd: desktopDir,
  });

  // 3. Determine target platforms
  let targets = [];

  if (args.includes("--win")) targets.push("win");
  if (args.includes("--mac")) targets.push("mac");
  if (args.includes("--linux")) targets.push("linux");
  if (args.includes("--dir")) targets.push("dir");

  // If no explicit targets passed or --all requested
  if (targets.length === 0 || args.includes("--all")) {
    if (hostPlatform === "win32") {
      targets = ["win", "linux"];
      console.log("\nℹ️  Host: Windows (Building Windows and Linux packages)");
      console.log("ℹ️  Note: macOS (.dmg) builds require macOS hardware or GitHub Actions CI (macos-latest runner).\n");
    } else if (hostPlatform === "darwin") {
      targets = ["mac", "win", "linux"];
      console.log("\nℹ️  Host: macOS (Building macOS, Windows, and Linux packages)\n");
    } else {
      targets = ["linux", "win"];
      console.log("\nℹ️  Host: Linux (Building Linux and Windows packages)");
      console.log("ℹ️  Note: macOS (.dmg) builds require macOS hardware or GitHub Actions CI (macos-latest runner).\n");
    }
  }

  // 4. On Windows, ensure any previous running instance of D2A is terminated
  if (hostPlatform === "win32") {
    try {
      execSync('powershell -Command "Stop-Process -Name D2A -Force -ErrorAction SilentlyContinue"', {
        stdio: "ignore",
      });
    } catch (e) {}
  }

  // 5. Package for each requested target
  console.log("==> [3/3] Packaging desktop executables...");
  for (const target of targets) {
    const flag = target === "dir" ? "--dir" : `--${target}`;
    console.log(`\n── Building target: ${target.toUpperCase()} (${flag}) ──`);

    if (target === "mac" && hostPlatform !== "darwin") {
      console.warn(`\n⚠️  Cannot package macOS target directly on ${hostPlatform}.`);
      console.warn("   Apple requires a macOS environment to compile and sign macOS binaries.");
      console.warn("   Trigger the GitHub Actions release workflow (or run on macOS) to generate macOS .dmg.\n");
      continue;
    }

    try {
      await runElectronBuilder(flag, desktopDir);
    } catch (err) {
      if (target === "linux" && hostPlatform === "win32") {
        console.warn("\n⚠️  Linux AppImage packaging on Windows encountered a symlink restriction.");
        console.warn("   (Enable Windows Developer Mode or build Linux via Docker/CI for full AppImage binaries.)\n");
      } else {
        throw err;
      }
    }
  }

  console.log("\n✓ Desktop packaging completed successfully!");
}

run().catch((err) => {
  console.error("\n❌ Desktop build failed:", err.message);
  process.exit(1);
});
