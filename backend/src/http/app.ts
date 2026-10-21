import express, { ErrorRequestHandler, Router } from 'express';
import cors from 'cors';
import gameRoutes from '../routes/game';
import { HttpConfig } from './config';

// Constructing an app never opens a port. Routes are injectable for boundary tests.
export function createApiApp(config: HttpConfig, games: Router = gameRoutes) {
  const app = express();
  const allowedOrigins = new Set(config.allowedOrigins);
  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.vary('Origin');
    const origin = req.get('Origin');
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      res.status(403).json({ message: '此来源无法访问牌桌服务。' });
      return;
    }
    next();
  });
  app.use('/api', cors({
    origin: [...allowedOrigins],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  }));
  app.use('/api/games', (req, res, next) => {
    if (req.method === 'POST' && !req.is('application/json')) {
      res.status(415).json({ message: '请使用 JSON 提交牌桌操作。' });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '8kb', inflate: false }));
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.use('/api/games', games);
  app.use((_req, res) => { res.status(404).json({ message: '接口不存在。' }); });

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ message: '提交内容过大，请缩小后重试。' });
    } else if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ message: 'JSON 格式不正确，请重新提交。' });
    } else if (error?.status === 415) {
      res.status(415).json({ message: '不支持此请求内容格式。' });
    } else {
      // Do not print request bodies, Origin values or future session credentials.
      console.error('Unhandled API request error');
      res.status(500).json({ message: '服务暂时不可用，请稍后重试。' });
    }
  };
  app.use(handleError);
  return app;
}
