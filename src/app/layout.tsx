import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MessageCircleMore } from "lucide-react";
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
  const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "9256308961").replace(/\D/g, "");
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
        >
          <MessageCircleMore size={24} />
          <span>Help & Support</span>
        </a>
      </body>
    </html>
  );
}
