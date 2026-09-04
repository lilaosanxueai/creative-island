import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig, ensureDirs, DATA_DIR } from './config.ts';
import { buildRouter } from './routes.ts';

const cfg = loadConfig();
ensureDirs();

const app = express();
app.use(express.json({ limit: '2mb' })); // 作品截图是 dataURL

app.use('/api', buildRouter(cfg));

// 生产模式：托管前端构建产物
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.listen(cfg.server.port, cfg.server.host, () => {
  console.log(`🏝 AI 创意岛已启动：http://${cfg.server.host}:${cfg.server.port}`);
  console.log(`📁 数据目录：${DATA_DIR}`);
  const keySet = cfg.llm.apiKey.trim().length > 0 && !cfg.llm.apiKey.includes('在这里填');
  console.log(keySet
    ? `🤖 AI 伙伴已连接模型：${cfg.llm.model}`
    : '⚠️ 还没配置 API Key（data/config.json），AI 伙伴将以离线替身模式回复');
});
