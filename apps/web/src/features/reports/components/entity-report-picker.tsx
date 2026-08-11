"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function EntityReportPicker({
  options,
  hrefTemplate,
  placeholder,
}: {
  options: { value: string; label: string }[];
  /** Ex.: "/api/reports/work-orders/{id}" — {id} é substituído pelo valor selecionado. */
  hrefTemplate: string;
  placeholder: string;
}) {
  const [selected, setSelected] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {selected ? (
        <a
          href={hrefTemplate.replace("{id}", selected)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Baixar PDF
        </a>
      ) : (
        <Button variant="outline" disabled>
          Baixar PDF
        </Button>
      )}
    </div>
  );
}
