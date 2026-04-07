import { ClassifiedEntry } from "../types";
import ContextEntry from "./ContextEntry";

interface Props {
  entries: ClassifiedEntry[];
}

export default function ContextViewer({ entries }: Props) {
  return (
    <div className="context-viewer">
      <div className="entry-count">{entries.length} entries</div>
      {entries.map((entry) => (
        <ContextEntry key={entry.index} entry={entry} />
      ))}
    </div>
  );
}
