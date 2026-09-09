# Prompt de implementação — fechamento das Etapas 1 a 8

Execute o fechamento técnico das pendências reais das Etapas 1 a 8 antes de
iniciar a Etapa 9 de `Adequaçoes.md`. Preserve o escopo AI-first, fail-closed e
as alterações existentes do usuário. Não implemente ainda ingestão física,
autenticação de dispositivos, rate limiting de telemetria ou teste de carga.

## Correções obrigatórias

1. Corrigir schemas térmicos administrativos em que string vazia podia ser
   convertida por `z.coerce.number()` em zero antes de representar ausência.
   Cobrir ponto térmico, emissividade e overrides por tipo de componente.
2. Tornar explícita a semântica do resultado supervisionado:
   - o FastAPI deve retornar a probabilidade supervisionada de falha separada;
   - `confidence` continua sendo a confiança da classe supervisionada prevista;
   - `modelScore` continua sendo o score ML combinado;
   - `riskScore` continua sendo o score operacional após pisos de engenharia;
   - o Next.js deve persistir `failureProbability` e `predictedClass` a partir
     da saída supervisionada, nunca a partir do risco operacional.
3. Remover ambiguidade da evidência apresentada ao usuário. Usar rótulos claros
   para probabilidade, confiança, score ML, score operacional e modo provável
   de falha. Não apresentar confiança da classe como certeza de defeito.
4. Manter compatibilidade de banco e não criar migration sem necessidade.
5. Atualizar `Adequaçoes.md`, `docs/architecture.md` e o checklist somente com
   resultados efetivamente comprovados. Evidência visual fornecida pelo usuário
   pode fechar a validação desktop; mobile, teclado, carga e E2E versionado
   permanecem na etapa de qualidade correspondente.

## Verificação

- Adicionar/ajustar testes Zod e Pydantic para o contrato novo e strings vazias.
- Executar testes TypeScript, testes Python, typecheck, lint e build.
- Confirmar que não existe fallback analítico, resultado hardcoded ou leitura
  de `ground truth` no runtime.
- Não executar reset, seed, limpeza ou migration destrutiva.

## Execução

Prompt criado e consumido nesta sessão em 09/09/2026. O resultado deve deixar
as Etapas 1–8 formalmente encerradas no escopo necessário para iniciar a Etapa
9, com pendências futuras corretamente classificadas em suas próprias etapas.
