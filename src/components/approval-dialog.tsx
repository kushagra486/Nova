"use client";

import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PrivacyClass } from "@/lib/nova/types";

const FINDING_LABELS: Record<string, string> = {
  email: "an email address",
  phone: "a phone number",
  api_key: "an API key",
  credential: "a password or credential",
  name: "a personal name",
  financial: "a financial/card number",
};

const CLASS_COPY: Record<PrivacyClass, { label: string; tone: string }> = {
  P0: { label: "Public", tone: "text-emerald-400" },
  P1: { label: "Low sensitivity", tone: "text-amber-400" },
  P2: { label: "Elevated sensitivity", tone: "text-amber-400" },
  P3: { label: "Highly sensitive", tone: "text-red-400" },
};

interface ApprovalDialogProps {
  open: boolean;
  privacyClass: PrivacyClass;
  findings: string[];
  onCancel: () => void;
  onApprove: () => void;
  loading?: boolean;
}

export function ApprovalDialog({ open, privacyClass, findings, onCancel, onApprove, loading }: ApprovalDialogProps) {
  const classInfo = CLASS_COPY[privacyClass] ?? CLASS_COPY.P1;
  const findingLabels = findings.map((f) => FINDING_LABELS[f] ?? f).join(", ") || "sensitive content";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <ShieldAlert className={`h-5 w-5 ${classInfo.tone}`} />
            <DialogTitle>Guardian flagged this request</DialogTitle>
          </div>
          <DialogDescription>
            This looks like it contains <strong className={classInfo.tone}>{findingLabels}</strong> — classified{" "}
            <strong className={classInfo.tone}>
              {privacyClass} ({classInfo.label})
            </strong>
            . Sending it to an external AI provider is not the default for this privacy level.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">
          Detected values still stay redacted with placeholders (e.g. <code className="text-zinc-300">[EMAIL]</code>)
          before anything leaves the process — approving only lets this request route to an AI model instead of
          stopping here.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onApprove} disabled={loading} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
            {loading ? "Sending…" : "Send anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
