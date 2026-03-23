const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const DEFAULT_PRODUCTION_PUBLIC_URL = 'https://vendamais.odontoart.com';
const isLocalHostname = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0';

const normalizeConfiguredUrl = (value: string) => {
  const trimmedValue = trimTrailingSlash(value.trim());
  const hasProtocol = /^[a-z]+:\/\//i.test(trimmedValue);
  const normalizedValue = hasProtocol ? trimmedValue : `https://${trimmedValue}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedValue);
  } catch {
    throw new Error('VITE_PUBLIC_APP_URL invalida. Use uma URL publica absoluta, por exemplo: https://teste.seudominio.com.br');
  }

  if (isLocalHostname(parsedUrl.hostname.toLowerCase())) {
    throw new Error('VITE_PUBLIC_APP_URL nao pode apontar para localhost. Use a URL publica do ambiente de teste.');
  }

  return trimTrailingSlash(parsedUrl.toString());
};

export function getPublicAppBaseUrl(): string {
  const configuredUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || '').trim();

  if (configuredUrl) {
    return normalizeConfiguredUrl(configuredUrl);
  }

  if (import.meta.env.PROD) {
    return DEFAULT_PRODUCTION_PUBLIC_URL;
  }

  const currentOrigin = window.location.origin;
  const hostname = window.location.hostname.toLowerCase();
  const isLocalhost = isLocalHostname(hostname);

  if (isLocalhost) {
    throw new Error('Configure VITE_PUBLIC_APP_URL com a URL publica do ambiente antes de gerar o link.');
  }

  return trimTrailingSlash(currentOrigin);
}

export function buildPublicAdesaoUrl(token: string): string {
  return `${getPublicAppBaseUrl()}/adesao/${token}`;
}
