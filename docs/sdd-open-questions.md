# Decisões da Baseline — SetFlow

Todas as decisões relevantes da baseline foram aprovadas e registradas conforme as respostas fornecidas pela equipe.

## Decisões aprovadas

- **OPEN-01:** backend em JavaScript/CommonJS com Express; a decisão anterior por Node.js + TypeScript foi superada.
- **OPEN-02:** frontend em HTML5 + CSS3.
- **OPEN-03:** banco relacional PostgreSQL via `pg`, configurado por `DATABASE_URL`.
- **OPEN-04:** limiar de transição = 5 semitons, configurável por banda.
- **OPEN-05:** um setlist deve conter pelo menos 1 música.
- **OPEN-06:** apenas o líder pode criar setlists.
- **OPEN-07:** o líder visualiza apenas o seu próprio domínio musical.
- **OPEN-08:** algoritmo de ordenação com backtracking limitado.
- **OPEN-09:** tons representados em cifragem com sustenidos (#).
- **OPEN-10:** duração persistida em segundos e exibida em minutos/segundos.
- **OPEN-11:** contratos de API definidos nas Specs individuais.
- **OPEN-12:** remover a referência ao ADR-002 ausente.
- **OPEN-13:** usar numeração sequencial do mapa de Specs (SPEC-001, SPEC-002...).
- **OPEN-14:** incluir reabertura de setlist `Confirmado → Rascunho` no MVP.
- **OPEN-15:** histórico ordenado por data do evento, em ordem decrescente.

## Questões resolvidas pelas atualizações de documentação

- **Persistência (PostgreSQL):** **resolvida** — PostgreSQL via `pg` e `DATABASE_URL`; migrações SQL versionadas em `db/migrations` e executadas por `npm run db:migrate`.
- **Stack (Node.js + TypeScript vs JavaScript):** **resolvida** — JavaScript/CommonJS com Express.
- **Nome de banda duplicado (EX-01 da SPEC-002):** **resolvida** — rejeitar somente quando o mesmo criador já possui o nome normalizado.
- **Identificador para adicionar membros:** **resolvida** — nickname globalmente único.
- **Membro duplicado:** **resolvida** — `409 MEMBER_ALREADY_EXISTS`.
- **Cifra anexada (RF-05/RF-15):** **resolvida** — arquivo PDF, PNG, JPG ou TXT de até 5 MB, um por música, guardado em `music_chord_files` (PostgreSQL), tipo validado pelo conteúdo, download liberado a qualquer membro da banda e alteração restrita ao líder. O campo de texto `cifraAnexo` é mantido apenas para dados antigos.
- **Recuperação de senha:** **resolvida** — link de uso único por e-mail (256 bits, hash SHA-256 no banco, validade de 30 minutos, novo pedido invalida o anterior), resposta `202` idêntica para contas existentes e inexistentes, limite de 3 pedidos por IP + e-mail em 15 minutos, encerramento de todas as sessões ao redefinir. Sem provedor de e-mail no projeto, o envio é plugável e o padrão grava a mensagem no log do servidor.
- **Contexto ativo:** **resolvida** — endpoint dedicado `POST /api/bandas/:bandId/ativa`, armazenado em sessão do servidor e revalidado contra o vínculo.

## Decisões fechadas na SPEC-001

- Forma de autenticação: sessão HTTP com cookie.
- Expiração da sessão: 24 horas, sem renovação automática.
- Cadastro de usuário: público, com nickname obrigatório.
- Rate limiting de login: 5 tentativas inválidas por IP + e-mail normalizado em 15 minutos, com bloqueio na 6ª tentativa.
- Contrato de erro da API: envelope JSON padronizado com `error.code` e `error.message`.
- Identidade pública: `{ id, nickname, email, status }`, sem senha, hash ou salt.
- Persistência de usuários e sessões: PostgreSQL, com IDs `u-<uuid>` e sessões expirando após 24 horas.

## Situação final

A baseline foi estabilizada para a implementação das Specs. Permanecem em aberto somente questões não resolvidas pelos documentos de atualização, como MFA, backup, observabilidade, deploy, versionamento de API, concorrência, validação de BPM e estratégia de remoção.
