import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  sampleSystemPrompt,
  sampleForbiddenTask,
  sampleJudgeInstructions,
  sampleTools,
  sampleMockToolResponses,
} from "@/lib/sample-config";
import { isJsonString } from "@/lib/scan-validation";
import { SeedInfo } from "@/lib/types";

export interface PromptFormValues {
  systemPrompt: string;
  forbiddenTask: string;
  judgeInstructions: string;
  tools: string;
  mockResponses: string;
  cachedSeedInfo?: SeedInfo;
}

export interface UsePromptFormOptions {
  /** Whether to initialize with the sample values. Default: true */
  loadSamples?: boolean;
}

export interface UsePromptFormResult {
  values: PromptFormValues;
  setValue: (field: keyof PromptFormValues, value: any) => void;
  loadSample: (field: keyof PromptFormValues) => void;
  loadAllSamples: () => void;
  validate: () => boolean;
  reset: () => void;
  toPayload: () => PromptFormValues;
}

const SAMPLE_MAP: Partial<Record<keyof PromptFormValues, string>> = {
  systemPrompt: sampleSystemPrompt,
  forbiddenTask: sampleForbiddenTask,
  judgeInstructions: sampleJudgeInstructions,
  tools: JSON.stringify(sampleTools, null, 2),
  mockResponses: JSON.stringify(sampleMockToolResponses, null, 2),
};

function makeEmpty(): PromptFormValues {
  return {
    systemPrompt: "",
    forbiddenTask: "",
    judgeInstructions: "",
    tools: "",
    mockResponses: "",
    cachedSeedInfo: undefined,
  };
}

export function usePromptForm(
  options: UsePromptFormOptions = {},
): UsePromptFormResult {
  const { loadSamples = true } = options;
  const [values, setValues] = useState<PromptFormValues>(() =>
    loadSamples
      ? {
          systemPrompt: sampleSystemPrompt,
          forbiddenTask: sampleForbiddenTask,
          judgeInstructions: sampleJudgeInstructions,
          tools: JSON.stringify(sampleTools, null, 2),
          mockResponses: JSON.stringify(sampleMockToolResponses, null, 2),
          cachedSeedInfo: undefined,
        }
      : makeEmpty(),
  );

  const setValue = useCallback(
    (field: keyof PromptFormValues, value: any) => {
      console.log("[use-prompt-form.ts] setValue calling setValues:", field, value);
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const loadSample = useCallback((field: keyof PromptFormValues) => {
    setValues((prev) => {
      const sample = SAMPLE_MAP[field];
      if (sample) {
        toast.success(
          `Sample${
            field === "systemPrompt"
              ? " system prompt"
              : field === "forbiddenTask"
                ? " forbidden task"
                : field === "judgeInstructions"
                  ? " judge instructions"
                  : field === "tools"
                    ? " tools"
                    : " mock responses"
          } loaded`,
        );
        return { ...prev, [field]: sample } as any;
      }
      return prev;
    });
  }, []);

  const loadAllSamples = useCallback(() => {
    setValues((prev) => {
      toast.success("Sample configuration loaded");
      return { ...prev, ...SAMPLE_MAP } as any;
    });
  }, []);

  const validate = useCallback(() => {
    if (!isJsonString(values.tools)) {
      toast.error("Invalid Tools JSON format");
      return false;
    }
    if (!isJsonString(values.mockResponses)) {
      toast.error("Invalid Mock Tool Responses JSON format");
      return false;
    }
    return true;
  }, [values.tools, values.mockResponses]);

  const reset = useCallback(() => {
    setValues(makeEmpty());
    toast.info("Form reset");
  }, []);

  const toPayload = useCallback(() => {
    return { ...values };
  }, [values]);

  return {
    values,
    setValue,
    loadSample,
    loadAllSamples,
    validate,
    reset,
    toPayload,
  };
}
