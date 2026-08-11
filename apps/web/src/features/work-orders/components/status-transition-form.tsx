"use client";

import { useFormState } from "react-dom";
import { transitionWorkOrderAction, type TransitionState } from "@/features/work-orders/actions/transition-work-order.action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const initialState: TransitionState = {};

export function StatusTransitionForm({
  workOrderId,
  options,
}: {
  workOrderId: string;
  options: { value: string; label: string }[];
}) {
  const [state, formAction] = useFormState(transitionWorkOrderAction, initialState);

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">Esta OS não admite mais transições de status.</p>;
  }

  // Chama o dispatch do useFormState diretamente com um FormData montado em
  // JS. Evitamos depender de submissão nativa de <form>: o botão "Cancelar OS"
  // vive dentro do Portal do Dialog (fora da árvore do form), e o React não
  // inclui name/value de botões externos associados via atributo `form` no
  // FormData da Server Action — só funciona para elementos realmente
  // descendentes do form.
  function submit(newStatus: string) {
    const data = new FormData();
    data.set("workOrderId", workOrderId);
    data.set("newStatus", newStatus);
    formAction(data);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option) =>
        option.value === "CANCELED" ? (
          <ConfirmDialog
            key={option.value}
            trigger={
              <Button type="button" variant="outline" size="sm">
                {option.label}
              </Button>
            }
            title="Cancelar ordem de serviço?"
            description="Esta ação não pode ser desfeita. A OS sairá do fluxo normal de execução e será marcada como cancelada."
            confirmLabel="Cancelar OS"
            onConfirm={() => submit(option.value)}
          />
        ) : (
          <Button key={option.value} type="button" variant="outline" size="sm" onClick={() => submit(option.value)}>
            {option.label}
          </Button>
        )
      )}
      {state.error && <p className="w-full text-sm text-status-critical">{state.error}</p>}
    </div>
  );
}
