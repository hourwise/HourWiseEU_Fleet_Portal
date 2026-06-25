import React, { useEffect } from 'react';
import { HeroSection } from '../marketing/HeroSection';
import { ProblemSection } from '../marketing/ProblemSection';
import { SolutionSection } from '../marketing/SolutionSection';
import { DriverAppSection } from '../marketing/DriverAppSection';
import { FleetPortalSection } from '../marketing/FleetPortalSection';
import { ConnectedWorkflowSection } from '../marketing/ConnectedWorkflowSection';
import { TachographSection } from '../marketing/TachographSection';
import { PricingSection } from '../marketing/PricingSection';
import { EarlyAccessSection } from '../marketing/EarlyAccessSection';
import { FaqSection } from '../marketing/FaqSection';

export function HomePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-hw-navy-950 min-h-screen">
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <DriverAppSection />
      <FleetPortalSection />
      <ConnectedWorkflowSection />
      <TachographSection />
      <PricingSection />
      <EarlyAccessSection />
      <FaqSection />
    </div>
  );
}
