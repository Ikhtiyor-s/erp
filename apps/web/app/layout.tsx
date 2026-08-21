import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/i18n/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PermissionsProvider } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Aniq ERP",
  description: "Aniq — biznes boshqaruv tizimi (ERP)",
  manifest: "/manifest.json",
  themeColor: "#0922fb",
  appleWebApp: {
    capable: true,
    title: "Aniq ERP",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 antialiased">
        <ThemeProvider>
          <LocaleProvider>
            <QueryProvider>
              <PermissionsProvider>
                {children}
                <Toaster
                  richColors
                  position="top-right"
                  toastOptions={{
                    className:
                      "border border-ink-200 dark:border-ink-800 shadow-md",
                  }}
                />
              </PermissionsProvider>
            </QueryProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
