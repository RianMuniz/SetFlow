# SPEC-002 — Criação de Banda, Membros e Contexto Ativo

Versão: 0.1
Autor: Copilot (esboço)
Arquivo: docs/specs/SPEC-002-criacao-banda-membros.md

Objetivo
--------
Permitir criar bandas, associar membros ao papel adequado (membro, líder) e alternar o contexto ativo da sessão do usuário entre bandas associadas.

Escopo
------
Incluso:
- CRUD básico para entidade Banda (nome, descrição, preferências básicas).
- Associação de usuários à banda com roles (membro, líder).
- Alternância de contexto ativo por usuário (selecionar qual banda 'está atuando').
- Convites por email para membros (aceite/recusa).

Requisitos Funcionais (RF)
--------------------------
RF-01: Criar/editar/excluir bandas.
RF-02: Associar usuários a bandas com papéis e permissões iniciais.
RF-03: Enviar convite por email para novos membros.
RF-04: Permitir que usuário selecione banda ativa em sua sessão.
RF-05: Permitir que líderes gerenciem membros (remover/promover).

Requisitos Não Funcionais (RNF)
-------------------------------
RNF-01: Operações de criação e associação devem ser auditáveis.
RNF-02: Emails de convite devem ser entregues de forma confiável (fila/retries).

Regras de Negócio (RB)
----------------------
RB-01: A primeira conta que criar a banda é automaticamente líder.
RB-02: Apenas líderes podem confirmar convite e alterar privilégios.
RB-03: Um usuário pode ter múltiplas associações, mas apenas uma banda ativa por sessão.

Fluxos (resumo)
---------------
1) Criar Banda: usuário fornece nome e cria banda -> torna-se líder.
2) Convidar Membro: líder envia convite por email -> membro aceita -> associação criada.
3) Alternar Contexto: usuário altera banda ativa -> contexto é salvo na sessão.

Critérios de Aceite
-------------------
- Dado um usuário criador, Quando criar banda, Então torna-se líder e banda aparece em suas bandas associadas.
- Dado convite enviado, Quando convidado aceitar, Então usuário aparece listado como membro.
- Dado usuário com múltiplas bandas, Quando alternar contexto, Então a aplicação usa o contexto ativo nas próximas operações.

Questões em Aberto
------------------
- OPEN-021: Quais dados da banda são obrigatórios (logo, cidade, estilo)?
- OPEN-022: Como lidar com transferências de liderança?

Notas
-----
Essa Spec supõe que autenticação já existirá (SPEC-001). Autorizações finas por role e políticas por recurso serão detalhadas em Specs posteriores.
