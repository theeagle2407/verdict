import { Inter, Orbitron } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import { Metadata } from "next";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "700", "900"],
});

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;
const imageUrl = `${baseUrl}/thumbnail.jpg`;

const title = "VERDICT — AI-Refereed Escrow";
const titleTemplate = "%s | VERDICT";
const description = "Built with 🏗 Scaffold-Stylus";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: titleTemplate,
  },
  description,
  openGraph: {
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
    images: [
      {
        url: imageUrl,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [imageUrl],
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider>
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
