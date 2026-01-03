<p align="center">
  <img
    src="https://github.com/user-attachments/assets/553ebef6-f6d0-46f8-a944-cd655fdf5378"
    alt="Tailorit logo"
    width="200"
  />
</p>


# Tailorit 
---
**Tailorit** is a Chrome side-panel extension that helps students tailor their resumes to a job description **without changing formatting or fabricating experience**.

Instead of rewriting resumes blindly, Tailorit:
- Preserves the original `.docx` formatting (fonts, spacing, layout)
- Identifies which job-relevant keywords are missing
- Suggests precise, explainable wording improvements
- Shows exactly *what changed and why*

---

## Why Tailorit

Most resume tools either:
- Destroy formatting
- Hallucinate experience
- Rewrite everything with no transparency

Tailorit is built on a single principle:

> **Only change wording when it meaningfully improves alignment — and never touch layout.**

---

## How It Works

### 1. Job Description Extraction
- Automatically extracts the full job description from the active tab (LinkedIn supported)
- Runs inside a Chrome extension content script

### 2. Resume Parsing (Formatting Preserved)
- Accepts resumes as `.docx`
- Parses `word/document.xml` directly
- Extracts text nodes **without altering styles, spacing, or structure**

### 3. Keyword Alignment Analysis
- Compares resume content to top job description keywords
- Computes a match percentage
- Identifies missing but relevant terms

### 4. Safe Text Replacement
- Applies word-level replacements inside existing text runs
- Rebuilds the `.docx` with **identical formatting**
- Outputs a downloadable, tailored resume

---

## Tech Stack

- **Frontend:** React + TypeScript (Vite)
- **Extension:** Chrome Extension (Manifest V3)
- **Document Parsing:** `.docx` XML manipulation
- **Compression:** `fflate`
- **Build Tooling:** Vite + Rollup

---

##  Project Structure

