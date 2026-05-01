"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import styles from "../auth.module.css"

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    sex: "male",
    avatarUrl: ""
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    let uploadedAvatarUrl = form.avatarUrl

    if (avatarFile) {
      const formData = new FormData()
      formData.append("file", avatarFile)

      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadRes.ok) {
          setError("Помилка завантаження аватару")
          setLoading(false)
          return
        }

        const uploadData = await uploadRes.json()
        uploadedAvatarUrl = uploadData.url
      } catch (err) {
        setError("Помилка підключення при завантаженні аватару")
        setLoading(false)
        return
      }
    }
    
    const finalForm = { ...form, avatarUrl: uploadedAvatarUrl }

    const res = await fetch("../api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(finalForm),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    setSuccess("Реєстрація успішна! Тепер ви можете увійти.")
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.authCard}>
        <h1 className={styles.title}>Реєстрація</h1>
        <p className={styles.subtitle}>Створіть свій профіль для гри</p>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <input 
              className={styles.input}
              type="email"
              placeholder="example@mail.com" 
              onChange={e => setForm({ ...form, email: e.target.value })} 
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Нікнейм</label>
            <input 
              className={styles.input}
              placeholder="МійНік123" 
              onChange={e => setForm({ ...form, username: e.target.value })} 
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Пароль</label>
            <input 
              className={styles.input}
              type="password" 
              placeholder="••••••••" 
              onChange={e => setForm({ ...form, password: e.target.value })} 
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Стать</label>
            <select 
              className={styles.select}
              onChange={e => setForm({ ...form, sex: e.target.value })}
            >
              <option value="male">Чоловіча</option>
              <option value="female">Жіноча</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Аватар (Опціонально)</label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label 
                style={{
                  backgroundColor: "var(--moon-surface-light)",
                  border: "1px dashed var(--moon-accent)",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  color: "var(--moon-text)",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  textAlign: "center",
                  flex: 1,
                  transition: "all 0.2s"
                }}
              >
                {avatarFile ? avatarFile.name : "Обрати файл..."}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
              </label>
              {avatarFile && (
                <div 
                  onClick={() => setAvatarFile(null)}
                  style={{
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "bold",
                    padding: "0.5rem"
                  }}
                  title="Видалити файл"
                >
                  ✕
                </div>
              )}
            </div>
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Завантаження..." : "Зареєструватися"}
          </button>
        </form>

        <p className={styles.footerText}>
          Вже маєте акаунт?{" "}
          <span
            className={styles.link}
            onClick={() => router.push("/login")}
          >
            Увійти
          </span>
        </p>
      </div>
    </div>
  )
}
