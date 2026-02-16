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
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "PortPilot AI | ETF 포트폴리오 추천",
    template: "%s | PortPilot AI",
  },
  description:
    "투자 성향 설문을 통해 ETF 포트폴리오 비중, 추천 이유, 리스크 경고를 한 번에 확인하세요.",
  openGraph: {
    title: "PortPilot AI | ETF 포트폴리오 추천",
    description:
      "5문항 투자 성향 설문으로 맞춤 ETF 포트폴리오를 빠르게 확인하는 한국어 웹 서비스",
    type: "website",
    locale: "ko_KR",
    url: "http://localhost:3000",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
