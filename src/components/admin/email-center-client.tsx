"use client";

import { useState } from "react";
import { Mail, Send, Loader2, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface EmailRow {
  id: string;
  to: string;
  subject: string;
  status: string;
  createdAt: string;
  body: string;
}

interface EmailCenterClientProps {
  initialEmails: EmailRow[];
}

export function EmailCenterClient({ initialEmails }: EmailCenterClientProps) {
  const [emails, setEmails] = useState(initialEmails);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      toast.error("Recipient and subject are required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send");
        return;
      }
      setEmails([data.email, ...emails]);
      setTo("");
      setSubject("");
      setBody("");
      toast.success("Email sent (mock)", {
        description: "During beta, emails are logged but not actually delivered.",
      });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send and review email notifications. During beta, emails are logged but not delivered.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Compose */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-blue-400" />
              Compose Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">To</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email content…"
                className="min-h-32 max-h-64"
              />
            </div>
            <Button onClick={handleSend} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Email
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-blue-400" />
              Sent Emails ({emails.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emails.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No emails sent yet.
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {email.subject}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          email.status === "SENT"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-red-500/30 bg-red-500/10 text-red-400"
                        }
                      >
                        {email.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      To: {email.to} · {new Date(email.createdAt).toLocaleString()}
                    </p>
                    {email.body && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {email.body}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
