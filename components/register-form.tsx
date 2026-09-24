"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLogo } from "@/components/app-logo";
import { AuthSignIn } from "@/components/auth-sign-in";
import { useAlert } from "@/components/use-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { AuthStatus, LearningTrack } from "@/lib/types";

const NAME_RE = /^[a-zA-Z]{2,30}$/;
const PHONE_RE = /^\+?[0-9\s-]{7,15}$/;

export function RegisterForm() {
  const [tracks, setTracks] = useState<LearningTrack[]>([]);
  const [tracksLoaded, setTracksLoaded] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [techSkill, setTechSkill] = useState("");
  const [email, setEmail] = useState("");

  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<{ text: string; kind: "info" | "success" | "error" }>({
    text: "",
    kind: "info",
  });
  const [submitting, setSubmitting] = useState(false);

  const { showAlert, dialog } = useAlert();

  useEffect(() => {
    let active = true;
    fetch("/api/tracks")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json?.data?.length) setTracks(json.data);
      })
      .catch(() => {
        /* fall back to defaults */
      })
      .finally(() => {
        if (active) setTracksLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const skillOptions = useMemo(() => {
    return tracks.map((t) => t.name);
  }, [tracks]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitState({ text: "", kind: "info" });
    const errors: Record<string, string> = {};

    if (!NAME_RE.test(firstName.trim())) errors.firstName = "Please enter a valid first name (letters only, 2–30 characters).";
    if (!NAME_RE.test(lastName.trim())) errors.lastName = "Please enter a valid last name (letters only, 2–30 characters).";
    if (!PHONE_RE.test(phone.trim())) errors.phone = "Please enter a valid phone number (7–15 digits, optional +, spaces and dashes).";
    if (!techSkill) errors.techSkill = "Please select a skill track.";
    if (!verifiedEmail) errors.email = "Please verify your Gmail address first.";

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showAlert("Cannot complete registration", Object.values(errors)[0]);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          techSkill,
          email: verifiedEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.whatsappLink) {
        setSubmitState({ text: "Registration successful! Redirecting to your WhatsApp group…", kind: "success" });
        setTimeout(() => {
          window.location.href = data.whatsappLink;
        }, 400);
        return;
      }
      setSubmitState({
        text: data.error || "Registration failed. Please try again.",
        kind: "error",
      });
      showAlert("Registration issue", data.error || "Something went wrong. Please try again.");
    } catch {
      setSubmitState({ text: "Network error. Please try again.", kind: "error" });
      showAlert("Registration issue", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <AppLogo />
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          IEEE 30 Days<em className="text-primary not-italic font-extrabold"> Skill Challenge</em>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Level up your tech skills in 30 days! Join a learning track, connect with the community, and share progress with your WhatsApp group.
        </p>
      </div>

      <Card className="glass-card">
        <form onSubmit={handleSubmit} noValidate>
          <CardHeader>
            <CardTitle className="text-xl">Registration Form</CardTitle>
            <CardDescription>* All fields are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={30}
                  autoComplete="given-name"
                />
                {fieldErrors.firstName ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.firstName}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={30}
                  autoComplete="family-name"
                />
                {fieldErrors.lastName ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.lastName}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+234 800 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={15}
                autoComplete="tel"
              />
              {fieldErrors.phone ? (
                <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="techSkill">Skill Track</Label>
              <Select
                value={techSkill}
                onValueChange={(v) => setTechSkill(v)}
                disabled={!tracksLoaded}
              >
                <SelectTrigger id="techSkill">
                  <SelectValue
                    placeholder={tracksLoaded && !skillOptions.length ? "No learning tracks available" : "Select your learning track"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {skillOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.techSkill ? (
                <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.techSkill}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Gmail Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@gmail.com"
                value={verifiedEmail ?? email}
                onChange={(e) => {
                  if (!verifiedEmail) setEmail(e.target.value);
                }}
                readOnly={!!verifiedEmail}
                autoComplete="email"
                className={verifiedEmail ? "border-green-600/60" : ""}
              />
              {fieldErrors.email ? (
                <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
              ) : null}
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-4 space-y-1">
              <p className="text-sm font-medium">Verify your Gmail to complete registration</p>
              <AuthSignIn
                onVerifiedEmail={(v) => setVerifiedEmail(v.toLowerCase())}
                onSessionLost={() => setVerifiedEmail(null)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            {submitState.text ? (
              <p className={`text-sm text-center ${submitState.kind === "error" ? "text-red-600 dark:text-red-400" : submitState.kind === "success" ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                {submitState.text}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Registering…" : "Register & Join WhatsApp Group"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      {dialog}
    </section>
  );
}