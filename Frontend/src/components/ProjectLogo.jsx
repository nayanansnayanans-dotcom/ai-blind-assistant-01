import React from 'react';

export default function ProjectLogo({ size = 'medium', showSubtitle = true }) {
  const dimensions = {
    small: { icon: 38, text: 17, sub: 10, gap: 10 },
    medium: { icon: 50, text: 23, sub: 11, gap: 12 },
    large: { icon: 66, text: 29, sub: 13, gap: 16 }
  }[size] || { icon: 50, text: 23, sub: 11, gap: 12 };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: `${dimensions.gap}px`, userSelect: 'none' }}>
      {/* Glossy Futuristic Cyber Eye Badge Container */}
      <div 
        className="card-3d"
        style={{
          width: `${dimensions.icon}px`,
          height: `${dimensions.icon}px`,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -4px rgba(2, 132, 199, 0.45), inset 0 2px 6px rgba(255, 255, 255, 0.65)',
          border: '2.5px solid #ffffff',
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
          transformStyle: 'preserve-3d'
        }}
        title="VisionAssist AI - 3D Smart AI Eye Logo"
      >
        {/* Subtle Radial Glare & Lens Reflection */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 60%)',
          pointerEvents: 'none'
        }} />

        {/* Ultra-Attractive Vector Eye SVG */}
        <svg 
          width={dimensions.icon * 0.75} 
          height={dimensions.icon * 0.75} 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Futuristic Audio Vision Aperture Arcs (Top & Bottom Radar Rays) */}
          <path d="M2.5 12C2.5 7.5 6 4.2 12 4.2C18 4.2 21.5 7.5 21.5 12" stroke="#e0f2fe" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
          <path d="M4 12C4 16.5 7.2 19.8 12 19.8C16.8 19.8 20 16.5 20 12" stroke="#e0f2fe" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />

          {/* Outer Eye Outline Contour (Smooth Elegant Almond Curve) */}
          <path 
            d="M1.8 12C4.2 6.8 7.8 4.5 12 4.5C16.2 4.5 19.8 6.8 22.2 12C19.8 17.2 16.2 19.5 12 19.5C7.8 19.5 4.2 17.2 1.8 12Z" 
            stroke="#ffffff" 
            strokeWidth="2.2" 
            strokeLinejoin="round" 
            fill="rgba(255, 255, 255, 0.12)"
          />

          {/* Outer Iris Ring */}
          <circle cx="12" cy="12" r="5" fill="#e0f2fe" stroke="#ffffff" strokeWidth="1.2" />

          {/* Inner Iris Gradient Lens */}
          <circle cx="12" cy="12" r="3.5" fill="#0284c7" />

          {/* Pupil Center Core */}
          <circle cx="12" cy="12" r="2" fill="#0369a1" />

          {/* Glowing Lens Highlight Dot (Light Reflection) */}
          <circle cx="10.8" cy="10.8" r="0.9" fill="#ffffff" />
          <circle cx="13.2" cy="13.2" r="0.4" fill="#ffffff" opacity="0.8" />

          {/* Embedded Audio Wave Equalizer Lines inside Pupil */}
          <path d="M12 7.5V8.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12 15.5V16.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7.5 12H8.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M15.5 12H16.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />

          {/* AI Sparkle Node (Top Right Eye Corner Accent) */}
          <path d="M18 5L18.6 6.5L20.1 7.1L18.6 7.7L18 9.2L17.4 7.7L15.9 7.1L17.4 6.5L18 5Z" fill="#ffffff" />
        </svg>
      </div>

      {/* Typography Section */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          lineHeight: 1.15
        }}>
          <span style={{
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontSize: `${dimensions.text}px`,
            fontWeight: '900',
            color: '#0369a1',
            letterSpacing: '-0.4px'
          }}>
            Vision<span style={{ color: '#0284c7' }}>Assist</span>
          </span>

          <span style={{
            fontSize: `${Math.max(9, dimensions.text * 0.42)}px`,
            fontWeight: '800',
            background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            color: '#0369a1',
            padding: '2px 8px',
            borderRadius: '20px',
            border: '1px solid #7dd3fc',
            letterSpacing: '0.4px',
            boxShadow: '0 2px 5px rgba(2, 132, 199, 0.12)',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            👁️ AI EYE
          </span>
        </div>

        {showSubtitle && (
          <span style={{
            fontSize: `${dimensions.sub}px`,
            color: '#0284c7',
            fontWeight: '700',
            marginTop: '3px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            opacity: 0.95
          }}>
            AI-Powered Smart Eye & Voice Assistant
          </span>
        )}
      </div>
    </div>
  );
}
