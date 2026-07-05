import React, { useEffect } from 'react';
import { HeroSection } from '../marketing/HeroSection';
import { RoleTabs } from '../marketing/RoleTabs';
import { ConnectedWorkflowSection } from '../marketing/ConnectedWorkflowSection';
import { FeatureExplorer } from '../marketing/FeatureExplorer';
import { TachographSection } from '../marketing/TachographSection';
import { EarlyAccessSection } from '../marketing/EarlyAccessSection';
import { FounderStorySection } from '../marketing/FounderStorySection';
import { FaqSection } from '../marketing/FaqSection';
import { PricingSection } from '../marketing/PricingSection';
import { AtlasChatWidget } from '../marketing/atlas/AtlasChatWidget';

export function HomePage() {
  useEffect(() => {
    // Handle anchor links if the page is loaded with one
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div className="bg-hw-navy-950 min-h-screen">
      <HeroSection />

      {/* Role Selector Section */}
      <RoleTabs />

      {/* Connected Workflow Strip */}
      <ConnectedWorkflowSection />

      {/* Feature Explorer with Tabs */}
      <FeatureExplorer />

      {/* Tachograph + Compliance Section */}
      <TachographSection />

      {/* Pricing Section (Placeholder/Beta messaging) */}
      <div id="pricing">
        <PricingSection />
      </div>

      {/* Early Access Signup Panel */}
      <EarlyAccessSection />

      {/* Founder / Credibility Note */}
      <FounderStorySection />

      {/* FAQ Accordion */}
      <FaqSection />

      {/* Floating Atlas Preview Chatbot */}
      <AtlasChatWidget />
    </div>
  );
}
