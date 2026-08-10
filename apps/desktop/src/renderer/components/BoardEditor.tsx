import Editor from "@monaco-editor/react";

export function BoardEditor({
  source,
  onChange,
}: {
  source: string;
  onChange(source: string): void;
}) {
  return (
    <Editor
      aria-label="Board YAML"
      height="100%"
      language="yaml"
      theme="vs-dark"
      value={source}
      onChange={(value) => onChange(value ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbersMinChars: 3,
        padding: { top: 12 },
        scrollBeyondLastLine: false,
      }}
    />
  );
}
