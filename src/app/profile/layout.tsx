"use client";

import { useAuth } from "@/shared/hooks/useAuth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const links = [
    { label: "Профіль", href: "/profile" },
    { label: "Зміна паролю", href: "/profile/password" },
    { label: "Історія ігор", href: "/profile/history" }
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
          <div style={{
            width: "80px",
            height: "80px",
            backgroundColor: "#1e293b",
            borderRadius: "8px",
            marginRight: "1rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            border: "2px solid #38bdf8"
          }}>
            <img 
              src={user.avatarUrl || "/default_user.png"} 
              alt="Avatar" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
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
