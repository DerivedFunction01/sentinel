import { FilterCondition } from "@/lib/dataframe/client-query-engine";

export interface FilterRowProps {
  f: FilterCondition;
  idx: number;
  currentFilters: FilterCondition[];
  setCurrentFilters: (filters: FilterCondition[]) => void;
  currentFields: any[];
  getUniqueFieldValues: (property: string) => string[];
  useFriendlyNames: boolean;
}
