import type { Metadata } from "next";
import "./globals.css";
import FloatingParticles from "./components/FloatingParticles";
import HypeSignalLogo from "./components/HypeSignalLogo";
import { ToastProvider } from "./components/Toast";

/**
 * Metadata for the page
 */
export const metadata: Metadata = {
  title: "HypeSignal - AI Trading Agent",
  description: "Advanced on-chain trading agent powered by AI and real-time market intelligence",
};

/**
 * Root layout for the page
 *
 * @param {object} props - The props for the root layout
 * @param {React.ReactNode} props.children - The children for the root layout
 * @returns {React.ReactNode} The root layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        {/* Sleek gradient background */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-950/20 via-background to-gray-900/10" />

          {/* Modern morphing gradient orbs */}
          <div className="absolute top-1/6 left-1/5 w-72 h-72 bg-gradient-to-r from-gray-600/8 via-gray-500/12 to-transparent rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/3 right-1/6 w-64 h-64 bg-gradient-to-l from-gray-400/6 via-gray-600/8 to-transparent rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: '3s' }} />
          <div className="absolute top-2/3 left-2/3 w-48 h-48 bg-gradient-to-br from-gray-500/5 to-gray-700/8 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: '6s' }} />

          {/* Sleek floating particles */}
          <div className="particle particle-1"></div>
          <div className="particle particle-2"></div>
          <div className="particle particle-3"></div>
          <div className="particle particle-4"></div>
          <div className="particle particle-5"></div>
          <div className="particle particle-6"></div>
          <div className="particle particle-7"></div>
          <div className="particle particle-8"></div>
          <div className="particle particle-9"></div>
          <div className="particle particle-10"></div>
          <div className="particle particle-11"></div>
          <div className="particle particle-12"></div>
          <div className="particle particle-13"></div>
          <div className="particle particle-14"></div>
          <div className="particle particle-15"></div>
          <div className="particle particle-16"></div>
        </div>

        {/* Three.js Floating Particles */}
        <FloatingParticles />

        {/* Header */}
        <ToastProvider>
        <header className="fixed top-0 left-0 right-0 z-50">
          <div className="w-full max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <HypeSignalLogo className="w-8 h-8" />
                <div className="flex flex-col">
                  <h1 className="text-white text-2xl font-bold tracking-widest">
                    HYPESIGNAL
                  </h1>
                </div>
              </div>

              {/* Beautiful AI-Powered Trading Agent Badge */}
              <div className="hidden sm:flex items-center">
                <div className="relative overflow-hidden rounded-full bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-emerald-500/20 backdrop-blur-sm">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/5 via-blue-400/5 to-purple-400/5 animate-pulse-slow"></div>

                  <div className="relative flex items-center space-x-2 px-4 py-2">
                    {/* Animated pulse dot */}
                    <div className="relative">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-30"></div>
                    </div>

                    {/* Text with gradient */}
                    <span className="text-sm font-medium bg-gradient-to-r from-emerald-300 via-blue-300 to-purple-300 bg-clip-text text-transparent tracking-wide">
                     HyperLiquid Trading Agent
                    </span>

                    {/* Subtle shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-shine"></div>
                  </div>
                </div>
              </div>

              {/* Mobile version - simplified */}
              <div className="sm:hidden">
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-emerald-300">AI Agent</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content with Full-Width Gradient */}
        <div className="flex-1 relative">
          {/* Full-width gradient background */}
          <div className="absolute inset-0 -z-10">
            {/* <div className="absolute inset-0 bg-gradient-to-br from-gray-200/8 via-gray-100/4 to-gray-300/10 dark:from-gray-900/25 dark:via-gray-800/12 dark:to-gray-700/20" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-gray-300/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-gray-400/6 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2.5s' }} />
            <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-gray-200/12 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-gray-100/8 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: '0.5s' }} /> */}
          </div>

          <main className="container mx-auto px-6 pt-28 pb-12 relative z-10">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/40 border-t-gray-800 h-24 mt-auto z-10 relative header-glass">
          <div className="container mx-auto px-6 h-full flex items-center justify-center">
            <div className="flex flex-col items-center space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center space-x-6 mb-2">
                <a
                  href="https://github.com/coinbase/agentkit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>GitHub</span>
                </a>
                <a
                  href="https://docs.cdp.coinbase.com/agentkit/docs/welcome"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Documentation</span>
                </a>
              </div>
              <p className="text-center">
                Powered by{" "}
                <a
                  href="https://docs.cdp.coinbase.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Coinbase Developer Platform and EigenAI
                </a>
                {" "} © {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
