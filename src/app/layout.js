import "./globals.css";

export const metadata = {
  title: "Skylark BI Agent — Business Intelligence Dashboard",
  description:
    "AI-powered business intelligence agent for Skylark Drones. Query Monday.com boards for pipeline health, revenue metrics, sector performance, and operational insights.",
  keywords: "Skylark Drones, Business Intelligence, Monday.com, AI Agent, Pipeline, Revenue",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
