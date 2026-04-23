# FuFan-VibeCodingCourse

Vibe Coding AI 编程实战课 — 赋能金牌讲师团课程仓库。

## Course Structure Convention

### Folder Naming

```
Stage{N}_{Topic_In_English}/
└── Lesson{NN}_{Topic_In_English}/
    └── CourseWare/          # slides + live collaboration files
    └── {ProjectFolder}/     # project source code (added after live session)
```

- **Stage**: numbered sequentially (Stage1, Stage2, ...), English topic name in snake_case
- **Lesson**: globally sequential across all stages (Lesson01 ~ LessonNN)
- **CourseWare**: contains `.pptx` and `.excalidraw` files, numbered to match lesson order (e.g. `06_OpenSpec.pptx`)
- **Project folder**: added after the live session, name reflects the project (e.g. `AgentTeamProject`, `GraphRAGAgent`)

### README Convention

Each Stage folder must have `README.md` (English) and `README_CN.md` (Chinese):

- **Title**: `# Stage N: {Topic}` (EN) / `# 阶段N：{Topic}` (CN)
- **Sections**: Objectives → Lessons (with links) → Project Structure → Courseware → Learning Outcomes
- **Language toggle**: `English | [中文](./README_CN.md)` at top

### Terminology

- Use **Stage** (not Week) in English
- Use **阶段** (not 周) in Chinese
- Consistent across all README files and root README

### Commit Messages

- English only, concise and professional
- Use conventional commit prefixes: `feat:`, `docs:`, `refactor:`, etc.
- Do not expose internal process details

## Current Stage Map

| Stage | Topic | Lessons |
|-------|-------|---------|
| 00_Introduction | Environment Setup | Intro 01-04 |
| Stage1_AI_Programming_Fundamentals | AI Programming | Lesson 01-02 |
| Stage2_Cursor_Deep_Dive | Cursor IDE | Lesson 03-04 |
| Stage3_Claude_Code_Engineering | Claude Code | Lesson 05-06 + Bonus |
| Stage4_Enterprise_Practice | Enterprise | Lesson 07 |
| Stage5_OpenSpec_Applied | OpenSpec | Lesson 08-09 |
| Stage6_SpecKit_Applied | Spec-Kit | Lesson 10-11 |
