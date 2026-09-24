# ADR 001: Algoritmo de Sugestão e Ordenação de Setlist

- **Status:** Aprovado
- **Contexto:** Precisamos ordenar as músicas de um setlist de modo a minimizar transições de tom abruptas sem comprometer o tempo de resposta do sistema (<2s).

## Decisão
Implementar a ordenação do Setlist no backend como um cálculo síncrono em memória no serviço de aplicação.

## Consequências
- **Positivas:** Simplicidade de código, sem necessidade de filas assíncronas complexas (ex: RabbitMQ/Redis), tempo de resposta abaixo de 200ms para listas comuns de shows (10-30 músicas).
- **Negativas:** Processamento intensivo de CPU se o número de músicas na lista for extremamente alto (>500 itens em um único setlist).
