"use client"

import { useAuth } from "@/shared/hooks/useAuth"
import { useEffect, useState } from "react"

export const dynamic = "force-dynamic"

interface NewsSection {
  sectionName: string
  subsectionName: string
  bullets: string[]
}

interface NewsItem {
  id: string
  title: string
  description: string
  imageUrl?: string
  size: "major" | "minor"
  date: string
  sections: NewsSection[]
}

export default function NewsPage() {
  const { user, loading: authLoading } = useAuth()
  
  const [newsList, setNewsList] = useState<NewsItem[]>([])
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    fetch("/api/news")
      .then(res => {
        if (!res.ok) throw new Error("Помилка завантаження новин")
        return res.json()
      })
      .then(data => {
        setNewsList(data)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [user])

  // Formatting date to Ukrainian text format (e.g. 11 травня 2026)
  const formatUkrainianDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const months = [
        "січня", "лютого", "березня", "квітня", "травня", "червня",
        "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
      ]
      const day = date.getUTCDate()
      const monthIndex = date.getUTCMonth()
      const year = date.getUTCFullYear()
      return `${day} ${months[monthIndex]} ${year}`
    } catch {
      return dateString
    }
  }

  if (authLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: "1rem" }}>Завантаження сесії...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
        <h2>Доступ обмежено</h2>
        <p style={{ color: "#64748b", marginTop: "0.5rem" }}>Будь ласка, авторизуйтеся в системі, щоб переглянути новини.</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* GLOBAL SCROLLBAR STYLING */}
      <style>{`
        *::-webkit-scrollbar { width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        *::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>

      {/* HEADER SECTION */}
      <div style={styles.header}>
        <h1 style={styles.title}>Стрічка оновлень</h1>
        <p style={styles.subtitle}>Хронологія змін та свіжих нововведень нашої ігрової платформи</p>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div style={styles.errorBox}>
          <span style={{ fontSize: "1.5rem", marginRight: "10px" }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading && !error ? (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: "1rem" }}>Завантаження оновлень...</p>
        </div>
      ) : (
        <div style={styles.list}>
          {newsList.length > 0 ? (
            newsList.map(news => {
              const isMajor = news.size === "major"
              const isExpanded = expandedCardId === news.id
              const isHovered = hoveredCardId === news.id

              // Accent color determination (Major = Blue, Minor = Green)
              const accentColor = isMajor ? "#38bdf8" : "#22c55e"
              const borderColor = isMajor 
                ? (isHovered || isExpanded ? "rgba(56, 189, 248, 0.6)" : "rgba(56, 189, 248, 0.2)")
                : (isHovered || isExpanded ? "rgba(34, 197, 94, 0.6)" : "rgba(34, 197, 94, 0.2)")
              
              const glowShadow = isMajor
                ? (isHovered || isExpanded ? "0 0 25px rgba(56, 189, 248, 0.15)" : "0 0 15px rgba(56, 189, 248, 0.05)")
                : (isHovered || isExpanded ? "0 0 25px rgba(34, 197, 94, 0.15)" : "0 0 15px rgba(34, 197, 94, 0.05)")

              return (
                <div
                  key={news.id}
                  style={{
                    ...styles.card,
                    borderColor,
                    boxShadow: glowShadow,
                    transform: isHovered && !isExpanded ? "translateY(-3px)" : "none",
                  }}
                  onMouseEnter={() => setHoveredCardId(news.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  onClick={() => setExpandedCardId(isExpanded ? null : news.id)}
                >
                  {/* CARD TOP INFO */}
                  <div style={styles.cardHeader}>
                    <div style={styles.meta}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: isMajor ? "rgba(56, 189, 248, 0.15)" : "rgba(34, 197, 94, 0.15)",
                        color: accentColor,
                        border: `1px solid ${isMajor ? "rgba(56, 189, 248, 0.2)" : "rgba(34, 197, 94, 0.2)"}`
                      }}>
                        {isMajor ? "Мажорне" : "Мінорне"}
                      </span>
                      <span style={styles.dateText}>{formatUkrainianDate(news.date)}</span>
                    </div>
                  </div>

                  {/* TITLE & DESCRIPTION */}
                  <h2 style={styles.cardTitle}>{news.title}</h2>
                  <p style={styles.cardDescription}>{news.description}</p>

                  {/* EXPAND ACTION (VISUAL ONLY SINCE ENTIRE CARD IS CLICKABLE) */}
                  <div style={{
                    ...styles.expandTrigger,
                    color: accentColor
                  }}>
                    <span>{isExpanded ? "Згорнути деталі" : "Детальний список змін"}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        ...styles.chevron,
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)"
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>

                  {/* EXPANDED INNER SECTIONS */}
                  {isExpanded && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <div style={styles.divider}></div>
                      <div style={styles.detailsContainer}>
                        {news.sections.map((section, idx) => (
                          <div 
                            key={idx} 
                            style={{
                              ...styles.section,
                              borderLeftColor: accentColor
                            }}
                          >
                            <h3 style={styles.sectionTitle}>{section.sectionName}</h3>
                            <h4 style={styles.subsectionTitle}>{section.subsectionName}</h4>
                            <ul style={styles.bulletList}>
                              {section.bullets.map((bullet, bIdx) => (
                                <li key={bIdx} style={styles.bulletItem}>
                                  <span style={{ color: accentColor, marginRight: "8px" }}>•</span>
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div style={styles.emptyState}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
              <h3>Немає оновлень</h3>
              <p style={{ color: "#64748b" }}>Наразі стрічка оновлень порожня.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "3rem 1.5rem",
    backgroundColor: "#0f172a",
    color: "#f8fafc",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    minHeight: "calc(100vh - 64px)",
  },
  header: {
    textAlign: "center",
    marginBottom: "3.5rem",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: "-0.025em",
    margin: "0 0 0.5rem 0",
    background: "linear-gradient(to right, #38bdf8, #818cf8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "1.1rem",
    fontWeight: "500",
    margin: 0,
    lineHeight: "1.5",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    padding: "1.75rem",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "pointer",
    borderWidth: "1px",
    borderStyle: "solid",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.75rem",
    gap: "1rem",
  },
  meta: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  dateText: {
    color: "#64748b",
    fontSize: "0.85rem",
    fontWeight: "600",
  },
  badge: {
    fontSize: "0.7rem",
    fontWeight: "700",
    padding: "3px 10px",
    borderRadius: "20px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  cardTitle: {
    fontSize: "1.45rem",
    fontWeight: "800",
    color: "#f8fafc",
    margin: "0 0 0.75rem 0",
    lineHeight: "1.3",
    letterSpacing: "-0.01em",
  },
  cardDescription: {
    fontSize: "0.975rem",
    color: "#94a3b8",
    lineHeight: "1.6",
    margin: 0,
  },
  expandTrigger: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.85rem",
    fontWeight: "700",
    marginTop: "1.25rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  chevron: {
    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  divider: {
    height: "1px",
    backgroundColor: "#334155",
    margin: "1.5rem 0",
  },
  detailsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    animation: "fadeIn 0.2s ease-out",
  },
  section: {
    paddingLeft: "1.25rem",
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
  },
  sectionTitle: {
    fontSize: "1.15rem",
    fontWeight: "800",
    color: "#f8fafc",
    margin: "0 0 0.25rem 0",
  },
  subsectionTitle: {
    fontSize: "0.75rem",
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 0.75rem 0",
  },
  bulletList: {
    listStyleType: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },
  bulletItem: {
    fontSize: "0.925rem",
    color: "#cbd5e1",
    lineHeight: "1.5",
    display: "flex",
    alignItems: "flex-start",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100vh - 150px)",
    color: "#94a3b8",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #334155",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    borderRadius: "12px",
    padding: "1rem",
    color: "#ef4444",
    marginBottom: "2rem",
    display: "flex",
    alignItems: "center",
    fontWeight: "600",
  },
  emptyState: {
    padding: "3rem",
    textAlign: "center",
    color: "#475569",
  },
}