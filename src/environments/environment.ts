// Dev default (ng serve / ng test). Kept on the mock on purpose — see
// MockGameHistoryService's doc comment and CLAUDE.md's MVP scope: local
// frontend work shouldn't depend on a running backend.
export const environment = {
  production: false,
  useRealBackend: false,
  apiBaseUrl: 'http://localhost:8080',
};
