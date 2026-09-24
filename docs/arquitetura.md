```markdown
# Arquitetura do Sistema SetFlow

## Estilo Arquitetural
Arquitetura Monolítica em Camadas (Layered Architecture - API REST + SPA):
- **Apresentação (Frontend):** React / Next.js
- **Aplicação/Domínio (Backend):** Node.js/TypeScript ou Python/FastAPI (módulos isolados)
- **Persistência (Banco de Dados):** Banco Relacional (PostgreSQL)

## Drivers Arquiteturais (DAs)
- **DA-01 (Algoritmo de Transição & Duração):** Cálculo de menor distância cromática e alerta de estouro de tempo (origem: RB-01, RB-02, RB-03).
- **DA-02 (Isolamento Multi-tenant por Banda):** Nenhuma informação ou música pode ser acessada por usuários de outra banda (origem: RNF-04, RB-07).
- **DA-03 (Desempenho da Sugestão):** Resposta em menos de 2s para ordenar até 50 músicas (origem: RNF-01).

## Mapeamento de Drivers para Decisões Técnicas
| Driver | Decisão Técnica |
| :--- | :--- |
| **DA-01** | Processamento síncrono da ordenação em memória via algoritmo guloso/backtracking simplificado. |
| **DA-02** | Filtro obrigatório de `banda_id` injetado na camada de serviço/repositório. |
| **DA-03** | Cache em memória para o ciclo cromático de tons e consulta otimizada de repertório. |
