/**
 * Edge Runtime bilan mos Web Crypto (SubtleCrypto) yordamchi funksiyalari.
 * Node'ga xos `crypto` moduli ISHLATILMAYDI — middleware Edge runtime'da
 * ishlashi kerak.
 */

const encoder = new TextEncoder();

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function importHmacKey(rawKey: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hmacSha256(key: CryptoKey, message: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign('HMAC', key, encoder.encode(message));
}

/**
 * Telegram WebApp `initData` satrini serverda tekshiradi.
 *
 * Algoritm (Telegram rasmiy hujjati bo'yicha):
 *   secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
 *   data_check_string = "hash" maydonisiz, qolganlarini "key=value"
 *                        ko'rinishida alifbo tartibida "\n" bilan qo'shib chiqish
 *   hash tekshiruvi = HMAC_SHA256(key=secret_key, data=data_check_string) === hash
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): Promise<{ valid: boolean; reason?: string }> {
  if (!initData) return { valid: false, reason: 'initData bo\'sh' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { valid: false, reason: 'hash topilmadi' };

  const authDate = params.get('auth_date');
  if (authDate) {
    const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(authDate, 10);
    if (ageSeconds > maxAgeSeconds) {
      return { valid: false, reason: 'initData muddati o\'tgan' };
    }
  }

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKeyMaterial = await hmacSha256(
    await importHmacKey(encoder.encode('WebAppData')),
    botToken
  );
  const secretKey = await importHmacKey(secretKeyMaterial);
  const computedHashBuffer = await hmacSha256(secretKey, dataCheckString);
  const computedHash = bufferToHex(computedHashBuffer);

  return computedHash === hash
    ? { valid: true }
    : { valid: false, reason: 'hash mos kelmadi' };
}

/**
 * Sessiya cookie'sini imzolash: base64url(payload) + "." + HMAC-hex.
 * Edge middleware ham, Server Action ham shu formatni tushunadi.
 */
export async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await importHmacKey(encoder.encode(secret));
  const signature = bufferToHex(await hmacSha256(key, payload));
  const encodedPayload = btoa(unescape(encodeURIComponent(payload)));
  return `${encodedPayload}.${signature}`;
}

/**
 * Imzolangan cookie qiymatini tekshiradi va payload'ni qaytaradi (yoki null).
 */
export async function verifySignedPayload(
  signedValue: string,
  secret: string
): Promise<string | null> {
  const parts = signedValue.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  let payload: string;
  try {
    payload = decodeURIComponent(escape(atob(encodedPayload)));
  } catch {
    return null;
  }

  const key = await importHmacKey(encoder.encode(secret));
  const expectedBuffer = await hmacSha256(key, payload);
  const expectedHex = bufferToHex(expectedBuffer);

  if (!timingSafeEqualHex(expectedHex, signature)) return null;
  return payload;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = hexToBuffer(a);
  const bufB = hexToBuffer(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}
