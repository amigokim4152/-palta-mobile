# Chile Curriculum Registry v1

## Purpose

Create a source-linked, versioned map of Chilean education that can later power Palta Education without copying the curriculum into a separate silo.

## Current framework baseline (checked 2026-09-18)

MINEDUC's 2026 guidance identifies the current 1°-6° Básico Bases Curriculares as Decretos 433 and 439 of 2012. The temporary curriculum prioritization ended in December 2025; schools return to the current Bases Curriculares in 2026.

The registry therefore distinguishes `current`, `proposed`, `superseded`, and `retired`. Public-consultation proposals are never silently treated as current curriculum.

## First vertical slice

The seed includes:
- framework identity for 1°-6° Básico;
- the core 1° Básico subjects;
- source-linked objective references for `MA01 OA 01` and `LE01 OA 01`;
- links from those OA references to canonical Palta concept IDs.

Full official OA text is not required in the canonical registry. Store source identity, code and concept mapping; preserve copyright/license metadata before reusing third-party materials.

## Growth path

1. Finish 1° Básico objective registry by subject.
2. Add official resources and license/reuse metadata.
3. Map each OA to one or more canonical Knowledge concepts.
4. Add Learning Nodes: prerequisite, explanation level, misconception, practice, understanding check and next node.
5. Repeat grade-by-grade through 6° Básico before expanding to secondary levels.
6. Project relevant published knowledge to Palta Home without putting private learner state into public Knowledge.

## Non-goals for v1

- No production DB migration is applied.
- No student profile or progress is stored in canonical public tables.
- No automatic AI publication.
- No forked Education content database.
