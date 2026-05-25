import React, { useState } from 'react';
import HeroManager from './HeroManager';
import WhyChooseUsManager from './WhyChooseUsManager';
import HomeServicesHeaderForm from '../components/HomeServicesHeaderForm';
import ServiceManager from './ServiceManager';
import NavbarManager from './NavbarManager';
import AdvantageManager from './AdvantageManager';
import StatsManager from './StatsManager';

export default function LandingPageManager() {
  const [activeTab, setActiveTab] = useState('hero');

  const tabs = [
    { id: 'hero', label: 'Hero Section' },
    { id: 'services-header', label: 'Services Header' },
    { id: 'services-cards', label: 'Service Cards' },
    { id: 'why-choose-us', label: 'Why Choose Us' },
    { id: 'advantage', label: 'The Vedhunt Advantage' },
    { id: 'stats-counter', label: 'Stats Counter' },
    { id: 'navbar-links', label: 'Navbar Links' }
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Landing Page</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage all the content sections displayed on the homepage.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-white/10">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'border-[#FF6B00] text-[#FF6B00]'
                  : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-4 animate-in fade-in duration-300">
        {activeTab === 'hero' && <HeroManager isNested={true} />}
        {activeTab === 'services-header' && <HomeServicesHeaderForm />}
        {activeTab === 'services-cards' && <ServiceManager isNested={true} />}
        {activeTab === 'why-choose-us' && <WhyChooseUsManager isNested={true} />}
        {activeTab === 'advantage' && <AdvantageManager isNested={true} />}
        {activeTab === 'stats-counter' && <StatsManager isNested={true} />}
        {activeTab === 'navbar-links' && <NavbarManager isNested={true} />}
      </div>
    </div>
  );
}
