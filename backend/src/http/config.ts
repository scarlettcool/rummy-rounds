export interface HttpConfig {
  allowedOrigins: readonly string[];
}

const developmentOrigins = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:4175', 'http://127.0.0.1:4175',
];

export function readHttpConfig(env: NodeJS.ProcessEnv): HttpConfig {
  const production = env.NODE_ENV === 'production';
  const configured = env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean);
  if (production && !configured?.length) {
    throw new Error('Production requires ALLOWED_ORIGINS with explicit HTTPS browser origins.');
  }
  const allowedOrigins = configured ?? developmentOrigins;
  for (const origin of allowedOrigins) {
    let parsed: URL;
    try { parsed = new URL(origin); }
    catch { throw new Error('ALLOWED_ORIGINS must contain exact HTTP(S) origins without paths or wildcards.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin ||
        parsed.hostname.includes('*') || (production && parsed.protocol !== 'https:')) {
      throw new Error('ALLOWED_ORIGINS must contain exact origins; production requires HTTPS.');
    }
  }
  return { allowedOrigins: [...new Set(allowedOrigins)] };
}
