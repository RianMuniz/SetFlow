// Cifra anexada à música (RF-05): validação do arquivo recebido pela API.
// O tipo é decidido pelo CONTEÚDO (assinatura do arquivo), nunca pelo nome ou pelo
// Content-Type enviado pelo cliente. HTML, SVG e outros formatos ativos são recusados.

const MAX_CHORD_FILE_BYTES = 5 * 1024 * 1024;
const CHORD_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];
const EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'text/plain': 'txt'
};

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function isUtf8Text(buffer) {
  if (buffer.includes(0)) {
    return false;
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch (error) {
    return false;
  }
}

function detectChordFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) { // %PDF-
    return 'application/pdf';
  }

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  return isUtf8Text(buffer) ? 'text/plain' : null;
}

// Nome vindo do cabeçalho X-File-Name (URL-encoded): sem caminho, sem caracteres de controle.
function sanitizeFileName(raw, type) {
  let name = '';

  if (typeof raw === 'string') {
    try {
      name = decodeURIComponent(raw);
    } catch (error) {
      name = raw;
    }
  }

  name = name.split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f\u007f"<>:*?|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');

  if (name.length > 120) {
    name = name.slice(0, 120);
  }

  return name || `cifra.${EXTENSIONS[type] || 'bin'}`;
}

function contentDispositionFor(name) {
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

module.exports = {
  MAX_CHORD_FILE_BYTES,
  CHORD_FILE_TYPES,
  detectChordFileType,
  sanitizeFileName,
  contentDispositionFor
};
