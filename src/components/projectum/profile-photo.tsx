"use client";

// The profile picture at the top of Settings' left column: the photo, or
// initials until there is one, with Upload (Change once there is a photo)
// and Remove below it. The centre square of the image is kept, 256px
// across, on the account (profile-store.ts), and the sidebar's
// profile shows the same picture.
// The hidden file input takes the files; the button is what gets focus.

import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { copy } from "@/content/copy";
import { initials } from "@/lib/initials";
import { useAccount } from "@/lib/account";
import { useAvatar } from "@/components/projectum/profile-store";
import { readAvatar } from "@/components/projectum/read-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const P = copy.projectum.settingsPage;

export function ProfilePhoto() {
  const { name } = useAccount();
  const [src, setSrc] = useAvatar();
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const ids = React.useId();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(P.photoErrors.type);
      return;
    }
    let image: string;
    try {
      image = await readAvatar(file);
    } catch {
      setError(P.photoErrors.read);
      return;
    }
    try {
      await setSrc(image);
      setError(null);
    } catch {
      setError(P.photoErrors.save);
    }
  };

  return (
    <div className="grid justify-items-start gap-3">
      <Avatar data-profile-photo="" className="size-24">
        {src && <AvatarImage src={src} alt="" />}
        <AvatarFallback className="text-2xl">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="grid gap-2">
        <input
          ref={fileRef}
          type="file"
          tabIndex={-1}
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label={P.photoLabel}
          className="sr-only"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-describedby={error ? `${ids}-error` : undefined}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus data-icon="inline-start" />
            {src ? P.photoChange : P.photoUpload}
          </Button>
          {src && (
            <Button type="button" variant="ghost" size="sm" onClick={() => void setSrc(null).catch(() => setError(P.photoErrors.save))}>
              <Trash2 data-icon="inline-start" />
              {P.photoRemove}
            </Button>
          )}
        </div>
        {error && (
          <p id={`${ids}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
