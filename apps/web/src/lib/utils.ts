// Ponte para o alias padrão que os componentes gerados pelo shadcn/ui esperam
// (@/lib/utils) — a implementação real já existia em @/lib/utils/cn antes da
// migração, então evitamos duplicar em vez de trocar o alias.
export { cn } from "@/lib/utils/cn";
