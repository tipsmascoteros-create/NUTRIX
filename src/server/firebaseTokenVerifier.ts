import crypto from 'crypto';

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  if (!forceRefresh && cachedCerts && Date.now() < cachedCerts.expiresAt) {
    return cachedCerts.certs;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Falha ao obter chaves públicas do Firebase (${res.status}).`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.min(21600, Math.max(60, Number(maxAgeMatch[1]))) : 3600;

  cachedCerts = {
    certs,
    expiresAt: Date.now() + maxAgeSec * 1000,
  };

  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf-8');
  return JSON.parse(json) as T;
}

/**
 * Cryptographically verifies a Firebase Auth ID Token (RS256) against Google's
 * official public X.509 certificates and validates all mandatory Firebase claims.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  expectedProjectId: string,
): Promise<VerifiedFirebaseUser> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token inválido.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Algoritmo ou identificador de chave do token inválido.');
  }

  let certs = await getGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await getGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error('Chave pública correspondente ao token não encontrada.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureBuf = Buffer.from(signatureB64, 'base64url');

  if (!verifier.verify(certPem, signatureBuf)) {
    throw new Error('Assinatura do token Firebase inválida.');
  }

  const payload = decodeBase64UrlJson<{
    exp?: number;
    iat?: number;
    auth_time?: number;
    aud?: string;
    iss?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
  }>(payloadB64);

  const nowSec = Math.floor(Date.now() / 1000);
  const clockSkewSec = 300;

  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Token de autenticação expirado.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + clockSkewSec) {
    throw new Error('Data de emissão do token inválida.');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + clockSkewSec) {
    throw new Error('Data de autenticação do token inválida.');
  }
  if (payload.aud !== expectedProjectId) {
    throw new Error('Audiência do token não corresponde ao projeto NUTRIX.');
  }
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new Error('Emissor do token inválido.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    throw new Error('Identificador de usuário do token inválido.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: Boolean(payload.email_verified),
  };
}
