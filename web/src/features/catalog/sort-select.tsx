import { useId } from "react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { SORT_OPTIONS } from "./catalog-query";
import { SortSelectControl } from "./sort-select-control";

export function SortSelect() {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        Sort by
      </label>
      <NativeSelect
        id={id}
        control={SortSelectControl}
        className="w-full [&>select]:h-9 [&>select]:bg-surface"
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <NativeSelectOption key={value} value={value}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
