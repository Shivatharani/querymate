"use client";
import { createAuthClient } from "better-auth/react";
import { showToast } from "@/lib/toastify";

const client = createAuthClient();

export const useSession = client.useSession;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signUp = {
  async email({ name, email, password }: { name: string; email: string; password: string }) {
    if (!name?.trim()) {
      showToast("error", "Name is required.");
      return { error: "Name is required." };
    }
    if (!emailRegex.test(email)) {
      showToast("error", "Invalid email address.");
      return { error: "Invalid email address." };
    }
    if (!password || password.length < 6) {
      showToast("error", "Password must be at least 6 characters.");
      return { error: "Password must be at least 6 characters." };
    }

    try {
      const resp = await client.signUp.email({ name, email, password }) as any;
      if (resp?.error) {
        const textError =
          typeof resp.error === "string"
            ? resp.error
            : resp.error?.message ?? JSON.stringify(resp.error);
        showToast("error", textError);
        return { error: textError };
      }
      showToast("success", "Account created successfully!");
      return resp;
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.message
          ? err.message
          : JSON.stringify(err);
      showToast("error", message);
      return { error: message };
    }
  },
  github: async () => {
    try {
      const resp = await client.signIn.social({ provider: "github" }) as any;
      if (resp?.error) {
        const textError =
          typeof resp.error === "string"
            ? resp.error
            : resp.error?.message ?? JSON.stringify(resp.error);
        showToast("error", textError);
        return { error: textError };
      }
      showToast("success", "Signed in with GitHub!");
      return resp;
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.message
          ? err.message
          : JSON.stringify(err);
      showToast("error", message);
      return { error: message };
    }
  },
  google: async () => {
    try {
      const resp = await client.signIn.social({ provider: "google" }) as any;
      if (resp?.error) {
        const textError =
          typeof resp.error === "string"
            ? resp.error
            : resp.error?.message ?? JSON.stringify(resp.error);
        showToast("error", textError);
        return { error: textError };
      }
      showToast("success", "Signed in with Google!");
      return resp;
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.message
          ? err.message
          : JSON.stringify(err);
      showToast("error", message);
      return { error: message };
    }
  },
};

export const signIn = {
  async email({ email, password }: { email: string; password: string }) {
    if (!emailRegex.test(email)) {
      showToast("error", "Invalid email address.");
      return { error: "Invalid email address." };
    }
    if (!password || password.length < 6) {
      showToast("error", "Password must be at least 6 characters.");
      return { error: "Password must be at least 6 characters." };
    }

    try {
      const resp = await client.signIn.email({ email, password }) as any;
      if (resp?.error) {
        const textError =
          typeof resp.error === "string"
            ? resp.error
            : resp.error?.message ?? JSON.stringify(resp.error);
        showToast("error", textError);
        return { error: textError };
      }
      showToast("success", "Signed in successfully!");
      return resp;
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.message
          ? err.message
          : JSON.stringify(err);
      showToast("error", message);
      return { error: message };
    }
  },
  github: async () => {
    try {
      const resp = await client.signIn.social({ provider: "github" }) as any;
      if (resp?.error) {
        const textError =
          typeof resp.error === "string"
            ? resp.error
            : resp.error?.message ?? JSON.stringify(resp.error);
        showToast("error", textError);
        return { error: textError };
      }
      showToast("success", "Signed in with GitHub!");
      return resp;
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.message
          ? err.message
          : JSON.stringify(err);
      showToast("error", message);
      return { error: message };
    }
  },
  google: async () => {
    try {
      const resp = await client.signIn.social({ provider: "google" }) as any;
      if (resp?.error) {
        const textError =
          typeof resp.error === "string"
            ? resp.error
            : resp.error?.message ?? JSON.stringify(resp.error);
        showToast("error", textError);
        return { error: textError };
      }
      showToast("success", "Signed in with Google!");
      return resp;
    } catch (err: any) {
      const message =
        typeof err === "string"
          ? err
          : err?.message
          ? err.message
          : JSON.stringify(err);
      showToast("error", message);
      return { error: message };
    }
  },
};
