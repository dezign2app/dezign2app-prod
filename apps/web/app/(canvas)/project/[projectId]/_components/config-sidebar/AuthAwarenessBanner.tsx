import React from "react";
import { ShieldCheck } from "lucide-react";

interface AuthAwarenessBannerProps {
  zoneName: string | null;
}

/**
 * Shown in EndpointConfig when the endpoint is called from a protected
 * (private-zone) WebClient page. Informs the developer that an
 * Authorization: Bearer <token> header will be forwarded automatically
 * and nudges them to configure the auth rule below.
 */
export const AuthAwarenessBanner: React.FC<AuthAwarenessBannerProps> = ({
  zoneName,
}) => {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 shadow-sm">
      <ShieldCheck
        size={16}
        className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Authenticated Endpoint
        </span>
        <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
          Called from{" "}
          <span className="font-mono font-semibold">
            {zoneName ?? "a protected page"}
          </span>
          {" "}&mdash; an{" "}
          <code className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-mono">
            Authorization: Bearer &lt;token&gt;
          </code>
          {" "}header is automatically forwarded by the client.
        </span>
        <span className="text-[10px] text-amber-600/60 dark:text-amber-500/60 mt-0.5">
          Configure the Auth Rule below to validate this token.
        </span>
      </div>
    </div>
  );
};
