import ReactMarkdown from "react-markdown";
import { SubscribeButton } from "./subscribe-button";

export type BillingCycle = "monthly" | "annually";

export interface Plan {
  id: string;
  name: string;
  desc: string;
  price: number | null;
  billingPeriod: string;
  freeLabel?: string;
  featured: boolean;
  features: string[];
}

function CheckCircle() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="black"
      className="shrink-0"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="white" strokeWidth="1.2" />
      <path
        d="M5 8l2 2 4-4"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanIconBadge({ featured }: { featured: boolean }) {
  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center mb-5 bg-black`}
    >
      <div className="w-[14px] h-[14px] rounded-full border-2 border-white flex items-center justify-center">
        <div className="w-1 h-1 rounded-full bg-white" />
      </div>
    </div>
  );
}

interface PlanCardProps {
  plan: Plan;
  billing?: BillingCycle;
}

export function PlanCard({ plan }: PlanCardProps) {
  const {
    id,
    name,
    desc,
    price,
    billingPeriod,
    freeLabel,
    featured,
    features,
  } = plan;

  const displayPrice = price;
  const periodLabel =
    billingPeriod === "every-year"
      ? "/ year"
      : billingPeriod === "every-month"
      ? "/ month"
      : "";

  return (
    <div
      className="relative border border-gray-200/90 flex flex-col w-full max-w-[360px] translate-y-0 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl bg-white/70 backdrop-blur-sm text-start"
    >
      <div className="flex items-center justify-between mb-5">
        <PlanIconBadge featured={featured} />
        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-black text-white uppercase tracking-wider">
          Beta Access
        </span>
      </div>

      {/* Plan name + desc */}
      <p
        className="text-2xl font-bold mb-1 text-black"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {name}
      </p>
      <div className="text-xs mb-6 prose prose-neutral prose-sm max-w-none prose-p:leading-normal prose-p:mb-0 text-gray-600">
        <ReactMarkdown>
          {!desc || desc.toLowerCase().includes("basic")
            ? "Everything you need to compile system architecture into production code."
            : desc}
        </ReactMarkdown>
      </div>

      {/* Price */}
      <div className="mb-1">
        {freeLabel ? (
          <span
            className="text-sm font-extrabold tracking-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {freeLabel}
          </span>
        ) : (
          <div className="flex flex-col">
            <span className="flex items-end gap-1.5">
              <span
                className="text-4xl font-extrabold tracking-tight leading-none text-black"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                ${displayPrice}
              </span>
              {periodLabel && (
                <span className="text-xs mb-1 text-gray-500 font-medium">
                  {periodLabel}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <SubscribeButton productId={id} />
      <ul className="flex flex-col gap-3 mt-6 border-t border-gray-100 pt-5">
        {features.map((f) => (
          <li key={f} className="flex items-start text-start gap-2.5 text-xs text-gray-700 font-medium leading-snug">
            <div className="mt-0.5 shrink-0">
              <CheckCircle />
            </div>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
