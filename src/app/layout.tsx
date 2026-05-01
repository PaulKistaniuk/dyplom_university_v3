import Navbar from "@/components/navbar"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <style>{`
          body {
            margin: 0;
            padding: 0;
            background-color: #0f172a;
            color: #f8fafc;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          * {
            box-sizing: border-box;
          }
        `}</style>
      </head>
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  )
}