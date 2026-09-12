export interface ExtractedImage {
  fileName: string;
  data: Buffer;
}

export interface ExtractedContent {
  text: string;
  images: ExtractedImage[];
}
