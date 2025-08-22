# Architecture Documentation

This folder contains the architecture documentation for the project. Each file is small, focused, and designed for easy maintenance.

Contents:
- system-architecture.md — System overview and runtime topology
- data-flow.md — Request/response flows and streaming
- dependencies.md — External services and libraries
- module-boundaries.md — Module ownership, interfaces, and DDD mapping
- refactoring-roadmap.md — Analysis, matrix, and step-by-step implementation plan

Conventions:
- No secrets or environment values are shown.
- Diagrams use Mermaid and reference concrete modules (e.g., `app/api/chat/route.ts`).
- File size kept <500 lines.
