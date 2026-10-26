import React from 'react';
import { Phone, Globe, Mail } from 'lucide-react';

const AgreementHeader = () => {
  return (
    <div className="w-full bg-white text-black font-sans pb-4">
      {/* Top thin bar */}
      <div className="flex w-full h-4">
        <div className="w-2/3 bg-[#1D3B23]"></div>
        <div className="w-1/3 bg-[#FF7F00]" style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0% 100%)', marginLeft: '-20px' }}></div>
      </div>

      {/* Stacks on narrow documents (phones); side by side from @lg — the width is the document's own (container query) */}
      <div className="px-4 @lg:px-8 py-4 @lg:py-6 flex flex-col @lg:flex-row items-start @lg:items-center justify-between gap-3 @lg:gap-6">
        {/* Logo Area */}
        <div className="flex items-center">
          <h1 className="text-3xl @lg:text-4xl font-black tracking-tighter">
            <span className="text-[#FF7F00]">VED</span>
            <span className="text-black">HUNT</span>
          </h1>
        </div>

        {/* Contact Info */}
        <div className="flex flex-col items-start @lg:items-end text-sm text-[#4A4A4A] space-y-1 font-medium">
          <div className="flex items-center gap-2 @lg:flex-row-reverse">
            <Phone size={16} className="text-[#4A4A4A] shrink-0" />
            <span>8652410289</span>
          </div>
          <div className="flex items-center gap-2 @lg:flex-row-reverse">
            <Globe size={16} className="text-[#4A4A4A] shrink-0" />
            <span>www.vedhunt.in</span>
          </div>
          <div className="flex items-center gap-2 @lg:flex-row-reverse">
            <Mail size={16} className="text-[#4A4A4A] shrink-0" />
            <span className="break-all">info@vedhunt.in</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 @lg:px-8">
        <div className="flex w-full h-2">
          <div className="w-[40%] bg-[#FF7F00]"></div>
          <div className="w-[60%] bg-[#1D3B23]"></div>
        </div>
      </div>

    </div>
  );
};

export default AgreementHeader;
