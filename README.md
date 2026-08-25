# VDJ Integration

Bring paired-chain and reference data onto a bulk repertoire. This Platforma block matches clonotypes between two V(D)J datasets — typically a deep bulk dataset and a smaller single-cell reference — so any property from the reference becomes available on the matched bulk clonotypes.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

## What it does

Bulk and single-cell sequencing trade off against each other. Bulk gives depth — hundreds of thousands of clonotypes — but no chain pairing. Single-cell gives pairing but at a fraction of the scale. Antibody discovery usually wants both: the depth to find rare candidates and the pairing to express them.

This block bridges the two. It finds clonotypes present in both datasets and carries the reference's information onto the target. Matching runs on the widest sequence region the two datasets share — the full VDJ region when both have it, CDR3 otherwise — in nucleotide or amino acid alphabet, with optional V and J gene matching at gene level to tighten the criteria.

Ambiguity is handled explicitly rather than silently. When a target clonotype matches several reference candidates, the block picks the most abundant and reports a **confidence score**: 1.0 for a unique match, lower when the match was ambiguous. That means an ambiguous match is visible in the data instead of indistinguishable from a certain one.

Once matched, *any* column from the reference becomes accessible on the matched target clonotypes — paired chains, liabilities, cluster labels, abundance — and usable in [Lead Selection](https://github.com/platforma-open/antibody-tcr-lead-selection), [Graph Maker](https://github.com/platforma-open/graph-maker), [MiXCR SHM Trees](https://github.com/platforma-open/mixcr-shm-trees), and the rest. A match summary reports how many clonotypes from each side were matched, so you can see the join's coverage before relying on it.

## Inputs & outputs

* **Input:** two V(D)J datasets — a **target** repertoire (typically bulk: deep, unpaired) and a **reference** repertoire (typically single-cell: paired, smaller). Both from any Platforma clonotyping or import block.
* **Output:** the match linking target clonotypes to reference clonotypes with a per-match confidence score, making every reference column available on matched target clonotypes downstream, plus a match summary.

## Specifications

| | |
|---|---|
| Block title in app | VDJ Integration |
| Matching | Exact match on the widest sequence region shared by both datasets (e.g. VDJRegion or CDR3) |
| Alphabet | Nucleotide or amino acid |
| Optional criteria | V and J gene matching at gene level |
| Ambiguity handling | Most abundant candidate selected; confidence score of 1.0 for unique matches, lower when ambiguous |
| Result | Any reference column becomes accessible on matched target clonotypes |
| Reporting | Match summary showing how many clonotypes matched from each side |

## Use cases

* **Add chain pairing to bulk data:** recover heavy–light pairing for bulk clonotypes that appear in a single-cell reference.
* **Depth plus pairing:** search deeply in bulk, then express only the candidates whose pairing is known.
* **Carry annotations across datasets:** bring liabilities, cluster labels, or scores computed on the reference onto the bulk repertoire.
* **Cross-timepoint tracking:** match a repertoire against a reference from another timepoint to follow specific clonotypes.
* **Validate a bulk hit:** confirm that a candidate found in bulk also appears in an independently sequenced reference.
* **Enable paired-chain downstream analysis:** make bulk clonotypes usable in blocks that need both chains.

## FAQ

### What is the difference between the target and reference dataset?

The target is the dataset you want to enrich — usually the deep bulk repertoire where your candidates live. The reference is the dataset carrying the extra information you want — usually a single-cell run with paired chains, or a dataset already annotated with properties you want to reuse.

### What does it match on?

The widest sequence region both datasets share, so the full VDJ region when both have it and CDR3 when that is all there is. You choose nucleotide or amino acid, and can optionally require V and J gene agreement as well.

### What happens when a clonotype matches more than one candidate?

The most abundant candidate is selected, and the confidence score drops below 1.0 to record that the match was ambiguous. Filtering on confidence lets you keep only unambiguous matches when that matters.

### What should I do with the confidence score?

Treat 1.0 as a unique, unambiguous match. Lower values mean several reference clonotypes were plausible. For anything where the wrong pairing would be expensive — expression, for instance — filter to unique matches.

### Which reference columns become available?

All of them. After matching, any column on the reference dataset — paired chain sequences, liabilities, cluster assignments, abundances, scores — is accessible on the matched target clonotypes in downstream blocks.

### How do I know if the join worked?

The match summary reports how many clonotypes matched from each side. Low coverage usually means the matching region or alphabet is too strict for the two datasets, or that they genuinely share little.

### Can I match amino acid instead of nucleotide?

Yes. Amino acid matching is more permissive, since it merges synonymous nucleotide variants — often what you want when the two datasets were produced by different pipelines.

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the docs for antibody discovery at [docs.platforma.bio/biology-guides/antibody-discovery](https://docs.platforma.bio/biology-guides/antibody-discovery/).
