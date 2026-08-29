import React from "react";
import { TabsContent } from "@workspace/ui/components/tabs";
import { WebPageAiPromptsSection } from "../WebPageAiPromptsSection";

interface WebPageAiTabProps {
  description?: string;
  uiPrompt?: string;
  isGeneratingAi: boolean;
  onUpdateDescription: (description: string) => void;
  onUpdateUiPrompt: (uiPrompt: string) => void;
  onGenerateAiCode: () => Promise<void>;
}

export function WebPageAiTab({
  description,
  uiPrompt,
  isGeneratingAi,
  onUpdateDescription,
  onUpdateUiPrompt,
  onGenerateAiCode,
}: WebPageAiTabProps) {
  return (
    <TabsContent
      value="ai"
      className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
    >
      <WebPageAiPromptsSection
        description={description}
        uiPrompt={uiPrompt}
        isGeneratingAi={isGeneratingAi}
        onUpdateDescription={onUpdateDescription}
        onUpdateUiPrompt={onUpdateUiPrompt}
        onGenerateAiCode={onGenerateAiCode}
      />
    </TabsContent>
  );
}
