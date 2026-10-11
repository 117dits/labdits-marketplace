<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## LABDITS architecture
- Keep TanStack Start file-based routing with small leaf route wrappers and shared view components; the fixed framework provides typed navigation and SSR.
- Keep this prototype entirely frontend-only behind a typed mock service adapter and shared MarketplaceProvider; backend replacements must not leak into presentation code.
- Read and write mock persistence only after hydration or from browser event handlers; SSR must render deterministic seed content.
- Use global semantic design tokens, shadcn buttons, Motion with reduced-motion support, and bundled preview assets; this keeps branding and accessibility consistent.
