// Atributo Secure do cookie de sessão.
// Padrão (SPEC-001): Secure em produção. Só que Secure exige HTTPS: em HTTP puro o navegador
// descarta o cookie, exceto em http://localhost. Quem publica sem HTTPS (por exemplo o Docker
// Compose acessado pelo celular via IP da rede) define COOKIE_SECURE=false.
function resolveCookieSecure(explicit, isProduction) {
  const value = String(explicit === undefined || explicit === null ? '' : explicit).trim().toLowerCase();

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return Boolean(isProduction);
}

module.exports = { resolveCookieSecure };
