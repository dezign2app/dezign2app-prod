const fs = require("fs");
const path = require("path");
const pngToIcoModule = require("png-to-ico");
const pngToIco = pngToIcoModule.default || pngToIcoModule;

async function generate() {
  const sourcePng = path.join(__dirname, "../build/icon.png");
  const buildDir = path.join(__dirname, "../build");
  const publicDir = path.join(__dirname, "../public");

  const icoBuffer = await pngToIco(sourcePng);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);
  fs.writeFileSync(path.join(publicDir, "icon.ico"), icoBuffer);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);
  console.log("✓ Generated icon.ico and favicon.ico in build/ and public/");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
