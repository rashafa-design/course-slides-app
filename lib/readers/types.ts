export interface ExtractedImage {
  fileName: string;
  data: Buffer;
}

export interface ExtractedSection {
  label: string;
  text: string;
  images: ExtractedImage[];
}

export interface ExtractedContent {
  sections: ExtractedSection[];
}
