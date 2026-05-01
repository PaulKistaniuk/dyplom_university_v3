"use client";

import { useAuth } from "@/shared/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      
      const { url } = await uploadRes.json();

      const updateRes = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url })
      });

      if (!updateRes.ok) throw new Error("Update failed");

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Помилка оновлення аватару");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const links = [
    { label: "Профіль", href: "/profile" },
    { label: "Зміна паролю", href: "/profile/password" },
    { label: "Історія ігор", href: "/profile/history" },
    { label: "Налаштування зв'язку", href: "/profile/media-settings" }
  ];

  return (
    <div style={{ display: "flex", width: "100%", minHeight: "calc(100vh - 64px)", color: "#f8fafc", backgroundColor: "#0f172a" }}>
      {/* Left Block (40%) */}
      <div style={{ 
        width: "40%", 
        paddingLeft: "5%", 
        paddingRight: "5%", 
        paddingTop: "2rem",
        borderRight: "1px solid #334155" 
      }}>
        
        {/* User Info Block */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "2rem" }}>
          <div 
            style={{
              position: "relative",
              width: "80px",
              height: "80px",
              backgroundColor: "#1e293b",
              borderRadius: "8px",
              marginRight: "1rem",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
              border: "2px solid #38bdf8",
              cursor: uploading ? "not-allowed" : "pointer"
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={handleAvatarClick}
          >
            <img 
              src={user.avatarUrl || "/default_user.png"} 
              alt="Avatar" 
              style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "cover",
                transition: "all 0.2s",
                opacity: (isHovering || uploading) ? 0.3 : 1
              }} 
            />
            {(isHovering || uploading) && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                color: "#f8fafc",
                fontSize: "0.75rem",
                fontWeight: "bold",
                textAlign: "center",
                padding: "4px"
              }}>
                {uploading ? "..." : "Змінити"}
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: "none" }}
            />
          </div>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{user.username}</div>
            <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>{user.email}</div>
          </div>
        </div>

        {/* Navigation Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  backgroundColor: isActive ? "#38bdf8" : "#1e293b",
                  color: isActive ? "#0f172a" : "#f8fafc",
                  textDecoration: "none",
                  fontWeight: isActive ? "bold" : "normal",
                  transition: "all 0.2s"
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

      </div>

      {/* Right Block (60%) */}
      <div style={{ 
        width: "60%", 
        paddingRight: "10%", 
        paddingLeft: "5%",
        paddingTop: "2rem" 
      }}>
        {children}
      </div>
    </div>
  );
}
