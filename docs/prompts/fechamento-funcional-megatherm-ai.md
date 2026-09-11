# Prompt de implementação — varredura e fechamento funcional do MegaTherm AI

Execute uma varredura funcional completa no MegaTherm AI e corrija todos os fluxos de produto que estejam visíveis, parcialmente implementados, inacessíveis pela navegação ou sem persistência adequada. Não entregue apenas um diagnóstico: implemente, teste e documente as correções. Preserve o escopo de monitoramento térmico, manutenção preditiva industrial, rastreabilidade por TAG, revisão humana e ordens de serviço. Não transforme o produto em um sistema genérico sem relação com esse núcleo.

Leia antes de alterar código:

- `Adequaçoes.md`, fonte única de controle, especialmente “Revisão funcional para a versão profissional — 10/09/2026”;
- `docs/architecture.md` e `README.md`;
- `apps/web/prisma/schema.prisma`;
- rotas em `apps/web/src/app/(dashboard)`;
- features de `work-orders`, `maintenance-plans`, `thermal-incidents`, `reports`, `thermal-monitoring` e `permissions`.

## Regras que não podem ser quebradas

- A marca visível do produto é **MegaTherm AI**. Não introduza textos sobre desafio, competição, protótipo ou demonstração na interface profissional.
- Uma OS `PREDICTIVE` só pode nascer de uma `Prediction` térmica rastreável, incidente confirmado por pessoa autorizada e prioridade empresarial registrada.
- O formulário genérico de OS nunca deve aceitar `PREDICTIVE`, inclusive quando o valor for forjado no cliente.
- Com a IA indisponível, preservar leituras e bloquear novos diagnósticos, incidentes analíticos e OS preditivas; não criar fallback por regras.
- Não inventar resultado de IA, termograma, prioridade empresarial, data, responsável ou evidência.
- Preservar migrations e dados existentes. Não executar reset, seed destrutivo, limpeza de banco ou alteração retroativa de histórico.
- Usar o design system, permissões e padrões de erro já existentes.
- Não fazer commit ou push sem autorização explícita.

## 1. Faça primeiro a varredura completa

Construa uma matriz `superfície → ação visível → destino → validação → persistência → feedback → permissão → teste`. Inspecione:

1. Todos os itens do menu, breadcrumbs, links, botões, formulários, filtros, tabs, downloads e redirects.
2. Todas as páginas `page.tsx`, rotas `route.ts`, server actions, services, repositories e modelos Prisma associados.
3. Componentes ou actions sem consumidor, rotas sem entrada pela interface e controles que aparecem, mas não têm ação útil.
4. Campos persistidos no banco que são exibidos sem edição ou nem sequer aparecem na interface.
5. Ações que alteram dados sem loading, confirmação, sucesso, erro, revalidação ou auditoria.
6. Diferenças entre o que o formulário envia, o que a action lê, o que o schema valida e o que o service persiste.
7. Permissões dos perfis ADMIN, PLANNER, TECHNICIAN e MANAGER, tanto na UI quanto no servidor.
8. Estados vazio, carregando, erro, indisponível, não autorizado e dados parciais.
9. Teclado, foco, nomes acessíveis, mensagens anunciáveis, contraste, zoom/reflow e mobile.

Antes de implementar, atualize os achados em `Adequaçoes.md`. Classifique cada item como:

- `P0`: impede uma jornada principal ou causa perda/inconsistência operacional;
- `P1`: função incompleta, invisível ou confusa;
- `P2`: melhoria de clareza, acessibilidade ou acabamento.

Não marque nada como concluído sem evidência executada.

## 2. Corrija o cronograma e o planejamento de OS

O cronograma atual é somente leitura e consulta apenas OS que já possuem `scheduledStart` e `scheduledEnd`. Isso esconde OS preditivas e preventivas criadas sem agenda.

Implemente:

- visão de calendário/Gantt operacional com filtros existentes;
- link acessível de cada item para `/work-orders/[id]`;
- seção “A planejar” para OS abertas sem agenda completa;
- ação de planejar/replanejar no detalhe da OS e, quando fizer sentido, no próprio cronograma;
- edição de responsável, início, fim, horas estimadas, prioridade e observações;
- indicador de atraso, conflito e ausência de responsável;
- revalidação de `/schedule` após qualquer alteração relevante.

Valide no servidor:

- datas válidas e normalizadas;
- `scheduledEnd > scheduledStart`;
- regra explícita para nenhum campo ou ambos os campos, sem intervalos parciais silenciosos;
- fuso horário apresentado ao usuário e conversão consistente para UTC;
- responsável ativo e elegível;
- permissão `workorder:manage` para planejar/replanejar;
- concorrência por `updatedAt` ou mecanismo equivalente para impedir sobrescrita silenciosa.

Não dependa de drag-and-drop para a única forma de edição. Se houver drag-and-drop, ofereça também formulário acessível por teclado.

## 3. Feche todos os caminhos de criação de OS

### OS manual/genérica

- Adicione CTA “Nova OS” em `/work-orders` somente para quem possui `workorder:manage`.
- Direcione para `/work-orders/new`.
- Preserve a exclusão estrutural de `PREDICTIVE`.
- Valide agenda, responsável, duração e equipamento no servidor.
- Registre histórico e `AuditLog` na criação.

### OS preditiva por incidente

O service já prevê parcialmente `priority`, `assignedUserId` e `scheduledStart`, mas o formulário não mostra esses campos e a action não lê agenda.

- Adicione responsável, prioridade da OS, início, fim e horas estimadas ao formulário de autorização.
- Atualize action, schema dedicado e service de forma coerente.
- Mantenha separadas prioridade empresarial e prioridade operacional da OS.
- Persista o planejamento na mesma transação que cria e vincula a OS.
- Inclua os campos relevantes no histórico e na auditoria, sem registrar segredos.

### OS preventiva por plano

- Ao gerar uma OS, use `nextExecution` como referência de início e derive o fim de uma duração configurada e documentada.
- Se não houver duração suficiente, crie a OS explicitamente como “A planejar”, sem fazê-la desaparecer do cronograma.
- Torne a geração manual idempotente por plano e ciclo.
- Avance `nextExecution` na mesma transação da criação manual ou automática.
- Evite duplicação por clique repetido, concorrência ou reexecução do cron.
- Mostre quantas OS foram geradas e quais falharam, com mensagens seguras.

## 4. Complete a execução e o encerramento da OS

- Exiba e permita concluir/reabrir itens do checklist, registrando usuário e horário.
- Permita preencher `actualHours`, `solution` e `notes`.
- Mostre `estimatedHours`, `actualHours`, checklist, solução e observações no detalhe.
- Adicione observação/justificativa às transições de status.
- Exija agenda válida antes de `PLANNED` e responsável antes de `IN_PROGRESS`.
- Defina critérios de `COMPLETED`: solução, horas reais e checklist concluído, com override apenas para perfil autorizado e justificativa auditável.
- Garanta que técnico opere somente sua própria OS atribuída.
- Não mostre controles acionáveis para quem não pode usá-los; explique o estado em texto quando necessário.
- Registre todas as mudanças relevantes em `WorkOrderHistory` e `AuditLog`.

## 5. Resolva funções existentes sem caminho claro

- Exponha “Planos preventivos” sob uma seção de planejamento ou incorpore sua gestão ao cronograma.
- Revise `/dashboard`, `/alerts`, `/predictive-maintenance` e `/settings`: mantenha redirects apenas como compatibilidade, sem usá-los como destinos normais de breadcrumbs ou navegação.
- Implemente um relatório preditivo **térmico** usando o domínio atual ou remova temporariamente o cartão e a rota que retorna `503`. Não religue o relatório mecânico legado como se fosse térmico.
- Identifique consumidores de `sensor-readings`, alertas mecânicos antigos e `runThermalSyncAction`. Se não houver consumidores reais, remova/isole de produção com testes que comprovem não quebrar o fluxo térmico.
- Deixe simuladores disponíveis somente com feature flag de desenvolvimento, desabilitada por padrão em produção.

## 6. Robustez e coerência da interface

- Valide query strings com Zod antes de passá-las ao Prisma; não faça cast cego de string para enum.
- Garanta que toda mutação tenha estado pendente, sucesso, erro recuperável e proteção contra duplo envio.
- Use labels em português para enums técnicos, mantendo o valor interno estável.
- Padronize data/hora/fuso em listas, detalhes, formulários e PDFs.
- Use estados vazios com explicação e próxima ação permitida ao perfil.
- Preserve filtros relevantes na paginação e no retorno de formulários.
- Confirme responsividade em 360, 768, 1280 e 1440 px, além de zoom de 200%.
- Teste navegação completa por teclado, foco visível, leitura dos erros e anúncios de sucesso.

## 7. Testes obrigatórios

Adicione testes para, no mínimo:

- schema de planejamento e datas inválidas/parciais/invertidas;
- criação e edição de OS com agenda;
- criação preditiva mantendo todas as gates AI-first;
- geração preventiva idempotente e avanço de `nextExecution`;
- consulta do cronograma incluindo sobreposição de período e fila sem agenda;
- revalidação de `/schedule` após mutations;
- permissões dos quatro perfis;
- transições `PLANNED`, `IN_PROGRESS` e `COMPLETED` com suas pré-condições;
- checklist, horas reais, solução e auditoria;
- filtros inválidos sem erro 500;
- E2E `incidente confirmado → criar e agendar OS → cronograma → executar checklist → concluir`;
- E2E `plano preventivo → gerar OS → cronograma → reagendar`;
- E2E fail-closed com IA indisponível.

Execute, sem baixar dependências desnecessariamente:

- Prisma format/validate/generate quando houver alteração de schema;
- typecheck;
- testes unitários e de integração disponíveis;
- lint;
- build de produção;
- testes FastAPI se algum contrato de IA for tocado;
- E2E autenticado em desktop e mobile.

Não use testes ignorados como evidência de aprovação. Se banco, navegador ou serviço externo estiver indisponível, registre exatamente o que ficou sem execução.

## 8. Critérios de aceite

O trabalho só termina quando:

1. Toda OS aberta aparece no cronograma ou na fila “A planejar”.
2. ADMIN/PLANNER consegue criar, planejar e replanejar uma OS.
3. Uma OS preditiva confirmada pode receber agenda e responsável sem quebrar sua rastreabilidade.
4. Uma OS preventiva gerada não desaparece do planejamento e não duplica no mesmo ciclo.
5. TECHNICIAN consegue executar apenas sua OS, atualizar checklist e registrar conclusão.
6. MANAGER consulta cronograma, OS e relatórios sem receber controles de mutação.
7. Não existem CTAs principais sem destino, rotas profissionais retornando “não disponível” ou funções mantidas sem decisão documentada.
8. Histórico e auditoria permitem reconstruir criação, planejamento, execução e conclusão.
9. Typecheck, testes, lint e build passam; E2E prioritário possui evidência.
10. `Adequaçoes.md` reflete somente resultados comprovados e permanece como fonte única de controle.

Ao final, entregue um resumo curto com arquivos alterados, migrations (se houver), testes executados, evidências das jornadas, pendências externas e riscos restantes.
