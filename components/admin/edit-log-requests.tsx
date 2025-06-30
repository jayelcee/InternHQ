"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface EditLogRequest {
  id: number
  logId: number
  internName: string
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  originalTimeIn: string | null
  originalTimeOut: string | null
  status: "pending" | "approved" | "rejected"
  requestedAt: string
}

export function EditLogRequestsAdmin() {
  const [requests, setRequests] = useState<EditLogRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/time-log-edit-requests")
      if (!res.ok) throw new Error("Failed to fetch edit requests")
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : data.requests)
    } catch (err: any) {
      setError(err.message || "Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleAction = async (id: number, action: "approve" | "reject" | "revert") => {
    setActionLoading(id)
    try {
      // For "revert", call only the revert endpoint, not the generic update endpoint
      if (action === "revert") {
        const res = await fetch(`/api/admin/time-log-edit-requests/${id}/revert`, {
          method: "POST",
          credentials: "include",
        })
        if (!res.ok) throw new Error("Failed to revert request")
      } else {
        const res = await fetch(`/api/admin/time-log-edit-requests/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        })
        if (!res.ok) throw new Error("Failed to update request")
      }
      await fetchRequests()
    } catch (err) {
      // Optionally show toast
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Log Requests</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading requests...</div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">{error}</div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No edit requests found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Intern</TableHead>
                <TableHead>Original Time In</TableHead>
                <TableHead>Original Time Out</TableHead>
                <TableHead>Requested Time In</TableHead>
                <TableHead>Requested Time Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(req => (
                <TableRow key={req.id}>
                  <TableCell>{req.internName}</TableCell>
                  <TableCell>{req.originalTimeIn ? new Date(req.originalTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                  <TableCell>{req.originalTimeOut ? new Date(req.originalTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                  <TableCell>{req.requestedTimeIn ? new Date(req.requestedTimeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                  <TableCell>{req.requestedTimeOut ? new Date(req.requestedTimeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        req.status === "pending"
                          ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                          : req.status === "approved"
                          ? "bg-green-100 text-green-700 border-green-300"
                          : "bg-gray-100 text-gray-700 border-gray-300"
                      }
                    >
                      {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === "pending" && (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" disabled={actionLoading === req.id} onClick={() => handleAction(req.id, "approve")}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={actionLoading === req.id} onClick={() => handleAction(req.id, "reject")}>Reject</Button>
                      </div>
                    )}
                    {(req.status === "approved" || req.status === "rejected") && (
                      <Button size="sm" variant="secondary" disabled={actionLoading === req.id} onClick={() => handleAction(req.id, "revert")}>Revert</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
