import { CheckCircle2, ImageIcon, UploadIcon } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import {
  PROGRESS_INCREMENT,
  PROGRESS_INTERVAL_MS,
  REDIRECT_DELAY_MS,
} from "../lib/constants";

interface UploadProps {
  onComplete?: (base64: string) => void;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

const isAllowedFileType = (file: File) => {
  if (ALLOWED_MIME_TYPES.has(file.type)) return true;

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
};

const Upload = ({ onComplete }: UploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { isSignedIn } = useOutletContext<AuthContext>();

  const timersRef = useRef<{
    intervalId: number | null;
    timeoutId: number | null;
  }>({ intervalId: null, timeoutId: null });

  const isMountedRef = useRef(true);

  const clearTimers = () => {
    const { intervalId, timeoutId } = timersRef.current;

    if (intervalId !== null) {
      window.clearInterval(intervalId);
      timersRef.current.intervalId = null;
    }

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timersRef.current.timeoutId = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, []);

  const processFile = (selectedFile: File) => {
    if (!isSignedIn) return;

    clearTimers();
    setError(null);

    if (!isAllowedFileType(selectedFile)) {
      setError("Please upload a JPG or PNG file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError("File exceeds the 50 MB limit. Please choose a smaller file.");
      return;
    }

    setFile(selectedFile);
    setProgress(0);

    const reader = new FileReader();
    reader.onerror = () => {
      if (!isMountedRef.current) return;

      clearTimers();
      setFile(null);
      setProgress(0);
      setError("Unable to read this file. Please try again with a JPG or PNG.");
    };

    reader.onload = () => {
      if (!isMountedRef.current) return;

      const base64 = reader.result as string;
      let currentProgress = 0;

      timersRef.current.intervalId = window.setInterval(() => {
        if (!isMountedRef.current) return;

        currentProgress = Math.min(currentProgress + PROGRESS_INCREMENT, 100);
        setProgress(currentProgress);

        if (currentProgress >= 100) {
          clearTimers();

          timersRef.current.timeoutId = window.setTimeout(() => {
            if (!isMountedRef.current) return;
            onComplete?.(base64);
          }, REDIRECT_DELAY_MS);
        }
      }, PROGRESS_INTERVAL_MS);
    };

    reader.readAsDataURL(selectedFile);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isSignedIn) return;

    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isSignedIn) return;
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isSignedIn) return;

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  return (
    <div className="upload">
      {!file ? (
        <div
          className={`dropzone ${isDragging ? "is-dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="drop-input"
            accept=".jpg,.jpeg,.png"
            disabled={!isSignedIn}
            onChange={handleChange}
          />

          <div className="drop-content">
            <div className="drop-icon">
              <UploadIcon size={20} />
            </div>
            <p>
              {isSignedIn
                ? "Click to upload or just drag and drop"
                : "Sign in or Sign up with Puter to upload"}
            </p>
            <p className="help">Maximum file size 50 MB.</p>
            {error ? (
              <p className="help text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="upload-status">
          <div className="status-content">
            <div className="status-icon">
              {progress === 100 ? (
                <CheckCircle2 className="check" />
              ) : (
                <ImageIcon className="image" />
              )}
            </div>

            <h3>{file.name}</h3>

            <div className="progress">
              <div className="bar" style={{ width: `${progress}%` }} />
            </div>

            <p className="status-text">
              {progress < 100 ? "Analyzing Floor Plan..." : "Redirecting..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
