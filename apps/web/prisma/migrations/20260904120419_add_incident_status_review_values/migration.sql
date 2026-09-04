-- AlterEnum
-- Postgres exige que valores novos de enum sejam confirmados (COMMIT) antes
-- de poderem ser usados em DEFAULT/comparações — por isso esta migration
-- SÓ adiciona os valores, isolada de qualquer uso deles. A migration
-- seguinte (que define o novo DEFAULT e cria as tabelas da Etapa 5) depende
-- desta já estar aplicada.
ALTER TYPE "IncidentStatus" ADD VALUE 'PENDING_HUMAN_REVIEW';
ALTER TYPE "IncidentStatus" ADD VALUE 'HUMAN_CONFIRMED';
ALTER TYPE "IncidentStatus" ADD VALUE 'HUMAN_REJECTED';
ALTER TYPE "IncidentStatus" ADD VALUE 'INCONCLUSIVE';
ALTER TYPE "IncidentStatus" ADD VALUE 'NEW_READING_REQUIRED';
