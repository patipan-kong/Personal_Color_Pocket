# Today Outfit V1 — Session Look Collection

Today configuration produces a session-only Look Collection with a maximum of three Looks:

`Today configuration → session Look Collection (max 3) → optional independent Preview per Look`

Looks are alternatives, not rankings. Their number is generation order only and carries no quality meaning. The collection is held in React session state; it is not written to `localStorage`, so a refresh or remount may reset it.

The first action creates Look 1. Once a valid Look exists, **Add Another Look** appends a new structured recommendation and never replaces an existing Look. Before generation, all current Look signatures are sent as a bounded exclusion set (zero, one, or two entries in V1). Owned signatures contain the selected wardrobe IDs. Inspiration signatures contain garment types and the authoritative canonical/generic color identities. Provider prose is never used for comparison.

Correctness remains stronger than novelty: gender-allowed Inspiration garments, occasion rules, Owned inventory, Personal Color behavior, and Lucky Color's soft-preference semantics still apply. A duplicate provider result is rejected and the deterministic fallback receives the same exclusions. If no distinct valid combination exists, all existing Looks remain and the app explains that no different option is currently available.

Each Look keeps its exact request snapshot, structured recommendation, app-owned explanations, source semantics, and its own Preview state. A Preview is idle, loading, successful, or failed independently of every other Look. Adding a Look never requests an image. Successful images remain visible and have no regeneration action; a failed Preview alone offers **Try Preview Again**. Multiple successful images may coexist.

## Saved Outfits and optional image persistence

Saving a Look persists its structured snapshot independently of the session collection. If the Look already has a successful Preview, the explicit save action may copy those existing bytes into IndexedDB as a Blob and store only an opaque `previewImageId` in Saved Outfit metadata. It makes no new image or recommendation request. Saving a Look without a Preview stores no image reference and never starts Preview generation.

If a Look was saved first and previewed later, **Save Preview to Saved Outfit** is an explicit attachment action. There is no hidden synchronization. Missing, corrupt, unavailable, or quota-blocked image storage never removes the structured Saved Outfit; the Saved Outfits screen falls back to app-owned garment and color cards. Deleting a Saved Outfit deletes only its associated Blob and metadata. Saved Outfits and Saved Preview Blobs survive Today context resets, locale/profile changes, and app remounts, and stay local to the browser in V1.

Image data URLs are never written to localStorage. Structured Saved Outfit metadata remains authoritative; persisted images are illustrative enhancement data.

Changing a recommendation-relevant input clears the collection without auto-generating replacements. Inspiration ignores unrelated wardrobe mutations; Owned request fingerprints include the relevant wardrobe facts. Changing locale preserves Looks, generation order, images, and safe Preview state while relocalizing app-owned copy and alt text, with zero recommendation or image calls. Explicit actions are guarded against duplicate requests and remain StrictMode-safe.
