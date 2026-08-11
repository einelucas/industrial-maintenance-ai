// Usuário "de sistema" (seed.ts): never loga (active: false), existe apenas
// para satisfazer WorkOrder.createdBy (obrigatório) quando o scheduler
// automático gera OS preventivas sem um usuário humano na origem.
export const SYSTEM_USER_EMAIL = "sistema@pcm.local";
