import { CheckCircle2, ImageIcon, UploadIcon } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import { useState } from "react";
import { useOutletContext } from "react-router";
import {
  PROGRESS_INCREMENT,
  PROGRESS_INTERVAL_MS,
  REDIRECT_DELAY_MS,
} from "../lib/constants";

interface UploadProps {
  onComplete?: (base64: string) => void;
}

const Upload = ({ onComplete }: UploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  const { isSignedIn } = useOutletContext<AuthContext>();

  const processFile = (selectedFile: File) => {
    if (!isSignedIn) return;

    setFile(selectedFile);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      let currentProgress = 0;

      const intervalId = window.setInterval(() => {
        currentProgress = Math.min(currentProgress + PROGRESS_INCREMENT, 100);
        setProgress(currentProgress);

        if (currentProgress >= 100) {
          clearInterval(intervalId);
          window.setTimeout(() => {
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
