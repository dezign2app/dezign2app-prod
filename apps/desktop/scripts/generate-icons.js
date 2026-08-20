const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const pngToIcoModule = require("png-to-ico");
const pngToIco = pngToIcoModule.default || pngToIcoModule;

async function generate() {
  const buildDir = path.join(__dirname, "../build");
  const publicDir = path.join(__dirname, "../public");
  const webFavicon = path.join(__dirname, "../../web/app/favicon.ico");
  const psScript = path.join(__dirname, "process-icon.ps1");

  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Process web favicon (which is a PNG) into a square 512x512 icon.png on Windows
  if (process.platform === "win32" && fs.existsSync(webFavicon) && fs.existsSync(psScript)) {
    try {
      console.log("Generating square icon.png from apps/web/app/favicon.ico...");
      execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, {
        stdio: "inherit",
      });
    } catch (err) {
      console.warn("PowerShell square conversion warning:", err.message);
    }
  }

  const sourcePng = path.join(buildDir, "icon.png");
  if (!fs.existsSync(sourcePng)) {
    const fallbackPng = path.join(publicDir, "icon.png");
    if (fs.existsSync(fallbackPng)) {
      fs.copyFileSync(fallbackPng, sourcePng);
    } else {
      throw new Error(`Source PNG not found at: ${sourcePng}`);
    }
  }

  // 2. Generate multi-resolution Windows .ico from square PNG
  console.log("Converting icon.png to multi-size icon.ico...");
  try {
    const icoBuffer = await pngToIco(sourcePng);

    fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);
    fs.writeFileSync(path.join(publicDir, "icon.ico"), icoBuffer);
    fs.writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);

    console.log("✓ Successfully generated icon.png, icon.ico, and favicon.ico in build/ and public/");
  } catch (err) {
    console.warn("Could not generate .ico:", err.message);
  }
}

generate().catch((err) => {
  console.error("Failed to generate icons:", err);
  process.exit(1);
});
