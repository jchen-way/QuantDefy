export type UploadRuntimeMode = "local" | "s3";

export type SavedUpload = {
  fileName: string;
  storagePath: string;
};

export type UploadAdapter = {
  mode: UploadRuntimeMode;
  save(file: File): Promise<SavedUpload>;
  read(fileName: string): Promise<Buffer>;
  remove(fileName: string): Promise<void>;
};
