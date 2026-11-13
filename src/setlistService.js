// Tabela do ciclo cromático de 12 semitons (RB-01)
const NOTAS_CROMATICAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function calcularDistanciaSemitons(tomA, tomB) {
  const idxA = NOTAS_CROMATICAS.indexOf(String(tomA).toUpperCase());
  const idxB = NOTAS_CROMATICAS.indexOf(String(tomB).toUpperCase());

  if (idxA === -1 || idxB === -1) {
    throw new Error('Tom inválido fornecido.');
  }

  const diferencaDireta = Math.abs(idxA - idxB);
  return Math.min(diferencaDireta, 12 - diferencaDireta);
}

function processarSetlist(musicas, tempoDisponivel, limiarTransicao = 3) {
  const duracaoTotal = musicas.reduce(
    (soma, musica) => soma + (musica.duracao !== undefined ? musica.duracao : musica.duracaoSegundos),
    0
  );
  const transicoes = [];

  for (let index = 0; index < musicas.length - 1; index += 1) {
    const atual = musicas[index];
    const proxima = musicas[index + 1];
    const distancia = calcularDistanciaSemitons(atual.tom, proxima.tom);
    transicoes.push({
      de: atual.titulo,
      para: proxima.titulo,
      distanciaSemitons: distancia,
      transicaoAbrupta: distancia > limiarTransicao
    });
  }

  return {
    duracaoTotal,
    alertaTempoExcedido: duracaoTotal > tempoDisponivel,
    transicoes,
    estado: 'Rascunho'
  };
}

function custoDaOrdem(musicas, limiarTransicao) {
  let distanciaTotal = 0;
  let transicoesAbruptas = 0;

  for (let index = 1; index < musicas.length; index += 1) {
    const distancia = calcularDistanciaSemitons(musicas[index - 1].tom, musicas[index].tom);
    distanciaTotal += distancia;
    if (distancia > limiarTransicao) {
      transicoesAbruptas += 1;
    }
  }

  return { transicoesAbruptas, distanciaTotal };
}

function ordemAnteriorMenor(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index].indiceOriginal !== b[index].indiceOriginal) {
      return a[index].indiceOriginal < b[index].indiceOriginal;
    }
  }
  return false;
}

function melhorOrdem(musicas, limiarTransicao) {
  if (!Array.isArray(musicas) || musicas.length === 0) {
    throw new Error('É necessário pelo menos uma música para sugerir a ordem.');
  }

  const numeradas = musicas.map((musica, indiceOriginal) => ({ ...musica, indiceOriginal }));
  let melhor = null;
  const limiteBacktracking = 8;

  function considerar(ordem) {
    const custo = custoDaOrdem(ordem, limiarTransicao);
    if (!melhor
      || custo.transicoesAbruptas < melhor.custo.transicoesAbruptas
      || (custo.transicoesAbruptas === melhor.custo.transicoesAbruptas
        && (custo.distanciaTotal < melhor.custo.distanciaTotal
          || (custo.distanciaTotal === melhor.custo.distanciaTotal
            && ordemAnteriorMenor(ordem, melhor.ordem))))) {
      melhor = { ordem: ordem.slice(), custo };
    }
  }

  if (numeradas.length <= limiteBacktracking) {
    function explorar(ordem, restantes) {
      if (restantes.length === 0) {
        considerar(ordem);
        return;
      }

      for (let index = 0; index < restantes.length; index += 1) {
        explorar(
          ordem.concat(restantes[index]),
          restantes.slice(0, index).concat(restantes.slice(index + 1))
        );
      }
    }
    explorar([], numeradas);
  } else {
    const restantes = numeradas.slice();
    const ordem = [restantes.shift()];

    while (restantes.length > 0) {
      const anterior = ordem[ordem.length - 1];
      let melhorIndice = 0;
      let menorDistancia = calcularDistanciaSemitons(anterior.tom, restantes[0].tom);

      for (let index = 1; index < restantes.length; index += 1) {
        const distancia = calcularDistanciaSemitons(anterior.tom, restantes[index].tom);
        if (distancia < menorDistancia
          || (distancia === menorDistancia
            && restantes[index].indiceOriginal < restantes[melhorIndice].indiceOriginal)) {
          melhorIndice = index;
          menorDistancia = distancia;
        }
      }
      ordem.push(restantes.splice(melhorIndice, 1)[0]);
    }
    considerar(ordem);
  }

  return melhor;
}

function sugerirOrdem(musicas, tempoDisponivelSegundos, limiarTransicao) {
  if (!Number.isFinite(Number(tempoDisponivelSegundos)) || Number(tempoDisponivelSegundos) <= 0) {
    throw new Error('Tempo disponível inválido.');
  }
  if (!Number.isFinite(Number(limiarTransicao)) || Number(limiarTransicao) < 0) {
    throw new Error('Limiar de transição inválido.');
  }

  const resultado = melhorOrdem(musicas, Number(limiarTransicao));
  const ordem = resultado.ordem.map((musica, index) => ({
    id: musica.id,
    musicaId: musica.id,
    titulo: musica.titulo,
    tom: musica.tom,
    duracaoSegundos: Number(musica.duracaoSegundos !== undefined ? musica.duracaoSegundos : musica.duracao),
    ordem: index + 1
  }));
  const duracaoTotalSegundos = ordem.reduce((total, musica) => total + musica.duracaoSegundos, 0);
  const transicoes = [];

  for (let index = 1; index < ordem.length; index += 1) {
    const distanciaSemitons = calcularDistanciaSemitons(ordem[index - 1].tom, ordem[index].tom);
    transicoes.push({
      de: ordem[index - 1].titulo,
      para: ordem[index].titulo,
      distanciaSemitons,
      transicaoAbrupta: distanciaSemitons > Number(limiarTransicao)
    });
  }

  return {
    musicas: ordem,
    duracaoTotalSegundos,
    tempoDisponivelSegundos: Number(tempoDisponivelSegundos),
    alertaTempoExcedido: duracaoTotalSegundos > Number(tempoDisponivelSegundos),
    transicoes,
    custo: resultado.custo
  };
}

module.exports = {
  calcularDistanciaSemitons,
  processarSetlist,
  melhorOrdem,
  sugerirOrdem
};
