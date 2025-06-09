"use client"

import { useState } from "react"

interface Toast {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = ({ title, description, variant = "default" }: Toast) => {
    // For now, just use alert for simplicity
    // In a real app, you'd implement a proper toast system
    if (variant === "destructive") {
      alert(`Error: ${title}\n${description || ""}`)
    } else {
      alert(`${title}\n${description || ""}`)
    }
  }

  return { toast, toasts }
}
