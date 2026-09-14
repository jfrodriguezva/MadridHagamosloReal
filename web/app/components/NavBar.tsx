"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonogramMarkGold } from "./LogoMark";

const LINKS = [
  { href: "/", label: "DASHBOARD" },
  { href: "/jugadores", label: "JUGADORES" },
  { href: "/tactica", label: "TÁCTICA" },
  { href: "/prediccion", label: "PREDICCIÓN" },
  { href: "/calificaciones", label: "CALIFICACIONES" },
  { href: "/podcast", label: "PODCAST" },
];

export default function NavBar({ active }: { active: string }) {
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const onScroll = () => setFloating(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between px-8 h-16 transition-all"
      style={{
        background: "var(--purple)",
        boxShadow: floating ? "0 6px 18px -6px rgba(20,15,40,.45)" : "none",
      }}
    >
      <Link href="/" className="flex items-center gap-3">
        <MonogramMarkGold size={30} />
        <span className="font-display font-extrabold text-lg text-white tracking-wide">MADRID HAGÁMOSLO REAL</span>
      </Link>
      <div className="flex gap-6 items-center">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="font-mono text-xs pb-5"
            style={{
              color: active === l.href ? "#fff" : "#c9c5df",
              borderBottom: active === l.href ? "2px solid #d9b95c" : "2px solid transparent",
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
        style={{ background: "#d9b95c", color: "#2b2350" }}
      >
        JF
      </div>
    </div>
  );
}
