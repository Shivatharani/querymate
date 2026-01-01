import "./globals.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SWRProvider } from "@/lib/swr-config";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Query-Mate AI</title>
        <link
          rel="icon"
          href="https://img.icons8.com/?size=100&id=unXm4ixWAr6H&format=png&color=000000"
          sizes="any"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI-powered chat application with advanced features" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="querymate-theme"
        >
          <SWRProvider>{children}</SWRProvider>
          <ToastContainer 
            theme="colored"
            position="top-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            toastClassName="toast-elevated"
            style={{ zIndex: 9999 }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
