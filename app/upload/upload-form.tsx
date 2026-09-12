"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MODE_LABELS, type DeckStyle, type UploadMode } from "@/lib/types";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB per file, generous for slides/chapters
const ACCEPTED = ".pptx,.pdf,.docx,.txt";

export default function UploadForm({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<UploadMode>("rebuild_slides");
  const [style, setStyle] = useState<DeckStyle>("plain");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError("Choose at least one file first.");
      return;
    }

    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is bigger than 25MB — try a smaller file for now.`);
      return;
    }

    setSubmitting(true);

    const uploadIds: string[] = [];

    for (const file of files) {
      const path = `${userId}/${crypto.randomUUID()}-${file.name}`;

      const { error: storageError } = await supabase.storage
        .from("course-files")
        .upload(path, file);

      if (storageError) {
        setError(`Couldn't upload "${file.name}": ${storageError.message}`);
        setSubmitting(false);
        return;
      }

      const { data: uploadRow, error: insertError } = await supabase
        .from("uploads")
        .insert({
          user_id: userId,
          mode,
          file_name: file.name,
          file_path: path,
          file_type: file.type || file.name.split(".").pop() || "unknown",
        })
        .select("id")
        .single();

      if (insertError || !uploadRow) {
        setError(insertError?.message ?? "Something went wrong saving that file.");
        setSubmitting(false);
        return;
      }

      uploadIds.push(uploadRow.id as string);
    }

    const { error: deckError } = await supabase.from("decks").insert({
      user_id: userId,
      upload_ids: uploadIds,
      mode,
      style,
      status: "uploaded",
    });

    if (deckError) {
      setError(deckError.message);
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">What are you uploading?</legend>
        {(Object.keys(MODE_LABELS) as UploadMode[]).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              value={key}
              checked={mode === key}
              onChange={() => setMode(key)}
            />
            {MODE_LABELS[key]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="files" className="text-sm font-medium text-gray-700">
          File(s) — .pptx, .pdf, .docx, or .txt
        </label>
        <input
          id="files"
          type="file"
          multiple
          accept={ACCEPTED}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm"
        />
        {files.length > 0 && (
          <ul className="mt-1 text-xs text-gray-500">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">Visual style</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="style"
            value="plain"
            checked={style === "plain"}
            onChange={() => setStyle("plain")}
          />
          Plain and simple
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="style"
            value="branded"
            checked={style === "branded"}
            onChange={() => setStyle("branded")}
          />
          Consistent branded template
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {submitting ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
