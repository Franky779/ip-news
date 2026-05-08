import { readFileSync } from 'fs';
import { request } from 'https';

const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('GITHUB_TOKEN not set'); process.exit(1); }

const OWNER = 'Franky779';
const REPO = 'ip-news';
const BRANCH = 'main';

function api(method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'claude-code'
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = request({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${path}`,
      method, headers
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(chunks ? JSON.parse(chunks) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode} on ${method} ${path}: ${chunks}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  console.log('1) 获取当前 commit...');
  const ref = await api('GET', `/git/ref/heads/${BRANCH}`);
  const parentCommitSha = ref.object.sha;
  const parentCommit = await api('GET', `/git/commits/${parentCommitSha}`);
  const baseTreeSha = parentCommit.tree.sha;
  console.log('   parent:', parentCommitSha);

  const treeItems = [];

  // 删除旧文件
  const oldFiles = [
    '动态/IP动态早知道-2026-05-01.html',
    '动态/IP动态早知道-2026-04-22.html'
  ];
  for (const oldFile of oldFiles) {
    treeItems.push({ path: oldFile, mode: '100644', type: 'blob', sha: null });
    console.log('   delete:', oldFile);
  }

  // 上传新/修改的文件
  const newFiles = [
    { path: '动态/本周行业动态-2026-05-01.html', local: '动态/本周行业动态-2026-05-01.html' },
    { path: '动态/本周行业动态-2026-04-22.html', local: '动态/本周行业动态-2026-04-22.html' },
    { path: 'weekly-news.html', local: 'weekly-news.html' },
    { path: 'index.html', local: 'index.html' }
  ];

  console.log('2) 上传 blobs...');
  for (const file of newFiles) {
    const content = readFileSync(file.local).toString('base64');
    const blob = await api('POST', '/git/blobs', { content, encoding: 'base64' });
    console.log(`   blob ${file.path} -> ${blob.sha}`);
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  console.log('3) 创建新 tree...');
  const newTree = await api('POST', '/git/trees', { base_tree: baseTreeSha, tree: treeItems });
  console.log('   new tree:', newTree.sha);

  console.log('4) 创建新 commit...');
  const newCommit = await api('POST', '/git/commits', {
    message: 'rename: IP动态早知道 → 本周行业动态',
    tree: newTree.sha,
    parents: [parentCommitSha]
  });
  console.log('   new commit:', newCommit.sha);

  console.log('5) 更新分支引用...');
  await api('PATCH', `/git/refs/heads/${BRANCH}`, { sha: newCommit.sha, force: false });
  console.log('   done');

  console.log(`\nhttps://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
