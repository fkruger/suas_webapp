import React, { useState, useRef, useEffect } from "react";

/* SUASUploader: friendly two-page file uploader
 * – Multi-strategy S3 presign (GET query, GET path, POST JSON)
 * – Healthcheck of storage at PIN time (unless TEST_MODE)
 * – Validates Serial Number before uploads
 * – Inline First/Middle/Last fields, labels above inputs
 * – "Upload All" button when >1 pending files
 * – Thumbnails for images/videos; fallback icons for PDF, text, others
 */

// TODO: make user and admin password hash file, and check that instead of hard-coded PIN
// TODO: set a hash pepper env on server (different for user and admin)
// TODO: make an admin page that allows creating / deleting PINs/passwords.
// TODO: add file exploration tools to admin page
// TODO: add ability to download files from admin page

// ---------- constants ----------
const PIN_CODE = "4321"; 
const TEST_MODE = true;
export const MAX_FILES = 250;
export const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
export const validatePin = (v) => v === PIN_CODE;  //TODO: check password hash file instead

// ---------- presign URL builder ----------
export const buildSignUrl = (filename, mode = "query") => {
  const enc = encodeURIComponent(filename);
  return mode === "path"
    ? `/api/sign/${enc}`
    : `/api/sign?filename=${enc}`;
};

// ---------- fetch signed URL with retries ----------
async function fetchSignedUrl(filename) {
  const attempts = [
    { url: buildSignUrl(filename, "query"), opts: { method: "GET" } },
    { url: buildSignUrl(filename, "path"), opts: { method: "GET" } },
    {
      url: "/api/sign",
      opts: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
      }
    }
  ];
  for (const { url, opts } of attempts) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await res.json()
        : { url: (await res.text()).trim() };
      if (data.url) return data.url;
    } catch {
      // try next
    }
  }
  throw new Error("sign failed");
}

// ---------- main component ----------
export default function SUASUploader() {
  const [step, setStep] = useState("pin");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [failures, setFailures] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    middle: "",
    lastName: "",
    branch: "",
    rank: "",
    serial: "",
    bootCamp: "",
    lastUnit: ""
  });
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  const bytesUsed = files.reduce((sum, f) => sum + f.file.size, 0);

  // Cleanup thumbnails
  useEffect(() => () => files.forEach(f => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl)), [files]);

  // -------- PIN submit & healthcheck --------
  const handlePinSubmit = async () => {
    const now = Date.now();
    if (now < lockUntil) return;
    setPinError("");
    setStorageError("");
    if (!validatePin(pin)) {
      const n = failures + 1;
      setFailures(n);
      const waitMs = Math.min(2 ** n * 1000, 30000);
      setLockUntil(now + waitMs);
      const msg = `Incorrect PIN. Please wait ${Math.round(waitMs/1000)} s.`;
      setPinError(msg);
      alert(msg);
      return;
    }
    if (TEST_MODE) {
      setFailures(0);
      setStep("form");
      return;
    }
    else try {
      const url = await fetchSignedUrl("healthcheck.txt");
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) throw new Error();
      setFailures(0);
      setStep("form");
    } catch {
      const msg = "Backend storage cannot be found. Please contact the administrator.";
      setStorageError(msg);
      alert(msg);
    }
  };

  // -------- Add files --------
  const addFiles = (list) => {
    const incoming = Array.from(list).map(file => {
      let thumbUrl;
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        thumbUrl = URL.createObjectURL(file);
      } else if (file.type === "application/pdf") {
        thumbUrl = "/icons/pdf-icon.png";
      } else if (file.type.startsWith("text/")) {
        thumbUrl = "/icons/text-icon.png";
      } else {
        thumbUrl = "/icons/file-icon.png";
      }
      return { file, status: "pending", progress: 0, thumbUrl };
    });
    const next = [...files, ...incoming];
    if (next.length > MAX_FILES) {
      incoming.forEach(f => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl));
      alert(`Limit is ${MAX_FILES} files per session.`);
      return;
    }
    const total = next.reduce((sum, f) => sum + f.file.size, 0);
    if (total > MAX_BYTES) {
      incoming.forEach(f => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl));
      alert(`Total exceeds ${(MAX_BYTES/1_073_741_824).toFixed(1)} GB.`);
      return;
    }
    setFiles(next);
  };
  const handleDrop = e => { e.preventDefault(); addFiles(e.dataTransfer.files); };
  const openPicker = () => inputRef.current?.click();
  const updateFile = (i, patch) => setFiles(arr => arr.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  // -------- Upload single --------
  const startUpload = async (i) => {
    if (!formData.serial.trim()) {
      alert("Please enter your Serial Number before uploading.");
      updateFile(i, { status: "error" });
      return;
    }
    const item = files[i];
    if (!item || item.status === "uploading") return;
    updateFile(i, { status: "uploading" });
    try {
      const url = await fetchSignedUrl(item.file.name);
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) throw new Error();
      const put = await fetch(url, {
        method: "PUT",
        body: item.file,
        headers: { "Content-Type": item.file.type || "application/octet-stream" }
      });
      if (!put.ok) throw new Error(`upload ${put.status}`);
      updateFile(i, { status: "done", progress: 100 });
    } catch (err) {
      console.error(err);
      const msg = err.message.startsWith("sign")
        ? "Upload service unavailable – please contact administrator."
        : "Upload failed—please try again later.";
      alert(msg);
      updateFile(i, { status: "error" });
    }
  };

  // -------- Upload all & remove --------
  const uploadAll = () => files.forEach((f, i) => f.status === "pending" && startUpload(i));
  const removeFile = i => setFiles(arr => { arr[i].thumbUrl && URL.revokeObjectURL(arr[i].thumbUrl); return arr.filter((_, idx) => idx !== i); });

  const finishSession = () => { files.forEach(f => f.thumbUrl && URL.revokeObjectURL(f.thumbUrl)); setFiles([]); setFormData({ firstName: "", middle: "", lastName: "", branch: "", rank: "", serial: "", bootCamp: "", lastUnit: "" }); setPin(""); setStep("pin"); };

  // ---------- render ----------
  if (step === "pin") {
    const locked = Date.now() < lockUntil;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-xs">
          <label className="block text-center text-lg mb-4">Enter PIN</label>
          {pinError && <div className="mb-2 text-center text-red-600">{pinError}</div>}
          {storageError && <div className="mb-2 text-center text-red-600">{storageError}</div>}
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="w-full p-3 border rounded mb-4 focus:outline-none focus:ring"
          />
          <button
            onClick={handlePinSubmit}
            disabled={locked}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
          >Submit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <header className="mb-6 text-center">
        <img src="/logo.svg" alt="Logo" className="mx-auto h-24" />
      </header>
      {/* Form fields */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex gap-4 mb-4">
          {[["firstName","First Name"],["middle","Middle Name/Initial"],["lastName","Last Name"]].map(([k,l]) => (
            <div key={k} className="flex-1 flex flex-col">
              <label className="mb-1 text-sm font-medium">{l}</label>
              <input
                value={formData[k]}
                onChange={e => setFormData({ ...formData, [k]: e.target.value })}
                className="p-3 border rounded focus:outline-none focus:ring"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[["rank","Rank"],["serial","Serial Number"],["bootCamp","Boot Camp Location"],["lastUnit","Last Unit"]].map(([k,l]) => (
            <div key={k} className="flex flex-col">
              <label className="mb-1 text-sm font-medium">{l}</label>
              <input
                value={formData[k]}
                onChange={e => setFormData({ ...formData, [k]: e.target.value })}
                className="p-3 border rounded focus:outline-none focus:ring"
              />
            </div>
          ))}
          <div className="flex flex-col col-span-2">
            <label className="mb-1 text-sm font-medium">Military Branch</label>
            <select
              value={formData.branch}
              onChange={e => setFormData({ ...formData, branch: e.target.value })}
              className="p-3 border rounded"
            >
              <option value="" disabled>Select branch</option>
              {["Army","Navy","Marine Corps","Air Force","Space Force","Coast Guard"].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* Upload section */}
      <section className="max-w-3xl mx-auto mb-8">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-400 rounded-lg p-6 cursor-pointer mb-4" onClick={openPicker}>
          <p className="mb-2">Drag & drop files here, or click to browse</p>
          <p className="text-sm text-gray-500">{files.length}/{MAX_FILES} files • {(bytesUsed/1_048_576).toFixed(1)} MB</p>
        </div>
        <input type="file" multiple ref={inputRef} onChange={e => addFiles(e.target.files)} className="hidden" />
        {files.filter(f => f.status === "pending").length > 1 && (
          <div className="flex justify-end mb-4">
            <button onClick={uploadAll} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Upload All</button>
          </div>
        )}
        {files.length > 0 && (
          <ul className="mt-6 space-y-4">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between p-3 bg-white rounded shadow-sm">
                <div className="flex items-center gap-4">
                  <img
                    src={f.thumbUrl}
                    alt="thumb"
                    className="w-12 h-12 object-cover rounded"
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = f.file.type === "application/pdf" ? "/icons/pdf-icon.png" : f.file.type.startsWith("text/") ? "/icons/text-icon.png" : "/icons/file-icon.png"; }}
                  />
                  <div>
                    <p>{f.file.name}</p>
                    {f.status === "uploading" && <p className="text-xs text-gray-500">Uploading…</p>}
                    {f.status === "done" && <p className="text-xs text-green-600">Uploaded ✔</p>}
                    {f.status === "error" && <p className="text-xs text-red-600">Error – retry</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {f.status === "pending" ? (
                    <button className="text-blue-600 hover:underline" onClick={() => startUpload(i)}>Upload</button>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                  <button className="text-red-600 hover:underline" onClick={() => removeFile(i)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="text-center">
        <button onClick={finishSession} className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700">Finished</button>
      </div>
    </div>
  );
}

// ---------- tests ----------
/* eslint-disable */
if (typeof describe === "function") {
  const { test, expect } = global;
  test("validatePin", () => { expect(validatePin("4321")).toBe(true); expect(validatePin("0000")).toBe(false); });
  test("buildSignUrl query", () => { expect(buildSignUrl("file.txt")).toBe("/api/sign?filename=file.txt"); });
  test("buildSignUrl path", () => { expect(buildSignUrl("file.txt", "path")).toBe("/api/sign/file.txt"); });
  test("buildSignUrl encodes", () => { expect(buildSignUrl("a b.txt")).toBe("/api/sign?filename=a%20b.txt"); });
}
