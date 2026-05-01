"use client";

import { useEffect, useState } from "react";

interface GameHistory {
  id: string;
  gameType: string;
  result: string;
  stats: any;
  createdAt: string;
}

export default function GameHistoryPage() {
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile/history")
      .then(res => res.json())
      .then(data => {
        if (data.history) {
          setHistory(data.history);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Завантаження історії...</div>;
  }

  const getBorderColor = (result: string) => {
    if (result === "win") return "#22c55e"; // Green
    if (result === "lose") return "#ef4444"; // Red
    return "#475569"; // Gray
  };

  const getRoleName = (role?: string) => {
    if (!role) return "Невідома роль";
    const roles: Record<string, string> = {
      mafia: "Мафія",
      don: "Дон",
      commissar: "Комісар",
      doctor: "Лікар",
      citizen: "Мирний"
    };
    return roles[role] || role;
  };

  const getGameName = (gameType: string) => {
    if (gameType === "mafia") return "Мафія";
    return gameType;
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#38bdf8" }}>Історія ігор</h1>
      
      {history.length === 0 ? (
        <div style={{ color: "#94a3b8", textAlign: "center", padding: "2rem" }}>
          Ви ще не зіграли жодної гри.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {history.map((game) => (
            <div 
              key={game.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 1.5rem",
                backgroundColor: "#1e293b",
                borderRadius: "8px",
                border: `2px solid ${getBorderColor(game.result)}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: "bold", fontSize: "1.125rem", color: "#f8fafc" }}>
                  {getRoleName(game.stats?.role)}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  {new Date(game.createdAt).toLocaleDateString("uk-UA")}
                </span>
              </div>
              
              <div style={{ fontWeight: "bold", color: "#38bdf8", fontSize: "1.125rem" }}>
                {getGameName(game.gameType)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
