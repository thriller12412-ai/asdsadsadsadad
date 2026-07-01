import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db.server";
import { v4 as uuidv4 } from "uuid";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(context.userId) as any;
    return {
      userId: context.userId,
      email: context.email,
      profile,
      roles: [profile?.role || "candidate"],
    };
  });

const RoleInput = z.object({ role: z.enum(["candidate", "recruiter"]) });

export const setMyRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => RoleInput.parse(d))
  .handler(async ({ data, context }) => {
    db.prepare("UPDATE profiles SET role = ? WHERE user_id = ?").run(data.role, context.userId);
    return { ok: true, role: data.role };
  });

const LoginInput = z.object({ email: z.string().email(), role: z.enum(["candidate", "recruiter"]).optional() });

export const mockLogin = createServerFn({ method: "POST" })
  .validator((d: unknown) => LoginInput.parse(d))
  .handler(async ({ data }) => {
    // Check if user exists
    let profile = db.prepare("SELECT * FROM profiles WHERE email = ?").get(data.email) as any;
    if (!profile) {
      const id = uuidv4();
      const role = data.role || "candidate";
      const name = data.email.split("@")[0];
      db.prepare("INSERT INTO profiles (user_id, email, name, role) VALUES (?, ?, ?, ?)").run(id, data.email, name, role);
      profile = { user_id: id, email: data.email, role, name };
    }
    
    // Set cookie
    setCookie("userId", profile.user_id, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    
    return { ok: true };
  });

export const mockLogout = createServerFn({ method: "POST" })
  .handler(async () => {
    setCookie("userId", "", { maxAge: 0, path: "/" });
    return { ok: true };
  });
