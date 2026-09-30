import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Last Jackpot — Private Co-op",
  description: "Survive the casino together in a private room for up to four players.",
  openGraph: {
    title: "Last Jackpot — Private Co-op",
    description: "Survive the casino together in a private room for up to four players.",
  },
  twitter: {
    title: "Last Jackpot — Private Co-op",
    description: "Survive the casino together in a private room for up to four players.",
  },
};

export default function CoopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
