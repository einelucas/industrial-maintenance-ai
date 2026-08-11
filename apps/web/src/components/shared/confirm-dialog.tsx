"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Diálogo de confirmação reutilizável para qualquer ação destrutiva
// (cancelamento de OS, desativação de usuário, etc.) — não só a de hoje.
//
// O conteúdo do diálogo é renderizado num Portal (fora da árvore DOM de
// qualquer <form> ao redor do trigger) — por isso o botão de confirmação
// NÃO deve depender de JS para submeter um form externo (ex.: mutar um
// input escondido via ref + form.requestSubmit()): isso é frágil. Para
// confirmar uma ação que precisa submeter um <form> existente, use o
// atributo HTML nativo `form` via `confirmButtonProps={{ type: "submit",
// form: "id-do-form", name: "...", value: "..." }}` — funciona mesmo com o
// botão fora da árvore do form, sem nenhum JS extra.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  confirmButtonProps,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm?.();
            }}
            {...confirmButtonProps}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
