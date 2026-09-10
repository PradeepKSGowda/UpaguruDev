import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "UPA-GURU | Pan-India Central & State Government Exam Notifications",
    template: "%s | UPA-GURU",
  },
  description: "Real-time government exam notifications, syllabus, eligibility criteria, and omnichannel alert tracking across UPSC, SSC, RRB, and State PSCs.",
  keywords: ["government exams", "UPSC notifications", "SSC CGL", "State PSC", "Sarkari Result", "exam alerts"],
  authors: [{ name: "UPA-GURU Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
