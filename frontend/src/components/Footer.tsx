"use client";

import React from "react";

export interface FooterLink {
  label: string;
  href: string;
  target?: "_blank" | "_self";
}

export interface FooterSocial {
  name: string;
  href: string;
  icon?: React.ReactNode;
}

export interface FooterProps {
  copyright?: string;
  links?: FooterLink[];
  socials?: FooterSocial[];
  variant?: "default" | "minimal" | "full";
  className?: string;
}

export default function Footer({
  // Menggunakan template literal untuk membuat tahun dinamis secara default
  copyright = `© ${new Date().getFullYear()} Ferxcode | All Rights Reserved`,
  links,
  socials,
  variant = "default",
  className = "",
}: FooterProps) {
  const baseClasses = "mt-16 pt-8 border-t border-slate-200 dark:border-slate-700";
  const containerClasses = variant === "minimal" || (!links?.length && !socials?.length)
  ? "flex flex-col items-center justify-center text-center gap-4" 
  : "flex flex-col sm:flex-row items-center justify-between gap-4";

  return (
    <footer className={`${baseClasses} ${className}`}>
      <div className={containerClasses}>
        {/* Copyright */}
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {copyright}
          </p>
        </div>

        {/* Links */}
        {links && links.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {links.map((link, index) => (
              <a
                key={index}
                href={link.href}
                target={link.target || "_self"}
                rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* Social Media */}
        {socials && socials.length > 0 && (
          <div className="flex items-center justify-center gap-3">
            {socials.map((social, index) => (
              <a
                key={index}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                aria-label={social.name}
              >
                {social.icon || social.name.charAt(0).toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}