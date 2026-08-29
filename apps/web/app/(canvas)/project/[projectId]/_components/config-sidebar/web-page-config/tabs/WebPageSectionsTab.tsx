import React from "react";
import { TabsContent } from "@workspace/ui/components/tabs";
import { PageSection } from "@/types/canvas";
import { WebPageSectionsOverviewSection } from "../WebPageSectionsOverviewSection";
import { WebPageMembershipSection } from "../WebPageMembershipSection";

interface WebPageSectionsTabProps {
  nodeId: string;
  label?: string;
  appSlug: string;
  connectedZoneName: string | null;
  sections?: PageSection[];
  onUpdateSections: (sections: PageSection[]) => void;
  onAddSection: (sectionName?: string) => void;
  onRequestRename: (newLabel: string) => void;
  onUpdateAppSlug: (appSlug: string) => void;
}

export function WebPageSectionsTab({
  nodeId,
  label,
  appSlug,
  connectedZoneName,
  sections,
  onUpdateSections,
  onAddSection,
  onRequestRename,
  onUpdateAppSlug,
}: WebPageSectionsTabProps) {
  return (
    <TabsContent
      value="sections"
      className="flex-1 py-4 space-y-5 overflow-y-auto m-0 outline-none"
    >
      {/* Page Sections & Components */}
      <WebPageSectionsOverviewSection
        nodeId={nodeId}
        sections={sections}
        onUpdateSections={onUpdateSections}
        onAddSection={onAddSection}
      />

      {/* App & Zone Membership */}
      <WebPageMembershipSection
        label={label}
        appSlug={appSlug}
        connectedZoneName={connectedZoneName}
        onUpdateLabel={onRequestRename}
        onUpdateAppSlug={onUpdateAppSlug}
      />
    </TabsContent>
  );
}
