import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DiagnosticStatus } from "@/types/generated/DiagnosticStatus";
import type { Incident } from "@/types/generated/Incident";

interface DiagnosticRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_REFRESH_MS = 5000;

function statusMessage(status: DiagnosticStatus | null): string {
  if (!status) {
    return "入力ログの状態を確認中";
  }
  if (status.error) {
    return "入力ログにエラーがあります";
  }
  return "入力ログ記録中";
}

export function DiagnosticRecorder({
  open,
  onOpenChange,
}: DiagnosticRecorderProps) {
  const [status, setStatus] = useState<DiagnosticStatus | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    function showPending(next: DiagnosticStatus) {
      setIncident(next.pending);
      if (next.pending) {
        onOpenChange(true);
      }
    }
    function refresh(show: boolean) {
      invoke<DiagnosticStatus>("diagnostic_status")
        .then((next) => {
          if (disposed) {
            return;
          }
          setStatus(next);
          if (show) {
            showPending(next);
          }
        })
        .catch((err) => {
          if (!disposed) {
            setError(String(err));
          }
        });
    }
    listen("diagnostic-incident", () => {
      refresh(true);
    })
      .then((stop) => {
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
          refresh(true);
        }
      })
      .catch((err) => {
        if (!disposed) {
          setError(String(err));
        }
      });
    const timer = window.setInterval(() => {
      refresh(false);
    }, STATUS_REFRESH_MS);
    return () => {
      disposed = true;
      unlisten?.();
      window.clearInterval(timer);
    };
  }, [onOpenChange]);

  async function mark() {
    setBusy(true);
    setError("");
    try {
      const next = await invoke<Incident>("diagnostic_mark");
      setIncident(next);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!incident) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await invoke("diagnostic_save", { id: incident.id, note });
      setIncident(null);
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      onOpenChange={(value) => {
        if (value) {
          onOpenChange(true);
        } else if (!busy && incident) {
          save();
        } else if (!busy) {
          onOpenChange(false);
        }
      }}
      open={open}
    >
      <DialogContent>
        <DialogTitle>
          {incident ? "異常を感じた状況を記録" : "入力診断"}
        </DialogTitle>
        {incident ? (
          <>
            <DialogDescription>
              記録した時刻: {new Date(incident.unixMs).toLocaleString()}
              <br />
              時刻はすでにマーク済みです。空欄でも保存できます。閉じる操作でもメモを保存します。
            </DialogDescription>
            <label className="text-sm" htmlFor="incident-note">
              何が起きましたか？
            </label>
            <textarea
              className="min-h-28 rounded border bg-background p-3 text-sm"
              disabled={busy}
              id="incident-note"
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: Spaceを離した後もレイヤーが戻らなかった"
              value={note}
            />
            <p className="text-right text-muted-foreground text-xs">
              {note.length} / 1000
            </p>
            <Button disabled={busy} onClick={save}>
              {busy ? "保存中…" : "ログに保存"}
            </Button>
          </>
        ) : (
          <>
            <DialogDescription>
              {statusMessage(status)}
              。異常を感じたら時刻を記録し、状況をメモできます。通知領域のアイコンからも記録できます。
            </DialogDescription>
            <Button disabled={busy} onClick={mark}>
              {busy ? "記録中…" : "異常を記録"}
            </Button>
          </>
        )}
        {!!status && (
          <details className="max-w-full text-xs">
            <summary className="cursor-pointer">ログ保存先</summary>
            <p className="select-text break-all">{status.path}</p>
            <p>
              キーコードを記録します。入力内容を推測できるため共有時はご注意ください。
            </p>
            <p>16 MB × 最大8ファイル。古いログから置き換えます。</p>
          </details>
        )}
        {!!(error || status?.error) && (
          <p className="text-destructive text-sm" role="alert">
            {error || status?.error}
          </p>
        )}
        {!!status?.droppedEvents && (
          <p className="text-destructive text-sm" role="alert">
            記録できなかったイベント: {status.droppedEvents}件
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
