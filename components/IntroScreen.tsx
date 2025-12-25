import React, { useEffect, useRef, useState } from 'react';
import * as THREE_LIB from 'three';

interface Props {
  onStart: () => void;
}

const LogoIconLarge = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="intro-logo-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="36" height="36" rx="12" fill="url(#intro-logo-gradient)" />
    <path d="M10 28L16 22L22 26L30 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 14V19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
    <path d="M30 14H25" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
    <circle cx="10" cy="28" r="2" fill="white" />
    <circle cx="16" cy="22" r="2" fill="white" />
    <circle cx="22" cy="26" r="2" fill="white" />
    <circle cx="30" cy="14" r="2.5" fill="white" />
  </svg>
);

const IntroScreen: React.FC<Props> = ({ onStart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Clean up
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    let renderer: THREE_LIB.WebGLRenderer;
    try {
        renderer = new THREE_LIB.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
        console.warn("WebGL Renderer failed:", e);
        setWebGLSupported(false);
        return;
    }

    const scene = new THREE_LIB.Scene();
    const camera = new THREE_LIB.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const material = new THREE_LIB.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE_LIB.Vector2(window.innerWidth, window.innerHeight) }
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float iTime;
        uniform vec2 iResolution;

        #define NUM_OCTAVES(i) int(i)

        float rand(vec2 n) {
          return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 u = fract(p);
          u = u*u*(3.0-2.0*u);
          return mix(mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x), mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
        }

        float fbm(vec2 x) {
          float v = 0.0; float a = 0.3; vec2 shift = vec2(100);
          mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int i = 0; i < 3; ++i) {
            v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.4;
          }
          return v;
        }

        void main() {
          vec2 p = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.y * 6.0;
          vec4 o = vec4(0.0);
          float f = 2.0 + fbm(p + vec2(iTime * 2.0, 0.0)) * 0.5;

          for (float i = 0.0; i < 20.0; i++) {
            vec2 v = p + cos(i + iTime * 0.05 + i * vec2(13.0, 11.0)) * 2.5;
            vec4 col = vec4(0.1 + 0.3 * sin(i * 0.2), 0.3 + 0.5 * cos(i * 0.3), 0.7 + 0.3 * sin(i * 0.4), 1.0);
            o += col / (length(v) * 20.0);
          }
          gl_FragColor = vec4(pow(o.rgb, vec3(1.2)), 1.0);
        }
      `
    });

    const geometry = new THREE_LIB.PlaneGeometry(2, 2);
    const mesh = new THREE_LIB.Mesh(geometry, material);
    scene.add(mesh);

    let frameId: number;
    const animate = () => {
      material.uniforms.iTime.value += 0.01;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {!webGLSupported && <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-950 to-black" />}
      
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]">
        <div className="animate-fade-in flex flex-col items-center p-4 text-center">
            <div className="mb-8 transition-transform hover:scale-105 duration-300 drop-shadow-2xl">
                <LogoIconLarge className="h-24 w-24 md:h-32 md:w-32" />
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-indigo-300">
              Quantum SEO
            </h1>
            <p className="text-xl md:text-2xl text-indigo-100 mb-10 font-light max-w-lg">
            Create content that <span className="font-semibold text-indigo-300">Ranks</span>.
            </p>
            
            <div className="flex flex-col items-center gap-6">
                {/* HIGH VISIBILITY VERSION BADGE */}
                <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/40 border border-indigo-400/50 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-black tracking-widest uppercase font-mono">
                        Version 1.3.0 Updated
                    </span>
                </div>
                
                <button 
                    onClick={onStart} 
                    className="group relative px-14 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/30 border border-indigo-400/40"
                >
                    <span className="relative text-xl font-bold flex items-center gap-4">
                        Start Engine
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </span>
                </button>
            </div>
        </div>
        
        <div className="absolute bottom-8 flex flex-col items-center gap-1 opacity-40">
            <div className="text-indigo-200 text-[10px] tracking-widest uppercase font-bold">
                Powered by Gemini AI
            </div>
            <div className="text-slate-500 font-mono text-[9px]">
                ENV_INJECTION: CLIENT_VITE_V1
            </div>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;