"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Notice } from "@/components/ui/notice";
import { emoji } from "@/lib/ui/emoji";
import { loginAction } from "../actions";

export function LoginForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await loginAction({
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          });
          if (!result.ok) {
            setMessage(result.message);
            setFieldErrors(result.fieldErrors ?? {});
            return;
          }
          router.push(result.data.redirected);
          router.refresh();
        });
      }}
    >
      {message ? <Notice message={message} tone="error" /> : null}
      <TextField
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        error={fieldErrors.email}
      />
      <TextField
        label="Kata sandi"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        error={fieldErrors.password}
      />
      <Button
        type="submit"
        variant="primary"
        emojiChar={emoji.posting}
        disabled={pending}
        className="w-full"
      >
        {pending ? "Memeriksa..." : "Masuk"}
      </Button>
    </form>
  );
}
