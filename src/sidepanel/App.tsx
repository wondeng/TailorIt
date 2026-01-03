import { useEffect, useMemo, useState } from "react";
import { parseDocx, applyReplacements, buildDocx, downloadDocx, type ParsedDocx, type ReplaceOp } from "./docx";


type JobData = {
  url: string;
  title: string;
  description: string;
};

const STOPWORDS = new Set([
  "the","and","for","with","you","your","are","our","we","will","a","an","to","of","in",
  "on","is","as","at","by","or","from","be","this","that","it","its","their","they",
  "them","can","may","must","should","have","has","had","into","about","over","more",
  "less","such","than","also"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

function topKeywords(text: string, n = 15): string[] {
  const freq = new Map<string, number>();
  for (const tok of tokenize(text)) freq.set(tok, (freq.get(tok) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export default function App() {
  const [docx, setDocx] = useState<ParsedDocx | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [status, setStatus] = useState<string>("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resume, setResume] = useState("");
  const [ops, setOps] = useState<ReplaceOp[]>([{ find: "", replace: "" }]);

  const onUploadResume = async (file: File) => {
    setResumeFileName(file.name);
    const bytes = await file.arrayBuffer();
    const parsed = parseDocx(bytes);
    setDocx(parsed);
    setResume(parsed.plainText);
  };
  const downloadUpdated = () => {
    if (!docx) return;

    const cleaned = ops.filter(o => o.find.trim());
    const updated = applyReplacements(docx, cleaned);

    const out = buildDocx(updated);

    const name =
      (resumeFileName || "resume").replace(/\.docx$/i, "") + "_tailored.docx";

    downloadDocx(out, name);
  };




  // Listen for extracted JD
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "JD_EXTRACTED") {
        setJob(msg.payload);
        setStatus("Job description extracted.");
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const results = useMemo(() => {
    if (!job?.description) return null;
    const jdKeywords = topKeywords(job.description, 25);
    const resumeTokens = new Set(tokenize(resume));

    const missing = jdKeywords.filter(k => !resumeTokens.has(k));
    const overlap = jdKeywords.length - missing.length;
    const matchPct = jdKeywords.length ? Math.round((overlap / jdKeywords.length) * 100) : 0;

    return { jdKeywords, missing: missing.slice(0, 15), matchPct };
  }, [job, resume]);

  const extractAgain = async () => {
    setStatus("Extracting...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return setStatus("No active tab found.");
    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JD" });
  };

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>Job Data</h3>
          <button onClick={extractAgain}>Extract JD again</button>
        </div>
        <div className="small"><b>URL:</b> {job?.url ?? "—"}</div>
        <div className="small"><b>Title:</b> {job?.title ?? "—"}</div>
        <div className="small" style={{ marginTop: 8 }}>
          <b>Description (preview):</b>
          <div style={{ whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto", marginTop: 6 }}>
            {job?.description ?? "—"}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Resume (.docx)</h3>

        <div className="small" style={{ marginBottom: 8 }}>
          Upload your resume as <b>.docx</b> so Tailorit can keep formatting unchanged.
        </div>

        <input
          type="file"
          accept=".docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadResume(f);
            e.currentTarget.value = "";
          }}
        />

        <div className="small" style={{ marginTop: 8 }}>
          <b>Loaded:</b> {resumeFileName || "—"}
        </div>
        <div className="small" style={{ marginTop: 12 }}><b>Text-only edits (safe):</b></div>

        <input
          style={{ width: "100%", marginTop: 6 }}
          placeholder="Find (exact text)"
          value={ops[0]?.find ?? ""}
          onChange={(e) => setOps([{ ...ops[0], find: e.target.value }])}
        />

        <input
          style={{ width: "100%", marginTop: 6 }}
          placeholder="Replace with"
          value={ops[0]?.replace ?? ""}
          onChange={(e) => setOps([{ ...ops[0], replace: e.target.value }])}
        />

        <button
          style={{ marginTop: 10, width: "100%" }}
          disabled={!docx}
          onClick={downloadUpdated}
        >
          Download updated .docx
        </button>

        <div className="small" style={{ marginTop: 8 }}>
          <b>Extracted text preview:</b>
          <div style={{ whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", marginTop: 6 }}>
            {resume || "—"}
          </div>
        </div>
      </div>


      <div className="card">
        <h3>Tailoring Results</h3>
        {results ? (
          <>
            <div className="small"><b>Match:</b> {results.matchPct}% (based on top JD keywords)</div>
            <div className="small" style={{ marginTop: 8 }}><b>Missing keywords:</b> {results.missing.join(", ") || "None"}</div>

          </>
        ) : (
          <div className="small">Extract a job description to see results.</div>
        )}
        {status && <div className="small" style={{ marginTop: 8 }}>{status}</div>}
      </div>
    </div>
  );
}
