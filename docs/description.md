# Overview

This block bridges two VDJ datasets by finding clonotypes that appear in both. It is designed for antibody discovery workflows where researchers need to combine a deep target dataset (typically bulk sequencing — broad coverage, no chain pairing) with a reference dataset (typically single-cell sequencing — paired chains, smaller scale).

The block performs exact matching on the widest sequence region shared by both datasets (e.g. VDJRegion or CDR3), in either nucleotide or amino acid alphabet, with optional V and J gene matching at gene level. When a clonotype matches multiple candidates, the block selects the most abundant match and reports a confidence score — 1.0 for unique matches, lower for ambiguous ones.

After running, any column from the reference dataset — paired chains, liabilities, cluster labels, abundance — becomes accessible on the matched target clonotypes in downstream blocks such as Lead Selection, GraphMaker, and SHM Trees. A match summary shows how many clonotypes from each side were matched.
