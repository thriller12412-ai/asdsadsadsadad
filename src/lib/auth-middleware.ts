import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { db } from "./db.server";

// Server middleware: validates the userId cookie from the request and attaches
// { userId, email, role } to context.
export const requireAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const userId = getCookie("userId");
    if (!userId) {
      throw new Response("Unauthorized: No session cookie", { status: 401 });
    }

    // Fetch from local SQLite db
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId) as any;
    if (!profile) {
      throw new Response("Unauthorized: Invalid session", { status: 401 });
    }

    return next({
      context: {
        userId: profile.user_id,
        email: profile.email,
        role: profile.role,
      },
    });
  },
);
