import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { field } from "../lib/field";

export default function AuthImage({ id, className }: { id: string; className: string }) {
  const { token } = useAuth();
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    if (!token) return;
    let url: string | undefined;
    let dead = false;
    field.photoUrl(id, token).then((u) => {
      if (dead) URL.revokeObjectURL(u);
      else { url = u; setSrc(u); }
    }).catch(() => {});
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [id, token]);

  return src
    ? <img src={src} alt="Field evidence" className={className} />
    : <div className={`${className} grid place-items-center bg-mint text-xs text-muted`}>Loading photo…</div>;
}