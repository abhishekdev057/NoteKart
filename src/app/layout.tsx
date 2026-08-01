import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoteKart | Custom Notebooks from Doomra",
  description:
    "NoteKart manufactures premium notebooks and customized photo notebooks in Doomra, Nawalgarh, Jhunjhunu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9461217285").replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${whatsappNumber.length === 10 ? `91${whatsappNumber}` : whatsappNumber}?text=${encodeURIComponent("Hello NoteKart, I need help with notebooks or my order.")}`;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <a
          className="whatsapp-support"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat with NoteKart support on WhatsApp"
          title="Chat on WhatsApp"
        >
          <svg aria-hidden="true" viewBox="0 0 32 32">
            <path d="M16 4.2a11.6 11.6 0 0 0-9.85 17.72L4.4 27.6l5.84-1.68A11.6 11.6 0 1 0 16 4.2Z" />
            <path d="M12.05 10.25c-.27-.6-.55-.62-.81-.63h-.69c-.24 0-.63.09-.96.45-.33.36-1.26 1.23-1.26 3s1.29 3.48 1.47 3.72c.18.24 2.53 4.04 6.27 5.5 3.1 1.2 3.74.96 4.41.9.67-.06 2.16-.88 2.46-1.74.3-.87.3-1.62.21-1.77-.09-.15-.33-.24-.69-.42-.36-.18-2.13-1.05-2.46-1.17-.33-.12-.57-.18-.81.18-.24.36-.93 1.17-1.14 1.41-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.79a10.9 10.9 0 0 1-2.01-2.5c-.21-.36-.02-.55.16-.73.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.8-1.96-1.34-3.09Z" />
          </svg>
        </a>
      </body>
    </html>
  );
}
