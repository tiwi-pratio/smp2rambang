import { useState, useRef, useEffect, useMemo } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SiakadUser {
  full_name?: string;
  role?: string;
  email?: string;
}

const getRoleLabel = (role?: string) => {
  switch (role) {
    case "admin": return "Administrator";
    case "guru": return "Guru";
    case "siswa": return "Siswa";
    default: return role ?? "";
  }
};

const getFirstName = (fullName?: string) => {
  if (!fullName) return "";
  return fullName.split(" ")[0];
};

const getInitials = (fullName?: string) => {
  if (!fullName) return "?";
  return fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
};

export default function Chatbot() {
  const user = useMemo<SiakadUser>(() => {
    try {
      return JSON.parse(localStorage.getItem("siakad_user") ?? "{}");
    } catch {
      return {};
    }
  }, []);

  const firstName = getFirstName(user.full_name);
  const roleLabel = getRoleLabel(user.role);

  const welcomeMessage = `Halo, ${firstName || "kamu"}! 👋 Saya asisten SIAKAD-mu. Kamu login sebagai **${roleLabel}**. Ada yang bisa saya bantu?`;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("siakad_token");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "Maaf, terjadi kesalahan." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Maaf, gagal terhubung ke server. Coba lagi." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = (content: string) => {
    const parts = content.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <>
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-80 sm:w-96 flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-border bg-white"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: "hsl(231,59%,26%)" }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold leading-tight">Asisten SIAKAD</p>
              <p className="text-white/60 text-xs leading-tight">SMP Negeri 2 Rambang</p>
            </div>
            {/* User info chip */}
            {user.full_name && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1 mr-1">
                <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[9px] font-bold text-white">
                  {getInitials(user.full_name)}
                </div>
                <span className="text-white/80 text-[10px] font-medium">{roleLabel}</span>
              </div>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[hsl(210,40%,98%)]"
            style={{ scrollbarWidth: "none" }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
                  ${msg.role === "assistant" ? "bg-[hsl(231,59%,26%)]" : "bg-muted"}`}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="h-3.5 w-3.5 text-white" />
                  ) : user.full_name ? (
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {getInitials(user.full_name)}
                    </span>
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === "assistant"
                    ? "bg-white text-foreground border border-border rounded-tl-sm shadow-sm"
                    : "text-white rounded-tr-sm"}`}
                  style={msg.role === "user" ? { background: "hsl(231,59%,26%)" } : {}}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 flex-row">
                <div className="w-7 h-7 rounded-full bg-[hsl(231,59%,26%)] flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-white border border-border px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 py-3 bg-white border-t border-border flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pertanyaan..."
              disabled={loading}
              className="flex-1 text-sm bg-muted rounded-xl px-3 py-2 outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            />
            <Button
              size="icon"
              disabled={!input.trim() || loading}
              onClick={sendMessage}
              className="h-9 w-9 rounded-xl shrink-0"
              style={{ background: "hsl(231,59%,26%)" }}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        style={{ background: "hsl(231,59%,26%)" }}
        title="Asisten SIAKAD"
      >
        {open
          ? <X className="h-6 w-6 text-white" />
          : <MessageCircle className="h-6 w-6 text-white" />}
      </button>
    </>
  );
}
