import { readFileSync } from 'fs';
import { request } from 'https';

const token = process.env.GITHUB_TOKEN;
console.log('token length:', token?.length);

function apiPut(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = request({
      hostname: 'api.github.com',
      path: `/repos/Franky779/ip-news/contents/${path}`,
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'claude-code',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        console.log(`PUT ${path} => ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(chunks));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${chunks}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Update index.html
const indexContent = readFileSync('index.html').toString('base64');
console.log('index.html base64 length:', indexContent.length);

apiPut('index.html', {
  message: 'update: 调整潮玩报告显示名称，新增初音未来评估报告',
  content: indexContent,
  sha: '5a3425717e42c1c34f1d902b7ad8ff6e0d95a50f'
}).then(result => {
  console.log('index.html commit:', result.commit.sha);
}).catch(err => {
  console.error('index.html failed:', err.message);
  process.exit(1);
});
