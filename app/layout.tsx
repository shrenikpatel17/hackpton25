import "./globals.css";
import { Inter, Raleway } from "next/font/google";
import { Press_Start_2P } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const raleway = Raleway({
  subsets: ['latin'],
});

export const metadata = {
  title: "Eye Health Monitor",
  description: "Keep your eyes healthy with our monitoring system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} ${raleway.className}`}>{children}</body>
    </html>
  );
}
