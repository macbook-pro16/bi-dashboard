// src/components/AppLogo.tsx
import React from 'react';

interface AppLogoProps {
  className?: string;
}

export default function AppLogo({ className = "w-8 h-8" }: AppLogoProps) {
  return (
    <svg 
      className={`shrink-0 ${className}`} 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="logoSun" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#be185d" />
          <stop offset="100%" stopColor="#e16b8c" />
        </linearGradient>
        <linearGradient id="logoBar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="512" height="512" rx="116" fill="url(#logoBg)" />
      <circle cx="360" cy="180" r="96" fill="url(#logoSun)" filter="url(#logoGlow)" />
      <rect x="112" y="280" width="72" height="136" rx="16" fill="url(#logoBar)" />
      <rect x="220" y="200" width="72" height="216" rx="16" fill="url(#logoBar)" />
      <rect x="328" y="104" width="72" height="312" rx="16" fill="#ffffff" />
      <rect x="348" y="124" width="32" height="8" rx="4" fill="#e16b8c" fillOpacity="0.9"/>
    </svg>
  );
}