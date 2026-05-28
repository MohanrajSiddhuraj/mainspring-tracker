// ===== MAINSPRING TRACKER — Soft Light Mode (with Rejected Defects + Extended Weeks + Decimal Leaves) =====
// Save as "server.js" in your mainspring-tracker folder
// IMPORTANT: Run this SQL in Supabase first (to create the new rejected_defects table):
//
// CREATE TABLE IF NOT EXISTS rejected_defects (
//   id BIGSERIAL PRIMARY KEY,
//   entry_id BIGINT NOT NULL REFERENCES mainspring_entries(id) ON DELETE CASCADE,
//   project TEXT NOT NULL,
//   jira_id TEXT,
//   issue_summary TEXT,
//   reason TEXT,
//   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
// CREATE INDEX IF NOT EXISTS idx_rejected_entry ON rejected_defects(entry_id);
// ALTER TABLE rejected_defects ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Allow all operations on rejected_defects" ON rejected_defects FOR ALL USING (true) WITH CHECK (true);
//
// Run: node server.js
// Visit: http://localhost:3000

require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const SUB_TEAMS = ["Axiom", "Allegro", "Hydra/NA Capture", "IMOS"];
const PROJECTS = ["FOS", "MOS", "Pluto"];

// ===== WEEK GENERATOR =====
function generateWeeks(startYear, startMonth, endYear, endMonth) {
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const weeks = [];
  let date = new Date(startYear, startMonth, 1);
  const endDate = new Date(endYear, endMonth + 1, 0);

  while (date.getDay() !== 1) date.setDate(date.getDate() + 1);

  const weekCountByMonth = {};

  while (date <= endDate) {
    const monday = new Date(date);
    const friday = new Date(date);
    friday.setDate(friday.getDate() + 4);

    const monthKey = `${friday.getFullYear()}-${friday.getMonth()}`;
    weekCountByMonth[monthKey] = (weekCountByMonth[monthKey] || 0) + 1;
    const weekNum = String(weekCountByMonth[monthKey]).padStart(2, "0");
    const monthName = monthNames[friday.getMonth()];
    const year = friday.getFullYear();

    const formatDate = d => `${String(d.getDate()).padStart(2, "0")} ${monthNames[d.getMonth()].substring(0,3)}`;
    const label = `${monthName} ${year} - Week ${weekNum} (${formatDate(monday)} - ${formatDate(friday)})`;

    weeks.push({
      label,
      startDate: monday.toISOString().split("T")[0],
      endDate: friday.toISOString().split("T")[0]
    });

    date.setDate(date.getDate() + 7);
  }

  return weeks.reverse();
}

const today = new Date();
const startMonth = today.getMonth() - 6;
const startYear = today.getFullYear() + (startMonth < 0 ? -1 : 0);
const adjustedStartMonth = (startMonth + 12) % 12;
// CHANGED: Now generates weeks from 6 months ago through end of December 2026
const WEEKS = generateWeeks(adjustedStartMonth === 0 ? startYear : startYear,
                             adjustedStartMonth, 2026, 11);

// ===== STYLES =====
function getStyles() {
  return `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fafafa;color:#2d3748;min-height:100vh}
a{color:#5b6ee1;text-decoration:none}a:hover{text-decoration:underline}

.topbar{background:#ffffff;padding:14px 30px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.topbar .logo{font-size:20px;font-weight:bold;color:#5b6ee1}
.topbar nav{display:flex;gap:8px}
.topbar nav a{color:#718096;font-size:14px;padding:8px 16px;border-radius:6px;transition:all .2s;font-weight:500}
.topbar nav a:hover{color:#5b6ee1;background:#ebf4ff;text-decoration:none}
.topbar nav a.active{color:#fff;background:#5b6ee1;text-decoration:none}

.container{max-width:1400px;margin:0 auto;padding:25px 20px}
h1{font-size:24px;margin-bottom:18px;color:#2d3748;font-weight:600}
h2{font-size:18px;margin-bottom:14px;color:#2d3748;font-weight:600}
h3{font-size:15px;margin-bottom:10px;color:#5b6ee1;border-bottom:1px solid #e2e8f0;padding-bottom:6px;font-weight:600}

.card{background:#ffffff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04)}

table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e2e8f0;background:#f7fafc;font-weight:600}
td{padding:10px 12px;border-bottom:1px solid #f7fafc;font-size:13px;color:#2d3748}
tr:hover td{background:#fafafa}

.btn{display:inline-block;padding:9px 20px;border-radius:8px;font-size:14px;font-weight:600;border:none;cursor:pointer;text-decoration:none;color:#fff;transition:all .2s}
.btn-primary{background:#5b6ee1}.btn-primary:hover{background:#4c5bc4}
.btn-success{background:#7fb069}.btn-success:hover{background:#6a9858}
.btn-small{padding:5px 12px;font-size:12px}
.btn-danger{background:#ec7372}.btn-danger:hover{background:#d35d5c}

.form-group{margin-bottom:14px}
.form-group label{display:block;margin-bottom:5px;font-size:13px;color:#4a5568;font-weight:600}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 14px;font-size:13px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;color:#2d3748;outline:none;transition:border-color .2s}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#5b6ee1;box-shadow:0 0 0 3px rgba(91,110,225,0.1)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.form-row-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px}
.form-row-5{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:10px}
.form-row-6{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 1fr;gap:10px}

.empty-state{text-align:center;padding:40px;color:#a0aec0;font-size:15px}

.expanded-row{background:#f7fafc}
.expanded-row td{padding:10px 12px;font-size:12px;color:#4a5568;border-bottom:1px solid #e2e8f0}

.success-msg{background:#e6f4ea;color:#5b8a47;padding:12px 16px;border-radius:8px;margin-bottom:16px;border-left:4px solid #7fb069}

.copy-btn{background:#5b6ee1;padding:8px 14px;border-radius:6px;color:#fff;border:none;cursor:pointer;font-size:12px;margin-left:8px;font-weight:600}
.copy-btn:hover{background:#4c5bc4}

.section{background:#fafafa;padding:14px;border-radius:8px;margin-bottom:14px;border:1px solid #e2e8f0}
.section-title{color:#5b6ee1;font-size:14px;font-weight:bold;margin-bottom:10px}
.subsection-title{color:#718096;font-size:12px;margin-top:10px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.field-label{font-size:11px;color:#718096;margin-bottom:3px;font-weight:600}
.compact-input{padding:7px 10px !important;font-size:12px !important}

.proj-collapse{margin-bottom:14px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.proj-collapse[open]{border-color:#5b6ee1;box-shadow:0 2px 8px rgba(91,110,225,0.08)}
.proj-summary{cursor:pointer;padding:14px 18px;background:#f7fafc;display:flex;align-items:center;gap:12px;list-style:none;transition:background .2s}
.proj-summary::-webkit-details-marker{display:none}
.proj-summary:hover{background:#ebf4ff}
.proj-collapse[open] .proj-summary{background:#ebf4ff;border-bottom:1px solid #e2e8f0}
.proj-collapse[open] .arrow{transform:rotate(90deg)}
.arrow{color:#5b6ee1;font-size:14px;transition:transform .2s;display:inline-block}
.proj-name{color:#2d3748;font-size:16px;font-weight:bold;flex:1}
.proj-hint{color:#a0aec0;font-size:12px;font-style:italic}
.proj-collapse[open] .proj-hint{display:none}
.proj-content{padding:18px}

.totals-row{background:#ebf4ff !important;font-weight:bold}
.totals-row td{color:#4c51bf !important;font-weight:bold}

.delete-link{color:#ec7372;font-size:11px;margin-left:6px}
.delete-link:hover{color:#d35d5c}

.action-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px}
</style>`;
}

function getNav(active) {
  return `<div class="topbar">
    <div class="logo">MainSpring Tracker</div>
    <nav>
      <a href="/" class="${active === 'submit' ? 'active' : ''}">Submit Data</a>
      <a href="/dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
    </nav>
  </div>`;
}

// ===== HOME PAGE — DATA ENTRY FORM =====
app.get("/", (req, res) => {
  const weekOpts = WEEKS.map(w => `<option value="${w.label}|${w.startDate}|${w.endDate}">${w.label}</option>`).join("");

  const projectSections = PROJECTS.map(proj => `
    <details class="proj-collapse">
      <summary class="proj-summary">
        <span class="arrow">▶</span>
        <span class="proj-name">${proj}</span>
        <span class="proj-hint">Click to expand</span>
      </summary>
      <div class="proj-content">

      <div class="section">
        <div class="section-title">Resources, Leaves & Requirements</div>
        <div class="form-row-3">
          <div class="form-group">
            <label>Resource Count</label>
            <input class="compact-input" type="text" name="${proj}_resource_count" placeholder="e.g. 01" />
          </div>
          <div class="form-group">
            <label>Activity</label>
            <input class="compact-input" type="text" name="${proj}_resource_activity" placeholder="e.g. Test Design" />
          </div>
          <div class="form-group">
            <label>Resource Names</label>
            <input class="compact-input" type="text" name="${proj}_resource_names" placeholder="e.g. Mohan, Priya" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>No. of Leaves (supports half-days like 0.5, 1.5)</label>
            <input class="compact-input" type="number" name="${proj}_leaves" min="0" step="0.5" value="0" />
          </div>
          <div class="form-group">
            <label>No. of Requirements</label>
            <input class="compact-input" type="number" name="${proj}_requirements" min="0" value="0" />
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Functional Testing</div>
        <div class="subsection-title">Test Design</div>
        <div class="form-row-6">
          <div class="form-group"><div class="field-label">High TCs</div><input class="compact-input" type="number" name="${proj}_ft_design_high_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High Time (hrs)</div><input class="compact-input" type="number" name="${proj}_ft_design_high_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Med TCs</div><input class="compact-input" type="number" name="${proj}_ft_design_medium_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Med Time (hrs)</div><input class="compact-input" type="number" name="${proj}_ft_design_medium_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Low TCs</div><input class="compact-input" type="number" name="${proj}_ft_design_low_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low Time (hrs)</div><input class="compact-input" type="number" name="${proj}_ft_design_low_time" min="0" step="0.5" value="0" /></div>
        </div>
        <div class="subsection-title">Test Execution</div>
        <div class="form-row-6">
          <div class="form-group"><div class="field-label">High TCs</div><input class="compact-input" type="number" name="${proj}_ft_exec_high_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High Time (hrs)</div><input class="compact-input" type="number" name="${proj}_ft_exec_high_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Med TCs</div><input class="compact-input" type="number" name="${proj}_ft_exec_medium_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Med Time (hrs)</div><input class="compact-input" type="number" name="${proj}_ft_exec_medium_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Low TCs</div><input class="compact-input" type="number" name="${proj}_ft_exec_low_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low Time (hrs)</div><input class="compact-input" type="number" name="${proj}_ft_exec_low_time" min="0" step="0.5" value="0" /></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Regression Testing</div>
        <div class="subsection-title">Test Design</div>
        <div class="form-row-6">
          <div class="form-group"><div class="field-label">High TCs</div><input class="compact-input" type="number" name="${proj}_rt_design_high_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High Time (hrs)</div><input class="compact-input" type="number" name="${proj}_rt_design_high_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Med TCs</div><input class="compact-input" type="number" name="${proj}_rt_design_medium_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Med Time (hrs)</div><input class="compact-input" type="number" name="${proj}_rt_design_medium_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Low TCs</div><input class="compact-input" type="number" name="${proj}_rt_design_low_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low Time (hrs)</div><input class="compact-input" type="number" name="${proj}_rt_design_low_time" min="0" step="0.5" value="0" /></div>
        </div>
        <div class="subsection-title">Test Execution</div>
        <div class="form-row-6">
          <div class="form-group"><div class="field-label">High TCs</div><input class="compact-input" type="number" name="${proj}_rt_exec_high_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High Time (hrs)</div><input class="compact-input" type="number" name="${proj}_rt_exec_high_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Med TCs</div><input class="compact-input" type="number" name="${proj}_rt_exec_medium_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Med Time (hrs)</div><input class="compact-input" type="number" name="${proj}_rt_exec_medium_time" min="0" step="0.5" value="0" /></div>
          <div class="form-group"><div class="field-label">Low TCs</div><input class="compact-input" type="number" name="${proj}_rt_exec_low_tcs" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low Time (hrs)</div><input class="compact-input" type="number" name="${proj}_rt_exec_low_time" min="0" step="0.5" value="0" /></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Defects</div>
        <div class="subsection-title">Functional Defects</div>
        <div class="form-row-5">
          <div class="form-group"><div class="field-label">Critical</div><input class="compact-input" type="number" name="${proj}_func_defect_critical" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High</div><input class="compact-input" type="number" name="${proj}_func_defect_high" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Medium</div><input class="compact-input" type="number" name="${proj}_func_defect_medium" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low</div><input class="compact-input" type="number" name="${proj}_func_defect_low" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Rejected</div><input class="compact-input rejected-input" type="number" name="${proj}_func_defect_rejected" data-project="${proj}" min="0" value="0" /></div>
        </div>

        <div class="rejected-section" id="rejected-${proj}" style="display:none;background:#fff5e6;border:1px solid #f0a04b;border-radius:8px;padding:14px;margin-top:10px">
          <div class="section-title" style="color:#c2682a">Rejected Defects Details — ${proj}</div>
          <p style="font-size:12px;color:#718096;margin-bottom:10px">Please provide details for each rejected defect. The number of rows below should match the Rejected count entered above.</p>
          <div id="rejected-rows-${proj}"></div>
        </div>

        <div class="subsection-title">Regression Defects</div>
        <div class="form-row-4">
          <div class="form-group"><div class="field-label">Critical</div><input class="compact-input" type="number" name="${proj}_reg_defect_critical" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High</div><input class="compact-input" type="number" name="${proj}_reg_defect_high" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Medium</div><input class="compact-input" type="number" name="${proj}_reg_defect_medium" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low</div><input class="compact-input" type="number" name="${proj}_reg_defect_low" min="0" value="0" /></div>
        </div>
        <div class="subsection-title">Production Defects</div>
        <div class="form-row-4">
          <div class="form-group"><div class="field-label">Critical</div><input class="compact-input" type="number" name="${proj}_prod_defect_critical" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">High</div><input class="compact-input" type="number" name="${proj}_prod_defect_high" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Medium</div><input class="compact-input" type="number" name="${proj}_prod_defect_medium" min="0" value="0" /></div>
          <div class="form-group"><div class="field-label">Low</div><input class="compact-input" type="number" name="${proj}_prod_defect_low" min="0" value="0" /></div>
        </div>
      </div>
      </div>
    </details>
  `).join("");

  const successMsg = req.query.saved === "1" ? `<div class="success-msg">✓ Data submitted successfully! Go to Dashboard to view consolidated data.</div>` : "";

  res.send(`<!DOCTYPE html><html><head><title>Submit — MainSpring Tracker</title>${getStyles()}</head><body>
    ${getNav("submit")}
    <div class="container">
      <h1>Submit Weekly Data</h1>
      ${successMsg}
      <div class="card">
        <form action="/submit" method="POST">
          <div class="form-row-3">
            <div class="form-group">
              <label>Select Week *</label>
              <select name="week" required>
                <option value="">-- Select Week --</option>
                ${weekOpts}
              </select>
            </div>
            <div class="form-group">
              <label>Sub-Team *</label>
              <input type="text" name="sub_team" placeholder="e.g. Axiom, Allegro, Hydra/NA Capture, IMOS" required />
            </div>
            <div class="form-group">
              <label>Your Name *</label>
              <input type="text" name="submitted_by" placeholder="Enter your name" required />
            </div>
          </div>
          <p style="color:#718096;font-size:13px;margin-bottom:18px">Fill in only the projects you worked on. Leave others as 0.</p>
          <div style="margin-bottom:14px;display:flex;gap:10px">
            <button type="button" onclick="toggleAll(true)" class="btn btn-small" style="background:#7fb069">Expand All</button>
            <button type="button" onclick="toggleAll(false)" class="btn btn-small" style="background:#a0aec0">Collapse All</button>
          </div>
          ${projectSections}
          <button type="submit" class="btn btn-primary" style="width:200px;margin-top:10px">Submit Data</button>
        </form>
      </div>
    </div>
    <script>
      function toggleAll(open) {
        document.querySelectorAll('.proj-collapse').forEach(d => d.open = open);
      }

      function buildRejectedRows(project, count) {
        const container = document.getElementById('rejected-rows-' + project);
        const section = document.getElementById('rejected-' + project);

        if (count <= 0) {
          section.style.display = 'none';
          container.innerHTML = '';
          return;
        }

        section.style.display = 'block';
        const existing = [];
        container.querySelectorAll('.rejected-row').forEach((row, idx) => {
          existing[idx] = {
            jira: row.querySelector('[data-field=jira]').value,
            summary: row.querySelector('[data-field=summary]').value,
            reason: row.querySelector('[data-field=reason]').value
          };
        });

        let html = '';
        for (let i = 0; i < count; i++) {
          const e = existing[i] || { jira: '', summary: '', reason: '' };
          html += '<div class="rejected-row" style="background:#fff;padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid #ece6dc">'
            + '<div style="font-size:11px;font-weight:600;color:#c2682a;margin-bottom:6px">Rejected Defect #' + (i+1) + '</div>'
            + '<div style="display:grid;grid-template-columns:80px 1fr 2fr 2fr;gap:8px">'
            + '<div class="form-group" style="margin-bottom:0"><div class="field-label">Project</div>'
            + '<input class="compact-input" type="text" name="rejected_' + project + '_' + i + '_project" value="' + project + '" /></div>'
            + '<div class="form-group" style="margin-bottom:0"><div class="field-label">JIRA ID *</div>'
            + '<input class="compact-input" type="text" name="rejected_' + project + '_' + i + '_jira" data-field="jira" placeholder="e.g. PROJ-1234" value="' + e.jira + '" required /></div>'
            + '<div class="form-group" style="margin-bottom:0"><div class="field-label">Issue Summary *</div>'
            + '<input class="compact-input" type="text" name="rejected_' + project + '_' + i + '_summary" data-field="summary" placeholder="Brief description of the issue" value="' + e.summary + '" required /></div>'
            + '<div class="form-group" style="margin-bottom:0"><div class="field-label">Reason for Rejection *</div>'
            + '<input class="compact-input" type="text" name="rejected_' + project + '_' + i + '_reason" data-field="reason" placeholder="e.g. Duplicate, Not reproducible" value="' + e.reason + '" required /></div>'
            + '</div></div>';
        }
        container.innerHTML = html;
      }

      document.querySelectorAll('.rejected-input').forEach(input => {
        input.addEventListener('input', (e) => {
          const project = e.target.dataset.project;
          const count = parseInt(e.target.value) || 0;
          buildRejectedRows(project, count);
        });
      });

      document.querySelector('form[action="/submit"]').addEventListener('submit', (e) => {
        let valid = true;
        let firstError = null;

        document.querySelectorAll('.rejected-input').forEach(input => {
          const project = input.dataset.project;
          const count = parseInt(input.value) || 0;
          if (count > 0) {
            const rows = document.querySelectorAll('#rejected-rows-' + project + ' .rejected-row');
            if (rows.length !== count) {
              valid = false;
              firstError = firstError || ('Project ' + project + ': expected ' + count + ' rejected defect rows, found ' + rows.length);
            } else {
              rows.forEach((row, idx) => {
                const jira = row.querySelector('[data-field=jira]').value.trim();
                const summary = row.querySelector('[data-field=summary]').value.trim();
                const reason = row.querySelector('[data-field=reason]').value.trim();
                if (!jira || !summary || !reason) {
                  valid = false;
                  firstError = firstError || ('Project ' + project + ', Rejected Defect #' + (idx+1) + ': all fields (JIRA ID, Issue Summary, Reason) are required');
                }
              });
            }
          }
        });

        if (!valid) {
          e.preventDefault();
          alert('Please fix the following before submitting:\\n\\n' + firstError);
        }
      });
    </script>
    </body></html>`);
});

// ===== SUBMIT HANDLER =====
app.post("/submit", async (req, res) => {
  try {
    const [weekLabel, weekStart, weekEnd] = req.body.week.split("|");
    const subTeam = req.body.sub_team.trim();
    const submittedBy = req.body.submitted_by.trim();

    const rows = PROJECTS.map(proj => {
      const get = (field) => req.body[`${proj}_${field}`] || "";
      const getNum = (field) => parseFloat(req.body[`${proj}_${field}`]) || 0;

      const hasNumericData = getNum("leaves") > 0 || getNum("requirements") > 0 ||
        getNum("ft_design_high_tcs") > 0 || getNum("ft_design_high_time") > 0 ||
        getNum("ft_design_medium_tcs") > 0 || getNum("ft_design_medium_time") > 0 ||
        getNum("ft_design_low_tcs") > 0 || getNum("ft_design_low_time") > 0 ||
        getNum("ft_exec_high_tcs") > 0 || getNum("ft_exec_high_time") > 0 ||
        getNum("ft_exec_medium_tcs") > 0 || getNum("ft_exec_medium_time") > 0 ||
        getNum("ft_exec_low_tcs") > 0 || getNum("ft_exec_low_time") > 0 ||
        getNum("rt_design_high_tcs") > 0 || getNum("rt_design_high_time") > 0 ||
        getNum("rt_design_medium_tcs") > 0 || getNum("rt_design_medium_time") > 0 ||
        getNum("rt_design_low_tcs") > 0 || getNum("rt_design_low_time") > 0 ||
        getNum("rt_exec_high_tcs") > 0 || getNum("rt_exec_high_time") > 0 ||
        getNum("rt_exec_medium_tcs") > 0 || getNum("rt_exec_medium_time") > 0 ||
        getNum("rt_exec_low_tcs") > 0 || getNum("rt_exec_low_time") > 0 ||
        getNum("func_defect_critical") > 0 || getNum("func_defect_high") > 0 ||
        getNum("func_defect_medium") > 0 || getNum("func_defect_low") > 0 ||
        getNum("func_defect_rejected") > 0 ||
        getNum("reg_defect_critical") > 0 || getNum("reg_defect_high") > 0 ||
        getNum("reg_defect_medium") > 0 || getNum("reg_defect_low") > 0 ||
        getNum("prod_defect_critical") > 0 || getNum("prod_defect_high") > 0 ||
        getNum("prod_defect_medium") > 0 || getNum("prod_defect_low") > 0;

      const hasResourceData = get("resource_count").trim() !== "" ||
        get("resource_activity").trim() !== "" ||
        get("resource_names").trim() !== "";

      if (!hasNumericData && !hasResourceData) return null;

      return {
        week_label: weekLabel, week_start_date: weekStart, week_end_date: weekEnd,
        sub_team: subTeam, submitted_by: submittedBy, project: proj,
        resource_count: get("resource_count"),
        resource_activity: get("resource_activity"),
        resource_names: get("resource_names"),
        leaves: getNum("leaves"), requirements: getNum("requirements"),
        ft_design_high_tcs: getNum("ft_design_high_tcs"), ft_design_high_time: getNum("ft_design_high_time"),
        ft_design_medium_tcs: getNum("ft_design_medium_tcs"), ft_design_medium_time: getNum("ft_design_medium_time"),
        ft_design_low_tcs: getNum("ft_design_low_tcs"), ft_design_low_time: getNum("ft_design_low_time"),
        ft_exec_high_tcs: getNum("ft_exec_high_tcs"), ft_exec_high_time: getNum("ft_exec_high_time"),
        ft_exec_medium_tcs: getNum("ft_exec_medium_tcs"), ft_exec_medium_time: getNum("ft_exec_medium_time"),
        ft_exec_low_tcs: getNum("ft_exec_low_tcs"), ft_exec_low_time: getNum("ft_exec_low_time"),
        rt_design_high_tcs: getNum("rt_design_high_tcs"), rt_design_high_time: getNum("rt_design_high_time"),
        rt_design_medium_tcs: getNum("rt_design_medium_tcs"), rt_design_medium_time: getNum("rt_design_medium_time"),
        rt_design_low_tcs: getNum("rt_design_low_tcs"), rt_design_low_time: getNum("rt_design_low_time"),
        rt_exec_high_tcs: getNum("rt_exec_high_tcs"), rt_exec_high_time: getNum("rt_exec_high_time"),
        rt_exec_medium_tcs: getNum("rt_exec_medium_tcs"), rt_exec_medium_time: getNum("rt_exec_medium_time"),
        rt_exec_low_tcs: getNum("rt_exec_low_tcs"), rt_exec_low_time: getNum("rt_exec_low_time"),
        func_defect_critical: getNum("func_defect_critical"), func_defect_high: getNum("func_defect_high"),
        func_defect_medium: getNum("func_defect_medium"), func_defect_low: getNum("func_defect_low"),
        func_defect_rejected: getNum("func_defect_rejected"),
        reg_defect_critical: getNum("reg_defect_critical"), reg_defect_high: getNum("reg_defect_high"),
        reg_defect_medium: getNum("reg_defect_medium"), reg_defect_low: getNum("reg_defect_low"),
        prod_defect_critical: getNum("prod_defect_critical"), prod_defect_high: getNum("prod_defect_high"),
        prod_defect_medium: getNum("prod_defect_medium"), prod_defect_low: getNum("prod_defect_low"),
      };
    }).filter(row => row !== null);

    if (rows.length === 0) {
      return res.send(`<p>No data entered for any project. <a href="/">Go back</a> and fill in at least one project.</p>`);
    }

    const { data: insertedRows, error } = await supabase.from("mainspring_entries").insert(rows).select();
    if (error) { console.log("Insert error:", error); return res.send(`<p>Error: ${error.message}</p>`); }

    // Insert rejected defects if any
    const rejectedRows = [];
    for (const proj of PROJECTS) {
      const rejectedCount = parseInt(req.body[`${proj}_func_defect_rejected`]) || 0;
      if (rejectedCount > 0) {
        const entryForProj = insertedRows.find(r => r.project === proj);
        if (!entryForProj) continue;

        for (let i = 0; i < rejectedCount; i++) {
          const jira = (req.body[`rejected_${proj}_${i}_jira`] || "").trim();
          const summary = (req.body[`rejected_${proj}_${i}_summary`] || "").trim();
          const reason = (req.body[`rejected_${proj}_${i}_reason`] || "").trim();
          const projectName = (req.body[`rejected_${proj}_${i}_project`] || proj).trim();
          if (jira || summary || reason) {
            rejectedRows.push({
              entry_id: entryForProj.id,
              project: projectName,
              jira_id: jira,
              issue_summary: summary,
              reason: reason
            });
          }
        }
      }
    }

    if (rejectedRows.length > 0) {
      const { error: rejectedError } = await supabase.from("rejected_defects").insert(rejectedRows);
      if (rejectedError) console.log("Rejected defects insert error:", rejectedError);
    }

    res.redirect("/?saved=1");
  } catch (err) {
    console.log("Submit error:", err);
    res.send(`<p>Error: ${err.message}</p>`);
  }
});

// ===== DASHBOARD =====
app.get("/dashboard", async (req, res) => {
  const selectedWeek = req.query.week || (WEEKS[0] ? WEEKS[0].label : "");

  const { data: allEntries } = await supabase.from("mainspring_entries").select("week_label").order("week_start_date", { ascending: false });
  const uniqueWeeks = [...new Set((allEntries || []).map(e => e.week_label))];
  const weekOptions = uniqueWeeks.map(w => `<option value="${w}" ${w === selectedWeek ? "selected" : ""}>${w}</option>`).join("");

  let entries = [];
  let rejectedDefects = [];
  if (selectedWeek) {
    const { data } = await supabase.from("mainspring_entries").select("*").eq("week_label", selectedWeek);
    entries = data || [];

    if (entries.length > 0) {
      const entryIds = entries.map(e => e.id);
      const { data: rejData } = await supabase.from("rejected_defects").select("*").in("entry_id", entryIds);
      rejectedDefects = rejData || [];
    }
  }

  function buildProjectView(projectName) {
    const projEntries = entries.filter(e => e.project === projectName);
    const numericFields = [
      "leaves", "requirements",
      "ft_design_high_tcs", "ft_design_high_time", "ft_design_medium_tcs", "ft_design_medium_time", "ft_design_low_tcs", "ft_design_low_time",
      "ft_exec_high_tcs", "ft_exec_high_time", "ft_exec_medium_tcs", "ft_exec_medium_time", "ft_exec_low_tcs", "ft_exec_low_time",
      "rt_design_high_tcs", "rt_design_high_time", "rt_design_medium_tcs", "rt_design_medium_time", "rt_design_low_tcs", "rt_design_low_time",
      "rt_exec_high_tcs", "rt_exec_high_time", "rt_exec_medium_tcs", "rt_exec_medium_time", "rt_exec_low_tcs", "rt_exec_low_time",
      "func_defect_critical", "func_defect_high", "func_defect_medium", "func_defect_low", "func_defect_rejected",
      "reg_defect_critical", "reg_defect_high", "reg_defect_medium", "reg_defect_low",
      "prod_defect_critical", "prod_defect_high", "prod_defect_medium", "prod_defect_low"
    ];

    const totals = {};
    numericFields.forEach(f => totals[f] = 0);
    let resourceRows = [];
    let totalResourceCount = 0;

    projEntries.forEach(e => {
      numericFields.forEach(f => totals[f] += parseFloat(e[f]) || 0);
      if (e.resource_count || e.resource_activity || e.resource_names) {
        const count = parseInt(e.resource_count) || 0;
        totalResourceCount += count;
        resourceRows.push({
          sub_team: e.sub_team, count: e.resource_count || "0",
          activity: e.resource_activity || "-", names: e.resource_names || "-",
          submitted_by: e.submitted_by
        });
      }
    });

    return { projEntries, totals, resourceRows, totalResourceCount };
  }

  const projectViews = PROJECTS.map(proj => {
    const v = buildProjectView(proj);
    if (v.projEntries.length === 0) {
      return `<details class="proj-collapse"><summary class="proj-summary"><span class="arrow">▶</span><span class="proj-name">${proj}</span><span class="proj-hint">No data submitted</span></summary><div class="proj-content"><div class="empty-state">No data submitted for ${proj} this week</div></div></details>`;
    }

    const resourceTableRows = v.resourceRows.map(r => `
      <tr>
        <td><strong style="color:#5b6ee1">${r.sub_team}</strong></td>
        <td style="text-align:center">${r.count}</td>
        <td>${r.activity}</td>
        <td>${r.names}</td>
        <td style="color:#718096;font-size:12px">${r.submitted_by}</td>
      </tr>
    `).join("");

    const contributorRows = v.projEntries.map(e => `
      <tr class="expanded-row">
        <td colspan="13" style="padding-left:30px">
          <strong style="color:#5b6ee1">${e.sub_team}</strong> (by ${e.submitted_by})
          - Resources: ${e.resource_count || "0"}, ${e.resource_activity || "-"} (${e.resource_names || "-"})
          | Leaves: ${e.leaves} | Reqs: ${e.requirements}
          <a href="/edit/${e.id}" class="btn btn-small" style="background:#5b6ee1;margin-left:10px">Edit</a>
          <a href="/delete/${e.id}" class="btn btn-small btn-danger" onclick="return confirm('Delete this entry?')">Delete</a>
        </td>
      </tr>
    `).join("");

    // Build rejected defects section for this project
    const projEntryIds = v.projEntries.map(e => e.id);
    const projRejected = rejectedDefects.filter(r => projEntryIds.includes(r.entry_id));
    let rejectedHtml = "";
    if (projRejected.length > 0) {
      const rejRows = projRejected.map(r => {
        const submitter = v.projEntries.find(e => e.id === r.entry_id);
        return `<tr>
          <td><strong>${r.jira_id || "-"}</strong></td>
          <td>${r.issue_summary || "-"}</td>
          <td>${r.reason || "-"}</td>
          <td style="color:#718096;font-size:12px">${submitter ? submitter.sub_team : "-"}</td>
          <td><a href="/edit-rejected/${r.id}" class="btn btn-small" style="background:#5b6ee1">Edit</a> <a href="/delete-rejected/${r.id}" class="delete-link" onclick="return confirm('Delete this rejected defect?')">Delete</a></td>
        </tr>`;
      }).join("");
      rejectedHtml = `<h3 style="margin-top:14px;color:#c2682a">Rejected Defects (${projRejected.length})</h3>
      <table>
        <tr><th>JIRA ID</th><th>Issue Summary</th><th>Reason for Rejection</th><th>Sub-Team</th><th>Actions</th></tr>
        ${rejRows}
      </table>`;
    }

    return `<details class="proj-collapse">
      <summary class="proj-summary">
        <span class="arrow">▶</span>
        <span class="proj-name">${proj}</span>
        <span class="proj-hint">${v.projEntries.length} submission(s) — click to expand</span>
      </summary>
      <div class="proj-content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0">${proj} Summary</h2>
        <button class="copy-btn" onclick="copyData('${proj}')">Copy Totals</button>
      </div>

      <div id="copyData-${proj}" style="display:none">
${proj} TOTALS for ${selectedWeek}
Total Resources: ${v.totalResourceCount}
Leaves: ${v.totals.leaves} | Requirements: ${v.totals.requirements}
${v.resourceRows.map(r => `${r.sub_team}: ${r.count}, ${r.activity} (${r.names})`).join("\n")}

FUNCTIONAL TESTING - Test Design:
High: ${v.totals.ft_design_high_tcs} TCs, ${v.totals.ft_design_high_time} hrs | Medium: ${v.totals.ft_design_medium_tcs} TCs, ${v.totals.ft_design_medium_time} hrs | Low: ${v.totals.ft_design_low_tcs} TCs, ${v.totals.ft_design_low_time} hrs

FUNCTIONAL TESTING - Test Execution:
High: ${v.totals.ft_exec_high_tcs} TCs, ${v.totals.ft_exec_high_time} hrs | Medium: ${v.totals.ft_exec_medium_tcs} TCs, ${v.totals.ft_exec_medium_time} hrs | Low: ${v.totals.ft_exec_low_tcs} TCs, ${v.totals.ft_exec_low_time} hrs

REGRESSION TESTING - Test Design:
High: ${v.totals.rt_design_high_tcs} TCs, ${v.totals.rt_design_high_time} hrs | Medium: ${v.totals.rt_design_medium_tcs} TCs, ${v.totals.rt_design_medium_time} hrs | Low: ${v.totals.rt_design_low_tcs} TCs, ${v.totals.rt_design_low_time} hrs

REGRESSION TESTING - Test Execution:
High: ${v.totals.rt_exec_high_tcs} TCs, ${v.totals.rt_exec_high_time} hrs | Medium: ${v.totals.rt_exec_medium_tcs} TCs, ${v.totals.rt_exec_medium_time} hrs | Low: ${v.totals.rt_exec_low_tcs} TCs, ${v.totals.rt_exec_low_time} hrs

DEFECTS:
Functional: Critical=${v.totals.func_defect_critical}, High=${v.totals.func_defect_high}, Medium=${v.totals.func_defect_medium}, Low=${v.totals.func_defect_low}, Rejected=${v.totals.func_defect_rejected}
Regression: Critical=${v.totals.reg_defect_critical}, High=${v.totals.reg_defect_high}, Medium=${v.totals.reg_defect_medium}, Low=${v.totals.reg_defect_low}
Production: Critical=${v.totals.prod_defect_critical}, High=${v.totals.prod_defect_high}, Medium=${v.totals.prod_defect_medium}, Low=${v.totals.prod_defect_low}
      </div>

      <h3>Resources Working on ${proj}</h3>
      <table>
        <tr><th>Sub-Team</th><th style="text-align:center;width:80px">Count</th><th>Activity</th><th>Resource Names</th><th style="width:120px">Submitted By</th></tr>
        ${resourceTableRows}
        <tr class="totals-row">
          <td><strong>TOTAL</strong></td>
          <td style="text-align:center"><strong>${v.totalResourceCount}</strong></td>
          <td colspan="3" style="color:#718096;font-size:12px">Sum of all resources working on this project</td>
        </tr>
      </table>

      <div style="margin-top:14px;background:#fafafa;padding:14px;border-radius:8px;border:1px solid #e2e8f0">
        <strong style="color:#5b6ee1">Total Leaves:</strong> ${v.totals.leaves} &nbsp;|&nbsp;
        <strong style="color:#5b6ee1">Total Requirements:</strong> ${v.totals.requirements}
      </div>

      <h3 style="margin-top:14px">Functional Testing</h3>
      <table>
        <tr><th></th><th>High TCs</th><th>High Hrs</th><th>Med TCs</th><th>Med Hrs</th><th>Low TCs</th><th>Low Hrs</th></tr>
        <tr class="totals-row"><td>Test Design</td><td>${v.totals.ft_design_high_tcs}</td><td>${v.totals.ft_design_high_time}</td><td>${v.totals.ft_design_medium_tcs}</td><td>${v.totals.ft_design_medium_time}</td><td>${v.totals.ft_design_low_tcs}</td><td>${v.totals.ft_design_low_time}</td></tr>
        <tr class="totals-row"><td>Test Execution</td><td>${v.totals.ft_exec_high_tcs}</td><td>${v.totals.ft_exec_high_time}</td><td>${v.totals.ft_exec_medium_tcs}</td><td>${v.totals.ft_exec_medium_time}</td><td>${v.totals.ft_exec_low_tcs}</td><td>${v.totals.ft_exec_low_time}</td></tr>
      </table>

      <h3 style="margin-top:14px">Regression Testing</h3>
      <table>
        <tr><th></th><th>High TCs</th><th>High Hrs</th><th>Med TCs</th><th>Med Hrs</th><th>Low TCs</th><th>Low Hrs</th></tr>
        <tr class="totals-row"><td>Test Design</td><td>${v.totals.rt_design_high_tcs}</td><td>${v.totals.rt_design_high_time}</td><td>${v.totals.rt_design_medium_tcs}</td><td>${v.totals.rt_design_medium_time}</td><td>${v.totals.rt_design_low_tcs}</td><td>${v.totals.rt_design_low_time}</td></tr>
        <tr class="totals-row"><td>Test Execution</td><td>${v.totals.rt_exec_high_tcs}</td><td>${v.totals.rt_exec_high_time}</td><td>${v.totals.rt_exec_medium_tcs}</td><td>${v.totals.rt_exec_medium_time}</td><td>${v.totals.rt_exec_low_tcs}</td><td>${v.totals.rt_exec_low_time}</td></tr>
      </table>

      <h3 style="margin-top:14px">Defects</h3>
      <table>
        <tr><th></th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Rejected</th></tr>
        <tr class="totals-row"><td>Functional</td><td>${v.totals.func_defect_critical}</td><td>${v.totals.func_defect_high}</td><td>${v.totals.func_defect_medium}</td><td>${v.totals.func_defect_low}</td><td>${v.totals.func_defect_rejected}</td></tr>
        <tr class="totals-row"><td>Regression</td><td>${v.totals.reg_defect_critical}</td><td>${v.totals.reg_defect_high}</td><td>${v.totals.reg_defect_medium}</td><td>${v.totals.reg_defect_low}</td><td>-</td></tr>
        <tr class="totals-row"><td>Production</td><td>${v.totals.prod_defect_critical}</td><td>${v.totals.prod_defect_high}</td><td>${v.totals.prod_defect_medium}</td><td>${v.totals.prod_defect_low}</td><td>-</td></tr>
      </table>

      ${rejectedHtml}

      <details style="margin-top:14px">
        <summary style="cursor:pointer;color:#5b6ee1;font-weight:bold;font-size:14px;padding:8px">▶ View Individual Sub-team Contributions (${v.projEntries.length} entries)</summary>
        <table style="margin-top:10px">
          ${contributorRows}
        </table>
      </details>
      </div>
    </details>`;
  }).join("");

  res.send(`<!DOCTYPE html><html><head><title>Dashboard — MainSpring Tracker</title>${getStyles()}</head><body>
    ${getNav("dashboard")}
    <div class="container">
      <h1>Weekly Dashboard</h1>
      <div class="card">
        <form method="GET" action="/dashboard" style="display:flex;gap:12px;align-items:flex-end">
          <div class="form-group" style="flex:1;margin-bottom:0">
            <label>Select Week to View</label>
            <select name="week" onchange="this.form.submit()">
              ${weekOptions || `<option>No data submitted yet</option>`}
            </select>
          </div>
        </form>
      </div>
      ${selectedWeek && entries.length > 0 ? `<div style="margin-bottom:14px;display:flex;gap:10px"><button type="button" onclick="toggleAllDash(true)" class="btn btn-small" style="background:#7fb069">Expand All</button><button type="button" onclick="toggleAllDash(false)" class="btn btn-small" style="background:#a0aec0">Collapse All</button></div>${projectViews}` : `<div class="card"><div class="empty-state">No data found. Go to Submit Data to add entries.</div></div>`}
    </div>
    <script>
      function copyData(proj) {
        const text = document.getElementById('copyData-' + proj).innerText;
        navigator.clipboard.writeText(text).then(() => alert('Copied ' + proj + ' totals to clipboard!'));
      }
      function toggleAllDash(open) {
        document.querySelectorAll('.proj-collapse').forEach(d => d.open = open);
      }
    </script>
  </body></html>`);
});

// ===== EDIT ENTRY =====
app.get("/edit/:id", async (req, res) => {
  const { data: entry, error } = await supabase.from("mainspring_entries").select("*").eq("id", req.params.id).single();
  if (error || !entry) return res.redirect("/dashboard");

  const fields = ["resource_count","resource_activity","resource_names","leaves","requirements",
    "ft_design_high_tcs","ft_design_high_time","ft_design_medium_tcs","ft_design_medium_time","ft_design_low_tcs","ft_design_low_time",
    "ft_exec_high_tcs","ft_exec_high_time","ft_exec_medium_tcs","ft_exec_medium_time","ft_exec_low_tcs","ft_exec_low_time",
    "rt_design_high_tcs","rt_design_high_time","rt_design_medium_tcs","rt_design_medium_time","rt_design_low_tcs","rt_design_low_time",
    "rt_exec_high_tcs","rt_exec_high_time","rt_exec_medium_tcs","rt_exec_medium_time","rt_exec_low_tcs","rt_exec_low_time",
    "func_defect_critical","func_defect_high","func_defect_medium","func_defect_low","func_defect_rejected",
    "reg_defect_critical","reg_defect_high","reg_defect_medium","reg_defect_low",
    "prod_defect_critical","prod_defect_high","prod_defect_medium","prod_defect_low"];

  const inputs = fields.map(f => {
    const isText = f.startsWith("resource_") && !f.includes("count");
    const type = isText ? "text" : (f === "resource_count" ? "text" : "number");
    const step = f === "leaves" ? ' step="0.5"' : '';
    return `<div class="form-group"><label>${f}</label><input class="compact-input" type="${type}"${step} name="${f}" value="${entry[f] || (type === 'number' ? 0 : '')}" /></div>`;
  }).join("");

  res.send(`<!DOCTYPE html><html><head><title>Edit Entry — MainSpring Tracker</title>${getStyles()}</head><body>
    ${getNav("dashboard")}
    <div class="container">
      <a href="/dashboard">← Back to Dashboard</a>
      <h1>Edit Entry: ${entry.sub_team} - ${entry.project} - ${entry.week_label}</h1>
      <div class="card">
        <form action="/update/${entry.id}" method="POST">
          <p style="color:#718096;margin-bottom:16px">Submitted by: ${entry.submitted_by}</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${inputs}</div>
          <button type="submit" class="btn btn-primary" style="margin-top:14px">Save Changes</button>
        </form>
      </div>
    </div></body></html>`);
});

app.post("/update/:id", async (req, res) => {
  const updates = { ...req.body };
  Object.keys(updates).forEach(k => {
    if (!k.startsWith("resource_")) updates[k] = parseFloat(updates[k]) || 0;
  });
  updates.updated_at = new Date().toISOString();
  await supabase.from("mainspring_entries").update(updates).eq("id", req.params.id);
  res.redirect("/dashboard");
});

app.get("/delete/:id", async (req, res) => {
  await supabase.from("mainspring_entries").delete().eq("id", req.params.id);
  res.redirect("/dashboard");
});

// ===== EDIT / DELETE REJECTED DEFECTS =====
app.get("/edit-rejected/:id", async (req, res) => {
  const { data: rej } = await supabase.from("rejected_defects").select("*").eq("id", req.params.id).single();
  if (!rej) return res.redirect("/dashboard");

  res.send(`<!DOCTYPE html><html><head><title>Edit Rejected Defect</title>${getStyles()}</head><body>
    ${getNav("dashboard")}
    <div class="container">
      <a href="/dashboard">← Back to Dashboard</a>
      <h1>Edit Rejected Defect — ${rej.project}</h1>
      <div class="card">
        <form action="/update-rejected/${rej.id}" method="POST">
          <div class="form-group"><label>Project *</label><input type="text" name="project" value="${rej.project}" required /></div>
          <div class="form-group"><label>JIRA ID *</label><input type="text" name="jira_id" value="${rej.jira_id || ''}" required /></div>
          <div class="form-group"><label>Issue Summary *</label><input type="text" name="issue_summary" value="${rej.issue_summary || ''}" required /></div>
          <div class="form-group"><label>Reason for Rejection *</label><input type="text" name="reason" value="${rej.reason || ''}" required /></div>
          <button type="submit" class="btn btn-primary" style="margin-top:10px">Save Changes</button>
        </form>
      </div>
    </div></body></html>`);
});

app.post("/update-rejected/:id", async (req, res) => {
  await supabase.from("rejected_defects").update({
    project: (req.body.project || "").trim(),
    jira_id: (req.body.jira_id || "").trim(),
    issue_summary: (req.body.issue_summary || "").trim(),
    reason: (req.body.reason || "").trim()
  }).eq("id", req.params.id);
  res.redirect("/dashboard");
});

app.get("/delete-rejected/:id", async (req, res) => {
  await supabase.from("rejected_defects").delete().eq("id", req.params.id);
  res.redirect("/dashboard");
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MainSpring Tracker running at http://localhost:${PORT}`);
  console.log(`Connected to Supabase: ${process.env.SUPABASE_URL}`);
});