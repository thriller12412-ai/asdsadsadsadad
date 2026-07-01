import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/auth.functions";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const getProfileFn = useServerFn(getMyProfile);

  useEffect(() => {
    getProfileFn()
      .then((data) => {
        if (data && data.profile) {
          setUser({ id: data.userId, email: data.email, ...data.profile });
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [getProfileFn]);

  return { session: user ? { user } : null, user, loading };
}

