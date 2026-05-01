"use client";

import { useState } from "react";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Нові паролі не збігаються");
      return;
    }

    if (newPassword.length < 6) {
      setError("Новий пароль має містити щонайменше 6 символів");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Помилка зміни паролю");
      } else {
        setSuccess(true);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setError("Внутрішня помилка сервера");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    marginBottom: "1.5rem",
    fontSize: "1rem"
  };

  const labelStyle = {
    display: "block",
    marginBottom: "0.5rem",
    color: "#cbd5e1",
    fontSize: "0.875rem"
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1.5rem", color: "#38bdf8" }}>Зміна паролю</h1>
      
      {error && (
        <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ backgroundColor: "rgba(34, 197, 94, 0.1)", color: "#22c55e", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
          Пароль успішно змінено!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label style={labelStyle}>Введіть свій старий пароль</label>
          <input 
            type="password" 
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Введіть свій новий пароль</label>
          <input 
            type="password" 
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Введіть свій новий пароль повторно</label>
          <input 
            type="password" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{
            backgroundColor: "#0ea5e9",
            color: "white",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            border: "none",
            fontWeight: "bold",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.2s"
          }}
        >
          {loading ? "Збереження..." : "Змінити пароль"}
        </button>
      </form>
    </div>
  );
}
