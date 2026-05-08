import { readFileSync } from 'fs';
import { request } from 'https';

const token = process.env.GITHUB_TOKEN;

function apiPut(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = request({
      hostname: 'api.github.com',
      path: `/repos/Franky779/ip-news/contents/${encodeURIComponent(path)}`,
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

// Create 数据分析/《IP评估报告-初音未来》.html
const content = readFileSync('数据分析/《IP评估报告-初音未来》.html').toString('base64');
console.log('miku report base64 length:', content.length);

apiPut('数据分析/《IP评估报告-初音未来》.html', {
  message: 'add: 新增初音未来 IP 评估报告',
  content: content
}).then(result => {
  console.log('miku report commit:', result.commit.sha);
}).catch(err => {
  console.error('miku report failed:', err.message);
  process.exit(1);
});
