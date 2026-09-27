import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://last-jackpot.frosty-swan-0404.chatgpt.site"),
  title: "Last Jackpot — Solo Zombie Survival",
  description:
    "An abandoned Las Vegas casino. Train the crowd, open the lounge, and survive one more round.",
  icons: { icon: "/icon.png" },
  openGraph: {
    title: "Last Jackpot",
    description: "Solo zombie survival in an abandoned Las Vegas casino.",
    images: [
      {
        url: "/og.png",
        width: 1735,
        height: 907,
        alt: "Last Jackpot — Solo Zombie Survival",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Last Jackpot",
    description: "Solo zombie survival in an abandoned Las Vegas casino.",
    images: ["/og.png"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
