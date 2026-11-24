"use client";

import type { AttributeValue, CategoryField } from "@/lib/mercadolibre/publish/category-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/** «15 cm» → { number: "15", unit: "cm" }. */
function splitNumberUnit(valueName: string | null | undefined, defaultUnit: string | null): { number: string; unit: string } {
  const match = /^\s*([\d.,]+)\s*(.*)$/.exec(valueName ?? "");
  return { number: match?.[1] ?? "", unit: match?.[2]?.trim() || defaultUnit || "" };
}

/**
 * Un campo de característica de la categoría (specs/025, RF-2): lista, texto
 * con sugerencias, número, número con unidad o sí/no, según lo que diga
 * Mercado Libre.
 */
export function AttributeField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: CategoryField;
  value: AttributeValue | undefined;
  onChange: (value: AttributeValue) => void;
  disabled: boolean;
}) {
  const inputId = `attr-${field.id}`;
  const label = (
    <Label htmlFor={inputId}>
      {field.name}
      {field.group === "required" && <span className="text-destructive"> *</span>}
    </Label>
  );

  if (field.type === "list" || field.type === "boolean") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <select
          id={inputId}
          className={SELECT_CLASS}
          disabled={disabled}
          value={value?.valueId ?? ""}
          onChange={(event) => {
            const option = field.options.find((o) => o.id === event.target.value);
            onChange({ id: field.id, valueId: option?.id ?? null, valueName: option?.name ?? null });
          }}
        >
          <option value="">Elegí una opción</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "number_unit") {
    const current = splitNumberUnit(value?.valueName, field.defaultUnit);
    const emit = (number: string, unit: string) =>
      onChange({ id: field.id, valueId: null, valueName: number.trim() ? `${number.trim()} ${unit}`.trim() : null });
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="flex gap-2">
          <Input
            id={inputId}
            inputMode="decimal"
            disabled={disabled}
            value={current.number}
            onChange={(event) => emit(event.target.value, current.unit)}
          />
          <select
            aria-label={`Unidad de ${field.name}`}
            className={`${SELECT_CLASS} w-24`}
            disabled={disabled}
            value={current.unit}
            onChange={(event) => emit(current.number, event.target.value)}
          >
            {field.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // Texto (con sugerencias de Mercado Libre, se puede escribir otro) o número.
  const listId = field.options.length > 0 ? `${inputId}-options` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label}
      <Input
        id={inputId}
        list={listId}
        inputMode={field.type === "number" ? "decimal" : undefined}
        maxLength={field.maxLength ?? 255}
        disabled={disabled}
        value={value?.valueName ?? ""}
        onChange={(event) => {
          const text = event.target.value;
          const option = field.options.find((o) => o.name.toLowerCase() === text.trim().toLowerCase());
          onChange({ id: field.id, valueId: option?.id ?? null, valueName: text });
        }}
      />
      {listId && (
        <datalist id={listId}>
          {field.options.map((option) => (
            <option key={option.id} value={option.name} />
          ))}
        </datalist>
      )}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
}
