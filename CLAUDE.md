# Instruções do Agente - Projeto SetFlow

## Diretrizes de Desenvolvimento (Spec-Driven Development)
1. Antes de gerar ou modificar código, consulte sempre a baseline em `/docs` (requisitos, modelo de domínio, arquitetura e a Spec específica em `/docs/specs`).
2. Siga rigorosamente a especificação ativa. Não adicione comportamentos, bibliotecas ou dependências que não foram aprovados na Spec.
3. Se identificar uma lacuna técnica ou regra ausente, registre como `OPEN-XX` na Spec e não tome decisões silenciosas.
4. Toda alteração de código deve vir acompanhada dos testes unitários correspondentes que comprovem os critérios de aceite (Dado, Quando, Então) definidos na Spec.

## Regras do Projeto
- Idioma da documentação e código: Português
- Estrutura de pastas: `/docs` para documentação, `/src` para código fonte, `/tests` para testes.
