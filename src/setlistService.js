/**
 * Serviço responsável pelas regras de geração e validação do Setlist (SPEC-004).
 */

// Tabela do ciclo cromático de 12 semitons (RB-01)
const NOTAS_CROMATICAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Calcula a menor distância circular em semitons entre dois tons (RB-01).
 */
function calcularDistanciaSemitons(tomA, tomB) {
  const idxA = NOTAS_CROMATICAS.indexOf(tomA.toUpperCase());
  const idxB = NOTAS_CROMATICAS.indexOf(tomB.toUpperCase());

  if (idxA === -1 || idxB === -1) {
    throw new Error('Tom inválido fornecido.');
  }

  const diferencaDireta = Math.abs(idxA - idxB);
  // Ciclo circular: menor caminho no ciclo de 12 semitons
  return Math.min(diferencaDireta, 12 - diferencaDireta);
}

/**
 * Processa um setlist calculando duração total, alertas de tempo e transições de tom.
 */
function processarSetlist(musicas, tempoDisponivel, limiarTransicao = 3) {
  // 1. Calcula duração total (RB-03)
  const duracaoTotal = musicas.reduce((soma, m) => soma + m.duracao, 0);

  // 2. Verifica estouro do tempo disponível
  const alertaTempoExcedido = duracaoTotal > tempoDisponivel;

  // 3. Verifica transições abruptas entre músicas consecutivas (RB-01 e RB-02)
  const transicoes = [];
  for (let i = 0; i < musicas.length - 1; i++) {
    const atual = musicas[i];
    const proxima = musicas[i + 1];

    const distancia = calcularDistanciaSemitons(atual.tom, proxima.tom);
    const transicaoAbrupta = distancia > limiarTransicao;

    transicoes.push({
      de: atual.titulo,
      para: proxima.titulo,
      distanciaSemitons: distancia,
      transicaoAbrupta: transicaoAbrupta
    });
  }

  return {
    duracaoTotal,
    alertaTempoExcedido,
    transicoes,
    estado: 'Rascunho'
  };
}

module.exports = {
  calcularDistanciaSemitons,
  processarSetlist
};
