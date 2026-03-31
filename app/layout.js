import "./globals.css";

export const metadata = {
  title: "Shop DB Starter",
  description: "Vercel starter app connected to shop.db",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
