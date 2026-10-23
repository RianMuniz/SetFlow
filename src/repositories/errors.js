// Erro de domínio lançado pelos repositórios quando uma restrição de unicidade é violada.
// field: 'email' | 'nickname' | 'band_name' | 'member'
class DuplicateError extends Error {
  constructor(field) {
    super(`Valor duplicado: ${field}`);
    this.name = 'DuplicateError';
    this.field = field;
  }
}

module.exports = { DuplicateError };
