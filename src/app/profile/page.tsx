"use client";

import { useEffect, useState } from "react";

interface ProfileData {
  sex: string;
  email: string;
  gamesPlayed: number;
  createdAt: string;
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then(res => res.json())
      .then(resData => {
        if (!resData.error) {
          setData(resData);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div>Завантаження...</div>;
  }

  if (!data) {
    return <div>Помилка завантаження профілю</div>;
  }

  const fieldStyle = {
    marginBottom: "1rem",
    backgroundColor: "#1e293b",
    padding: "1rem",
    borderRadius: "8px",
    border: "1px solid #334155"
  };

  const labelStyle = {
    color: "#94a3b8",
    fontSize: "0.875rem",
    marginBottom: "0.25rem"
  };

  const valueStyle = {
    fontSize: "1.125rem",
    color: "#f8fafc"
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#38bdf8" }}>Профіль</h1>
      
      <div style={fieldStyle}>
        <div style={labelStyle}>Стать</div>
        <div style={valueStyle}>{data.sex === "male" ? "Чоловіча" : data.sex === "female" ? "Жіноча" : data.sex}</div>
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Пошта</div>
        <div style={valueStyle}>{data.email}</div>
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Ігор зіграно</div>
        <div style={valueStyle}>{data.gamesPlayed}</div>
      </div>

      <div style={fieldStyle}>
        <div style={labelStyle}>Дата створення акаунту</div>
        <div style={valueStyle}>{new Date(data.createdAt).toLocaleDateString("uk-UA")}</div>
      </div>
    </div>
  );
}
