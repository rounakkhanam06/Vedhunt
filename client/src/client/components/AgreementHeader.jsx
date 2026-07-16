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

      <div className="px-8 py-6 flex items-center justify-between">
        {/* Logo Area */}
        <div className="flex items-center">
          <h1 className="text-4xl font-black tracking-tighter">
            <span className="text-[#FF7F00]">VED</span>
            <span className="text-black">HUNT</span>
          </h1>
        </div>

        {/* Contact Info */}
        <div className="flex flex-col items-end text-sm text-[#4A4A4A] space-y-1 font-medium">
          <div className="flex items-center gap-2">
            <span>8652410289</span>
            <Phone size={16} className="text-[#4A4A4A]" />
          </div>
          <div className="flex items-center gap-2">
            <span>www.vedhunt.in</span>
            <Globe size={16} className="text-[#4A4A4A]" />
          </div>
          <div className="flex items-center gap-2">
            <span>info@vedhunt.in</span>
            <Mail size={16} className="text-[#4A4A4A]" />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-8">
        <div className="flex w-full h-2">
          <div className="w-[40%] bg-[#FF7F00]"></div>
          <div className="w-[60%] bg-[#1D3B23]"></div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mt-6">
        <h2 className="text-[#0B2B5E] text-2xl font-bold tracking-wide">SERVICE AGREEMENT</h2>
      </div>
    </div>
  );
};

export default AgreementHeader;
