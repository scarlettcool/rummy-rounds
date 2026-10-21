import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Router } from 'express';
import { createApiApp } from '../src/http/app';
import { readHttpConfig } from '../src/http/config';

describe('HTTP configuration', () => {
  it('requires explicit HTTPS origins in production', () => {
    for (const ALLOWED_ORIGINS of [undefined, '', ' , ', '*', 'null', 'http://club.example']) {
      expect(() => readHttpConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS })).toThrow();
    }
    expect(readHttpConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://club.example, https://play.example' }).allowedOrigins)
      .toEqual(['https://club.example', 'https://play.example']);
  });

  it('rejects credentials, paths, wildcards and non-HTTP schemes', () => {
    for (const ALLOWED_ORIGINS of ['https://*.example', 'https://club.example/path', 'https://club.example/',
      'https://user:password@club.example', 'https://club.example?token=private', 'file:///tmp/test']) {
      expect(() => readHttpConfig({ ALLOWED_ORIGINS })).toThrow();
    }
  });

  it('uses only local development defaults and respects an explicit configuration', () => {
    expect(readHttpConfig({}).allowedOrigins).toContain('http://127.0.0.1:4175');
    expect(readHttpConfig({ ALLOWED_ORIGINS: 'https://club.example,https://club.example' }).allowedOrigins)
      .toEqual(['https://club.example']);
  });
});

describe('HTTP boundary before game mutations', () => {
  let server: Server;
  let base: string;
  const mutate = vi.fn();
  beforeAll(async () => {
    const games = Router();
    games.post('/', (req, res) => { mutate(); res.status(201).json({ received: req.body }); });
    games.get('/unexpected', () => { throw new Error('private-server-detail'); });
    const app = createApiApp(readHttpConfig({ ALLOWED_ORIGINS: 'https://club.example' }), games);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const post = (headers: Record<string, string>, body = '{}') => fetch(`${base}/api/games`, {
    method: 'POST', headers, body,
  });

  it('accepts an allowed browser origin and does not cache API responses', async () => {
    const before = mutate.mock.calls.length;
    const response = await post({ Origin: 'https://club.example', 'Content-Type': 'application/json' }, '{"mode":"challenge"}');
    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://club.example');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.has('x-powered-by')).toBe(false);
    expect(await response.json()).toEqual({ received: { mode: 'challenge' } });
    expect(mutate.mock.calls.length).toBe(before + 1);
  });

  it('rejects untrusted, lookalike and null origins before reaching a game route', async () => {
    const before = mutate.mock.calls.length;
    for (const Origin of ['https://evil.example', 'https://club.example.evil.example', 'http://club.example', 'null']) {
      const response = await post({ Origin, 'Content-Type': 'application/json' });
      expect(response.status).toBe(403);
      expect(response.headers.has('access-control-allow-origin')).toBe(false);
      expect(await response.json()).toHaveProperty('message');
    }
    expect(mutate.mock.calls.length).toBe(before);
  });

  it('supports allowed preflights and rejects untrusted preflights', async () => {
    const response = await fetch(`${base}/api/games`, { method: 'OPTIONS', headers: {
      Origin: 'https://club.example', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    } });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect(response.headers.get('access-control-allow-methods')).not.toContain('DELETE');
    const rejected = await fetch(`${base}/api/games`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(rejected.status).toBe(403);
  });

  it('rejects malformed, oversized, compressed and non-JSON input without mutation', async () => {
    const before = mutate.mock.calls.length;
    const requests = [
      { headers: { 'Content-Type': 'application/json' }, body: '{broken', status: 400 },
      { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(9000) }), status: 413 },
      { headers: { 'Content-Type': 'text/plain' }, body: '{}', status: 415 },
      { headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: '{}', status: 415 },
    ];
    for (const request of requests) {
      const response = await post(request.headers, request.body);
      expect(response.status).toBe(request.status);
      const body = await response.json();
      expect(body).toHaveProperty('message');
      expect(body).not.toHaveProperty('stack');
    }
    expect(mutate.mock.calls.length).toBe(before);
  });

  it('keeps no-Origin requests working without claiming they are authenticated', async () => {
    const response = await post({ 'Content-Type': 'application/json' });
    expect(response.status).toBe(201);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
    const health = await fetch(`${base}/api/health`);
    expect(await health.json()).toEqual({ status: 'ok' });
  });

  it('returns JSON for unknown routes and hides unexpected server details', async () => {
    const missing = await fetch(`${base}/api/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toHaveProperty('message');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await fetch(`${base}/api/games/unexpected`);
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain('private-server-detail');
      expect(log).toHaveBeenCalledWith('Unhandled API request error');
    } finally { log.mockRestore(); }
  });
});
