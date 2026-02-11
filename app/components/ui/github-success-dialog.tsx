"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, CheckCircle } from "lucide-react";

interface GitHubSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoUrl: string;
  title?: string;
  description?: string;
}

export function GitHubSuccessDialog({
  open,
  onOpenChange,
  repoUrl,
  title = "GitHub Repository Ready",
  description = "Your code has been successfully published to GitHub.",
}: GitHubSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="break-all">
            {description}
            <br />
            <span className="text-xs text-muted-foreground">{repoUrl}</span>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          <Button
            onClick={() => window.open(repoUrl, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open on GitHub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
