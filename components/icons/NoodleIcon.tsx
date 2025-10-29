import React from 'react';

const NoodleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    {/* Bowl */}
    <path d="M12 40c0 8.837 8.954 16 20 16s20-7.163 20-16" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Noodles */}
    <path d="M18 32s4-4 8 0 4 4 8 0 4-4 8 0" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18 38s4-4 8 0 4 4 8 0 4-4 8 0" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Chopsticks */}
    <path d="M20 20h36" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 26h32" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default NoodleIcon;