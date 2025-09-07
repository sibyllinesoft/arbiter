╭──────────────────────────────────────────────────────────────────────────────╮
│                                                                              │
│                 ⚙️  Valknut v0.1.0 - AI-Powered Code Analysis                 │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
✅ Using default configuration

📂 Validating Input Paths
  📁 Directory: .

📁 Output directory: /media/nathan/Seagate Hub/Projects/arbiter/out
📊 Report format: MARKDOWN

🔍 Starting Analysis Pipeline
🔍 DEBUG: Pipeline calling adapter.parse_index on TypeScriptAdapter
🔍 DEBUG: Adapter methods: ['available', 'call_graph', 'cohesion_features', 'discover', 'entities', 'exception_features', 'file_extensions', 'import_graph', 'import_patterns', 'language', 'node_type_mapping', 'parse_index', 'parser_language_function', 'parser_module', 'status', 'type_features']
🔍 DEBUG: Got 1888 entities from adapter
🔍 DEBUG: First entity: db-coverage.test.ts, raw_text=PRESENT
📂 Discovering files...    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
🔄 Parsing code...         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
📊 Analyzing complexity... ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
🏆 Ranking entities...     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
╭────────────────────────────── Analysis Results ──────────────────────────────╮
│                                                                              │
│   📄 Files Analyzed     237                                                  │
│   🏢 Code Entities      1,978                                                │
│   ⏱️  Processing Time    10.79s                                               │
│   🏆 Health Score       🔴 52.9/100                                          │
│   ⚠️  Priority Issues    ✅ 0                                                 │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯

📝 Generating Reports
📊 Team report (markdown): out/team_report.md
🎯 Health Score: 90.5/100
⚠️  Priority Issues: 0
🔧 Refactoring Recommendations: 0
⠋ MARKDOWN report generated

✅ Analysis Complete!

📁 Results saved to: /media/nathan/Seagate Hub/Projects/arbiter/out

📊 Quick Insights:

🔥 Top Issues Requiring Attention:
  1. 🟢 Toast (score: 0.471)
  2. 🟢 initializeSchema (score: 0.471)
  3. 🟢 syncInitialProjectData (score: 0.472)
  4. 🟢 handleRequest (score: 0.473)
  5. 🟢 detectManifests (score: 0.473)

🏆 Quick Wins Available: 100 entities with moderate complexity

📢 Next Steps:
   1. Review the generated markdown report for detailed findings
   2. Address high-priority issues identified in the analysis
   3. Consider running analysis regularly to track improvements

📝 Tip: The markdown report is ready for your team wiki or documentation
