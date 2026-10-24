"use client";

import React from "react";
import { Header } from "./header";
import { HeroSection } from "./hero/HeroSection";
import { StudioViewsSection } from "./studio-views/StudioViewsSection";
import { CompilerShowcaseSection } from "./compiler/CompilerShowcaseSection";
import { DesktopStudioSection } from "./desktop/DesktopStudioSection";
import { PricingSection } from "./pricing/PricingSection";
import { FaqSection } from "./faq/FaqSection";
import { Footer } from "./footer";

export const Landing: React.FC = () => {
  return (
    <div className="max-w-screen min-h-screen w-full bg-background text-foreground flex flex-col items-center overflow-x-hidden transition-colors selection:bg-primary/20 selection:text-primary">
      <Header />
      <main className="w-full flex flex-col">
        <HeroSection />
        <StudioViewsSection />
        <CompilerShowcaseSection />
        <DesktopStudioSection />
        <PricingSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
