# Self-hosted interface fonts

Instrument Sans supplies the interface and headings; IBM Plex Mono supplies numerical readouts, units, equations and compact coordinate labels. These files are bundled with the application. No browser request to a font provider is needed.

Downloaded on 2026-10-28 from the pinned Fontsource packages `@fontsource-variable/instrument-sans@5.3.0` and `@fontsource/ibm-plex-mono@5.3.0`, delivered by jsDelivr. `provenance.json` records every exact URL, byte count and SHA-256 hash. The downloaded font binaries are unmodified. Both families use the SIL Open Font License 1.1; the original license and copyright texts are retained beside the fonts.

- Instrument Sans: upright variable weight 400–700, Latin and Latin extended.
- IBM Plex Mono: upright regular 400 and medium 500, Latin and Latin extended.
- Font binaries total approximately 98 kB; Unicode ranges avoid loading unused subsets.

Load `/fonts/fonts.css` once. Use `"Instrument Sans", system-ui, sans-serif` and `"IBM Plex Mono", ui-monospace, monospace`. The CSS uses only relative local font URLs and `font-display: swap`. Do not add external font imports or preconnect requests.
