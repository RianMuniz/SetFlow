# Decisões da Baseline — SetFlow

Todas as decisões relevantes da baseline foram aprovadas e registradas conforme as respostas fornecidas pela equipe.

## Decisões aprovadas

- **OPEN-01:** backend em Node.js + TypeScript
- **OPEN-02:** frontend em HTML5 + CSS3
- **OPEN-03:** banco relacional PostgreSQL
- **OPEN-04:** limiar de transição = 5 semitons, configurável por banda
- **OPEN-05:** um setlist deve conter pelo menos 1 música
- **OPEN-06:** apenas o líder pode criar setlists
- **OPEN-07:** o líder visualiza apenas o seu próprio domínio musical
- **OPEN-08:** algoritmo de ordenação com backtracking limitado
- **OPEN-09:** tons representados em cifragem com sustenidos (#)
- **OPEN-10:** duração persistida em segundos e exibida em minutos/segundos
- **OPEN-11:** contratos de API definidos nas Specs individuais
- **OPEN-12:** remover a referência ao ADR-002 ausente
- **OPEN-13:** usar numeração sequencial do mapa de Specs (SPEC-001, SPEC-002...)
- **OPEN-14:** incluir reabertura de setlist `Confirmado → Rascunho` no MVP
- **OPEN-15:** histórico ordenado por data do evento, em ordem decrescente

## Situação final

A baseline foi estabilizada para a geração das Specs.

## Decisões fechadas na SPEC-001

- Forma de autenticação: sessão HTTP com cookie.
- Expiração da sessão: 24 horas, sem renovação automática.
- Cadastro de usuário: público.
- Rate limiting de login: 5 tentativas inválidas por IP + e-mail normalizado em 15 minutos, com bloqueio na 6ª tentativa.
- Contrato de erro da API: envelope JSON padronizado com `error.code` e `error.message`.
- Stack da implementação da SPEC-001: Node.js com JavaScript/CommonJS e Express.
