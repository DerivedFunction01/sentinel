"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Trash2 } from "lucide-react";
import { PromptFormSection, PromptFormSectionValues, PromptFormSectionOptions } from "./prompt-form-section";

export interface PromptSectionCardProps {
  title: string;
  description?: string;
  values: PromptFormSectionValues;
  onChange: (field: keyof PromptFormSectionValues, value: any) => void;
  onUseSample?: (field: keyof PromptFormSectionValues) => void;
  formOptions?: PromptFormSectionOptions;
  showCopyFromPrevious?: boolean;
  onCopyFromPrevious?: () => void;
  copyLabel?: string;
  showRemove?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}

export function PromptSectionCard({
  title,
  description,
  values,
  onChange,
  onUseSample,
  formOptions = {},
  showCopyFromPrevious,
  onCopyFromPrevious,
  copyLabel = "Copy from previous",
  showRemove,
  onRemove,
  removeLabel = "Remove",
}: PromptSectionCardProps) {
  const hasActions = Boolean(
    (showCopyFromPrevious && onCopyFromPrevious) || (showRemove && onRemove),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {title}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          {hasActions && (
            <div className="flex items-center gap-2 shrink-0">
              {showCopyFromPrevious && onCopyFromPrevious && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onCopyFromPrevious}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  {copyLabel}
                </Button>
              )}
              {showRemove && onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400 hover:text-red-500"
                  onClick={onRemove}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {removeLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <PromptFormSection
          values={values}
          onChange={onChange}
          onUseSample={onUseSample}
          options={{
            ...formOptions,
            showCopyFromPrevious: false,
            showRemove: false,
            extraActions: undefined,
          }}
        />
      </CardContent>
    </Card>
  );
}
