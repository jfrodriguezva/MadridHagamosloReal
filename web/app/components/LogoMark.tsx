"use client";

import { useState } from "react";

// Escudo oficial del Real Madrid -- NO lo genero yo (derechos de autor del
// club), lo toma de un archivo que tú colocas en web/public/logos/crest.png.
// Si no existe todavía, cae en un mark propio como respaldo.
export function RealMadridCrest({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <MonogramMark size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/crest.png"
      alt="Real Madrid"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

// Ícono de marca del producto (monograma "MCF" que colocas en
// web/public/logos/monogram.png) -- usado en la barra de navegación, el
// favicon y el ícono del instalable. Respaldo propio si aún no existe.
export function MonogramMark({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="19" fill="#2b2350" stroke="#d9b95c" strokeWidth="1.2" />
        <text
          x="20" y="24" textAnchor="middle"
          fontFamily="Big Shoulders Display, sans-serif" fontWeight={800} fontSize="15"
          fill="#d9b95c" letterSpacing="0.5"
        >
          MHR
        </text>
      </svg>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/monogram.png"
      alt="Madrid Hagámoslo Real"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

// Misma marca en dorado -- para usarla sobre fondos oscuros (la barra de
// navegación es morado oscuro y el monograma en tinta azul se perdía ahí).
export function MonogramMarkGold({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <MonogramMark size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/monogram-gold.png"
      alt="Madrid Hagámoslo Real"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

export function ShieldMark({ size = 22, color = "#d9b95c" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" stroke={color} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.2" fill={color} />
    </svg>
  );
}
