"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tone = "info" | "success" | "error";

type AlertState = {
  open: boolean;
  tone: Tone;
  title: string;
  message: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: ((value: boolean) => void) | null;
};

type PromptState = {
  open: boolean;
  title: string;
  message: string;
  label: string;
  placeholder: string;
  initialValue: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: ((value: string | null) => void) | null;
};

const TONE_STYLES: Record<Tone, string> = {
  info: "",
  success: "bg-green-600 text-white hover:bg-green-600",
  error: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

/**
 * Modal replacements for the browser's window.alert, window.confirm and window.prompt.
 * Every call returns a promise so call sites read like the native functions:
 *
 *   const { showAlert, confirm, prompt, dialogs } = useModal();
 *   if (!(await confirm("Delete this quiz?", "This cannot be undone."))) return;
 *   const name = await prompt("Confirm email", "Type your Gmail address.");
 */
export function useModal() {
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    tone: "info",
    title: "Alert",
    message: "",
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "Please confirm",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    destructive: false,
    resolve: null,
  });
  const [promptState, setPromptState] = useState<PromptState>({
    open: false,
    title: "Please confirm",
    message: "",
    label: "Value",
    placeholder: "",
    initialValue: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    resolve: null,
  });
  const [promptValue, setPromptValue] = useState("");

  const alertResolve = useRef<(() => void) | null>(null);

  const showAlert = useCallback((title: string, message = "", tone: Tone = "info") => {
    return new Promise<void>((resolve) => {
      alertResolve.current = resolve;
      setAlertState({ open: true, tone, title, message });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((state) => ({ ...state, open: false }));
    alertResolve.current?.();
    alertResolve.current = null;
  }, []);

  const confirm = useCallback(
    (
      title: string,
      message = "",
      options: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean } = {}
    ) => {
      return new Promise<boolean>((resolve) => {
        setConfirmState({
          open: true,
          title,
          message,
          confirmLabel: options.confirmLabel ?? "Confirm",
          cancelLabel: options.cancelLabel ?? "Cancel",
          destructive: options.destructive ?? false,
          resolve,
        });
      });
    },
    []
  );

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmState((state) => {
      state.resolve?.(value);
      return { ...state, open: false, resolve: null };
    });
  }, []);

  const prompt = useCallback(
    (
      title: string,
      message = "",
      options: { label?: string; placeholder?: string; initialValue?: string; confirmLabel?: string; cancelLabel?: string } = {}
    ) => {
      return new Promise<string | null>((resolve) => {
        setPromptValue(options.initialValue ?? "");
        setPromptState({
          open: true,
          title,
          message,
          label: options.label ?? "Value",
          placeholder: options.placeholder ?? "",
          initialValue: options.initialValue ?? "",
          confirmLabel: options.confirmLabel ?? "Confirm",
          cancelLabel: options.cancelLabel ?? "Cancel",
          resolve,
        });
      });
    },
    []
  );

  const closePrompt = useCallback((value: string | null) => {
    setPromptState((state) => {
      state.resolve?.(value);
      return { ...state, open: false, resolve: null };
    });
  }, []);

  const dialogs = (
    <>
      <AlertDialog
        open={alertState.open}
        onOpenChange={(open) => {
          if (!open) closeAlert();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertState.title}</AlertDialogTitle>
            {alertState.message ? <AlertDialogDescription>{alertState.message}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction asChild>
              <Button className={TONE_STYLES[alertState.tone]} onClick={closeAlert}>
                OK
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmState.open}
        onOpenChange={(open) => {
          if (!open) closeConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
            {confirmState.message ? <AlertDialogDescription>{confirmState.message}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant={confirmState.destructive ? "destructive" : "default"}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={promptState.open}
        onOpenChange={(open) => {
          if (!open) closePrompt(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{promptState.title}</AlertDialogTitle>
            {promptState.message ? <AlertDialogDescription>{promptState.message}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="modal-prompt-input">{promptState.label}</Label>
            <Input
              id="modal-prompt-input"
              value={promptValue}
              placeholder={promptState.placeholder}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  closePrompt(promptValue.trim() || null);
                }
              }}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => closePrompt(null)}>
                {promptState.cancelLabel}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={() => closePrompt(promptValue.trim() || null)}>{promptState.confirmLabel}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return { showAlert, confirm, prompt, dialogs };
}