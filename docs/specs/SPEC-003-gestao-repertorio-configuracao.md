# SPEC-003 — Gestão de Repertório e Configuração Musical

## 1. Identificação
- **ID:** SPEC-003
- **Nome:** Gestão de Repertório e Configuração Musical
- **Objetivo:** Permitir ao líder registrar músicas da banda e definir o limiar de transição abrupta usado pela sugestão de ordem.
- **Valor entregue:** Cria a base de dados da banda para montar setlists e executar a ordenação baseada em tom e duração.

## 2. Rastreabilidade
- **RFs:** RF-05, RF-06
- **RBs:** RB-02, RB-07
- **RNFs:** RNF-01, RNF-03, RNF-04, RNF-05
- **Caso de uso / fluxo:** preparação do repertório do UC-01; FA-02 do UC-01
- **Entidades:** Banda, Membro, Música
- **Drivers:** DA-01, DA-02
- **ADRs:** ADR-001, indiretamente, pois fornece os dados para a ordenação

## 3. Escopo
### Incluído
- Cadastro de músicas por banda.
- Armazenamento de tom, BPM, duração, observações e cifras.
- Definição do limiar de transição em semitons.
- Consulta e edição do repertório da banda ativa.

### Fora do escopo
- Ordenação do setlist em si.
- Confirmação do setlist.
- Cálculo de domínio musical do usuário.

## 4. Dependências
- SPEC-001
- SPEC-002
- Open decisions: tom com sustenidos; duração em segundos persistida e exibida em minutos/segundos; limiar padrão 5 semitons configurável por banda.

## 5. Comportamento esperado
### Pré-condições
- Usuário autenticado.
- Usuário é membro da banda e possui permissão de líder para cadastrar músicas ou definir limiar.

### Fluxo principal
1. Líder acessa repertório da banda ativa.
2. Preenche dados da música: título, tom, BPM, duração, observações, cifra.
3. Sistema valida o payload.
4. Sistema persiste a música ligada à banda ativa.
5. Líder pode editar o limiar da banda.
6. Sistema grava valor do limiar e usa no cálculo da transição abrupta.

### Fluxos alternativos
- **FA-01:** editar uma música existente.
- **FA-02:** alterar o limiar após a banda já ter repertório.

### Fluxos de exceção
- **EX-01:** tom inválido. Sistema rejeita com erro de validação.
- **EX-02:** duração negativa ou zero. Sistema bloqueia.

### Pós-condições
- Música disponível no repertório da banda.
- Limiar da banda atualizado e usado em futuras sugestões.

## 6. Regras e invariantes
- **INV-001:** Toda música pertence a exatamente uma banda.
- **INV-002:** O limiar de transição é atributo da banda, não global.
- **INV-003:** A duração de uma música deve ser um valor positivo.
- **INV-004:** O tom deve seguir a convenção de notas em cifras com sustenidos (#).
- **INV-005:** O repertório de uma banda não pode ser acessado por outra banda.

## 7. Modelo de domínio envolvido
### Música
- id, bandaId, titulo, tom, bpm, duracaoSegundos, observacoes, cifraAnexo

### Banda
- id, nome, limiarTransicaoSemitons

### Membro
- papel (Líder | Músico)

## 8. Impacto arquitetural
- **Módulos:** gestão de repertório, regras de banda, persistência relacional.
- **Fronteiras:** camada de apresentação manipula formulário; camada de serviço valida e persiste; banco de dados armazena dados por banda.
- **ADRs:** ADR-001 obriga a lógica de ordenação a consumir os dados de banda e música. 

## 9. Contratos necessários
- Entradas: payload de música e valor de limiar.
- Saídas: música cadastrada; limiar atualizado; erros de validação.
- API conceitual: `POST /bandas/:id/musicas`, `GET /bandas/:id/musicas`, `PUT /bandas/:id/limiar-transicao`.

## 10. Requisitos não funcionais
- **RNF-01:** listagem do repertório em menos de 2s.
- **RNF-04:** isolamento por banda.
- **RNF-05:** dados persistidos em PostgreSQL.

## 11. Critérios de aceitação
### Critério 1 — cadastro de música
- **Dado** que o líder está autenticado na banda correta
- **Quando** informa um título, tom, BPM e duração válidos
- **Então** o sistema salva a música na banda ativa

### Critério 2 — limiar configurável por banda
- **Dado** uma banda ativa com repertório
- **Quando** o líder altera o limiar de transição
- **Então** o novo valor passa a ser usado nas sugestões futuras da banda

### Critério 3 — validação de duração
- **Dado** uma duração negativa ou zero
- **Quando** a música é salva
- **Então** o sistema rejeita o cadastro

## 12. Casos de teste derivados
1. persistência de música válida
2. persistência de música inválida
3. atualização de limiar por banda
4. isolamento do repertório por banda
5. leitura do repertório na banda ativa

## 13. Questões em aberto
- Nenhuma.

## 14. Definition of Done
- música cadastrada e vinculada à banda correta;
- limiar persistido por banda;
- NFRs atendidos;
- invariantes preservados.

