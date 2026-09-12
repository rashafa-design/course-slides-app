export type UploadMode = "rebuild_slides" | "book_chapter" | "syllabus_excerpts";
export type DeckStyle = "plain" | "branded";
export type DeckStatus = "uploaded" | "processing" | "ready" | "failed";

export const MODE_LABELS: Record<UploadMode, string> = {
  rebuild_slides: "Rebuild existing slides",
  book_chapter: "Turn a book chapter into slides",
  syllabus_excerpts: "Syllabus + textbook excerpts",
};

export const STATUS_LABELS: Record<DeckStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export interface UploadRow {
  id: string;
  user_id: string;
  mode: UploadMode;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

export interface SlideContent {
  title: string;
  bullets: string[];
  speakerNotes: string;
  discussionQuestions: string[];
  // Which source sections (e.g. "chapter.pptx :: Slide 3") the AI says this
  // slide drew from - filled in by the AI's own response.
  sourceLabels?: string[];
  // Storage paths for images tied to those source sections - filled in by
  // our own code after the AI responds, never by the AI itself.
  images?: string[];
}

export interface DeckRow {
  id: string;
  user_id: string;
  upload_ids: string[];
  mode: UploadMode;
  style: DeckStyle;
  instructions: string | null;
  status: DeckStatus;
  deck_file_path: string | null;
  error_message: string | null;
  extracted_text: string | null;
  extracted_image_paths: string[];
  slides_json: SlideContent[] | null;
  created_at: string;
  updated_at: string;
}
