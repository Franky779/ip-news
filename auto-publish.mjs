// auto-publish.mjs — 一键自动发布报告到 GitHub
// 用法: node auto-publish.mjs
// 功能: 扫描报告目录 → 复制新文件 → 更新 files-data.js → 推送到 GitHub

import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = 'd:/claudecode/临时文件夹/github网页/github实时更新版本';
const SOURCE_DIRS = [
    'd:/claudecode/临时文件夹/报告',
];

// 黑名单: 这些文件名不会发布
const BLACKLIST = ['report.html', 'report_raw.html'];

// 文件分类规则: 根据文件名判断放到哪个目录
function getTargetFolder(filename) {
    if (filename.includes('行业动态')) return '动态';
    // 报告/分析/评估/调研 都归入数据分析
    if (/报告|分析|评估|调研|复盘|盘点/.test(filename)) return '数据分析';
    return '数据分析';
}

// 从文件名提取日期 (YYYY-MM-DD 或 YYYY_MM_DD)
function extractDate(filename) {
    const m = filename.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return '';
}

// 生成 displayName: 去掉 .html 和日期后缀
function makeDisplayName(filename) {
    let name = filename.replace(/\.html$/i, '');
    // 去掉尾部日期
    name = name.replace(/[-_]\d{4}[-_]\d{2}[-_]\d{2}$/, '');
    // 去掉尾部下划线/横线
    name = name.replace(/[-_]+$/, '');
    return '《' + name + '》';
}

// 扫描源目录,找出需要复制的新文件
function scanNewFiles() {
    const newFiles = [];
    for (const srcDir of SOURCE_DIRS) {
        let files;
        try { files = readdirSync(srcDir); }
        catch { continue; }

        for (const name of files) {
            if (!name.endsWith('.html')) continue;
            // 跳过黑名单
            if (BLACKLIST.includes(name.toLowerCase())) {
                console.log(`  [跳过] ${name} (黑名单)`);
                continue;
            }
            // 必须能从文件名提取到日期
            const date = extractDate(name);
            if (!date) {
                console.log(`  [跳过] ${name} (无日期)`);
                continue;
            }
            const folder = getTargetFolder(name);
            const targetPath = join(REPO_ROOT, folder, name);
            if (!existsSync(targetPath)) {
                newFiles.push({
                    name,
                    source: join(srcDir, name),
                    folder,
                    target: targetPath,
                    date
                });
            }
        }
    }
    return newFiles;
}

// 复制文件
function copyFiles(files) {
    for (const f of files) {
        copyFileSync(f.source, f.target);
        console.log(`  [复制] ${f.name} → ${f.folder}/`);
    }
}

// 扫描目标目录,重新生成 FILE_LISTS
function rebuildFileLists() {
    const folders = ['动态', '数据分析'];
    const FILE_LISTS = {};

    for (const folder of folders) {
        const dir = join(REPO_ROOT, folder);
        let files;
        try { files = readdirSync(dir); }
        catch { files = []; }

        const list = files
            .filter(f => f.endsWith('.html'))
            .map(f => {
                const date = extractDate(f);
                const displayName = makeDisplayName(f);
                return { name: f, displayName, date };
            })
            .filter(f => f.date) // 只保留能提取到日期的
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        FILE_LISTS[folder] = list;
    }

    const content = `// 自动生成，请勿手动修改。运行 auto-publish.mjs 更新。\nconst FILE_LISTS = ${JSON.stringify(FILE_LISTS, null, 4)};\n`;
    const outPath = join(REPO_ROOT, 'files-data.js');
    writeFileSync(outPath, content);
    console.log('  [更新] files-data.js');
    return outPath;
}

// 推送到 GitHub
function pushToGitHub(files, dataFilePath) {
    const changedFiles = files.map(f => `${f.folder}/${f.name}`);
    changedFiles.push('files-data.js');

    const today = new Date().toISOString().slice(0, 10);
    const msg = `auto: 发布 ${files.length} 篇报告 (${today})`;
    const args = changedFiles.map(f => `"${f}"`).join(' ');

    const cmd = `node _push_via_api.mjs "${msg}" ${args}`;
    console.log(`\n  [推送] ${cmd}\n`);
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
}

// ===== 主流程 =====
console.log('=== 自动发布脚本 ===\n');

const newFiles = scanNewFiles();

if (newFiles.length === 0) {
    console.log('没有新文件需要发布。');
    process.exit(0);
}

console.log(`发现 ${newFiles.length} 个新文件:`);
newFiles.forEach(f => console.log(`  · ${f.name}`));
console.log('');

copyFiles(newFiles);
rebuildFileLists();
pushToGitHub(newFiles);

console.log('\n=== 完成 ===');
