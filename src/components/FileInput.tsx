import { useState, useCallback, DragEvent } from "react";

interface Props {
  onParse: (raw: string) => void;
}

export default function FileInput({ onParse }: Props) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onParse(reader.result);
        }
      };
      reader.readAsText(file);
    },
    [onParse]
  );

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  return (
    <div className="file-input-container">
      <div
        className={`drop-zone ${dragging ? "drop-zone--active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <p>Drop a context JSON file here</p>
        <label className="file-label">
          Or choose a file
          <input
            type="file"
            accept=".json,.txt"
            onChange={handleFileChange}
            hidden
          />
        </label>
      </div>

      <div className="paste-section">
        <hr className="divider" />
        <p className="paste-label">Or paste JSON below</p>
        <textarea
          className="paste-area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='[{"role": "system", "content": "..."}]'
          rows={8}
        />
        <button
          className="parse-btn"
          onClick={() => onParse(text)}
          disabled={!text.trim()}
        >
          Parse
        </button>
      </div>
    </div>
  );
}
