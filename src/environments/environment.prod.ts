// Used by `ng build` (production configuration), e.g. the Vercel deploy.
// Must match kaizan-companion's DOMAIN (.env on the Oracle VM) and be
// registered as that backend's MINIAPP_ORIGIN (CORS) — see WebConfig.
export const environment = {
  production: true,
  useRealBackend: true,
  apiBaseUrl: 'https://kaizen.xyz.br',
};
