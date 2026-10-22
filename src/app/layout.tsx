import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/toaster";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const plex = localFont({
  variable: "--font-plex",
  display: "swap",
  src: [
    { path: "./fonts/plex-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/plex-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plex-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/plex-700.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · certificações de nuvem`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fb" },
    { media: "(prefers-color-scheme: dark)", color: "#16191d" },
  ],
};

// Aplica o tema antes da pintura para evitar flash (preferência salva ou do sistema).
const temaScript = `(function(){try{var t=localStorage.getItem('tema');var d=t?t==='escuro':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={`${plex.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
