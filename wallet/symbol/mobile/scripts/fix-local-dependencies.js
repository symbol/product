const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const nodeModulesDir = path.join(projectRoot, 'node_modules');
const pkgJsonPath = path.join(projectRoot, 'package.json');

// Read and parse package.json
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
    ...(pkg.optionalDependencies || {}),
};

// Helper to copy dirs recursively
function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// Process file-based deps
Object.entries(allDeps)
    .filter(([_, version]) => typeof version === 'string' && version.startsWith('file:'))
    .forEach(([pkgName, version]) => {
        const relativePath = version.replace(/^file:/, '');
        const src = path.resolve(projectRoot, relativePath);
        const dest = path.join(nodeModulesDir, pkgName);

        if (!fs.existsSync(dest)) {
            console.warn(`[WARN] ${pkgName} not found in node_modules`);
            return;
        }

        const isSymlink = fs.lstatSync(dest).isSymbolicLink();
        if (!isSymlink) {
            console.log(`[SKIP] ${pkgName} is not a symlink`);
            return;
        }

        console.log(`[REPLACE] ${pkgName}: replacing symlink with copy from ${relativePath}`);
        fs.rmSync(dest, { recursive: true, force: true });
        copyRecursiveSync(src, dest);
    });
