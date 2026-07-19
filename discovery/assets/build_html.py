#!/usr/bin/env python3
"""Build styled HTML versions of the discovery docs (IDM-style document family)."""
import re, subprocess, pathlib, html as H

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = {
 "README":            ("Discovery Package — Index","Full requirements analysis, gap analysis & implementation-ready specification",["18 documents","Traceability BO→FR→BR→GAP→US→TS","Pass 1 · pre-code-audit"]),
 "01-BRD":            ("Business Requirements Document","Business context, objectives, stakeholders, current & future state, scope, risks, success metrics",["BRD-GHOH-001","v1.0","10 objectives"]),
 "02-SRS":            ("Software Requirements Specification","Functional & non-functional requirements with build status, constraints, external interfaces",["SRS-GHOH-001","IEEE 29148-aligned","25 FR groups · 30+ NFRs"]),
 "03-module-analysis":("Module-by-Module Analysis","Every module dissected — inputs, outputs, validations, business rules, edge cases, risks",["12 Tier-A deep dives","16 Tier-B modules"]),
 "04-workflows":      ("Workflow Analysis","17 workflows with happy, alternate, failure and exception paths",["Flow + sequence diagrams","Mermaid, editable"]),
 "05-business-rules": ("Business Rules Catalogue","Trigger · validation · expected result · status for every rule",["~70 rules","10 domains"]),
 "06-gap-analysis":   ("Gap Analysis Report","Prototype vs enterprise-quality: 30 prioritized gaps with recommendations",["S1–S4 severity","MoSCoW rated"]),
 "07-risk-register":  ("Risk Register","32 risks with probability, impact, mitigation and owner",["Top-5 board summary"]),
 "08-ambiguities":    ("Requirement Ambiguities","22 ambiguities — why each matters, interpretations, recommendation, decision required",["Cross-referenced to Question Log"]),
 "09-stakeholder-questions":("Stakeholder Question Log","~70 grouped questions, each with its rationale; ★ marks design blockers",["Workshop-ready","17 groups"]),
 "10-assumptions-register":("Assumptions Register","18 assumptions with impact, validation path and risk if incorrect",[]),
 "11-dependencies-register":("Dependencies Register","Internal, external, OTA, government, messaging, browser and infrastructure dependencies",[]),
 "12-data-model":     ("Data Model & ERD","55-model entity catalogue, relationships, constraints, retention rules",["Schema-extracted","GiST correctness core"]),
 "13-api-analysis":   ("API Analysis","Existing seams, recommended REST surface, webhooks, events, cross-cutting API rules",[]),
 "14-backlog":        ("Product Backlog","9 epics · 45+ stories with Given/When/Then, points, DoR/DoD",["P0 ≈ 67 pts","Jira/ADO-ready"]),
 "15-rtm":            ("Requirement Traceability Matrix","BO → FR/NFR → BR → GAP → US → TS, fully linked",[]),
 "16-test-readiness": ("Testing Readiness","Functional, UAT, security, performance, offline and accessibility scenario catalogue",["100+ scenarios"]),
 "17-roadmap":        ("Roadmap & Delivery Plan","Phase 0–3 aligned to grant quarters, future scope, delivery governance",["Grant-quarter aligned"]),
}

SHELL = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Guest House Ops Hub Discovery</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/doc.css">
</head><body>
<div class="page">
<div class="confbar"><span>MindBit Solutions LLP · ROOT Platform</span><span>Confidential — for the build team</span></div>
<div class="banner">
  <p class="kicker">Guest House Operations Hub · Discovery Package · Doc {num}</p>
  <h1>{title}</h1>
  <p class="sub">{subtitle}</p>
  <div class="chips">{chips}</div>
</div>
<div class="content">
{body}
</div>
<div class="docfooter"><span>© 2026 MindBit Solutions LLP · Shillong, Meghalaya</span><span>{fname}.md is the version-controlled source</span></div>
</div>
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
mermaid.initialize({{startOnLoad:true, theme:"neutral", themeVariables:{{primaryColor:"#e7f5f1",primaryBorderColor:"#0fa68e",lineColor:"#1c4356",fontFamily:"Plus Jakarta Sans, sans-serif"}}}});
</script>
</body></html>"""

TAGS = {
 r"\[FACT[^\]]*\]": '<span class="tag fact">FACT</span>',
 r"\[INFERRED[^\]]*\]": '<span class="tag inferred">INFERRED</span>',
 r"\[REC[^\]]*\]": '<span class="tag rec">REC</span>',
 r"\[OPEN-Q[^\]]*\]": '<span class="tag openq">OPEN-Q</span>',
}

def mermaidize(body: str) -> str:
    # pandoc gfm emits <pre class="mermaid"><code>…</code></pre> or sourceCode divs
    def repl(m):
        code = m.group(1)
        return f'<pre class="mermaid">{code}</pre>'
    body = re.sub(r'<pre class="mermaid"><code>(.*?)</code></pre>', repl, body, flags=re.S)
    body = re.sub(r'<div class="sourceCode"[^>]*><pre class="sourceCode mermaid"><code[^>]*>(.*?)</code></pre></div>',
                  lambda m: f'<pre class="mermaid">{re.sub(r"<[^>]+>","",m.group(1))}</pre>', body, flags=re.S)
    return body

for fname,(title,subtitle,chips) in DOCS.items():
    src = ROOT/f"{fname}.md"
    if not src.exists(): print("MISS",src); continue
    body = subprocess.run(["pandoc","-f","gfm","-t","html5",str(src)],capture_output=True,text=True).stdout
    body = mermaidize(body)
    for pat,rep in TAGS.items():
        body = re.sub(pat, rep, body)
    body = body.replace("../README.html","README.html")
    # link .md → .html for intra-package links
    body = re.sub(r'href="((?:\d\d-[\w-]+|README))\.md"', r'href="\1.html"', body)
    num = fname.split("-")[0] if fname[0].isdigit() else "00"
    chipshtml = "".join(f'<span class="chip">{H.escape(c)}</span>' for c in chips)
    out = SHELL.format(title=H.escape(title),subtitle=H.escape(subtitle),chips=chipshtml,body=body,fname=fname,num=num)
    (ROOT/f"{fname}.html").write_text(out,encoding="utf-8")
    print("OK",fname)
