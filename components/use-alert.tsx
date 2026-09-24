"use client";

import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function useAlert() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Alert");
  const [message, setMessage] = useState("");

  function showAlert(titleText = "Alert", messageText = "") {
    setTitle(titleText);
    setMessage(messageText);
    setOpen(true);
  }

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction asChild>
          <Button onClick={() => setOpen(false)}>OK</Button>
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { showAlert, dialog };
}