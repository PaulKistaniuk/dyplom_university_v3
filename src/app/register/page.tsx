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
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    
    const res = await fetch("../api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      return
    }

    setSuccess("Реєстрація успішна! Тепер ви можете увійти.")
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

          <button type="submit" className={styles.button}>Зареєструватися</button>
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
