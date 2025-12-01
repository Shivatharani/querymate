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
      </head>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen flex flex-col transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <SWRProvider>{children}</SWRProvider>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
